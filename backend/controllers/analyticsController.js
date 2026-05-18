const mongoose = require("mongoose");
const Issue = require("../models/Issue");
const IssueHistory = require("../models/IssueHistory");
const Project = require("../models/Project");
const ProjectTeam = require("../models/ProjectTeam");
const Team = require("../models/Team");
const TeamMember = require("../models/TeamMember");
const asyncHandler = require("../utils/asyncHandler");
const { BUG_SEVERITY_VALUES, BUG_TERMINAL_STATUS_VALUES } = require("../utils/bugLifecycle");
const {
  ISSUE_STATUS,
  getCanonicalIssueStatus,
  isClosedIssueStatus,
  normalizeIssueStatus,
} = require("../utils/issueStatus");
const {
  ISSUE_TYPES,
  ISSUE_TYPE_VALUES,
  getCanonicalIssueType,
  isValidIssueType,
} = require("../utils/issueTypes");
const { buildProjectAccessQuery } = require("../utils/projectRelations");
const { hasAdminAccess } = require("../utils/roles");
const { normalizeWorkspaceId } = require("../utils/workspace");

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CLOSED_STATUSES = [ISSUE_STATUS.DONE, ...BUG_TERMINAL_STATUS_VALUES];
const PRIORITY_ORDER = ["High", "Medium", "Low"];
const STATUS_LABELS = {
  [ISSUE_STATUS.TODO]: "To Do",
  [ISSUE_STATUS.IN_PROGRESS]: "In Progress",
  [ISSUE_STATUS.BLOCKED]: "Blocked",
  [ISSUE_STATUS.REVIEW]: "Review",
  [ISSUE_STATUS.QA]: "QA",
  [ISSUE_STATUS.DONE]: "Done",
  [ISSUE_STATUS.NEW]: "New",
  [ISSUE_STATUS.OPEN]: "Open",
  [ISSUE_STATUS.ASSIGNED]: "Assigned",
  [ISSUE_STATUS.FIXED]: "Fixed",
  [ISSUE_STATUS.CLOSED]: "Closed",
  [ISSUE_STATUS.REOPEN]: "Reopen",
  [ISSUE_STATUS.REJECTED]: "Rejected",
  [ISSUE_STATUS.DEFERRED]: "Deferred",
};
const STATUS_ORDER = [
  ISSUE_STATUS.TODO,
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.BLOCKED,
  ISSUE_STATUS.REVIEW,
  ISSUE_STATUS.QA,
  ISSUE_STATUS.DONE,
  ISSUE_STATUS.NEW,
  ISSUE_STATUS.OPEN,
  ISSUE_STATUS.ASSIGNED,
  ISSUE_STATUS.FIXED,
  ISSUE_STATUS.CLOSED,
  ISSUE_STATUS.REOPEN,
  ISSUE_STATUS.REJECTED,
  ISSUE_STATUS.DEFERRED,
];

const escapeRegExp = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const parseDateInput = (value, label, { end = false } = {}) => {
  if (value === null || value === "" || typeof value === "undefined" || value === "all") {
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
    value: end ? endOfDay(parsedValue) : startOfDay(parsedValue),
  };
};

const resolveObjectId = (value) => {
  if (!value) {
    return null;
  }

  if (value._id) {
    return value._id;
  }

  return value;
};

const uniqueObjectIds = (values = []) => {
  const unique = new Map();

  values.filter(Boolean).forEach((value) => {
    unique.set(String(value), value);
  });

  return Array.from(unique.values());
};

const getAccessibleProjectIds = async (user) => {
  const workspaceId = normalizeWorkspaceId(user.workspaceId);
  const projectAccessQuery = await buildProjectAccessQuery(user);
  const [memberProjectIds, directlyAssignedProjectIds] = await Promise.all([
    Project.find(projectAccessQuery).distinct("_id"),
    hasAdminAccess(user.role)
      ? Promise.resolve([])
      : Issue.find({
          $or: [
            { assignee: user._id },
            { reporter: user._id },
            { "bugDetails.testerOwner": user._id },
            { "bugDetails.developerLead": user._id },
          ],
        }).distinct("projectId"),
  ]);

  const assignedProjectIds = directlyAssignedProjectIds.length
    ? await Project.find({
        _id: {
          $in: directlyAssignedProjectIds,
        },
        workspaceId,
      }).distinct("_id")
    : [];

  return uniqueObjectIds([...memberProjectIds, ...assignedProjectIds]);
};

