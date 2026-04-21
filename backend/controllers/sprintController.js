const mongoose = require("mongoose");
const Issue = require("../models/Issue");
const ProjectTeam = require("../models/ProjectTeam");
const Sprint = require("../models/Sprint");
const Team = require("../models/Team");
const asyncHandler = require("../utils/asyncHandler");
const {
  canManageProjectPlanning,
  loadReadableProject,
} = require("../utils/backlogAccess");
const { recordIssueHistory } = require("../utils/issueHistory");
const {
  PLANNING_ORDER_INCREMENT,
  getNextPlanningOrder,
} = require("../utils/planningOrder");
const { populateIssueQuery, serializeIssues } = require("../utils/issuePresentation");
const { normalizeWorkspaceId } = require("../utils/workspace");

const parseOptionalDate = (value, label) => {
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

  return {
    value: parsedValue,
  };
};

const ensureSprintTeamForProject = async ({ projectId, teamId, workspaceId }) => {
  if (!teamId) {
    return {
      team: null,
    };
  }

  if (!mongoose.isValidObjectId(teamId)) {
    return {
      error: {
        status: 400,
        message: "Invalid team id",
      },
    };
  }

  const [team, projectTeamLink] = await Promise.all([
    Team.findOne({
      _id: teamId,
      workspaceId: normalizeWorkspaceId(workspaceId),
    })
      .select("_id name workspaceId")
      .lean(),
    ProjectTeam.findOne({
      projectId,
      teamId,
    })
      .select("_id")
      .lean(),
  ]);

  if (!team) {
    return {
      error: {
        status: 404,
        message: "Selected team could not be found in this workspace",
      },
    };
  }

  if (!projectTeamLink) {
    return {
      error: {
        status: 400,
        message: "Selected team is not attached to this project",
      },
    };
  }

  return {
    team,
  };
};

const serializeSprint = (sprint, issues = []) => ({
  _id: sprint._id,
  projectId: sprint.projectId,
  teamId: sprint.teamId,
  workspaceId: sprint.workspaceId,
  name: sprint.name,
  goal: sprint.goal || "",
  state: sprint.state,
  startDate: sprint.startDate,
  endDate: sprint.endDate,
  startedAt: sprint.startedAt,
  completedAt: sprint.completedAt,
  snapshot: sprint.snapshot || null,
  createdBy: sprint.createdBy,
  completedBy: sprint.completedBy,
  createdAt: sprint.createdAt,
  updatedAt: sprint.updatedAt,
  issueCount: issues.length,
  completedCount: issues.filter((issue) => issue.status === "DONE").length,
});

const ensureSprintManagementAccess = async (user, sprint) => {
  const project = await loadReadableProject(user, sprint.projectId);

  if (!project) {
    return {
      error: {
        status: 404,
        message: "Project not found or inaccessible",
      },
    };
  }

  if (!canManageProjectPlanning(user, project)) {
    return {
      error: {
        status: 403,
        message: "You do not have permission to manage sprints for this project",
      },
    };
  }

  return {
    project,
  };
};

const validateActiveSprintOverlap = async (sprint) => {
  if (sprint.teamId) {
    const conflictingSprint = await Sprint.findOne({
      _id: {
        $ne: sprint._id,
      },
      projectId: sprint.projectId,
      state: "ACTIVE",
      $or: [{ teamId: null }, { teamId: sprint.teamId }],
    })
      .select("_id")
      .lean();

    if (conflictingSprint) {
      return {
        error: {
          status: 409,
          message:
            "This sprint overlaps with an existing active sprint in the same project scope",
        },
      };
    }
  } else {
    const conflictingSprint = await Sprint.findOne({
      _id: {
        $ne: sprint._id,
      },
      projectId: sprint.projectId,
      state: "ACTIVE",
    })
      .select("_id")
      .lean();

    if (conflictingSprint) {
      return {
        error: {
          status: 409,
          message: "This project already has an active sprint",
        },
      };
    }
  }

  return {
    value: true,
  };
};

