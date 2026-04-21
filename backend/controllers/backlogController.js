const mongoose = require("mongoose");
const Epic = require("../models/Epic");
const Issue = require("../models/Issue");
const Sprint = require("../models/Sprint");
const asyncHandler = require("../utils/asyncHandler");
const {
  getBacklogPermissions,
  loadReadableProject,
} = require("../utils/backlogAccess");
const { serializeProjectsWithRelations } = require("../utils/projectRelations");
const { populateIssueQuery, serializeIssues } = require("../utils/issuePresentation");

const escapeRegExp = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseDateFilterInput = (value, label, { endOfDay = false } = {}) => {
  if (!value) {
    return {
      value: null,
    };
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return {
      error: {
        status: 400,
        message: `Invalid ${label}`,
      },
    };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) {
    if (endOfDay) {
      parsedValue.setHours(23, 59, 59, 999);
    } else {
      parsedValue.setHours(0, 0, 0, 0);
    }
  }

  return {
    value: parsedValue,
  };
};

const buildBacklogIssueQuery = async (req, project) => {
  const query = {
    projectId: project._id,
  };

  if (req.query.teamId && req.query.teamId !== "all") {
    if (!mongoose.isValidObjectId(req.query.teamId)) {
      return {
        error: {
          status: 400,
          message: "Invalid team id filter",
        },
      };
    }

    query.teamId = req.query.teamId;
  }

  if (req.query.assigneeId && req.query.assigneeId !== "all") {
    if (!mongoose.isValidObjectId(req.query.assigneeId)) {
      return {
        error: {
          status: 400,
          message: "Invalid assignee filter",
        },
      };
    }

    query.assignee = req.query.assigneeId;
  }

  if (req.query.epicId && req.query.epicId !== "all") {
    if (req.query.epicId === "unassigned") {
      query.epicId = null;
    } else {
      if (!mongoose.isValidObjectId(req.query.epicId)) {
        return {
          error: {
            status: 400,
            message: "Invalid epic filter",
          },
        };
      }

      query.epicId = req.query.epicId;
    }
  }

  if (req.query.search?.trim()) {
    const searchExpression = new RegExp(
      escapeRegExp(req.query.search.trim()),
      "i"
    );

    query.$or = [{ title: searchExpression }, { description: searchExpression }];
  }

  if (req.query.dateFrom || req.query.dateTo) {
    const dateFromResult = parseDateFilterInput(req.query.dateFrom, "start date");
    const dateToResult = parseDateFilterInput(req.query.dateTo, "end date", {
      endOfDay: true,
    });

    if (dateFromResult.error) {
      return dateFromResult;
    }

    if (dateToResult.error) {
      return dateToResult;
    }

    if (
      dateFromResult.value &&
      dateToResult.value &&
      dateFromResult.value > dateToResult.value
    ) {
      return {
        error: {
          status: 400,
          message: "Start date must be before the end date",
        },
      };
    }

    query.createdAt = {};

    if (dateFromResult.value) {
      query.createdAt.$gte = dateFromResult.value;
    }

    if (dateToResult.value) {
      query.createdAt.$lte = dateToResult.value;
    }
  }

  return {
    query,
  };
};

const serializeSprint = (sprint, issues = []) => ({
  _id: sprint._id,
  projectId: sprint.projectId,
  teamId: sprint.teamId,
  name: sprint.name,
  goal: sprint.goal || "",
  state: sprint.state,
  startDate: sprint.startDate,
  endDate: sprint.endDate,
  startedAt: sprint.startedAt,
  completedAt: sprint.completedAt,
  snapshot: sprint.snapshot || null,
  createdAt: sprint.createdAt,
  updatedAt: sprint.updatedAt,
  issueCount: issues.length,
  completedCount: issues.filter((issue) => issue.status === "DONE").length,
});

const getBacklogBoard = asyncHandler(async (req, res) => {
  const projectId = req.query.projectId;

  if (!projectId || !mongoose.isValidObjectId(projectId)) {
    res.status(400);
    throw new Error("A valid project id is required");
  }

  const project = await loadReadableProject(req.user, projectId);

  if (!project) {
    res.status(404);
    throw new Error("Project not found or inaccessible");
  }

  const [serializedProject] = await serializeProjectsWithRelations([project]);
  const issueQueryResult = await buildBacklogIssueQuery(req, project);

  if (issueQueryResult.error) {
    res.status(issueQueryResult.error.status);
    throw new Error(issueQueryResult.error.message);
  }

  const includeCompletedSprints =
    String(req.query.includeCompletedSprints || "false").toLowerCase() === "true";
  const issueQuery = issueQueryResult.query;
  const sprintQuery = {
    projectId: project._id,
  };

  if (req.query.teamId && req.query.teamId !== "all") {
    sprintQuery.teamId = req.query.teamId;
  }

  if (!includeCompletedSprints) {
    sprintQuery.state = {
      $in: ["ACTIVE", "PLANNED"],
    };
  }

  const [issues, epics, sprints] = await Promise.all([
    populateIssueQuery(
      Issue.find(issueQuery).sort({
        sprintId: 1,
        planningOrder: 1,
        createdAt: -1,
      })
    ),
    Epic.find({
      projectId: project._id,
    })
      .sort({
        planningOrder: 1,
        createdAt: 1,
      })
      .lean(),
    Sprint.find(sprintQuery)
      .populate("teamId", "name description workspaceId")
      .sort({
        state: 1,
        startDate: 1,
        createdAt: 1,
      })
      .lean(),
  ]);
  const serializedIssues = serializeIssues(issues);
  const visibleIssueIds = new Set(serializedIssues.map((issue) => String(issue._id)));
  const epicCounts = serializedIssues.reduce((map, issue) => {
    const epicId = String(issue?.epicId?._id || issue?.epicId || "unassigned");
    map.set(epicId, (map.get(epicId) || 0) + 1);
    return map;
  }, new Map());
  const backlogIssues = serializedIssues.filter((issue) => !issue.sprintId);
  const sprintSections = sprints.map((sprint) => {
    const sprintIssues = serializedIssues.filter(
      (issue) => String(issue?.sprintId?._id || issue?.sprintId || "") === String(sprint._id)
    );

    return {
      sprint: serializeSprint(sprint, sprintIssues),
      issues: sprintIssues,
    };
  });

  res.status(200).json({
    project: serializedProject,
    permissions: getBacklogPermissions(req.user, project),
    epics: epics.map((epic) => ({
      ...epic,
      issueCount: epicCounts.get(String(epic._id)) || 0,
    })),
    backlogIssues,
    sprintSections,
    summary: {
      totalVisibleIssues: visibleIssueIds.size,
      backlogIssueCount: backlogIssues.length,
      activeSprintCount: sprintSections.filter(
        (section) => section.sprint.state === "ACTIVE"
      ).length,
      plannedSprintCount: sprintSections.filter(
        (section) => section.sprint.state === "PLANNED"
      ).length,
      completedSprintCount: sprintSections.filter(
        (section) => section.sprint.state === "COMPLETED"
      ).length,
    },
  });
});

module.exports = {
  getBacklogBoard,
};