const addPersonalAccess = (match, user) => {
  const personalAccessQuery = {
    $or: [
      { assignee: user._id },
      { reporter: user._id },
      { "bugDetails.testerOwner": user._id },
      { "bugDetails.developerLead": user._id },
    ],
  };

  if (match.$or) {
    match.$and = [...(match.$and || []), { $or: match.$or }, personalAccessQuery];
    delete match.$or;
    return;
  }

  match.$or = personalAccessQuery.$or;
};

const buildAnalyticsMatch = async (req, res) => {
  const accessibleProjectIds = await getAccessibleProjectIds(req.user);
  const match = {
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

    match.projectId = new mongoose.Types.ObjectId(req.query.projectId);
  }

  if (req.query.teamId && req.query.teamId !== "all") {
    if (!mongoose.isValidObjectId(req.query.teamId)) {
      res.status(400);
      throw new Error("Invalid team id filter");
    }

    match.teamId = new mongoose.Types.ObjectId(req.query.teamId);
  }

  if (req.query.assigneeId && req.query.assigneeId !== "all") {
    if (!mongoose.isValidObjectId(req.query.assigneeId)) {
      res.status(400);
      throw new Error("Invalid assignee filter");
    }

    match.assignee = new mongoose.Types.ObjectId(req.query.assigneeId);
  }

  if (req.query.status && req.query.status !== "all") {
    const normalizedStatus = normalizeIssueStatus(req.query.status);

    if (normalizedStatus === "OPEN") {
      match.status = {
        $nin: CLOSED_STATUSES,
      };
    } else if (normalizedStatus === "CLOSED") {
      match.status = {
        $in: CLOSED_STATUSES,
      };
    } else if (Object.values(ISSUE_STATUS).includes(normalizedStatus)) {
      match.status = normalizedStatus;
    } else {
      res.status(400);
      throw new Error("Invalid status filter");
    }
  }

  if (req.query.priority && req.query.priority !== "all") {
    if (!PRIORITY_ORDER.includes(req.query.priority)) {
      res.status(400);
      throw new Error("Invalid priority filter");
    }

    match.priority = req.query.priority;
  }

  if (req.query.type && req.query.type !== "all") {
    const normalizedType = getCanonicalIssueType(req.query.type, "");

    if (!isValidIssueType(normalizedType)) {
      res.status(400);
      throw new Error(`Type must be ${ISSUE_TYPE_VALUES.join(", ")}`);
    }

    match.type = normalizedType;
  }

  if (req.query.search?.trim()) {
    const searchExpression = new RegExp(escapeRegExp(req.query.search.trim()), "i");
    match.$or = [
      { title: searchExpression },
      { description: searchExpression },
      { priority: searchExpression },
      { status: searchExpression },
      { type: searchExpression },
    ];
  }

  if (req.query.dateFrom || req.query.dateTo) {
    const dateFromResult = parseDateInput(req.query.dateFrom, "start date");
    const dateToResult = parseDateInput(req.query.dateTo, "end date", {
      end: true,
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

    match.createdAt = {};

    if (dateFromResult.value) {
      match.createdAt.$gte = dateFromResult.value;
    }

    if (dateToResult.value) {
      match.createdAt.$lte = dateToResult.value;
    }
  }

  if (!hasAdminAccess(req.user.role)) {
    addPersonalAccess(match, req.user);
  }

  return match;
};

const getDisplayKey = (issue) => {
  const explicitKey = typeof issue?.issueKey === "string" ? issue.issueKey.trim() : "";

  if (explicitKey) {
    return explicitKey;
  }

  const projectName = issue?.projectId?.name || issue?.project?.name || "";
  const projectKey =
    projectName
      .trim()
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((word) => word[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 4) || "WORK";
  const suffix = String(issue?._id || "").slice(-5).toUpperCase();

  return suffix ? `${projectKey}-${suffix}` : `${projectKey}-NEW`;
};

const serializeIssueRef = (issue, extra = {}) => {
  const assignee =
    issue?.assignee && typeof issue.assignee === "object"
      ? {
          _id: issue.assignee._id,
          name: issue.assignee.name,
          email: issue.assignee.email,
          role: issue.assignee.role,
        }
      : null;

  return {
    _id: issue._id,
    issueId: getDisplayKey(issue),
    title: issue.title,
    description: issue.description || "",
    type: issue.type || ISSUE_TYPES.TASK,
    priority: issue.priority || "Medium",
    status: getCanonicalIssueStatus(issue.status, ISSUE_STATUS.TODO),
    project: issue.projectId
      ? {
          _id: resolveObjectId(issue.projectId),
          name: issue.projectId.name || "Unknown project",
        }
      : null,
    team: issue.teamId
      ? {
          _id: resolveObjectId(issue.teamId),
          name: issue.teamId.name || "Unassigned team",
        }
      : null,
    assignee,
    createdAt: issue.createdAt,
    startedAt: issue.startedAt,
    severity: issue.bugDetails?.severity || null,
    tags: [
      issue.type || ISSUE_TYPES.TASK,
      issue.priority || "Medium",
      issue.bugDetails?.severity || null,
    ].filter(Boolean),
    ...extra,
  };
};

const loadScopedIssueIds = async (match) => Issue.find(match).distinct("_id");

const loadClosureMetrics = async (issues = []) => {
  const issueIds = issues.map((issue) => issue._id);

  if (!issueIds.length) {
    return {
      averageResolutionMs: null,
      closureByIssueId: new Map(),
    };
  }

  const closureEvents = await IssueHistory.aggregate([
    {
      $match: {
        issueId: {
          $in: issueIds,
        },
        field: "status",
        toValue: {
          $in: CLOSED_STATUSES,
        },
      },
    },
    {
      $sort: {
        createdAt: 1,
      },
    },
    {
      $group: {
        _id: "$issueId",
        closedAt: {
          $first: "$createdAt",
        },
      },
    },
  ]);
  const createdAtByIssueId = new Map(
    issues.map((issue) => [String(issue._id), issue.createdAt])
  );
  const closureByIssueId = new Map();
  const resolutionDurations = [];

  closureEvents.forEach((event) => {
    const issueId = String(event._id);
    const createdAt = createdAtByIssueId.get(issueId);
    const closedAt = event.closedAt;

    closureByIssueId.set(issueId, closedAt);

    if (createdAt && closedAt && closedAt >= createdAt) {
      resolutionDurations.push(closedAt.getTime() - createdAt.getTime());
    }
  });

  return {
    averageResolutionMs: resolutionDurations.length
      ? Math.round(
          resolutionDurations.reduce((sum, value) => sum + value, 0) /
            resolutionDurations.length
        )
      : null,
    closureByIssueId,
  };
};

const buildWeekTrend = async (baseMatch) => {
  const today = endOfDay(new Date());
  const currentStart = startOfDay(today.getTime() - 6 * DAY_IN_MS);
  const previousStart = startOfDay(currentStart.getTime() - 7 * DAY_IN_MS);
  const previousEnd = new Date(currentStart.getTime() - 1);
  const buildRangeMatch = (start, end) => ({
    ...baseMatch,
    createdAt: {
      ...(baseMatch.createdAt || {}),
      $gte: start,
      $lte: end,
    },
  });
  const [currentSummary] = await Issue.aggregate([
    {
      $match: buildRangeMatch(currentStart, today),
    },
    {
      $group: {
        _id: null,
        totalIssues: {
          $sum: 1,
        },
        openIssues: {
          $sum: {
            $cond: [{ $in: ["$status", CLOSED_STATUSES] }, 0, 1],
          },
        },
        closedIssues: {
          $sum: {
            $cond: [{ $in: ["$status", CLOSED_STATUSES] }, 1, 0],
          },
        },
        highPriorityIssues: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$priority", "High"] },
                  { $not: [{ $in: ["$status", CLOSED_STATUSES] }] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  const [previousSummary] = await Issue.aggregate([
    {
      $match: buildRangeMatch(previousStart, previousEnd),
    },
    {
      $group: {
        _id: null,
        totalIssues: {
          $sum: 1,
        },
        openIssues: {
          $sum: {
            $cond: [{ $in: ["$status", CLOSED_STATUSES] }, 0, 1],
          },
        },
        closedIssues: {
          $sum: {
            $cond: [{ $in: ["$status", CLOSED_STATUSES] }, 1, 0],
          },
        },
        highPriorityIssues: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$priority", "High"] },
                  { $not: [{ $in: ["$status", CLOSED_STATUSES] }] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  return {
    current: currentSummary || {},
    previous: previousSummary || {},
  };
};

const buildTrendMeta = (current = 0, previous = 0) => {
  const difference = Number(current || 0) - Number(previous || 0);
  const percent = previous ? Math.round((difference / previous) * 100) : current ? 100 : 0;

  return {
    current: Number(current || 0),
    previous: Number(previous || 0),
    difference,
    percent,
    direction: difference > 0 ? "up" : difference < 0 ? "down" : "flat",
    label:
      difference === 0
        ? "0 vs last week"
        : `${difference > 0 ? "+" : ""}${difference} vs last week`,
  };
};

const getOverviewPayload = async (match, user) => {
  const [facetResult] = await Issue.aggregate([
    {
      $match: match,
    },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              totalIssues: {
                $sum: 1,
              },
              openIssues: {
                $sum: {
                  $cond: [{ $in: ["$status", CLOSED_STATUSES] }, 0, 1],
                },
              },
              closedIssues: {
                $sum: {
                  $cond: [{ $in: ["$status", CLOSED_STATUSES] }, 1, 0],
                },
              },
              highPriorityIssues: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$priority", "High"] },
                        { $not: [{ $in: ["$status", CLOSED_STATUSES] }] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              activeTeamIds: {
                $addToSet: "$teamId",
              },
            },
          },
          {
            $project: {
              _id: 0,
              totalIssues: 1,
              openIssues: 1,
              closedIssues: 1,
              highPriorityIssues: 1,
              activeTeams: {
                $size: {
                  $filter: {
                    input: "$activeTeamIds",
                    as: "teamId",
                    cond: {
                      $ne: ["$$teamId", null],
                    },
                  },
                },
              },
            },
          },
        ],
        statusDistribution: [
          {
            $group: {
              _id: "$status",
              count: {
                $sum: 1,
              },
            },
          },
        ],
        priorityDistribution: [
          {
            $group: {
              _id: "$priority",
              count: {
                $sum: 1,
              },
            },
          },
        ],
      },
    },
  ]);
  const issues = await Issue.find(match)
    .select("_id createdAt status")
    .lean();
  const closureMetrics = await loadClosureMetrics(issues);
  const summary = facetResult?.summary?.[0] || {
    totalIssues: 0,
    openIssues: 0,
    closedIssues: 0,
    highPriorityIssues: 0,
    activeTeams: 0,
  };
  const resolutionRate = summary.totalIssues
    ? Math.round((summary.closedIssues / summary.totalIssues) * 100)
    : 0;
  const week = await buildWeekTrend(match);
  const statusCounts = new Map(
    (facetResult?.statusDistribution || []).map((row) => [
      getCanonicalIssueStatus(row._id, ISSUE_STATUS.TODO),
      row.count,
    ])
  );
  const priorityCounts = new Map(
    (facetResult?.priorityDistribution || []).map((row) => [row._id, row.count])
  );
  const statusDistribution = STATUS_ORDER.map((status) => ({
    key: status,
    label: STATUS_LABELS[status] || status,
    count: statusCounts.get(status) || 0,
    percentage: summary.totalIssues
      ? Math.round(((statusCounts.get(status) || 0) / summary.totalIssues) * 100)
      : 0,
  }));
  const priorityDistribution = PRIORITY_ORDER.map((priority) => ({
    key: priority,
    label: priority,
    count: priorityCounts.get(priority) || 0,
    percentage: summary.totalIssues
      ? Math.round(((priorityCounts.get(priority) || 0) / summary.totalIssues) * 100)
      : 0,
  }));
  const [mostActiveProject] = await buildProjectAnalytics(match, user, {
    limit: 1,
  });

  return {
    summary: {
      ...summary,
      avgResolutionTimeMs: closureMetrics.averageResolutionMs,
      resolutionRate,
      teamProductivity: resolutionRate,
    },
    trends: {
      totalIssues: buildTrendMeta(week.current.totalIssues, week.previous.totalIssues),
      openIssues: buildTrendMeta(week.current.openIssues, week.previous.openIssues),
      closedIssues: buildTrendMeta(week.current.closedIssues, week.previous.closedIssues),
      highPriorityIssues: buildTrendMeta(
        week.current.highPriorityIssues,
        week.previous.highPriorityIssues
      ),
    },
    statusDistribution,
    priorityDistribution,
    mostActiveProject: mostActiveProject || null,
  };
};

const buildProjectAnalytics = async (match, user, { limit = 0 } = {}) => {
  const rows = await Issue.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: "$projectId",
        totalIssues: {
          $sum: 1,
        },
        openIssues: {
          $sum: {
            $cond: [{ $in: ["$status", CLOSED_STATUSES] }, 0, 1],
          },
        },
        closedIssues: {
          $sum: {
            $cond: [{ $in: ["$status", CLOSED_STATUSES] }, 1, 0],
          },
        },
        highPriorityIssues: {
          $sum: {
            $cond: [{ $eq: ["$priority", "High"] }, 1, 0],
          },
        },
        teamIds: {
          $addToSet: "$teamId",
        },
      },
    },
    {
      $sort: {
        totalIssues: -1,
        openIssues: -1,
      },
    },
    ...(limit
      ? [
          {
            $limit: limit,
          },
        ]
      : []),
  ]);
  const projectIds = rows.map((row) => row._id).filter(Boolean);
  const projects = projectIds.length
    ? await Project.find({
        _id: {
          $in: projectIds,
        },
        workspaceId: normalizeWorkspaceId(user.workspaceId),
      })
        .select("name isCompleted")
        .lean()
    : [];
  const projectTeams = projectIds.length
    ? await ProjectTeam.find({
        projectId: {
          $in: projectIds,
        },
      })
        .populate("teamId", "name")
        .lean()
    : [];
  const projectsById = new Map(projects.map((project) => [String(project._id), project]));
  const teamNamesByProjectId = new Map();

  projectTeams.forEach((projectTeam) => {
    const projectId = String(projectTeam.projectId);
    const teamName = projectTeam.teamId?.name;

    if (!teamName) {
      return;
    }

    teamNamesByProjectId.set(projectId, [
      ...(teamNamesByProjectId.get(projectId) || []),
      teamName,
    ]);
  });

  return rows.map((row) => {
    const project = projectsById.get(String(row._id));
    const completionRate = row.totalIssues
      ? Math.round((row.closedIssues / row.totalIssues) * 100)
      : 0;

    return {
      projectId: row._id,
      name: project?.name || "Unknown project",
      totalIssues: row.totalIssues,
      openIssues: row.openIssues,
      closedIssues: row.closedIssues,
      highPriorityIssues: row.highPriorityIssues,
      completionRate,
      isCompleted: Boolean(project?.isCompleted),
      teamCount: (teamNamesByProjectId.get(String(row._id)) || []).length,
      teams: teamNamesByProjectId.get(String(row._id)) || [],
    };
  });
};

const buildTeamAnalytics = async (match, user, { limit = 0 } = {}) => {
  const rows = await Issue.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: "$teamId",
        totalIssues: {
          $sum: 1,
        },
        openIssues: {
          $sum: {
            $cond: [{ $in: ["$status", CLOSED_STATUSES] }, 0, 1],
          },
        },
        closedIssues: {
          $sum: {
            $cond: [{ $in: ["$status", CLOSED_STATUSES] }, 1, 0],
          },
        },
        highPriorityIssues: {
          $sum: {
            $cond: [{ $eq: ["$priority", "High"] }, 1, 0],
          },
        },
      },
    },
    {
      $sort: {
        totalIssues: -1,
        closedIssues: -1,
      },
    },
    ...(limit
      ? [
          {
            $limit: limit,
          },
        ]
      : []),
  ]);
  const teamIds = rows.map((row) => row._id).filter(Boolean);
  const [teams, memberCounts] = await Promise.all([
    teamIds.length
      ? Team.find({
          _id: {
            $in: teamIds,
          },
          workspaceId: normalizeWorkspaceId(user.workspaceId),
        })
          .select("name")
          .lean()
      : [],
    teamIds.length
      ? TeamMember.aggregate([
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
        ])
      : [],
  ]);
  const teamsById = new Map(teams.map((team) => [String(team._id), team]));
  const memberCountByTeamId = new Map(
    memberCounts.map((row) => [String(row._id), row.count])
  );

  return rows
    .filter((row) => row._id)
    .map((row) => {
      const team = teamsById.get(String(row._id));
      const completionRate = row.totalIssues
        ? Math.round((row.closedIssues / row.totalIssues) * 100)
        : 0;

      return {
        teamId: row._id,
        name: team?.name || "Unassigned team",
        totalIssues: row.totalIssues,
        openIssues: row.openIssues,
        closedIssues: row.closedIssues,
        highPriorityIssues: row.highPriorityIssues,
        pendingWorkload: row.openIssues,
        completionRate,
        productivity: completionRate,
        memberCount: memberCountByTeamId.get(String(row._id)) || 0,
      };
    });
};

const getTrendRange = (query) => {
  const end = query.dateTo ? endOfDay(query.dateTo) : endOfDay(new Date());
  const start = query.dateFrom
    ? startOfDay(query.dateFrom)
    : startOfDay(end.getTime() - 29 * DAY_IN_MS);

  return {
    start,
    end,
  };
};

const getDateKey = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

const getMonthKey = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
  }).format(new Date(value));