const getSprints = asyncHandler(async (req, res) => {
  const { projectId, teamId, state } = req.query;

  if (!projectId || !mongoose.isValidObjectId(projectId)) {
    res.status(400);
    throw new Error("A valid project id is required");
  }

  const project = await loadReadableProject(req.user, projectId);

  if (!project) {
    res.status(404);
    throw new Error("Project not found or inaccessible");
  }

  const query = {
    projectId,
    workspaceId: normalizeWorkspaceId(req.user.workspaceId),
  };

  if (teamId && teamId !== "all") {
    if (!mongoose.isValidObjectId(teamId)) {
      res.status(400);
      throw new Error("Invalid team id filter");
    }

    query.teamId = teamId;
  }

  if (state && state !== "all") {
    query.state = state;
  }

  const sprints = await Sprint.find(query)
    .populate("teamId", "name description workspaceId")
    .sort({
      startDate: 1,
      createdAt: 1,
    })
    .lean();

  res.status(200).json(sprints.map((sprint) => serializeSprint(sprint)));
});

const getSprintIssues = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid sprint id");
  }

  const sprint = await Sprint.findById(req.params.id)
    .populate("teamId", "name description workspaceId")
    .lean();

  if (!sprint) {
    res.status(404);
    throw new Error("Sprint not found");
  }

  const accessResult = await ensureSprintManagementAccess(req.user, sprint);

  if (accessResult.error) {
    res.status(accessResult.error.status);
    throw new Error(accessResult.error.message);
  }

  const issues = await populateIssueQuery(
    Issue.find({
      sprintId: sprint._id,
    }).sort({
      planningOrder: 1,
      createdAt: 1,
    })
  );

  res.status(200).json({
    sprint: serializeSprint(sprint, serializeIssues(issues)),
    issues: serializeIssues(issues),
  });
});

const createSprint = asyncHandler(async (req, res) => {
  const {
    projectId,
    teamId = null,
    name,
    goal = "",
    startDate = null,
    endDate = null,
  } = req.body;

  if (!projectId || !mongoose.isValidObjectId(projectId)) {
    res.status(400);
    throw new Error("A valid project id is required");
  }

  if (!name || !String(name).trim()) {
    res.status(400);
    throw new Error("Sprint name is required");
  }

  const project = await loadReadableProject(req.user, projectId);

  if (!project) {
    res.status(404);
    throw new Error("Project not found or inaccessible");
  }

  if (!canManageProjectPlanning(req.user, project)) {
    res.status(403);
    throw new Error("You do not have permission to create sprints for this project");
  }

  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const teamResult = await ensureSprintTeamForProject({
    projectId,
    teamId,
    workspaceId,
  });

  if (teamResult.error) {
    res.status(teamResult.error.status);
    throw new Error(teamResult.error.message);
  }

  const startDateResult = parseOptionalDate(startDate, "start date");
  const endDateResult = parseOptionalDate(endDate, "end date");

  if (startDateResult.error) {
    res.status(startDateResult.error.status);
    throw new Error(startDateResult.error.message);
  }

  if (endDateResult.error) {
    res.status(endDateResult.error.status);
    throw new Error(endDateResult.error.message);
  }

  if (
    startDateResult.value &&
    endDateResult.value &&
    startDateResult.value > endDateResult.value
  ) {
    res.status(400);
    throw new Error("Sprint start date must be before the end date");
  }

  const sprint = await Sprint.create({
    projectId,
    teamId: teamResult.team?._id || null,
    workspaceId,
    name: String(name).trim(),
    goal: typeof goal === "string" ? goal.trim() : "",
    state: "PLANNED",
    startDate: startDateResult.value,
    endDate: endDateResult.value,
    createdBy: req.user._id,
  });

  await sprint.populate("teamId", "name description workspaceId");

  res.status(201).json(serializeSprint(sprint.toObject()));
});

