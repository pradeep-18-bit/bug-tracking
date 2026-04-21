const IssueHistory = require("../models/IssueHistory");

const recordIssueHistory = async ({
  issueId,
  projectId,
  actorId,
  eventType,
  field = "",
  fromValue = null,
  toValue = null,
  meta = {},
}) => {
  if (!issueId || !projectId || !actorId || !eventType) {
    return null;
  }

  return IssueHistory.create({
    issueId,
    projectId,
    actorId,
    eventType,
    field,
    fromValue,
    toValue,
    meta,
  });
};

module.exports = {
  recordIssueHistory,
};
