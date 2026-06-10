const {
  BUG_STATUS,
  BUG_STATUS_VALUES,
  BUG_TERMINAL_STATUS_VALUES,
  normalizeBugStatus,
} = require("./bugLifecycle");

const ISSUE_STATUS = Object.freeze({
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  REVIEW: "REVIEW",
  QA: "QA",
  DONE: "DONE",
  ...BUG_STATUS,
});

const ISSUE_STATUS_VALUES = Object.freeze(Object.values(ISSUE_STATUS));
const GENERIC_ISSUE_STATUS_VALUES = Object.freeze([
  ISSUE_STATUS.TODO,
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.BLOCKED,
  ISSUE_STATUS.REVIEW,
  ISSUE_STATUS.QA,
  ISSUE_STATUS.DONE,
]);
const ACTIVE_ISSUE_STATUS_VALUES = Object.freeze([
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.BLOCKED,
  ISSUE_STATUS.REVIEW,
  ISSUE_STATUS.QA,
  ISSUE_STATUS.OPEN,
  ISSUE_STATUS.NEEDS_TRIAGE,
  ISSUE_STATUS.AVAILABLE_QUEUE,
  ISSUE_STATUS.TRIAGED,
  ISSUE_STATUS.ASSIGNED,
  ISSUE_STATUS.READY_FOR_QA,
  ISSUE_STATUS.TESTING,
  ISSUE_STATUS.FIXED,
  ISSUE_STATUS.REOPEN,
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
    return BUG_STATUS.READY_FOR_QA;
  }

  const normalizedBugStatus = normalizeBugStatus(normalizedValue, "");

  if (BUG_STATUS_VALUES.includes(normalizedBugStatus)) {
    return normalizedBugStatus;
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
  [ISSUE_STATUS.DONE, ...BUG_TERMINAL_STATUS_VALUES].includes(
    getCanonicalIssueStatus(value, ISSUE_STATUS.TODO)
  );

const isInProgressIssueStatus = (value) =>
  ACTIVE_ISSUE_STATUS_VALUES.includes(
    getCanonicalIssueStatus(value, ISSUE_STATUS.TODO)
  );

module.exports = {
  ISSUE_STATUS,
  ISSUE_STATUS_VALUES,
  GENERIC_ISSUE_STATUS_VALUES,
  ACTIVE_ISSUE_STATUS_VALUES,
  normalizeIssueStatus,
  isValidIssueStatus,
  getCanonicalIssueStatus,
  isClosedIssueStatus,
  isInProgressIssueStatus,
};
