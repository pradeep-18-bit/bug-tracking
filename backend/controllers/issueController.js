const mongoose = require("mongoose");
const Comment = require("../models/Comment");
const Issue = require("../models/Issue");
const Project = require("../models/Project");
const ProjectTeam = require("../models/ProjectTeam");
const Sprint = require("../models/Sprint");
const Team = require("../models/Team");
const TeamMember = require("../models/TeamMember");
const User = require("../models/User");
const { sendIssueEmail } = require("../services/emailService");
const asyncHandler = require("../utils/asyncHandler");
const { recordIssueHistory } = require("../utils/issueHistory");
const {
  populateIssueDocument,
  populateIssueQuery,
  serializeIssue,
  serializeIssues,
} = require("../utils/issuePresentation");
const {
  ISSUE_STATUS,
  ISSUE_STATUS_VALUES,
  getCanonicalIssueStatus,
  isInProgressIssueStatus,
  normalizeIssueStatus,
} = require("../utils/issueStatus");
const {
  ISSUE_TYPES,
  ISSUE_TYPE_VALUES,
  getCanonicalIssueType,
  isValidIssueType,
} = require("../utils/issueTypes");
const { getNextPlanningOrder } = require("../utils/planningOrder");
const { canManageProjectPlanning } = require("../utils/backlogAccess");
const { buildProjectAccessQuery } = require("../utils/projectRelations");
const { hasAdminAccess } = require("../utils/roles");
const { normalizeWorkspaceId } = require("../utils/workspace");

const isAdmin = (user) => hasAdminAccess(user?.role);
const escapeRegExp = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isAssignedToUser = (issue, userId) =>
  Boolean(issue?.assignee) && String(issue.assignee) === String(userId);

const getAccessibleProjectIds = async (user) => {
  const workspaceId = normalizeWorkspaceId(user.workspaceId);
  const projectAccessQuery = await buildProjectAccessQuery(user);

  const [memberProjectIds, directlyAssignedProjectIds] = await Promise.all([
    Project.find(projectAccessQuery).distinct("_id"),
    isAdmin(user)
      ? Promise.resolve([])
      : Issue.find({ assignee: user._id }).distinct("projectId"),
  ]);

  const assignedProjectIds = directlyAssignedProjectIds.length
    ? await Project.find({
        _id: {
          $in: directlyAssignedProjectIds,
        },
        workspaceId,
      }).distinct("_id")
    : [];

  const uniqueProjectIds = new Map();

  [...memberProjectIds, ...assignedProjectIds].forEach((projectId) => {
    if (projectId) {
      uniqueProjectIds.set(String(projectId), projectId);
    }
  });

  return Array.from(uniqueProjectIds.values());
};

const loadAccessibleProject = async (user, projectId) =>
  Project.findOne({
    _id: projectId,
    ...(await buildProjectAccessQuery(user)),
  });

const ensureAssigneeExists = async (assigneeId, workspaceId) => {
  const assignee = await User.findOne({
    _id: assigneeId,
    workspaceId: normalizeWorkspaceId(workspaceId),
  })
    .select("_id role workspaceId")
    .lean();

  if (!assignee) {
    return null;
  }

  return assignee;
};

const hasOwnField = (payload, field) =>
  Object.prototype.hasOwnProperty.call(payload || {}, field);

const resolveAssigneeInput = (payload = {}) =>
  hasOwnField(payload, "assigneeId") ? payload.assigneeId : payload.assignee;

const hasAssigneeInput = (payload = {}) =>
  hasOwnField(payload, "assigneeId") || hasOwnField(payload, "assignee");

const resolveAssigneeFilterInput = (payload = {}) => {
  if (hasOwnField(payload, "assignedTo")) {
    return payload.assignedTo;
  }

  if (hasOwnField(payload, "assigneeId")) {
    return payload.assigneeId;
  }

  if (hasOwnField(payload, "assignee")) {
    return payload.assignee;
  }

  return undefined;
};

const buildIssueCreatedEmailPayload = (issue) => ({
  _id: String(issue._id),
  title: issue.title,
  description: issue.description || "",
  projectName: issue.projectId?.name || "Unknown project",
  assigneeName: issue.assignee?.name || "Unassigned",
  priority: issue.priority || "Medium",
  status: getCanonicalIssueStatus(issue.status, ISSUE_STATUS.TODO),
  createdAt: issue.createdAt,
  dueDate: issue.dueAt || null,
});

const getIssueNotificationEmails = (issue) =>
  [
    issue?.assignee?.email || null,
    // If we want to notify the reporter later, add issue?.reporter?.email here.
  ]
    .map((email) => (email ? String(email).trim().toLowerCase() : null))
    .filter(Boolean)
    .filter((email, index, emails) => emails.indexOf(email) === index);