const buildTrendRows = async (match, req) => {
  const { start, end } = getTrendRange(req.query);
  const rangeMatch = {
    ...match,
    createdAt: {
      ...(match.createdAt || {}),
      $gte: start,
      $lte: end,
    },
  };
  const issueIds = await loadScopedIssueIds(match);
  const [createdRows, closedRows] = await Promise.all([
    Issue.aggregate([
      {
        $match: rangeMatch,
      },
      {
        $group: {
          _id: {
            $dateToString: {
              date: "$createdAt",
              format: "%Y-%m-%d",
            },
          },
          created: {
            $sum: 1,
          },
        },
      },
    ]),
    issueIds.length
      ? IssueHistory.aggregate([
          {
            $match: {
              issueId: {
                $in: issueIds,
              },
              field: "status",
              toValue: {
                $in: CLOSED_STATUSES,
              },
              createdAt: {
                $gte: start,
                $lte: end,
              },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  date: "$createdAt",
                  format: "%Y-%m-%d",
                },
              },
              closed: {
                $sum: 1,
              },
            },
          },
        ])
      : Promise.resolve([]),
  ]);
  const createdByDate = new Map(createdRows.map((row) => [row._id, row.created]));
  const closedByDate = new Map(closedRows.map((row) => [row._id, row.closed]));
  const dayCount = Math.min(
    Math.max(Math.round((end.getTime() - start.getTime()) / DAY_IN_MS) + 1, 1),
    90
  );
  const issueTrend = Array.from({ length: dayCount }, (_, index) => {
    const date = startOfDay(start.getTime() + index * DAY_IN_MS);
    const key = getDateKey(date);

    return {
      key,
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(date),
      created: createdByDate.get(key) || 0,
      closed: closedByDate.get(key) || 0,
    };
  });
  const weekEnd = endOfDay(new Date());
  const weeklyResolution = Array.from({ length: 6 }, (_, index) => {
    const weekStart = startOfDay(weekEnd.getTime() - (5 - index) * 7 * DAY_IN_MS);
    const weekFinish = endOfDay(weekStart.getTime() + 6 * DAY_IN_MS);
    const row = {
      key: getDateKey(weekStart),
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(weekStart),
      opened: 0,
      resolved: 0,
      resolutionRate: 0,
    };

    issueTrend.forEach((trendRow) => {
      const trendDate = new Date(trendRow.key);

      if (trendDate >= weekStart && trendDate <= weekFinish) {
        row.opened += trendRow.created;
        row.resolved += trendRow.closed;
      }
    });

    row.resolutionRate = row.opened ? Math.round((row.resolved / row.opened) * 100) : 0;
    return row;
  });
  const monthEnd = new Date();
  const monthStart = startOfDay(new Date(monthEnd.getFullYear(), monthEnd.getMonth() - 5, 1));
  const monthlyRows = await Issue.aggregate([
    {
      $match: {
        ...match,
        createdAt: {
          ...(match.createdAt || {}),
          $gte: monthStart,
          $lte: endOfDay(monthEnd),
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            date: "$createdAt",
            format: "%Y-%m",
          },
        },
        issues: {
          $sum: 1,
        },
      },
    },
  ]);
  const issuesByMonth = new Map(monthlyRows.map((row) => [row._id, row.issues]));
  const monthlyGrowth = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(monthEnd.getFullYear(), monthEnd.getMonth() - (5 - index), 1);
    const key = getMonthKey(date);

    return {
      key,
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
      }).format(date),
      issues: issuesByMonth.get(key) || 0,
    };
  });

  return {
    issueTrend,
    weeklyResolution,
    monthlyGrowth,
  };
};

