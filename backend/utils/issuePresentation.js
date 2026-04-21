const {
  ISSUE_STATUS,
  getCanonicalIssueStatus,
} = require("../utils/issueStatus");

const issuePopulation = [
  { path: "assignee", select: "name email role" },
  { path: "dependsOnIssueId", select: "title status dueAt" },
  { path: "reporter", select: "name email role" },
  { path: "projectId", select: "name description createdBy isCompleted manager teamLead" },
  { path: "teamId", select: "name description workspaceId" },
  { path: "epicId", select: "name color status planningOrder" },
  { path: "sprintId", select: "name state startDate endDate teamId startedAt completedAt" },
];

const populateIssueQuery = (query) => query.populate(issuePopulation);

const populateIssueDocument = (issue) => issue.populate(issuePopulation);

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

module.exports = {
  populateIssueQuery,
  populateIssueDocument,
  serializeIssue,
  serializeIssues,
};