const updateSprint = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid sprint id");
  }

  const sprint = await Sprint.findById(req.params.id);

  if (!sprint) {
    res.status(404);
    throw new Error("Sprint not found");
  }

  const accessResult = await ensureSprintManagementAccess(req.user, sprint);

  if (accessResult.error) {
    res.status(accessResult.error.status);
    throw new Error(accessResult.error.message);
  }

  if (sprint.state === "COMPLETED") {
    res.status(400);
    throw new Error("Completed sprints cannot be edited");
  }

  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);

  if (Object.prototype.hasOwnProperty.call(req.body, "teamId")) {
    if (sprint.state !== "PLANNED") {
      res.status(400);
      throw new Error("Sprint team scope can only be changed while the sprint is planned");
    }

    const teamResult = await ensureSprintTeamForProject({
      projectId: sprint.projectId,
      teamId: req.body.teamId || null,
      workspaceId,
    });

    if (teamResult.error) {
      res.status(teamResult.error.status);
      throw new Error(teamResult.error.message);
    }

    sprint.teamId = teamResult.team?._id || null;
  }

  const startDateResult = parseOptionalDate(req.body.startDate, "start date");
  const endDateResult = parseOptionalDate(req.body.endDate, "end date");

  if (startDateResult.error) {
    res.status(startDateResult.error.status);
    throw new Error(startDateResult.error.message);
  }

  if (endDateResult.error) {
    res.status(endDateResult.error.status);
    throw new Error(endDateResult.error.message);
  }

  if (
    startDateResult.value &&
    endDateResult.value &&
    startDateResult.value > endDateResult.value
  ) {
    res.status(400);
    throw new Error("Sprint start date must be before the end date");
  }

  ["name", "goal"].forEach((field) => {
    if (typeof req.body[field] !== "undefined") {
      sprint[field] = typeof req.body[field] === "string" ? req.body[field].trim() : req.body[field];
    }
  });

  if (typeof req.body.startDate !== "undefined") {
    sprint.startDate = startDateResult.value;
  }

  if (typeof req.body.endDate !== "undefined") {
    sprint.endDate = endDateResult.value;
  }

  await sprint.save();
  await sprint.populate("teamId", "name description workspaceId");

  res.status(200).json(serializeSprint(sprint.toObject()));
});

const deleteSprint = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid sprint id");
  }

  const sprint = await Sprint.findById(req.params.id);

  if (!sprint) {
    res.status(404);
    throw new Error("Sprint not found");
  }

  const accessResult = await ensureSprintManagementAccess(req.user, sprint);

  if (accessResult.error) {
    res.status(accessResult.error.status);
    throw new Error(accessResult.error.message);
  }

  if (sprint.state !== "PLANNED") {
    res.status(400);
    throw new Error("Only planned sprints can be deleted");
  }

  const issueCount = await Issue.countDocuments({
    sprintId: sprint._id,
  });

  if (issueCount > 0) {
    res.status(409);
    throw new Error("Move all issues out of the sprint before deleting it");
  }

  await Sprint.deleteOne({
    _id: sprint._id,
  });

  res.status(200).json({
    message: "Sprint deleted successfully",
  });
});

const startSprint = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid sprint id");
  }

  const sprint = await Sprint.findById(req.params.id);

  if (!sprint) {
    res.status(404);
    throw new Error("Sprint not found");
  }

  const accessResult = await ensureSprintManagementAccess(req.user, sprint);

  if (accessResult.error) {
    res.status(accessResult.error.status);
    throw new Error(accessResult.error.message);
  }

  if (sprint.state !== "PLANNED") {
    res.status(400);
    throw new Error("Only planned sprints can be started");
  }

  if (!sprint.startDate || !sprint.endDate) {
    res.status(400);
    throw new Error("Sprint start and end dates must be set before starting the sprint");
  }

  const overlapResult = await validateActiveSprintOverlap(sprint);

  if (overlapResult.error) {
    res.status(overlapResult.error.status);
    throw new Error(overlapResult.error.message);
  }

  const issues = await Issue.find({
    sprintId: sprint._id,
  })
    .select("_id storyPoints")
    .lean();

  sprint.state = "ACTIVE";
  sprint.startedAt = new Date();
  sprint.snapshot = {
    committedIssueIds: issues.map((issue) => issue._id),
    committedPoints: issues.reduce(
      (sum, issue) => sum + Number(issue.storyPoints || 0),
      0
    ),
    completedIssueIds: [],
    completedPoints: 0,
    carriedOverIssueIds: [],
    carryOverMode: "",
  };

  await sprint.save();
  await sprint.populate("teamId", "name description workspaceId");

  res.status(200).json(serializeSprint(sprint.toObject()));
});

