const BUG_SEVERITIES = Object.freeze({
  BLOCKER: "Blocker",
  CRITICAL: "Critical",
  MAJOR: "Major",
  MINOR: "Minor",
});

const BUG_SEVERITY_VALUES = Object.freeze(Object.values(BUG_SEVERITIES));

const BUG_PRIORITIES = Object.freeze({
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
});

const BUG_PRIORITY_VALUES = Object.freeze(Object.values(BUG_PRIORITIES));

const BUG_STATUS = Object.freeze({
  NEW: "NEW",
  OPEN: "OPEN",
  ASSIGNED: "ASSIGNED",
  FIXED: "FIXED",
  CLOSED: "CLOSED",
  REOPEN: "REOPEN",
  REJECTED: "REJECTED",
  DEFERRED: "DEFERRED",
});

const BUG_STATUS_VALUES = Object.freeze(Object.values(BUG_STATUS));

const BUG_STATUS_LABELS = Object.freeze({
  [BUG_STATUS.NEW]: "New",
  [BUG_STATUS.OPEN]: "Open",
  [BUG_STATUS.ASSIGNED]: "Assigned",
  [BUG_STATUS.FIXED]: "Fixed",
  [BUG_STATUS.CLOSED]: "Closed",
  [BUG_STATUS.REOPEN]: "Reopen",
  [BUG_STATUS.REJECTED]: "Rejected",
  [BUG_STATUS.DEFERRED]: "Deferred",
});

const BUG_STATUS_FLOW = Object.freeze([
  BUG_STATUS.NEW,
  BUG_STATUS.OPEN,
  BUG_STATUS.ASSIGNED,
  BUG_STATUS.FIXED,
  BUG_STATUS.CLOSED,
]);

const BUG_ALTERNATE_TRANSITIONS = Object.freeze([
  [BUG_STATUS.FIXED, BUG_STATUS.REOPEN, BUG_STATUS.ASSIGNED],
  [BUG_STATUS.OPEN, BUG_STATUS.REJECTED],
  [BUG_STATUS.ASSIGNED, BUG_STATUS.REJECTED],
  [BUG_STATUS.OPEN, BUG_STATUS.DEFERRED],
  [BUG_STATUS.ASSIGNED, BUG_STATUS.DEFERRED],
]);

const BUG_ALLOWED_TRANSITIONS = Object.freeze({
  [BUG_STATUS.NEW]: Object.freeze([BUG_STATUS.OPEN]),
  [BUG_STATUS.OPEN]: Object.freeze([
    BUG_STATUS.ASSIGNED,
    BUG_STATUS.REJECTED,
    BUG_STATUS.DEFERRED,
  ]),
  [BUG_STATUS.ASSIGNED]: Object.freeze([
    BUG_STATUS.FIXED,
    BUG_STATUS.REJECTED,
    BUG_STATUS.DEFERRED,
  ]),
  [BUG_STATUS.FIXED]: Object.freeze([BUG_STATUS.CLOSED, BUG_STATUS.REOPEN]),
  [BUG_STATUS.REOPEN]: Object.freeze([BUG_STATUS.ASSIGNED]),
  [BUG_STATUS.CLOSED]: Object.freeze([]),
  [BUG_STATUS.REJECTED]: Object.freeze([]),
  [BUG_STATUS.DEFERRED]: Object.freeze([]),
});

const BUG_TERMINAL_STATUS_VALUES = Object.freeze([
  BUG_STATUS.CLOSED,
  BUG_STATUS.REJECTED,
  BUG_STATUS.DEFERRED,
]);

const normalizeToken = (value, fallback = "") => {
  if (value === null || typeof value === "undefined") {
    return fallback;
  }

  const normalizedValue = String(value)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  return normalizedValue || fallback;
};

const normalizeBugStatus = (value, fallback = "") => {
  const normalizedValue = normalizeToken(value, fallback);

  if (normalizedValue === "RE_OPEN" || normalizedValue === "REOPENED") {
    return BUG_STATUS.REOPEN;
  }

  return normalizedValue;
};

const getCanonicalBugStatus = (value, fallback = BUG_STATUS.NEW) => {
  const normalizedValue = normalizeBugStatus(value, fallback);

  if (BUG_STATUS_VALUES.includes(normalizedValue)) {
    return normalizedValue;
  }

  return fallback;
};

const isBugStatus = (value) => BUG_STATUS_VALUES.includes(normalizeBugStatus(value));

const getBugStatusLabel = (status) =>
  BUG_STATUS_LABELS[getCanonicalBugStatus(status, "")] || String(status || "");

const normalizeBugSeverity = (value, fallback = "") => {
  const normalizedValue = normalizeToken(value, fallback);

  return (
    BUG_SEVERITY_VALUES.find(
      (severity) => severity.toUpperCase() === normalizedValue
    ) || fallback
  );
};

const normalizeBugPriority = (value, fallback = "") => {
  const normalizedValue = normalizeToken(value, fallback);

  return (
    BUG_PRIORITY_VALUES.find(
      (priority) => priority.toUpperCase() === normalizedValue
    ) || fallback
  );
};

module.exports = {
  BUG_SEVERITIES,
  BUG_SEVERITY_VALUES,
  BUG_PRIORITIES,
  BUG_PRIORITY_VALUES,
  BUG_STATUS,
  BUG_STATUS_VALUES,
  BUG_STATUS_LABELS,
  BUG_STATUS_FLOW,
  BUG_ALTERNATE_TRANSITIONS,
  BUG_ALLOWED_TRANSITIONS,
  BUG_TERMINAL_STATUS_VALUES,
  normalizeBugStatus,
  getCanonicalBugStatus,
  isBugStatus,
  getBugStatusLabel,
  normalizeBugSeverity,
  normalizeBugPriority,
};
