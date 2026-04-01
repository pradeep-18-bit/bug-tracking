const mongoose = require("mongoose");
const Comment = require("../models/Comment");
const Issue = require("../models/Issue");
const Project = require("../models/Project");
const ProjectTeam = require("../models/ProjectTeam");
const Team = require("../models/Team");
const TeamMember = require("../models/TeamMember");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const {
  ISSUE_STATUS,
  ISSUE_STATUS_VALUES,
  getCanonicalIssueStatus,
  isInProgressIssueStatus,
  normalizeIssueStatus,
} = require("../utils/issueStatus");
const { buildProjectAccessQuery } = require("../utils/projectRelations");
const { normalizeWorkspaceId } = require("../utils/workspace");

const populateIssueQuery = (query) =>
  query
    .populate("assignee", "name email role")
    .populate("dependsOnIssueId", "title status dueAt")
    .populate("reporter", "name email role")
    .populate("projectId", "name description createdBy isCompleted")
    .populate("teamId", "name description workspaceId");

const populateIssueDocument = (issue) =>
  issue.populate([
    { path: "assignee", select: "name email role" },
    { path: "dependsOnIssueId", select: "title status dueAt" },
    { path: "reporter", select: "name email role" },
    { path: "projectId", select: "name description createdBy isCompleted" },
    { path: "teamId", select: "name description workspaceId" },
  ]);

const isAdmin = (user) => user?.role === "Admin";
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

const serializeIssue = (issue) => {
  const serializedIssue =
    typeof issue?.toObject === "function"
      ? issue.toObject()
      : {
          ...issue,
        };
  const assigneeReference =
    serializedIssue?.assignee?._id || serializedIssue?.assignee || null;
  const dependencyIssue =
    serializedIssue?.dependsOnIssueId &&
    typeof serializedIssue.dependsOnIssueId === "object"
      ? {
          ...serializedIssue.dependsOnIssueId,
          status: getCanonicalIssueStatus(
            serializedIssue.dependsOnIssueId.status,
            ISSUE_STATUS.TODO
          ),
        }
      : serializedIssue?.dependsOnIssueId || null;

  return {
    ...serializedIssue,
    status: getCanonicalIssueStatus(serializedIssue.status, ISSUE_STATUS.TODO),
    dependsOnIssueId: dependencyIssue,
    assigneeId: assigneeReference ? String(assigneeReference) : null,
  };
};

const serializeIssues = (issues = []) => issues.map(serializeIssue);

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
    const statusFilterResult = parseIssueStatusInput(req.query.status, "");

    if (statusFilterResult.error) {
      res.status(statusFilterResult.error.status);
      throw new Error(statusFilterResult.error.message);
    }

    query.status = statusFilterResult.value;
  }

  if (req.query.priority && req.query.priority !== "all") {
    query.priority = req.query.priority;
  }

  if (req.query.teamId && req.query.teamId !== "all") {
    if (!mongoose.isValidObjectId(req.query.teamId)) {
      res.status(400);
      throw new Error("Invalid team id filter");
    }

    query.teamId = req.query.teamId;
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
    throw new Error("Admins do not have access to personal task views");
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
  [ISSUE_STATUS.DONE]: "Done",
};

const priorityOrder = ["Low", "Medium", "High"];
const statusOrder = [
  ISSUE_STATUS.TODO,
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.DONE,
];

const getReports = asyncHandler(async (req, res) => {
  const query = await buildIssueQueryFromRequest(req, res, {
    forceOwnAssignee: !isAdmin(req.user),
  });

  const [totalIssues, issuesByStatusRaw, issuesByPriorityRaw, issuesPerProjectRaw] =
    await Promise.all([
      Issue.countDocuments(query),
      Issue.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      Issue.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$priority",
            count: { $sum: 1 },
          },
        },
      ]),
      Issue.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$projectId",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

  const statusCountMap = issuesByStatusRaw.reduce((map, item) => {
    const canonicalStatus = getCanonicalIssueStatus(item._id, ISSUE_STATUS.TODO);
    map.set(canonicalStatus, (map.get(canonicalStatus) || 0) + item.count);
    return map;
  }, new Map());
  const priorityCountMap = new Map(
    issuesByPriorityRaw.map((item) => [item._id, item.count])
  );

  const projectIds = issuesPerProjectRaw
    .map((item) => item._id)
    .filter((projectId) => Boolean(projectId));
  const projects = projectIds.length
    ? await Project.find({
        _id: {
          $in: projectIds,
        },
      })
        .select("name")
        .lean()
    : [];
  const projectNameMap = new Map(
    projects.map((project) => [String(project._id), project.name])
  );

  res.status(200).json({
    totalIssues,
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
    issuesPerProject: issuesPerProjectRaw
      .map((item) => ({
        projectId: String(item._id),
        name: projectNameMap.get(String(item._id)) || "Unknown project",
        count: item.count,
      }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)),
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

  if (req.user.role === "Developer") {
    res.status(403);
    throw new Error("Developers cannot create new issues");
  }

  if (req.user.role === "Tester" && type !== "Bug") {
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

  const issue = await Issue.create({
    title,
    description,
    type,
    status: statusResult.value,
    priority,
    assignee: assigneeId || null,
    reporter: req.user._id,
    projectId,
    teamId,
    dueAt: dueAtResult.value,
    dependsOnIssueId: dependsOnIssueId || null,
    startedAt: isInProgressIssueStatus(statusResult.value) ? new Date() : null,
  });

  await populateIssueDocument(issue);

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

  if (!isAdmin(req.user)) {
    if (!issue.assignee || String(issue.assignee) !== String(req.user._id)) {
      res.status(403);
      throw new Error("You can only update issues assigned to you");
    }

    const allowedFields = ["status"];
    const requestedFields = Object.keys(req.body);

    if (!requestedFields.every((field) => allowedFields.includes(field))) {
      res.status(403);
      throw new Error("Your role can only update issue status");
    }
  }

  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);

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

    issue.projectId = targetProject._id;
  }

  const updatableFields = [
    "title",
    "description",
    "type",
    "priority",
  ];
  const nextStatusResult = parseIssueStatusInput(req.body.status, issue.status);

  if (nextStatusResult.error) {
    res.status(nextStatusResult.error.status);
    throw new Error(nextStatusResult.error.message);
  }

  const nextStatus = nextStatusResult.value;

  updatableFields.forEach((field) => {
    if (typeof req.body[field] !== "undefined") {
      issue[field] = req.body[field];
    }
  });

  if (typeof req.body.status !== "undefined") {
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
    issue.teamId = nextTeamId;
  }

  if (hasAssigneeChange) {
    if (!isAdmin(req.user)) {
      res.status(403);
      throw new Error("Only admins can reassign issues");
    }

    if (!nextAssigneeId) {
      issue.assignee = null;
    } else {
      issue.assignee = nextAssigneeId;
    }
  }

  if (hasDependencyChange) {
    issue.dependsOnIssueId = nextDependsOnIssueId;
  }

  await issue.save();
  await populateIssueDocument(issue);

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
  createIssue,
  updateIssue,
  deleteIssue,
};
