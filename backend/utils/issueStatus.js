const ISSUE_STATUS = Object.freeze({
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  REVIEW: "REVIEW",
  QA: "QA",
  DONE: "DONE",
});

const ISSUE_STATUS_VALUES = Object.freeze(Object.values(ISSUE_STATUS));
const ACTIVE_ISSUE_STATUS_VALUES = Object.freeze([
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.BLOCKED,
  ISSUE_STATUS.REVIEW,
  ISSUE_STATUS.QA,
]);

const normalizeIssueStatus = (value, fallback = "") => {
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

  if (normalizedValue === "INPROGRESS") {
    return ISSUE_STATUS.IN_PROGRESS;
  }

  if (normalizedValue === "TO_DO") {
    return ISSUE_STATUS.TODO;
  }

  if (normalizedValue === "IN_REVIEW") {
    return ISSUE_STATUS.REVIEW;
  }

  if (normalizedValue === "READY_FOR_QA") {
    return ISSUE_STATUS.QA;
  }

  return normalizedValue;
};

const isValidIssueStatus = (value) =>
  ISSUE_STATUS_VALUES.includes(normalizeIssueStatus(value));

const getCanonicalIssueStatus = (value, fallback = ISSUE_STATUS.TODO) => {
  const normalizedValue = normalizeIssueStatus(value, fallback);

  if (ISSUE_STATUS_VALUES.includes(normalizedValue)) {
    return normalizedValue;
  }

  return fallback;
};

const isClosedIssueStatus = (value) =>
  getCanonicalIssueStatus(value, ISSUE_STATUS.TODO) === ISSUE_STATUS.DONE;

const isInProgressIssueStatus = (value) =>
  ACTIVE_ISSUE_STATUS_VALUES.includes(
    getCanonicalIssueStatus(value, ISSUE_STATUS.TODO)
  );

module.exports = {
  ISSUE_STATUS,
  ISSUE_STATUS_VALUES,
  ACTIVE_ISSUE_STATUS_VALUES,
  normalizeIssueStatus,
  isValidIssueStatus,
  getCanonicalIssueStatus,
  isClosedIssueStatus,
  isInProgressIssueStatus,
};
