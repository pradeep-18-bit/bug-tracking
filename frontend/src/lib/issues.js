export const ISSUE_STATUS = Object.freeze({
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  REVIEW: "REVIEW",
  QA: "QA",
  DONE: "DONE",
  NEW: "NEW",
  OPEN: "OPEN",
  ASSIGNED: "ASSIGNED",
  FIXED: "FIXED",
  CLOSED: "CLOSED",
  RESOLVED: "RESOLVED",
  REOPEN: "REOPEN",
  REJECTED: "REJECTED",
  DEFERRED: "DEFERRED",
});

export const ISSUE_ACTIVE_STATUS_VALUES = Object.freeze([
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.BLOCKED,
  ISSUE_STATUS.REVIEW,
  ISSUE_STATUS.QA,
  ISSUE_STATUS.OPEN,
  ISSUE_STATUS.ASSIGNED,
  ISSUE_STATUS.FIXED,
  ISSUE_STATUS.REOPEN,
]);

export const BUG_SEVERITY_OPTIONS = ["Blocker", "Critical", "Major", "Minor"];
export const BUG_PRIORITY_OPTIONS = ["Critical", "High", "Medium", "Low"];
export const BUG_STATUS_OPTIONS = [
  { value: ISSUE_STATUS.NEW, label: "New" },
  { value: ISSUE_STATUS.OPEN, label: "Open" },
  { value: ISSUE_STATUS.ASSIGNED, label: "Assigned" },
  { value: ISSUE_STATUS.FIXED, label: "Fixed" },
  { value: ISSUE_STATUS.CLOSED, label: "Closed" },
  { value: ISSUE_STATUS.REOPEN, label: "Reopen" },
  { value: ISSUE_STATUS.REJECTED, label: "Rejected" },
  { value: ISSUE_STATUS.DEFERRED, label: "Deferred" },
];
export const BUG_STATUS_FLOW = [
  ISSUE_STATUS.NEW,
  ISSUE_STATUS.OPEN,
  ISSUE_STATUS.ASSIGNED,
  ISSUE_STATUS.FIXED,
  ISSUE_STATUS.CLOSED,
];
export const BUG_ALTERNATE_TRANSITIONS = [
  [ISSUE_STATUS.FIXED, ISSUE_STATUS.REOPEN, ISSUE_STATUS.ASSIGNED],
  [ISSUE_STATUS.OPEN, ISSUE_STATUS.REJECTED],
  [ISSUE_STATUS.ASSIGNED, ISSUE_STATUS.REJECTED],
  [ISSUE_STATUS.OPEN, ISSUE_STATUS.DEFERRED],
  [ISSUE_STATUS.ASSIGNED, ISSUE_STATUS.DEFERRED],
];
export const BUG_TERMINAL_STATUSES = [
  ISSUE_STATUS.CLOSED,
  ISSUE_STATUS.REJECTED,
  ISSUE_STATUS.DEFERRED,
];
export const BUG_LIFECYCLE_STATUSES = BUG_STATUS_OPTIONS.map((option) => option.value);
export const ISSUE_COMPLETED_STATUSES = Object.freeze([
  ISSUE_STATUS.CLOSED,
  ISSUE_STATUS.RESOLVED,
  ISSUE_STATUS.DONE,
]);
export const ISSUE_HIGH_PRIORITY_VALUES = Object.freeze([
  "High",
  "Critical",
  "Urgent",
]);

export const ISSUE_STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: ISSUE_STATUS.TODO, label: "To Do" },
  { value: ISSUE_STATUS.IN_PROGRESS, label: "In Progress" },
  { value: ISSUE_STATUS.BLOCKED, label: "Blocked" },
  { value: ISSUE_STATUS.REVIEW, label: "Review" },
  { value: ISSUE_STATUS.QA, label: "QA" },
  { value: ISSUE_STATUS.DONE, label: "Done" },
  ...BUG_STATUS_OPTIONS,
];

export const ISSUE_WORKFLOW_STATUS_OPTIONS = ISSUE_STATUS_OPTIONS.filter(
  (option) => option.value !== "all"
);
export const GENERIC_ISSUE_WORKFLOW_STATUS_OPTIONS = [
  { value: ISSUE_STATUS.TODO, label: "To Do" },
  { value: ISSUE_STATUS.IN_PROGRESS, label: "In Progress" },
  { value: ISSUE_STATUS.BLOCKED, label: "Blocked" },
  { value: ISSUE_STATUS.REVIEW, label: "Review" },
  { value: ISSUE_STATUS.QA, label: "QA" },
  { value: ISSUE_STATUS.DONE, label: "Done" },
];