const buildRecentActivity = async (match) => {
  const issueIds = await loadScopedIssueIds(match);
  const [createdIssues, assignedIssues, criticalIssues, closureEvents] = await Promise.all([
    Issue.find(match)
      .sort({ createdAt: -1 })
      .limit(8)
      .populate("projectId", "name")
      .populate("teamId", "name")
      .populate("assignee", "name email role")
      .lean(),
    Issue.find({
      ...match,
      assignee: {
        $ne: null,
      },
    })
      .sort({ startedAt: -1, createdAt: -1 })
      .limit(8)
      .populate("projectId", "name")
      .populate("teamId", "name")
      .populate("assignee", "name email role")
      .lean(),
    Issue.find({
      $and: [
        match,
        {
          status: {
            $nin: CLOSED_STATUSES,
          },
        },
        {
          $or: [
            { priority: "High" },
            {
              "bugDetails.severity": {
                $in: BUG_SEVERITY_VALUES.filter((severity) =>
                  ["Blocker", "Critical"].includes(severity)
                ),
              },
            },
          ],
        },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate("projectId", "name")
      .populate("teamId", "name")
      .populate("assignee", "name email role")
      .lean(),
    issueIds.length
      ? IssueHistory.find({
          issueId: {
            $in: issueIds,
          },
          field: "status",
          toValue: {
            $in: CLOSED_STATUSES,
          },
        })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean()
      : Promise.resolve([]),
  ]);
  const closedIssueIds = uniqueObjectIds(closureEvents.map((event) => event.issueId));
  const closedIssues = closedIssueIds.length
    ? await Issue.find({
        _id: {
          $in: closedIssueIds,
        },
      })
        .populate("projectId", "name")
        .populate("teamId", "name")
        .populate("assignee", "name email role")
        .lean()
    : [];
  const closedIssueById = new Map(
    closedIssues.map((issue) => [String(issue._id), issue])
  );
  const closedActivities = closureEvents
    .map((event) => {
      const issue = closedIssueById.get(String(event.issueId));

      if (!issue) {
        return null;
      }

      return serializeIssueRef(issue, {
        activityType: "closed",
        activityLabel: "Recently resolved",
        activityAt: event.createdAt,
      });
    })
    .filter(Boolean);
  const activities = [
    ...createdIssues.map((issue) =>
      serializeIssueRef(issue, {
        activityType: "created",
        activityLabel: "Recently created",
        activityAt: issue.createdAt,
      })
    ),
    ...assignedIssues.map((issue) =>
      serializeIssueRef(issue, {
        activityType: "assigned",
        activityLabel: "Assigned ticket",
        activityAt: issue.startedAt || issue.createdAt,
      })
    ),
    ...criticalIssues.map((issue) =>
      serializeIssueRef(issue, {
        activityType: "critical",
        activityLabel: "Critical issue alert",
        activityAt: issue.createdAt,
      })
    ),
    ...closedActivities,
  ];
  const uniqueActivities = new Map();

  activities.forEach((activity) => {
    uniqueActivities.set(`${activity.activityType}-${activity._id}`, activity);
  });

  return Array.from(uniqueActivities.values())
    .sort((left, right) => new Date(right.activityAt) - new Date(left.activityAt))
    .slice(0, 12);
};

const getOverview = asyncHandler(async (req, res) => {
  const match = await buildAnalyticsMatch(req, res);

  res.status(200).json(await getOverviewPayload(match, req.user));
});

const getTrends = asyncHandler(async (req, res) => {
  const match = await buildAnalyticsMatch(req, res);

  res.status(200).json(await buildTrendRows(match, req));
});

const getPriorities = asyncHandler(async (req, res) => {
  const match = await buildAnalyticsMatch(req, res);
  const rows = await Issue.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: "$priority",
        count: {
          $sum: 1,
        },
      },
    },
  ]);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const counts = new Map(rows.map((row) => [row._id, row.count]));

  res.status(200).json({
    priorities: PRIORITY_ORDER.map((priority) => ({
      key: priority,
      label: priority,
      count: counts.get(priority) || 0,
      percentage: total ? Math.round(((counts.get(priority) || 0) / total) * 100) : 0,
    })),
  });
});

