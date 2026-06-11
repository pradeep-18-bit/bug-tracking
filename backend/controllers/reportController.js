const mongoose = require("mongoose");
const Issue = require("../models/Issue");
const IssueHistory = require("../models/IssueHistory");
const Project = require("../models/Project");
const Sprint = require("../models/Sprint");
const asyncHandler = require("../utils/asyncHandler");
const { ROLE_DEVELOPER } = require("../utils/roles");
const { ISSUE_STATUS } = require("../utils/issueStatus");
const { ISSUE_TYPES } = require("../utils/issueTypes");
const { BUG_STATUS, BUG_TERMINAL_STATUS_VALUES } = require("../utils/bugLifecycle");

const CLOSED_STATUSES = [
  ISSUE_STATUS.DONE,
  BUG_STATUS.CLOSED,
  BUG_STATUS.DONE,
];

const DONE_STATUSES = [
  ISSUE_STATUS.DONE,
  BUG_STATUS.CLOSED,
  BUG_STATUS.DONE,
  BUG_STATUS.FIXED,
];

const OPEN_STATUSES = [
  ISSUE_STATUS.TODO,
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.BLOCKED,
  ISSUE_STATUS.REVIEW,
  ISSUE_STATUS.QA,
  BUG_STATUS.NEW,
  BUG_STATUS.TRIAGED,
  BUG_STATUS.OPEN,
  BUG_STATUS.ASSIGNED,
  BUG_STATUS.IN_PROGRESS,
  BUG_STATUS.READY_FOR_QA,
  BUG_STATUS.TESTING,
  BUG_STATUS.REOPEN,
];

const TODO_STATUSES = [
  ISSUE_STATUS.TODO,
  BUG_STATUS.NEW,
  BUG_STATUS.TRIAGED,
  BUG_STATUS.OPEN,
  BUG_STATUS.ASSIGNED,
];

const IN_PROGRESS_STATUSES = [
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.BLOCKED,
  BUG_STATUS.IN_PROGRESS,
];

const CRITICAL_VALUES = ["Critical", "Blocker"];