export const ISSUE_TYPES = Object.freeze({
  TASK: "Task",
  STORY: "Story",
  BUG: "Bug",
  EPIC: "Epic",
  SUB_TASK: "Sub-task",
});

export const ISSUE_TYPE_OPTIONS = [
  ISSUE_TYPES.TASK,
  ISSUE_TYPES.STORY,
  ISSUE_TYPES.BUG,
  ISSUE_TYPES.EPIC,
  ISSUE_TYPES.SUB_TASK,
];

export const ISSUE_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "priority", label: "Priority" },
  { value: "recently-started", label: "Recently started" },
];

const priorityRank = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const workflowRank = {
  [ISSUE_STATUS.IN_PROGRESS]: 0,
  [ISSUE_STATUS.BLOCKED]: 1,
  [ISSUE_STATUS.REVIEW]: 2,
  [ISSUE_STATUS.QA]: 3,
  [ISSUE_STATUS.TODO]: 4,
  [ISSUE_STATUS.DONE]: 5,
  [ISSUE_STATUS.NEW]: 0,
  [ISSUE_STATUS.OPEN]: 1,
  [ISSUE_STATUS.ASSIGNED]: 2,
  [ISSUE_STATUS.FIXED]: 3,
  [ISSUE_STATUS.REOPEN]: 4,
  [ISSUE_STATUS.REJECTED]: 5,
  [ISSUE_STATUS.DEFERRED]: 6,
  [ISSUE_STATUS.CLOSED]: 7,
};

const projectKeyWord = (value = "") =>
  value
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 4);

export const normalizeIssueStatus = (value, fallback = ISSUE_STATUS.TODO) => {
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

  if (normalizedValue === "RE_OPEN" || normalizedValue === "REOPENED") {
    return ISSUE_STATUS.REOPEN;
  }

  if (normalizedValue === "RESOLVED") {
    return ISSUE_STATUS.RESOLVED;
  }

  return Object.values(ISSUE_STATUS).includes(normalizedValue)
    ? normalizedValue
    : fallback;
};

export const normalizeIssueType = (value, fallback = ISSUE_TYPES.TASK) => {
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
    ISSUE_TYPE_OPTIONS.find(
      (issueType) =>
        issueType.toUpperCase().replace(/[\s-]+/g, "_") === normalizedValue
    ) || fallback
  );
};

export const getIssueWorkflowLane = (status) => {
  const normalizedStatus = normalizeIssueStatus(status);

  if (
    normalizedStatus === ISSUE_STATUS.DONE ||
    BUG_TERMINAL_STATUSES.includes(normalizedStatus)
  ) {
    return ISSUE_STATUS.DONE;
  }

  if (normalizedStatus === ISSUE_STATUS.TODO || normalizedStatus === ISSUE_STATUS.NEW) {
    return ISSUE_STATUS.TODO;
  }

  return ISSUE_STATUS.IN_PROGRESS;
};

export const isIssueClosed = (issueOrStatus) => {
  const status =
    typeof issueOrStatus === "object" ? issueOrStatus?.status : issueOrStatus;

  return ISSUE_COMPLETED_STATUSES.includes(normalizeIssueStatus(status, ""));
};

export const isIssueOpen = (issueOrStatus) => !isIssueClosed(issueOrStatus);

export const isIssueInProgress = (issueOrStatus) =>
  ISSUE_ACTIVE_STATUS_VALUES.includes(
    normalizeIssueStatus(
      typeof issueOrStatus === "object" ? issueOrStatus?.status : issueOrStatus
    )
  );

export const isBugIssue = (issueOrType) =>
  normalizeIssueType(
    typeof issueOrType === "object" ? issueOrType?.type : issueOrType,
    ""
  ) === ISSUE_TYPES.BUG;

export const getWorkflowStatusOptionsForIssue = (issueOrType) =>
  isBugIssue(issueOrType)
    ? BUG_STATUS_OPTIONS
    : GENERIC_ISSUE_WORKFLOW_STATUS_OPTIONS;

export const normalizeBugStatusForIssue = (issue) => {
  const status = normalizeIssueStatus(issue?.status, "");

  if (BUG_LIFECYCLE_STATUSES.includes(status)) {
    return status;
  }

  if (status === ISSUE_STATUS.IN_PROGRESS || status === ISSUE_STATUS.BLOCKED) {
    return ISSUE_STATUS.ASSIGNED;
  }

  if (status === ISSUE_STATUS.REVIEW || status === ISSUE_STATUS.QA) {
    return ISSUE_STATUS.FIXED;
  }

  if (status === ISSUE_STATUS.DONE) {
    return ISSUE_STATUS.CLOSED;
  }

  return ISSUE_STATUS.NEW;
};