const logIssuePayloadReceipt = (action, req) => {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.log(`[issues] ${action} payload received`, {
    userId: req.user?.id || null,
    issueId: req.params?.id || null,
    projectId: req.body?.projectId ?? null,
    teamId: req.body?.teamId ?? null,
    assigneeId: hasOwnField(req.body, "assigneeId") ? req.body.assigneeId : null,
    dueAt: hasOwnField(req.body, "dueAt") ? req.body.dueAt : null,
    dependsOnIssueId: hasOwnField(req.body, "dependsOnIssueId")
      ? req.body.dependsOnIssueId
      : null,
    legacyAssignee: hasOwnField(req.body, "assignee") ? req.body.assignee : null,
  });
};

const parseOptionalDateInput = (value, label) => {
  if (value === null || value === "" || typeof value === "undefined") {
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

const parseIssueStatusInput = (value, fallback = ISSUE_STATUS.TODO) => {
  if (value === null || value === "" || typeof value === "undefined") {
    return {
      value: fallback ? getCanonicalIssueStatus(fallback, ISSUE_STATUS.TODO) : fallback,
    };
  }

  const normalizedStatus = normalizeIssueStatus(value);

  if (!ISSUE_STATUS_VALUES.includes(normalizedStatus)) {
    return {
      error: {
        status: 400,
        message: `Status must be ${ISSUE_STATUS_VALUES.join(", ")}`,
      },
    };
  }

  return {
    value: normalizedStatus,
  };
};

const ensureIssueTeamForProject = async ({
  projectId,
  teamId,
  workspaceId,
  requireTeam = false,
}) => {
  if (!teamId) {
    if (requireTeam) {
      return {
        error: {
          status: 400,
          message: "Issue team is required",
        },
      };
    }

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

const ensureAssigneeBelongsToTeam = async ({
  assigneeId,
  teamId,
  workspaceId,
}) => {
  if (!assigneeId) {
    return {
      assignee: null,
    };
  }

  if (!teamId) {
    return {
      error: {
        status: 400,
        message: "Select a team before assigning this issue",
      },
    };
  }

  if (!mongoose.isValidObjectId(assigneeId)) {
    return {
      error: {
        status: 400,
        message: "Invalid assignee id",
      },
    };
  }

  const assignee = await ensureAssigneeExists(
    assigneeId,
    normalizeWorkspaceId(workspaceId)
  );

  if (!assignee) {
    return {
      error: {
        status: 400,
        message: "Selected assignee could not be found",
      },
    };
  }

  const teamMembership = await TeamMember.findOne({
    teamId,
    userId: assigneeId,
  })
    .select("_id")
    .lean();

  if (!teamMembership) {
    return {
      error: {
        status: 400,
        message: "Selected assignee is not a member of the selected team",
      },
    };
  }

  return {
    assignee,
  };
};

const ensureDependencyIssueForProject = async ({
  dependsOnIssueId,
  projectId,
  issueId,
}) => {
  if (!dependsOnIssueId) {
    return {
      dependencyIssue: null,
    };
  }

  if (!projectId) {
    return {
      error: {
        status: 400,
        message: "Select a project before adding an issue dependency",
      },
    };
  }

  if (!mongoose.isValidObjectId(dependsOnIssueId)) {
    return {
      error: {
        status: 400,
        message: "Invalid dependency issue id",
      },
    };
  }

  if (issueId && String(dependsOnIssueId) === String(issueId)) {
    return {
      error: {
        status: 400,
        message: "An issue cannot depend on itself",
      },
    };
  }

  const dependencyIssue = await Issue.findById(dependsOnIssueId)
    .select("_id title status dueAt projectId")
    .lean();

  if (!dependencyIssue) {
    return {
      error: {
        status: 404,
        message: "Selected dependency issue could not be found",
      },
    };
  }

  if (String(dependencyIssue.projectId) !== String(projectId)) {
    return {
      error: {
        status: 400,
        message: "Dependency issues must belong to the selected project",
      },
    };
  }

  return {
    dependencyIssue,
  };
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDateFilterInput = (value, label, { endOfDay = false } = {}) => {
  if (value === null || value === "" || typeof value === "undefined") {
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

  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value.trim())) {
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

const buildIssueQueryFromRequest = async (
  req,
  res,
  { forceOwnAssignee = false } = {}
) => {
  const accessibleProjectIds = await getAccessibleProjectIds(req.user);
  const query = {
    projectId: {
      $in: accessibleProjectIds,
    },
  };

  if (req.query.projectId && req.query.projectId !== "all") {
    if (!mongoose.isValidObjectId(req.query.projectId)) {
      res.status(400);
      throw new Error("Invalid project id filter");
    }

    const hasProjectAccess = accessibleProjectIds.some(
      (projectId) => String(projectId) === String(req.query.projectId)
    );

    if (!hasProjectAccess) {
      res.status(403);
      throw new Error("You do not have access to that project");
    }

    query.projectId = req.query.projectId;
  }

  if (req.query.status && req.query.status !== "all") {
    const normalizedStatusFilter = normalizeIssueStatus(req.query.status);

    if (normalizedStatusFilter === "OPEN") {
      query.status = {
        $ne: ISSUE_STATUS.DONE,
      };
    } else if (normalizedStatusFilter === "CLOSED") {
      query.status = ISSUE_STATUS.DONE;
    } else {
      const statusFilterResult = parseIssueStatusInput(req.query.status, "");

      if (statusFilterResult.error) {
        res.status(statusFilterResult.error.status);
        throw new Error(statusFilterResult.error.message);
      }

      query.status = statusFilterResult.value;
    }
  }

  if (req.query.priority && req.query.priority !== "all") {
    query.priority = req.query.priority;
  }

  if (req.query.type && req.query.type !== "all") {
    const normalizedType = getCanonicalIssueType(req.query.type, "");

    if (!isValidIssueType(normalizedType)) {
      res.status(400);
      throw new Error(`Type must be ${ISSUE_TYPE_VALUES.join(", ")}`);
    }

    query.type = normalizedType;
  }

  if (req.query.teamId && req.query.teamId !== "all") {
    if (!mongoose.isValidObjectId(req.query.teamId)) {
      res.status(400);
      throw new Error("Invalid team id filter");
    }

    query.teamId = req.query.teamId;
  }

  if (req.query.sprintId && req.query.sprintId !== "all") {
    if (req.query.sprintId === "backlog") {
      query.sprintId = null;
    } else {
      if (!mongoose.isValidObjectId(req.query.sprintId)) {
        res.status(400);
        throw new Error("Invalid sprint id filter");
      }

      query.sprintId = req.query.sprintId;
    }
  }

  if (req.query.sprintState && req.query.sprintState !== "all") {
    const sprintState = String(req.query.sprintState).trim().toUpperCase();

    if (!["PLANNED", "ACTIVE", "COMPLETED"].includes(sprintState)) {
      res.status(400);
      throw new Error("Invalid sprint state filter");
    }

    const sprintQuery = {
      projectId:
        typeof query.projectId === "object" && query.projectId.$in
          ? { $in: query.projectId.$in }
          : query.projectId,
      state: sprintState,
    };

    if (query.teamId) {
      sprintQuery.teamId = query.teamId;
    }

    const sprintIds = await Sprint.find(sprintQuery).distinct("_id");
    query.sprintId = sprintIds.length
      ? {
          $in: sprintIds,
        }
      : {
          $in: [],
        };
  }

  if (req.query.search?.trim()) {
    const searchExpression = new RegExp(
      escapeRegExp(req.query.search.trim()),
      "i"
    );

    query.$or = [
      { title: searchExpression },
      { description: searchExpression },
    ];
  }

  if (
    (req.query.dateFrom && req.query.dateFrom !== "all") ||
    (req.query.dateTo && req.query.dateTo !== "all")
  ) {
    const dateFromResult = parseDateFilterInput(
      req.query.dateFrom,
      "start date"
    );
    const dateToResult = parseDateFilterInput(req.query.dateTo, "end date", {
      endOfDay: true,
    });

    if (dateFromResult.error) {
      res.status(dateFromResult.error.status);
      throw new Error(dateFromResult.error.message);
    }

    if (dateToResult.error) {
      res.status(dateToResult.error.status);
      throw new Error(dateToResult.error.message);
    }

    if (
      dateFromResult.value &&
      dateToResult.value &&
      dateFromResult.value > dateToResult.value
    ) {
      res.status(400);
      throw new Error("Start date must be before the end date");
    }

    query.createdAt = {};

    if (dateFromResult.value) {
      query.createdAt.$gte = dateFromResult.value;
    }

    if (dateToResult.value) {
      query.createdAt.$lte = dateToResult.value;
    }
  }

  if (forceOwnAssignee) {
    query.assignee = req.user.id;
    return query;
  }

  const assigneeFilter = resolveAssigneeFilterInput(req.query);

  if (
    typeof assigneeFilter !== "undefined" &&
    assigneeFilter !== null &&
    assigneeFilter !== "" &&
    assigneeFilter !== "all"
  ) {
    if (String(assigneeFilter).toLowerCase() === "me") {
      query.assignee = req.user.id;
      return query;
    }

    if (!mongoose.isValidObjectId(assigneeFilter)) {
      res.status(400);
      throw new Error("Invalid assignee filter");
    }

    if (!isAdmin(req.user) && String(assigneeFilter) !== String(req.user.id)) {
      res.status(403);
      throw new Error("You can only view issues assigned to you");
    }

    query.assignee = assigneeFilter;
  } else if (!isAdmin(req.user)) {
    query.assignee = req.user.id;
  }

  return query;
};

const getIssues = asyncHandler(async (req, res) => {
  const query = await buildIssueQueryFromRequest(req, res);

  const issues = await populateIssueQuery(Issue.find(query)).sort({
    createdAt: -1,
  });

  res.status(200).json(serializeIssues(issues));
});

const getMyIssues = asyncHandler(async (req, res) => {
  if (isAdmin(req.user)) {
    res.status(403);
    throw new Error("Admins and managers do not have access to personal task views");
  }

  const query = await buildIssueQueryFromRequest(req, res, {
    forceOwnAssignee: true,
  });

  const issues = await populateIssueQuery(Issue.find(query)).sort({
    createdAt: -1,
  });

  res.status(200).json(serializeIssues(issues));
});

const statusLabelMap = {
  [ISSUE_STATUS.TODO]: "To Do",
  [ISSUE_STATUS.IN_PROGRESS]: "In Progress",
  [ISSUE_STATUS.BLOCKED]: "Blocked",
  [ISSUE_STATUS.REVIEW]: "Review",
  [ISSUE_STATUS.QA]: "QA",
  [ISSUE_STATUS.DONE]: "Done",
};

const priorityOrder = ["High", "Medium", "Low"];
const statusOrder = [
  ISSUE_STATUS.TODO,
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.BLOCKED,
  ISSUE_STATUS.REVIEW,
  ISSUE_STATUS.QA,
  ISSUE_STATUS.DONE,
];

const uniqueObjectIds = (values = []) => {
  const uniqueIds = new Map();

  values.filter(Boolean).forEach((value) => {
    uniqueIds.set(String(value), value);
  });

  return Array.from(uniqueIds.values());
};

const getNormalizedReportIssues = (issues = []) =>
  issues.map((issue) => ({
    ...issue,
    status: getCanonicalIssueStatus(issue.status, ISSUE_STATUS.TODO),
  }));

const createStatusCountMap = (issues = []) =>
  issues.reduce((map, issue) => {
    const status = getCanonicalIssueStatus(issue.status, ISSUE_STATUS.TODO);
    map.set(status, (map.get(status) || 0) + 1);
    return map;
  }, new Map());

const createPriorityCountMap = (issues = []) =>
  issues.reduce((map, issue) => {
    if (!issue.priority) {
      return map;
    }

    map.set(issue.priority, (map.get(issue.priority) || 0) + 1);
    return map;
  }, new Map());

const buildSummaryMetrics = (issues = []) =>
  issues.reduce(
    (summary, issue) => {
      const status = getCanonicalIssueStatus(issue.status, ISSUE_STATUS.TODO);

      summary.totalIssues += 1;

      if (status === ISSUE_STATUS.DONE) {
        summary.closedIssues += 1;
      } else {
        summary.openIssues += 1;
      }

      if (isInProgressIssueStatus(status)) {
        summary.inProgressIssues += 1;
      }

      return summary;
    },
    {
      totalIssues: 0,
      openIssues: 0,
      inProgressIssues: 0,
      closedIssues: 0,
    }
  );

const createEntityBucket = (base = {}) => ({
  total: 0,
  open: 0,
  inProgress: 0,
  closed: 0,
  completionRate: 0,
  ...base,
});

const incrementEntityBucket = (bucket, issue) => {
  const status = getCanonicalIssueStatus(issue.status, ISSUE_STATUS.TODO);

  bucket.total += 1;

  if (status === ISSUE_STATUS.DONE) {
    bucket.closed += 1;
  } else {
    bucket.open += 1;
  }

  if (isInProgressIssueStatus(status)) {
    bucket.inProgress += 1;
  }

  bucket.completionRate = bucket.total
    ? Math.round((bucket.closed / bucket.total) * 100)
    : 0;
};

const sortEntityBuckets = (left, right) =>
  right.total - left.total ||
  right.closed - left.closed ||
  right.inProgress - left.inProgress ||
  left.name.localeCompare(right.name);

const loadReportIssues = async (query) =>
  getNormalizedReportIssues(
    await Issue.find(query)
      .select("status priority projectId teamId assignee createdAt")
      .lean()
  );

const buildProjectReportBuckets = async (issues, workspaceId) => {
  const projectIds = uniqueObjectIds(issues.map((issue) => issue.projectId));

  if (!projectIds.length) {
    return [];
  }

  const projects = await Project.find({
    _id: {
      $in: projectIds,
    },
    workspaceId: normalizeWorkspaceId(workspaceId),
  })
    .select("name isCompleted workspaceId")
    .lean();
  const projectsById = new Map(
    projects.map((project) => [String(project._id), project])
  );
  const bucketsById = new Map();

  issues.forEach((issue) => {
    if (!issue.projectId) {
      return;
    }

    const projectId = String(issue.projectId);
    const project = projectsById.get(projectId);

    if (!project) {
      return;
    }

    const bucket =
      bucketsById.get(projectId) ||
      createEntityBucket({
        projectId,
        name: project.name,
        isCompleted: Boolean(project.isCompleted),
      });

    incrementEntityBucket(bucket, issue);
    bucketsById.set(projectId, bucket);
  });

  return Array.from(bucketsById.values()).sort(sortEntityBuckets);
};

const buildUserReportBuckets = async (issues, workspaceId) => {
  const assigneeIds = uniqueObjectIds(issues.map((issue) => issue.assignee));

  if (!assigneeIds.length) {
    return [];
  }

  const users = await User.find({
    _id: {
      $in: assigneeIds,
    },
    workspaceId: normalizeWorkspaceId(workspaceId),
  })
    .select("name email role workspaceId")
    .lean();
  const usersById = new Map(users.map((user) => [String(user._id), user]));
  const bucketsById = new Map();

  issues.forEach((issue) => {
    if (!issue.assignee) {
      return;
    }

    const assigneeId = String(issue.assignee);
    const assignee = usersById.get(assigneeId);

    if (!assignee) {
      return;
    }

    const bucket =
      bucketsById.get(assigneeId) ||
      createEntityBucket({
        assigneeId,
        name: assignee.name,
        email: assignee.email,
        role: assignee.role,
      });

    incrementEntityBucket(bucket, issue);
    bucketsById.set(assigneeId, bucket);
  });

  return Array.from(bucketsById.values()).sort(sortEntityBuckets);
};

const buildTeamReportBuckets = async (issues, workspaceId) => {
  const teamIds = uniqueObjectIds(issues.map((issue) => issue.teamId));

  if (!teamIds.length) {
    return [];
  }

  const [teams, teamMemberCounts] = await Promise.all([
    Team.find({
      _id: {
        $in: teamIds,
      },
      workspaceId: normalizeWorkspaceId(workspaceId),
    })
      .select("name workspaceId")
      .lean(),
    TeamMember.aggregate([
      {
        $match: {
          teamId: {
            $in: teamIds,
          },
        },
      },
      {
        $group: {
          _id: "$teamId",
          count: {
            $sum: 1,
          },
        },
      },
    ]),
  ]);
  const teamsById = new Map(teams.map((team) => [String(team._id), team]));
  const teamMemberCountMap = new Map(
    teamMemberCounts.map((item) => [String(item._id), item.count])
  );
  const bucketsById = new Map();

  issues.forEach((issue) => {
    if (!issue.teamId) {
      return;
    }

    const teamId = String(issue.teamId);
    const team = teamsById.get(teamId);

    if (!team) {
      return;
    }

    const bucket =
      bucketsById.get(teamId) ||
      createEntityBucket({
        teamId,
        name: team.name,
        memberCount: teamMemberCountMap.get(teamId) || 0,
      });

    incrementEntityBucket(bucket, issue);
    bucketsById.set(teamId, bucket);
  });

  return Array.from(bucketsById.values()).sort(sortEntityBuckets);
};

const buildReportsPayload = async (issues, workspaceId) => {
  const statusCountMap = createStatusCountMap(issues);
  const priorityCountMap = createPriorityCountMap(issues);
  const issuesPerProject = await buildProjectReportBuckets(issues, workspaceId);

  return {
    ...buildSummaryMetrics(issues),
    issuesByStatus: statusOrder.map((status) => ({
      key: status,
      label: statusLabelMap[status] || status,
      count: statusCountMap.get(status) || 0,
    })),
    issuesByPriority: priorityOrder.map((priority) => ({
      key: priority,
      label: priority,
      count: priorityCountMap.get(priority) || 0,
    })),
    issuesPerProject: issuesPerProject.map((project) => ({
      projectId: project.projectId,
      name: project.name,
      count: project.total,
      open: project.open,
      inProgress: project.inProgress,
      closed: project.closed,
      completionRate: project.completionRate,
      isCompleted: project.isCompleted,
    })),
  };
};

const getReports = asyncHandler(async (req, res) => {
  const query = await buildIssueQueryFromRequest(req, res, {
    forceOwnAssignee: !isAdmin(req.user),
  });
  const issues = await loadReportIssues(query);

  res.status(200).json(
    await buildReportsPayload(issues, req.user.workspaceId)
  );
});

const getProjectReports = asyncHandler(async (req, res) => {
  const query = await buildIssueQueryFromRequest(req, res, {
    forceOwnAssignee: !isAdmin(req.user),
  });
  const issues = await loadReportIssues(query);

  res.status(200).json({
    projects: await buildProjectReportBuckets(issues, req.user.workspaceId),
  });
});

const getUserReports = asyncHandler(async (req, res) => {
  const query = await buildIssueQueryFromRequest(req, res, {
    forceOwnAssignee: !isAdmin(req.user),
  });
  const issues = await loadReportIssues(query);

  res.status(200).json({
    users: await buildUserReportBuckets(issues, req.user.workspaceId),
  });
});

const getTeamReports = asyncHandler(async (req, res) => {
  const query = await buildIssueQueryFromRequest(req, res, {
    forceOwnAssignee: !isAdmin(req.user),
  });
  const issues = await loadReportIssues(query);

  res.status(200).json({
    teams: await buildTeamReportBuckets(issues, req.user.workspaceId),
  });
});

const createIssue = asyncHandler(async (req, res) => {
  logIssuePayloadReceipt("create", req);

  const {
    title,
    description,
    type,
    status,
    priority,
    projectId,
    teamId,
    dueAt,
    dependsOnIssueId,
  } = req.body;
  const assigneeId = resolveAssigneeInput(req.body);
  const normalizedType = getCanonicalIssueType(type, ISSUE_TYPES.TASK);
  const statusResult = parseIssueStatusInput(status, ISSUE_STATUS.TODO);

  if (!title || !projectId || !teamId) {
    res.status(400);
    throw new Error("Issue title, project, and team are required");
  }

  if (statusResult.error) {
    res.status(statusResult.error.status);
    throw new Error(statusResult.error.message);
  }

  if (!mongoose.isValidObjectId(projectId)) {
    res.status(400);
    throw new Error("Invalid project id");
  }

  if (!isValidIssueType(normalizedType)) {
    res.status(400);
    throw new Error(`Type must be ${ISSUE_TYPE_VALUES.join(", ")}`);
  }

  if (req.user.role === "Developer") {
    res.status(403);
    throw new Error("Developers cannot create new issues");
  }

  if (req.user.role === "Tester" && normalizedType !== ISSUE_TYPES.BUG) {
    res.status(403);
    throw new Error("Testers can only report bug issues");
  }

  const project = await loadAccessibleProject(req.user, projectId);

  if (!project) {
    res.status(403);
    throw new Error("You do not have access to that project");
  }

  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const teamResult = await ensureIssueTeamForProject({
    projectId: project._id,
    teamId,
    workspaceId,
    requireTeam: true,
  });

  if (teamResult.error) {
    res.status(teamResult.error.status);
    throw new Error(teamResult.error.message);
  }

  if (assigneeId) {
    if (!isAdmin(req.user) && String(assigneeId) !== String(req.user._id)) {
      res.status(403);
      throw new Error("Only admins can assign work to other users");
    }

    const assigneeResult = await ensureAssigneeBelongsToTeam({
      assigneeId,
      teamId,
      workspaceId,
    });

    if (assigneeResult.error) {
      res.status(assigneeResult.error.status);
      throw new Error(assigneeResult.error.message);
    }
  }

  const dueAtResult = parseOptionalDateInput(dueAt, "due date");

  if (dueAtResult.error) {
    res.status(dueAtResult.error.status);
    throw new Error(dueAtResult.error.message);
  }

  const dependencyResult = await ensureDependencyIssueForProject({
    dependsOnIssueId: dependsOnIssueId || null,
    projectId: project._id,
  });

  if (dependencyResult.error) {
    res.status(dependencyResult.error.status);
    throw new Error(dependencyResult.error.message);
  }

  const planningOrder = await getNextPlanningOrder(Issue, {
    projectId,
    sprintId: null,
  });

  const issue = await Issue.create({
    title,
    description,
    type: normalizedType,
    status: statusResult.value,
    priority,
    assignee: assigneeId || null,
    reporter: req.user._id,
    projectId,
    teamId,
    dueAt: dueAtResult.value,
    dependsOnIssueId: dependsOnIssueId || null,
    planningOrder,
    startedAt: isInProgressIssueStatus(statusResult.value) ? new Date() : null,
  });

  await populateIssueDocument(issue);
  await recordIssueHistory({
    issueId: issue._id,
    projectId: issue.projectId,
    actorId: req.user._id,
    eventType: "ISSUE_CREATED",
    field: "issue",
    fromValue: null,
    toValue: issue.title,
    meta: {
      type: issue.type,
      priority: issue.priority,
      status: issue.status,
    },
  });

  const emails = getIssueNotificationEmails(issue);
  const emailWorkspaceId = normalizeWorkspaceId(project.workspaceId || workspaceId);
  const emailPayload = buildIssueCreatedEmailPayload(issue);
  const creatorUserId = req.user?.id || req.user?._id || "";

  if (emails.length > 0) {
    try {
      console.log("[issues] Issue-created email context", {
        issueId: String(issue._id),
        reqUserWorkspaceId: workspaceId,
        projectWorkspaceId: project.workspaceId || "",
        emailWorkspaceId,
        issueCreatorId: String(creatorUserId || ""),
        issueCreatorEmail: req.user?.email || "",
        issueCreatorRole: req.user?.role || "",
      });
      console.log("[issues] Sending email to:", emails);
      const emailResult = await sendIssueEmail(emails, emailPayload, {
        creatorUserId,
        workspaceId: emailWorkspaceId,
      });
      console.log("[issues] Issue-created final sender", {
        issueId: String(issue._id),
        creatorUserId: String(creatorUserId || ""),
        creatorUserEmail: req.user?.email || "",
        creatorUserRole: req.user?.role || "",
        finalSenderSource: emailResult?.senderSource || "unknown",
        finalFrom: emailResult?.from || "",
        finalAuthUser: emailResult?.authUser || "",
      });
      console.log("[issues] Issue-created email sent", {
        issueId: String(issue._id),
        senderSource: emailResult?.senderSource || "unknown",
        from: emailResult?.from || "",
        workspaceId: emailWorkspaceId,
      });
    } catch (error) {
      console.error("[issues] Failed to send issue-created email", {
        issueId: String(issue._id),
        message: error.message,
      });
    }
  }

  res.status(201).json(serializeIssue(issue));
});

const updateIssue = asyncHandler(async (req, res) => {
  logIssuePayloadReceipt("update", req);

  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid issue id");
  }

  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    res.status(404);
    throw new Error("Issue not found");
  }

  let targetProject = await loadAccessibleProject(req.user, issue.projectId);
  const hasDirectAssignmentAccess =
    !isAdmin(req.user) && isAssignedToUser(issue, req.user._id);

  if (!targetProject && hasDirectAssignmentAccess) {
    targetProject = await Project.findOne({
      _id: issue.projectId,
      workspaceId: normalizeWorkspaceId(req.user.workspaceId),
    });
  }

  if (!targetProject) {
    res.status(403);
    throw new Error("You do not have access to this issue");
  }

  const hasProjectLeadershipAccess = canManageProjectPlanning(req.user, targetProject);

  if (!isAdmin(req.user)) {
    if (
      !hasProjectLeadershipAccess &&
      (!issue.assignee || String(issue.assignee) !== String(req.user._id))
    ) {
      res.status(403);
      throw new Error("You can only update issues assigned to you");
    }

    const allowedFields = hasProjectLeadershipAccess
      ? [
          "title",
          "description",
          "type",
          "priority",
          "status",
          "teamId",
          "assigneeId",
          "assignee",
          "dueAt",
          "dependsOnIssueId",
        ]
      : ["status"];
    const requestedFields = Object.keys(req.body);

    if (!requestedFields.every((field) => allowedFields.includes(field))) {
      res.status(403);
      throw new Error("Your role can only update issue status");
    }
  }

  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const changeEntries = [];

  if (req.body.projectId) {
    if (!isAdmin(req.user)) {
      res.status(403);
      throw new Error("Only admins can move issues between projects");
    }

    if (!mongoose.isValidObjectId(req.body.projectId)) {
      res.status(400);
      throw new Error("Invalid project id");
    }

    targetProject = await loadAccessibleProject(req.user, req.body.projectId);

    if (!targetProject) {
      res.status(403);
      throw new Error("You do not have access to the target project");
    }

    const previousProjectId = issue.projectId;
    issue.projectId = targetProject._id;
    changeEntries.push({
      field: "projectId",
      fromValue: previousProjectId,
      toValue: targetProject._id,
    });
  }

  const updatableFields = ["title", "description", "priority"];
  const nextStatusResult = parseIssueStatusInput(req.body.status, issue.status);
  const nextType = hasOwnField(req.body, "type")
    ? getCanonicalIssueType(req.body.type, "")
    : issue.type;

  if (nextStatusResult.error) {
    res.status(nextStatusResult.error.status);
    throw new Error(nextStatusResult.error.message);
  }

  if (hasOwnField(req.body, "type") && !isValidIssueType(nextType)) {
    res.status(400);
    throw new Error(`Type must be ${ISSUE_TYPE_VALUES.join(", ")}`);
  }

  const nextStatus = nextStatusResult.value;

  updatableFields.forEach((field) => {
    if (typeof req.body[field] !== "undefined") {
      changeEntries.push({
        field,
        fromValue: issue[field],
        toValue: req.body[field],
      });
      issue[field] = req.body[field];
    }
  });

  if (typeof req.body.type !== "undefined") {
    changeEntries.push({
      field: "type",
      fromValue: issue.type,
      toValue: nextType,
    });
    issue.type = nextType;
  }

  if (typeof req.body.status !== "undefined") {
    changeEntries.push({
      field: "status",
      fromValue: issue.status,
      toValue: nextStatus,
    });
    issue.status = nextStatus;
  }

  if (isInProgressIssueStatus(nextStatus) && !issue.startedAt) {
    issue.startedAt = new Date();
  }

  const hasTeamChange = hasOwnField(req.body, "teamId");
  const hasAssigneeChange = hasAssigneeInput(req.body);
  const hasDueAtChange = hasOwnField(req.body, "dueAt");
  const hasDependencyChange = hasOwnField(req.body, "dependsOnIssueId");
  const nextTeamId = hasTeamChange ? req.body.teamId || null : issue.teamId || null;
  const nextAssigneeId = hasAssigneeChange
    ? resolveAssigneeInput(req.body) || null
    : issue.assignee || null;
  const nextDependsOnIssueId = hasDependencyChange
    ? req.body.dependsOnIssueId || null
    : issue.dependsOnIssueId || null;

  if (hasTeamChange || req.body.projectId) {
    const teamResult = await ensureIssueTeamForProject({
      projectId: targetProject?._id || issue.projectId,
      teamId: nextTeamId,
      workspaceId,
      requireTeam: false,
    });

    if (teamResult.error) {
      res.status(teamResult.error.status);
      throw new Error(teamResult.error.message);
    }
  }

  if (nextAssigneeId) {
    const assigneeResult = await ensureAssigneeBelongsToTeam({
      assigneeId: nextAssigneeId,
      teamId: nextTeamId,
      workspaceId,
    });

    if (assigneeResult.error) {
      res.status(assigneeResult.error.status);
      throw new Error(assigneeResult.error.message);
    }
  }

  if (hasDueAtChange) {
    const dueAtResult = parseOptionalDateInput(req.body.dueAt, "due date");

    if (dueAtResult.error) {
      res.status(dueAtResult.error.status);
      throw new Error(dueAtResult.error.message);
    }

    changeEntries.push({
      field: "dueAt",
      fromValue: issue.dueAt || null,
      toValue: dueAtResult.value || null,
    });
    issue.dueAt = dueAtResult.value;
  }

  if (hasDependencyChange || req.body.projectId) {
    const dependencyResult = await ensureDependencyIssueForProject({
      dependsOnIssueId: nextDependsOnIssueId,
      projectId: targetProject?._id || issue.projectId,
      issueId: issue._id,
    });

    if (dependencyResult.error) {
      res.status(dependencyResult.error.status);
      throw new Error(dependencyResult.error.message);
    }
  }

  if (hasTeamChange) {
    changeEntries.push({
      field: "teamId",
      fromValue: issue.teamId || null,
      toValue: nextTeamId || null,
    });
    issue.teamId = nextTeamId;
  }

  if (hasAssigneeChange) {
    if (!isAdmin(req.user)) {
      res.status(403);
      throw new Error("Only admins can reassign issues");
    }

    const previousAssigneeId = issue.assignee || null;

    if (!nextAssigneeId) {
      issue.assignee = null;
    } else {
      issue.assignee = nextAssigneeId;
    }

    changeEntries.push({
      field: "assignee",
      fromValue: previousAssigneeId,
      toValue: nextAssigneeId || null,
    });
  }

  if (hasDependencyChange) {
    changeEntries.push({
      field: "dependsOnIssueId",
      fromValue: issue.dependsOnIssueId || null,
      toValue: nextDependsOnIssueId || null,
    });
    issue.dependsOnIssueId = nextDependsOnIssueId;
  }

  await issue.save();
  await populateIssueDocument(issue);
  await Promise.all(
    changeEntries
      .filter((entry) => String(entry.fromValue || "") !== String(entry.toValue || ""))
      .map((entry) =>
        recordIssueHistory({
          issueId: issue._id,
          projectId: issue.projectId,
          actorId: req.user._id,
          eventType: "ISSUE_UPDATED",
          field: entry.field,
          fromValue: entry.fromValue,
          toValue: entry.toValue,
          meta: {
            title: issue.title,
          },
        })
      )
  );

  res.status(200).json(serializeIssue(issue));
});

const deleteIssue = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid issue id");
  }

  if (!isAdmin(req.user)) {
    res.status(403);
    throw new Error("Only admins can delete issues");
  }

  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    res.status(404);
    throw new Error("Issue not found");
  }

  const project = await loadAccessibleProject(req.user, issue.projectId);

  if (!project) {
    res.status(403);
    throw new Error("You do not have access to this issue");
  }

  await Comment.deleteMany({ issueId: issue._id });
  await issue.deleteOne();

  res.status(200).json({
    message: "Issue deleted successfully",
  });
});

module.exports = {
  getIssues,
  getMyIssues,
  getReports,
  getProjectReports,
  getUserReports,
  getTeamReports,
  createIssue,
  updateIssue,
  deleteIssue,
};
