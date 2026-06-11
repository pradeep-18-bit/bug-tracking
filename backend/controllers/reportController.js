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
  const userId = req.user._id;

  // Filters
  const { projectId, sprintId, dateFrom, dateTo, priority, severity } = req.query;
  const match = {
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

  // Optimized aggregation for summary and metrics
  const issues = await Issue.find(match).lean();

  const taskIssues = issues.filter(i => i.type !== ISSUE_TYPES.BUG);
  const bugIssues = issues.filter(i => i.type === ISSUE_TYPES.BUG);

  const summary = {
    assignedWork: issues.length,
    openWork: issues.filter(i => OPEN_STATUSES.includes(i.status)).length,
    completed: issues.filter(i => CLOSED_STATUSES.includes(i.status)).length,
    readyForQa: bugIssues.filter(i => i.status === BUG_STATUS.READY_FOR_QA || i.status === BUG_STATUS.FIXED).length,
    criticalBugs: bugIssues.filter(i => CRITICAL_VALUES.includes(i.bugDetails?.severity) || CRITICAL_VALUES.includes(i.priority)).length,
  };
  summary.productivity = summary.assignedWork ? Math.round((summary.completed / summary.assignedWork) * 100) : 0;

  const completedTasks = taskIssues.filter(i => i.status === ISSUE_STATUS.DONE);
  const taskMetrics = {
    assigned: taskIssues.length,
    open: taskIssues.filter(i => TODO_STATUSES.includes(i.status) || IN_PROGRESS_STATUSES.includes(i.status)).length,
    completed: completedTasks.length,
    overdue: taskIssues.filter(i => i.dueAt && new Date(i.dueAt) < new Date() && i.status !== ISSUE_STATUS.DONE).length,
    storyPointsCompleted: completedTasks.reduce((sum, i) => sum + (i.storyPoints || 0), 0),
    sprintParticipation: [...new Set(taskIssues.map(i => i.sprintId).filter(Boolean))].length,
  };
  taskMetrics.completionRate = taskMetrics.assigned ? Math.round((taskMetrics.completed / taskMetrics.assigned) * 100) : 0;

  const taskLeadDurations = completedTasks
    .map(i => i.closedAt && i.createdAt ? new Date(i.closedAt) - new Date(i.createdAt) : null)
    .filter(d => d !== null && d >= 0);
  taskMetrics.avgLeadTime = taskLeadDurations.length
    ? Math.round(taskLeadDurations.reduce((a, b) => a + b, 0) / taskLeadDurations.length)
    : 0;

  const taskCycleDurations = completedTasks
    .map(i => i.closedAt && i.startedAt ? new Date(i.closedAt) - new Date(i.startedAt) : null)
    .filter(d => d !== null && d >= 0);
  taskMetrics.avgCycleTime = taskCycleDurations.length
    ? Math.round(taskCycleDurations.reduce((a, b) => a + b, 0) / taskCycleDurations.length)
    : 0;

  const closedBugs = bugIssues.filter(i => i.status === BUG_STATUS.CLOSED || i.status === BUG_STATUS.DONE);
  const bugMetrics = {
    assigned: bugIssues.length,
    inProgress: bugIssues.filter(i => i.status === BUG_STATUS.IN_PROGRESS).length,
    readyForQa: bugIssues.filter(i => i.status === BUG_STATUS.READY_FOR_QA || i.status === BUG_STATUS.FIXED).length,
    reopened: bugIssues.filter(i => i.status === BUG_STATUS.REOPEN).length,
    closed: closedBugs.length,
    critical: bugIssues.filter(i => CRITICAL_VALUES.includes(i.bugDetails?.severity)).length,
  };

  const totalClosedEver = bugIssues.filter(i => i.closedAt).length || closedBugs.length;
  bugMetrics.reopenRate = totalClosedEver ? Math.round((bugIssues.filter(i => (i.reopenedCount || 0) > 0).length / totalClosedEver) * 100) : 0;

  const closedWithoutReopen = bugIssues.filter(i => (i.status === BUG_STATUS.CLOSED || i.status === BUG_STATUS.DONE) && (i.reopenedCount || 0) === 0).length;
  bugMetrics.fixSuccessRate = closedBugs.length ? Math.round((closedWithoutReopen / closedBugs.length) * 100) : 0;

  const bugLeadDurations = closedBugs
    .map(i => i.closedAt && i.createdAt ? new Date(i.closedAt) - new Date(i.createdAt) : null)
    .filter(d => d !== null && d >= 0);
  bugMetrics.avgLeadTime = bugLeadDurations.length
    ? Math.round(bugLeadDurations.reduce((a, b) => a + b, 0) / bugLeadDurations.length)
    : 0;

  const bugCycleDurations = closedBugs
    .map(i => i.closedAt && i.startedAt ? new Date(i.closedAt) - new Date(i.startedAt) : null)
    .filter(d => d !== null && d >= 0);
  bugMetrics.avgCycleTime = bugCycleDurations.length
    ? Math.round(bugCycleDurations.reduce((a, b) => a + b, 0) / bugCycleDurations.length)
    : 0;

  // Use Lead Time as a fallback for Avg Resolution Time if needed
  bugMetrics.avgResolutionTime = bugMetrics.avgLeadTime;

  // Severity Breakdown
  bugMetrics.severityBreakdown = {
    Critical: bugIssues.filter(i => i.bugDetails?.severity === "Critical" || i.bugDetails?.severity === "Blocker").length,
    Major: bugIssues.filter(i => i.bugDetails?.severity === "Major").length,
    Minor: bugIssues.filter(i => i.bugDetails?.severity === "Minor").length,
    Low: bugIssues.filter(i => i.bugDetails?.severity === "Low").length,
  };

  // Type Breakdown
  bugMetrics.typeBreakdown = bugIssues.reduce((acc, i) => {
    const type = i.bugDetails?.category || "Other";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  // Velocity - last 6 sprints
  const sprints = await Sprint.find({
    workspaceId: req.user.workspaceId,
    state: "COMPLETED"
  }).sort({ endDate: -1 }).limit(6).lean();

  const sprintVelocity = await Promise.all(sprints.map(async (sprint) => {
    const sprintIssues = await Issue.find({
      sprintId: sprint._id,
      $or: [{ assignee: userId }, { "bugDetails.developerLead": userId }],
      status: { $in: CLOSED_STATUSES }
    }).countDocuments();
    return {
      name: sprint.name,
      completed: sprintIssues
    };
  }));

  // Work Distribution
  const charts = {
    workDistribution: [
      { name: "Tasks", value: taskIssues.length },
      { name: "Bugs", value: bugIssues.length },
    ],
    severityDistribution: Object.entries(bugMetrics.severityBreakdown).map(([name, value]) => ({ name, value })),
    sprintTrend: sprintVelocity.reverse(),
  };

  // Recent Activity
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

  // Module Stats
  const moduleMap = issues.reduce((acc, i) => {
    const module = i.bugDetails?.moduleName || "General";
    if (!acc[module]) acc[module] = { name: module, tasks: 0, bugs: 0, completed: 0 };
    if (i.type === ISSUE_TYPES.BUG) {
      acc[module].bugs += 1;
      if (CLOSED_STATUSES.includes(i.status)) acc[module].completed += 1;
    } else {
      acc[module].tasks += 1;
      if (i.status === ISSUE_STATUS.DONE) acc[module].completed += 1;
    }
    return acc;
  }, {});

  // Performance trends
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

  res.status(200).json({
    summary,
    taskMetrics,
    bugMetrics,
    productivityScore,
    charts,
    recentActivity,
    moduleStats: Object.values(moduleMap),
  });
});

module.exports = {
  getDeveloperDashboardAnalytics,
};