export const resolveBugDetails = (issue) => issue?.bugDetails || {};

export const getIssueStatusMetrics = (issues = []) => ({
  total: issues.length,
  open: issues.filter((issue) => isIssueOpen(issue)).length,
  inProgress: issues.filter((issue) => isIssueInProgress(issue)).length,
  closed: issues.filter((issue) => isIssueClosed(issue)).length,
});

export const createIssueListFilters = (overrides = {}) => ({
  search: "",
  status: "all",
  type: "all",
  priority: "all",
  projectId: "all",
  teamId: "all",
  assigneeId: "all",
  sortBy: "newest",
  ...overrides,
});

export const getIssueStatusLabel = (status) =>
  ISSUE_WORKFLOW_STATUS_OPTIONS.find(
    (option) => option.value === normalizeIssueStatus(status, "")
  )?.label || "Unknown";

export const getIssueStatusVariant = (status) => {
  const normalizedStatus = normalizeIssueStatus(status);

  if (normalizedStatus === ISSUE_STATUS.DONE) {
    return "success";
  }

  if (normalizedStatus === ISSUE_STATUS.CLOSED) {
    return "success";
  }

  if (normalizedStatus === ISSUE_STATUS.REJECTED) {
    return "danger";
  }

  if (normalizedStatus === ISSUE_STATUS.DEFERRED) {
    return "secondary";
  }

  if (normalizedStatus === ISSUE_STATUS.BLOCKED) {
    return "danger";
  }

  if (
    normalizedStatus === ISSUE_STATUS.REVIEW ||
    normalizedStatus === ISSUE_STATUS.FIXED
  ) {
    return "default";
  }

  if (
    normalizedStatus === ISSUE_STATUS.QA ||
    normalizedStatus === ISSUE_STATUS.ASSIGNED ||
    normalizedStatus === ISSUE_STATUS.REOPEN
  ) {
    return "warning";
  }

  if (
    normalizedStatus === ISSUE_STATUS.IN_PROGRESS ||
    normalizedStatus === ISSUE_STATUS.OPEN
  ) {
    return "warning";
  }

  return "secondary";
};

export const getIssuePriorityVariant = (priority) => {
  if (priority === "Critical") {
    return "danger";
  }

  if (priority === "High") {
    return "danger";
  }

  if (priority === "Medium") {
    return "warning";
  }

  return "success";
};

export const getIssueTypeVariant = (type) => {
  const normalizedType = normalizeIssueType(type, "");

  if (normalizedType === ISSUE_TYPES.BUG) {
    return "danger";
  }

  if (normalizedType === ISSUE_TYPES.STORY) {
    return "default";
  }

  if (normalizedType === ISSUE_TYPES.EPIC) {
    return "warning";
  }

  if (normalizedType === ISSUE_TYPES.SUB_TASK) {
    return "outline";
  }

  return "secondary";
};

export const resolveIssueProjectId = (issue) =>
  String(issue?.projectId?._id || issue?.projectId || "");

export const resolveIssueAssigneeId = (issue) =>
  String(issue?.assigneeId || issue?.assignee?._id || issue?.assignee || "");

export const resolveIssueAssignee = (issue) =>
  issue?.assignee && typeof issue.assignee === "object" ? issue.assignee : null;

export const resolveIssueTeamId = (issue) =>
  String(issue?.teamId?._id || issue?.teamId || "");

export const resolveIssueEpicId = (issue) =>
  String(issue?.epicId?._id || issue?.epicId || "");

export const resolveIssueSprintId = (issue) =>
  String(issue?.sprintId?._id || issue?.sprintId || "");

export const resolveIssueDependencyId = (issue) =>
  String(issue?.dependsOnIssueId?._id || issue?.dependsOnIssueId || "");

export const resolveIssueDependency = (issue) =>
  issue?.dependsOnIssueId && typeof issue.dependsOnIssueId === "object"
    ? issue.dependsOnIssueId
    : null;

export const getIssueDisplayKey = (issue) => {
  const displayBugId =
    typeof issue?.displayBugId === "string" ? issue.displayBugId.trim() : "";

  if (displayBugId) {
    return displayBugId;
  }

  const explicitKey =
    typeof issue?.issueKey === "string" ? issue.issueKey.trim() : "";

  if (explicitKey) {
    return explicitKey;
  }

  const projectName = issue?.projectId?.name || "";
  const projectKey = projectKeyWord(projectName) || "WORK";
  const suffix = String(issue?._id || "")
    .slice(-5)
    .toUpperCase();

  return suffix ? `${projectKey}-${suffix}` : `${projectKey}-NEW`;
};