const getDeveloperDashboardAnalytics = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);

  // Filters
  const { projectId, sprintId, dateFrom, dateTo, priority, severity } = req.query;
  const match = {
    isDeleted: { $ne: true },
    $or: [
      { assignee: userId },
      { "bugDetails.developerLead": userId }
    ]
  };

  if (projectId && projectId !== "all") {
    match.projectId = new mongoose.Types.ObjectId(projectId);
  }
  if (sprintId && sprintId !== "all") {
    match.sprintId = sprintId === "backlog" ? null : new mongoose.Types.ObjectId(sprintId);
  }
  if (priority && priority !== "all") {
    match.priority = priority;
  }
  if (severity && severity !== "all") {
    match["bugDetails.severity"] = severity;
  }
  if (dateFrom || dateTo) {
    match.createdAt = {};
    if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const dTo = new Date(dateTo);
      dTo.setHours(23, 59, 59, 999);
      match.createdAt.$lte = dTo;
    }
  }

  // Optimized data fetching using aggregation with $facet
  const [analyticsResult] = await Issue.aggregate([
    { $match: match },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              assignedWork: { $sum: 1 },
              openWork: { $sum: { $cond: [{ $in: ["$status", OPEN_STATUSES] }, 1, 0] } },
              completed: { $sum: { $cond: [{ $in: ["$status", CLOSED_STATUSES] }, 1, 0] } },
              readyForQa: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$type", ISSUE_TYPES.BUG] },
                        { $in: ["$status", [BUG_STATUS.READY_FOR_QA, BUG_STATUS.FIXED]] }
                      ]
                    },
                    1, 0
                  ]
                }
              },
              criticalBugs: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$type", ISSUE_TYPES.BUG] },
                        {
                          $or: [
                            { $in: ["$bugDetails.severity", CRITICAL_VALUES] },
                            { $in: ["$priority", CRITICAL_VALUES] }
                          ]
                        }
                      ]
                    },
                    1, 0
                  ]
                }
              }
            }
          }
        ],
        taskMetrics: [
          { $match: { type: { $ne: ISSUE_TYPES.BUG } } },
          {
            $group: {
              _id: null,
              assigned: { $sum: 1 },
              open: { $sum: { $cond: [{ $in: ["$status", [...TODO_STATUSES, ...IN_PROGRESS_STATUSES]] }, 1, 0] } },
              completed: { $sum: { $cond: [{ $eq: ["$status", ISSUE_STATUS.DONE] }, 1, 0] } },
              overdue: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ["$dueAt", null] },
                        { $lt: ["$dueAt", new Date()] },
                        { $ne: ["$status", ISSUE_STATUS.DONE] }
                      ]
                    },
                    1, 0
                  ]
                }
              },
              storyPointsCompleted: { $sum: { $cond: [{ $eq: ["$status", ISSUE_STATUS.DONE] }, { $ifNull: ["$storyPoints", 0] }, 0] } },
              sprintIds: { $addToSet: "$sprintId" }
            }
          }
        ],
        bugMetrics: [
          { $match: { type: ISSUE_TYPES.BUG } },
          {
            $group: {
              _id: null,
              assigned: { $sum: 1 },
              inProgress: { $sum: { $cond: [{ $eq: ["$status", BUG_STATUS.IN_PROGRESS] }, 1, 0] } },
              readyForQa: { $sum: { $cond: [{ $in: ["$status", [BUG_STATUS.READY_FOR_QA, BUG_STATUS.FIXED]] }, 1, 0] } },
              reopened: { $sum: { $cond: [{ $eq: ["$status", BUG_STATUS.REOPEN] }, 1, 0] } },
              closed: { $sum: { $cond: [{ $in: ["$status", [BUG_STATUS.CLOSED, BUG_STATUS.DONE]] }, 1, 0] } },
              critical: { $sum: { $cond: [{ $in: ["$bugDetails.severity", CRITICAL_VALUES] }, 1, 0] } },
              totalReopenedCount: { $sum: { $cond: [{ $gt: ["$reopenedCount", 0] }, 1, 0] } },
              totalClosedEver: { $sum: { $cond: [{ $ne: ["$closedAt", null] }, 1, 0] } },
              closedWithoutReopen: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $in: ["$status", [BUG_STATUS.CLOSED, BUG_STATUS.DONE]] },
                        { $eq: [{ $ifNull: ["$reopenedCount", 0] }, 0] }
                      ]
                    },
                    1, 0
                  ]
                }
              }
            }
          }
        ],
        severityBreakdown: [
          { $match: { type: ISSUE_TYPES.BUG } },
          {
            $group: {
              _id: "$bugDetails.severity",
              count: { $sum: 1 }
            }
          }
        ],
        typeBreakdown: [
          { $match: { type: ISSUE_TYPES.BUG } },
          {
            $group: {
              _id: "$bugDetails.category",
              count: { $sum: 1 }
            }
          }
        ],
        moduleStats: [
          {
            $group: {
              _id: { $ifNull: ["$bugDetails.moduleName", "General"] },
              tasks: { $sum: { $cond: [{ $ne: ["$type", ISSUE_TYPES.BUG] }, 1, 0] } },
              bugs: { $sum: { $cond: [{ $eq: ["$type", ISSUE_TYPES.BUG] }, 1, 0] } },
              completed: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $and: [{ $ne: ["$type", ISSUE_TYPES.BUG] }, { $eq: ["$status", ISSUE_STATUS.DONE] }] },
                        { $and: [{ $eq: ["$type", ISSUE_TYPES.BUG] }, { $in: ["$status", CLOSED_STATUSES] }] }
                      ]
                    },
                    1, 0
                  ]
                }
              }
            }
          }
        ],
        rawIssues: [
          { $project: { _id: 1, type: 1, status: 1, createdAt: 1, startedAt: 1, closedAt: 1, reopenedCount: 1 } }
        ]
      }
    }
  ]);

  const summary = analyticsResult.summary[0] || {
    assignedWork: 0,
    openWork: 0,
    completed: 0,
    readyForQa: 0,
    criticalBugs: 0,
    productivity: 0
  };
  summary.productivity = summary.assignedWork ? Math.round((summary.completed / summary.assignedWork) * 100) : 0;

  const taskMetricsRaw = analyticsResult.taskMetrics[0] || {
    assigned: 0,
    open: 0,
    completed: 0,
    overdue: 0,
    storyPointsCompleted: 0,
    sprintIds: []
  };
  const taskMetrics = {
    ...taskMetricsRaw,
    completionRate: taskMetricsRaw.assigned ? Math.round((taskMetricsRaw.completed / taskMetricsRaw.assigned) * 100) : 0,
    sprintParticipation: taskMetricsRaw.sprintIds.filter(Boolean).length
  };

  const bugMetricsRaw = analyticsResult.bugMetrics[0] || {
    assigned: 0,
    inProgress: 0,
    readyForQa: 0,
    reopened: 0,
    closed: 0,
    critical: 0,
    totalReopenedCount: 0,
    totalClosedEver: 0,
    closedWithoutReopen: 0
  };
  const bugMetrics = {
    ...bugMetricsRaw,
    reopenRate: bugMetricsRaw.totalClosedEver || bugMetricsRaw.closed ? Math.round((bugMetricsRaw.totalReopenedCount / (bugMetricsRaw.totalClosedEver || bugMetricsRaw.closed)) * 100) : 0,
    fixSuccessRate: bugMetricsRaw.closed ? Math.round((bugMetricsRaw.closedWithoutReopen / bugMetricsRaw.closed) * 100) : 0
  };

  // Lead and Cycle Time Calculations
  const calculateAvgTime = (issues, useStartedAt = false) => {
    const durations = issues
      .filter(i => i.closedAt && (useStartedAt ? i.startedAt : i.createdAt))
      .map(i => new Date(i.closedAt) - new Date(useStartedAt ? i.startedAt : i.createdAt))
      .filter(d => d >= 0);
    return durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  };

  const rawTasks = analyticsResult.rawIssues.filter(i => i.type !== ISSUE_TYPES.BUG);
  const rawBugs = analyticsResult.rawIssues.filter(i => i.type === ISSUE_TYPES.BUG);

  taskMetrics.avgLeadTime = calculateAvgTime(rawTasks);
  taskMetrics.avgCycleTime = calculateAvgTime(rawTasks, true);
  bugMetrics.avgLeadTime = calculateAvgTime(rawBugs);
  bugMetrics.avgCycleTime = calculateAvgTime(rawBugs, true);
  bugMetrics.avgResolutionTime = bugMetrics.avgLeadTime;

  // Severity Breakdown
  const severityMap = analyticsResult.severityBreakdown.reduce((acc, curr) => {
    acc[curr._id] = curr.count;
    return acc;
  }, {});

  bugMetrics.severityBreakdown = {
    Critical: (severityMap["Critical"] || 0) + (severityMap["Blocker"] || 0),
    Major: severityMap["Major"] || 0,
    Minor: severityMap["Minor"] || 0,
    Low: severityMap["Low"] || 0,
  };

  bugMetrics.typeBreakdown = analyticsResult.typeBreakdown.reduce((acc, curr) => {
    acc[curr._id || "Other"] = curr.count;
    return acc;
  }, {});

  // Velocity - last 6 sprints
  const sprints = await Sprint.find({
    workspaceId: req.user.workspaceId,
    state: "COMPLETED"
  }).sort({ endDate: -1 }).limit(6).lean();

  const sprintIds = sprints.map(s => s._id);

  const sprintData = await Issue.aggregate([
    {
      $match: {
        sprintId: { $in: sprintIds },
        $or: [{ assignee: userId }, { "bugDetails.developerLead": userId }],
        status: { $in: CLOSED_STATUSES },
        isDeleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: { sprintId: "$sprintId", type: "$type" },
        count: { $sum: 1 }
      }
    }
  ]);

  const sprintTrend = sprints.map(s => {
    const tasks = sprintData.find(d => d._id.sprintId.equals(s._id) && d._id.type !== ISSUE_TYPES.BUG)?.count || 0;
    const bugs = sprintData.find(d => d._id.sprintId.equals(s._id) && d._id.type === ISSUE_TYPES.BUG)?.count || 0;
    return {
      sprint: s.name,
      name: s.name,
      tasks,
      bugs,
      completed: tasks + bugs
    };
  }).reverse();

  const charts = {
    workDistribution: [
      { name: "Tasks", value: taskMetrics.assigned },
      { name: "Bugs", value: bugMetrics.assigned },
    ],
    severityDistribution: [
      { name: "Critical", value: bugMetrics.severityBreakdown.Critical },
      { name: "Major", value: bugMetrics.severityBreakdown.Major },
      { name: "Minor", value: bugMetrics.severityBreakdown.Minor },
      { name: "Low", value: bugMetrics.severityBreakdown.Low },
    ],
    sprintTrend,
  };

  const recentHistory = await IssueHistory.find({
    actorId: userId,
  }).sort({ createdAt: -1 }).limit(15).populate("issueId", "title type displayBugId").lean();

  const recentActivity = recentHistory.map(h => ({
    id: h._id,
    action: h.eventType === "BUG_STATUS_CHANGED" || h.field === "status" ? `Moved to ${h.toValue}` : h.eventType,
    issueTitle: h.issueId?.title,
    issueId: h.issueId?.displayBugId || h.issueId?._id,
    type: h.issueId?.type,
    createdAt: h.createdAt
  }));

  const moduleStats = analyticsResult.moduleStats.map(m => ({
    name: m._id,
    tasks: m.tasks,
    bugs: m.bugs,
    completed: m.completed
  }));

  const now = new Date();
  const lastSprintStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const prevSprintStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const [lastSprintCount, prevSprintCount] = await Promise.all([
    Issue.countDocuments({
      ...match,
      status: { $in: CLOSED_STATUSES },
      updatedAt: { $gte: lastSprintStart }
    }),
    Issue.countDocuments({
      ...match,
      status: { $in: CLOSED_STATUSES },
      updatedAt: { $gte: prevSprintStart, $lt: lastSprintStart }
    })
  ]);

  let trend = 0;
  if (prevSprintCount > 0) {
    trend = Math.round(((lastSprintCount - prevSprintCount) / prevSprintCount) * 100);
  } else if (lastSprintCount > 0) {
    trend = 100;
  }

  const productivityScore = {
    current: summary.productivity,
    trend: trend,
    velocity: summary.completed,
  };

  const analytics = {
    summary,
    taskMetrics,
    bugMetrics,
    productivityScore,
    charts,
    recentActivity,
    moduleStats,
  };

  console.log("Analytics Response", JSON.stringify(analytics, null, 2));

  res.status(200).json(analytics);
});

module.exports = {
  getDeveloperDashboardAnalytics,
};
