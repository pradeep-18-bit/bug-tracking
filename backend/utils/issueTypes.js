const ISSUE_TYPES = Object.freeze({
  TASK: "Task",
  STORY: "Story",
  BUG: "Bug",
  EPIC: "Epic",
  SUB_TASK: "Sub-task",
});

const ISSUE_TYPE_VALUES = Object.freeze(Object.values(ISSUE_TYPES));

const normalizeIssueType = (value, fallback = "") => {
  if (value === null || typeof value === "undefined") {
    return fallback;
  }

  const normalizedValue = String(value)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (!normalizedValue) {
    return fallback;
  }

  if (normalizedValue === "SUBTASK") {
    return ISSUE_TYPES.SUB_TASK;
  }

  return (
    ISSUE_TYPE_VALUES.find(
      (issueType) =>
        issueType.toUpperCase().replace(/[\s-]+/g, "_") === normalizedValue
    ) || fallback
  );
};

const getCanonicalIssueType = (value, fallback = ISSUE_TYPES.TASK) =>
  normalizeIssueType(value, fallback) || fallback;

const isValidIssueType = (value) =>
  ISSUE_TYPE_VALUES.includes(getCanonicalIssueType(value, ""));

module.exports = {
  ISSUE_TYPES,
  ISSUE_TYPE_VALUES,
  normalizeIssueType,
  getCanonicalIssueType,
  isValidIssueType,
};