export const filterIssues = (issues, filters) => {
  const searchTerm = filters.search?.trim().toLowerCase() || "";
  const assigneeFilter = filters.assigneeId ?? filters.assignee ?? "all";
  const priorityGroup = filters.priorityGroup || "all";
  const statusGroup = filters.statusGroup || "all";
  const normalizedStatusFilter =
    filters.status && filters.status !== "all"
      ? normalizeIssueStatus(filters.status)
      : "all";
  const normalizedTypeFilter =
    filters.type && filters.type !== "all"
      ? normalizeIssueType(filters.type, "")
      : "all";

  return issues.filter((issue) => {
    const normalizedIssueStatus = normalizeIssueStatus(issue.status);

    if (statusGroup === "open" && ISSUE_COMPLETED_STATUSES.includes(normalizedIssueStatus)) {
      return false;
    }

    if (statusGroup === "closed" && !isIssueClosed(issue)) {
      return false;
    }

    if (
      normalizedStatusFilter !== "all" &&
      normalizedIssueStatus !== normalizedStatusFilter
    ) {
      return false;
    }

    if (
      normalizedTypeFilter !== "all" &&
      normalizeIssueType(issue.type, "") !== normalizedTypeFilter
    ) {
      return false;
    }

    if (
      priorityGroup === "high" &&
      !ISSUE_HIGH_PRIORITY_VALUES.includes(issue.priority)
    ) {
      return false;
    }

    if (filters.priority !== "all" && issue.priority !== filters.priority) {
      return false;
    }

    if (
      filters.projectId !== "all" &&
      resolveIssueProjectId(issue) !== String(filters.projectId)
    ) {
      return false;
    }

    if (filters.teamId !== "all" && resolveIssueTeamId(issue) !== String(filters.teamId)) {
      return false;
    }

    if (filters.epicId === "unassigned" && resolveIssueEpicId(issue)) {
      return false;
    }

    if (
      filters.epicId &&
      filters.epicId !== "all" &&
      filters.epicId !== "unassigned" &&
      resolveIssueEpicId(issue) !== String(filters.epicId)
    ) {
      return false;
    }

    if (filters.sprintId === "backlog" && resolveIssueSprintId(issue)) {
      return false;
    }

    if (
      filters.sprintId &&
      filters.sprintId !== "all" &&
      filters.sprintId !== "backlog" &&
      resolveIssueSprintId(issue) !== String(filters.sprintId)
    ) {
      return false;
    }

    if (
      assigneeFilter !== "all" &&
      resolveIssueAssigneeId(issue) !== String(assigneeFilter)
    ) {
      return false;
    }

    if (!searchTerm) {
      return true;
    }

    return [
      getIssueDisplayKey(issue),
      issue.title,
      issue.description,
      issue.projectId?.name,
      issue.teamId?.name,
      issue.epicId?.name,
      resolveIssueAssignee(issue)?.name,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(searchTerm));
  });
};

export const sortIssues = (issues, sortBy = "newest") => {
  const items = [...issues];

  return items.sort((left, right) => {
    if (sortBy === "oldest") {
      return new Date(left.createdAt) - new Date(right.createdAt);
    }

    if (sortBy === "priority") {
      const priorityDelta =
        (priorityRank[left.priority] ?? Number.MAX_SAFE_INTEGER) -
        (priorityRank[right.priority] ?? Number.MAX_SAFE_INTEGER);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }
    }

    if (sortBy === "recently-started") {
      const leftStartedAt = left.startedAt ? new Date(left.startedAt).getTime() : 0;
      const rightStartedAt = right.startedAt ? new Date(right.startedAt).getTime() : 0;
      const startedDelta = rightStartedAt - leftStartedAt;

      if (startedDelta !== 0) {
        return startedDelta;
      }
    }

    if (sortBy === "priority") {
      const workflowDelta =
        (workflowRank[normalizeIssueStatus(left.status)] ?? Number.MAX_SAFE_INTEGER) -
        (workflowRank[normalizeIssueStatus(right.status)] ?? Number.MAX_SAFE_INTEGER);

      if (workflowDelta !== 0) {
        return workflowDelta;
      }
    }

    return new Date(right.createdAt) - new Date(left.createdAt);
  });
};

export const countIssuesByStatus = (issues) =>
  ISSUE_STATUS_OPTIONS.reduce(
    (counts, option) => {
      if (option.value === "all") {
        counts.all = issues.length;
        return counts;
      }

      counts[option.value] = issues.filter(
        (issue) => normalizeIssueStatus(issue.status) === option.value
      ).length;
      return counts;
    },
    { all: issues.length }
  );
