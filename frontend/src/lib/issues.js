export const ISSUE_STATUS = Object.freeze({
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  REVIEW: "REVIEW",
  QA: "QA",
  DONE: "DONE",
});

export const ISSUE_ACTIVE_STATUS_VALUES = Object.freeze([
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.BLOCKED,
  ISSUE_STATUS.REVIEW,
  ISSUE_STATUS.QA,
]);

export const ISSUE_STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: ISSUE_STATUS.TODO, label: "To Do" },
  { value: ISSUE_STATUS.IN_PROGRESS, label: "In Progress" },
  { value: ISSUE_STATUS.BLOCKED, label: "Blocked" },
  { value: ISSUE_STATUS.REVIEW, label: "Review" },
  { value: ISSUE_STATUS.QA, label: "QA" },
  { value: ISSUE_STATUS.DONE, label: "Done" },
];

export const ISSUE_WORKFLOW_STATUS_OPTIONS = ISSUE_STATUS_OPTIONS.filter(
  (option) => option.value !== "all"
);

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
  High: 0,
  Medium: 1,
  Low: 2,
};

const workflowRank = {
  [ISSUE_STATUS.IN_PROGRESS]: 0,
  [ISSUE_STATUS.BLOCKED]: 1,
  [ISSUE_STATUS.REVIEW]: 2,
  [ISSUE_STATUS.QA]: 3,
  [ISSUE_STATUS.TODO]: 4,
  [ISSUE_STATUS.DONE]: 5,
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

  if (normalizedStatus === ISSUE_STATUS.DONE) {
    return ISSUE_STATUS.DONE;
  }

  if (normalizedStatus === ISSUE_STATUS.TODO) {
    return ISSUE_STATUS.TODO;
  }

  return ISSUE_STATUS.IN_PROGRESS;
};

export const isIssueClosed = (issueOrStatus) =>
  normalizeIssueStatus(
    typeof issueOrStatus === "object" ? issueOrStatus?.status : issueOrStatus
  ) === ISSUE_STATUS.DONE;

export const isIssueOpen = (issueOrStatus) => !isIssueClosed(issueOrStatus);

export const isIssueInProgress = (issueOrStatus) =>
  ISSUE_ACTIVE_STATUS_VALUES.includes(
    normalizeIssueStatus(
      typeof issueOrStatus === "object" ? issueOrStatus?.status : issueOrStatus
    )
  );

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

  if (normalizedStatus === ISSUE_STATUS.BLOCKED) {
    return "danger";
  }

  if (normalizedStatus === ISSUE_STATUS.REVIEW) {
    return "default";
  }

  if (normalizedStatus === ISSUE_STATUS.QA) {
    return "warning";
  }

  if (normalizedStatus === ISSUE_STATUS.IN_PROGRESS) {
    return "warning";
  }

  return "secondary";
};

export const getIssuePriorityVariant = (priority) => {
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

export const resolveIssueDependencyId = (issue) =>
  String(issue?.dependsOnIssueId?._id || issue?.dependsOnIssueId || "");

export const resolveIssueDependency = (issue) =>
  issue?.dependsOnIssueId && typeof issue.dependsOnIssueId === "object"
    ? issue.dependsOnIssueId
    : null;

export const getIssueDisplayKey = (issue) => {
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
  const normalizedStatusFilter =
    filters.status && filters.status !== "all"
      ? normalizeIssueStatus(filters.status)
      : "all";
  const normalizedTypeFilter =
    filters.type && filters.type !== "all"
      ? normalizeIssueType(filters.type, "")
      : "all";

  return issues.filter((issue) => {
    if (
      normalizedStatusFilter !== "all" &&
      normalizeIssueStatus(issue.status) !== normalizedStatusFilter
    ) {
      return false;
    }

    if (
      normalizedTypeFilter !== "all" &&
      normalizeIssueType(issue.type, "") !== normalizedTypeFilter
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

export const countIssuesByStatus = (issues) => ({
  all: issues.length,
  [ISSUE_STATUS.TODO]: issues.filter(
    (issue) => normalizeIssueStatus(issue.status) === ISSUE_STATUS.TODO
  ).length,
  [ISSUE_STATUS.IN_PROGRESS]: issues.filter(
    (issue) => normalizeIssueStatus(issue.status) === ISSUE_STATUS.IN_PROGRESS
  ).length,
  [ISSUE_STATUS.BLOCKED]: issues.filter(
    (issue) => normalizeIssueStatus(issue.status) === ISSUE_STATUS.BLOCKED
  ).length,
  [ISSUE_STATUS.REVIEW]: issues.filter(
    (issue) => normalizeIssueStatus(issue.status) === ISSUE_STATUS.REVIEW
  ).length,
  [ISSUE_STATUS.QA]: issues.filter(
    (issue) => normalizeIssueStatus(issue.status) === ISSUE_STATUS.QA
  ).length,
  [ISSUE_STATUS.DONE]: issues.filter(
    (issue) => normalizeIssueStatus(issue.status) === ISSUE_STATUS.DONE
  ).length,
});