const completeSprint = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid sprint id");
  }

  const sprint = await Sprint.findById(req.params.id);

  if (!sprint) {
    res.status(404);
    throw new Error("Sprint not found");
  }

  const accessResult = await ensureSprintManagementAccess(req.user, sprint);

  if (accessResult.error) {
    res.status(accessResult.error.status);
    throw new Error(accessResult.error.message);
  }

  if (sprint.state !== "ACTIVE") {
    res.status(400);
    throw new Error("Only active sprints can be completed");
  }

  const carryOverMode =
    String(req.body?.carryOverMode || "BACKLOG").trim().toUpperCase() || "BACKLOG";

  if (!["BACKLOG", "SPRINT"].includes(carryOverMode)) {
    res.status(400);
    throw new Error("Carry-over mode must be BACKLOG or SPRINT");
  }

  const issues = await Issue.find({
    sprintId: sprint._id,
  }).sort({
    planningOrder: 1,
    createdAt: 1,
  });
  const completedIssues = issues.filter((issue) => issue.status === "DONE");
  const incompleteIssues = issues.filter((issue) => issue.status !== "DONE");
  let targetSprint = null;

  if (carryOverMode === "SPRINT" && incompleteIssues.length) {
    if (!mongoose.isValidObjectId(req.body?.targetSprintId)) {
      res.status(400);
      throw new Error("A valid target sprint is required when carrying work forward");
    }

    targetSprint = await Sprint.findOne({
      _id: req.body.targetSprintId,
      projectId: sprint.projectId,
      state: "PLANNED",
    });

    if (!targetSprint) {
      res.status(404);
      throw new Error("Target sprint not found");
    }

    if (
      targetSprint.teamId &&
      incompleteIssues.some(
        (issue) => String(issue.teamId || "") !== String(targetSprint.teamId || "")
      )
    ) {
      res.status(400);
      throw new Error(
        "Target sprint team scope does not match one or more incomplete issues"
      );
    }
  }

  if (carryOverMode === "BACKLOG" && incompleteIssues.length) {
    let nextPlanningOrder = await getNextPlanningOrder(Issue, {
      projectId: sprint.projectId,
      sprintId: null,
    });

    for (const issue of incompleteIssues) {
      issue.sprintId = null;
      issue.planningOrder = nextPlanningOrder;
      nextPlanningOrder += PLANNING_ORDER_INCREMENT;
      await issue.save();
      await recordIssueHistory({
        issueId: issue._id,
        projectId: issue.projectId,
        actorId: req.user._id,
        eventType: "SPRINT_CARRY_OVER",
        field: "sprintId",
        fromValue: String(sprint._id),
        toValue: null,
        meta: {
          carryOverMode,
          sprintName: sprint.name,
        },
      });
    }
  }

  if (carryOverMode === "SPRINT" && incompleteIssues.length && targetSprint) {
    for (const issue of incompleteIssues) {
      issue.sprintId = targetSprint._id;
      await issue.save();
      await recordIssueHistory({
        issueId: issue._id,
        projectId: issue.projectId,
        actorId: req.user._id,
        eventType: "SPRINT_CARRY_OVER",
        field: "sprintId",
        fromValue: String(sprint._id),
        toValue: String(targetSprint._id),
        meta: {
          carryOverMode,
          sprintName: sprint.name,
          targetSprintName: targetSprint.name,
        },
      });
    }
  }

  sprint.state = "COMPLETED";
  sprint.completedAt = new Date();
  sprint.completedBy = req.user._id;
  sprint.snapshot = {
    ...(sprint.snapshot || {}),
    committedIssueIds: sprint.snapshot?.committedIssueIds || issues.map((issue) => issue._id),
    committedPoints:
      sprint.snapshot?.committedPoints ||
      issues.reduce((sum, issue) => sum + Number(issue.storyPoints || 0), 0),
    completedIssueIds: completedIssues.map((issue) => issue._id),
    completedPoints: completedIssues.reduce(
      (sum, issue) => sum + Number(issue.storyPoints || 0),
      0
    ),
    carriedOverIssueIds: incompleteIssues.map((issue) => issue._id),
    carryOverMode,
  };

  await sprint.save();
  await sprint.populate("teamId", "name description workspaceId");

  res.status(200).json({
    sprint: serializeSprint(sprint.toObject()),
    carriedOverIssueIds: incompleteIssues.map((issue) => String(issue._id)),
  });
});

module.exports = {
  getSprints,
  getSprintIssues,
  createSprint,
  updateSprint,
  deleteSprint,
  startSprint,
  completeSprint,
};