const getProjects = asyncHandler(async (req, res) => {
  const match = await buildAnalyticsMatch(req, res);

  res.status(200).json({
    projects: await buildProjectAnalytics(match, req.user),
  });
});

const getTeams = asyncHandler(async (req, res) => {
  const match = await buildAnalyticsMatch(req, res);

  res.status(200).json({
    teams: await buildTeamAnalytics(match, req.user),
  });
});

const getRecentActivity = asyncHandler(async (req, res) => {
  const match = await buildAnalyticsMatch(req, res);

  res.status(200).json({
    activity: await buildRecentActivity(match),
  });
});

const getIssueAnalyticsRows = asyncHandler(async (req, res) => {
  const match = await buildAnalyticsMatch(req, res);
  const issues = await Issue.find(match)
    .sort({
      createdAt: -1,
    })
    .populate("projectId", "name")
    .populate("teamId", "name")
    .populate("assignee", "name email role")
    .lean();
  const { closureByIssueId } = await loadClosureMetrics(issues);

  res.status(200).json({
    issues: issues.map((issue) => {
      const closedAt = closureByIssueId.get(String(issue._id)) || null;
      const resolutionTimeMs =
        closedAt && issue.createdAt && closedAt >= issue.createdAt
          ? closedAt.getTime() - issue.createdAt.getTime()
          : null;

      return serializeIssueRef(issue, {
        closedAt,
        resolutionTimeMs,
      });
    }),
  });
});

module.exports = {
  getIssueAnalyticsRows,
  getOverview,
  getTrends,
  getPriorities,
  getProjects,
  getTeams,
  getRecentActivity,
};
