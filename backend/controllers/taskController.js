const { updateIssue } = require("./issueController");
const Issue = require("../models/Issue");
const asyncHandler = require("../utils/asyncHandler");
const {
  populateIssueQuery,
  serializeIssues,
} = require("../utils/issuePresentation");
const { ISSUE_STATUS } = require("../utils/issueStatus");
const { ISSUE_TYPES } = require("../utils/issueTypes");
const { ROLE_TESTER } = require("../utils/roles");

const RECENT_TASK_LIMIT = 5;

const TASK_STATUS_TO_ISSUE_STATUS = Object.freeze({
  OPEN: ISSUE_STATUS.TODO,
  TODO: ISSUE_STATUS.TODO,
  IN_PROGRESS: ISSUE_STATUS.IN_PROGRESS,
  DONE: ISSUE_STATUS.DONE,
});

const normalizeTaskStatusInput = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

const updateTaskStatus = (req, res, next) => {
  const requestedStatus = normalizeTaskStatusInput(req.body?.status);
  const issueStatus = TASK_STATUS_TO_ISSUE_STATUS[requestedStatus];

  if (!issueStatus) {
    res.status(400);
    next(new Error("Status must be OPEN, IN_PROGRESS, or DONE"));
    return undefined;
  }

  req.body = {
    status: issueStatus,
  };

  return updateIssue(req, res, next);
};

const getRecentTasks = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLE_TESTER) {
    res.status(403);
    throw new Error("Only testers can access recent tasks");
  }

  const tasks = await populateIssueQuery(
    Issue.find({
      assignee: req.user._id,
      type: ISSUE_TYPES.TASK,
    })
      .sort({
        createdAt: -1,
      })
      .limit(RECENT_TASK_LIMIT)
  );

  res.status(200).json(serializeIssues(tasks));
});

module.exports = {
  getRecentTasks,
  updateTaskStatus,
};
