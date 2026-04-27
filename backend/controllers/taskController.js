const { updateIssue } = require("./issueController");
const { ISSUE_STATUS } = require("../utils/issueStatus");

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

module.exports = {
  updateTaskStatus,
};
