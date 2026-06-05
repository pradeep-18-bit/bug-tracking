const { ISSUE_TYPES } = require("./issueTypes");

const PLANNING_ISSUE_TYPES = Object.freeze([
  ISSUE_TYPES.TASK,
  ISSUE_TYPES.STORY,
  "Feature",
  "Enhancement",
  ISSUE_TYPES.EPIC,
]);

const normalizePlanningIssueType = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

const PLANNING_ISSUE_TYPE_KEYS = new Set(
  PLANNING_ISSUE_TYPES.map(normalizePlanningIssueType)
);

const isPlanningIssueType = (value) =>
  PLANNING_ISSUE_TYPE_KEYS.has(normalizePlanningIssueType(value));

const buildPlanningIssueTypeQuery = () => ({
  type: {
    $in: PLANNING_ISSUE_TYPES,
  },
});

module.exports = {
  PLANNING_ISSUE_TYPES,
  buildPlanningIssueTypeQuery,
  isPlanningIssueType,
};
