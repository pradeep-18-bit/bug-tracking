export const ISSUE_STATUS = Object.freeze({
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
});

export const ISSUE_STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: ISSUE_STATUS.TODO, label: "To Do" },
  { value: ISSUE_STATUS.IN_PROGRESS, label: "In Progress" },
  { value: ISSUE_STATUS.DONE, label: "Done" },
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

const statusRank = {
  [ISSUE_STATUS.IN_PROGRESS]: 0,
  [ISSUE_STATUS.TODO]: 1,
  [ISSUE_STATUS.DONE]: 2,
};

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

  if (Object.values(ISSUE_STATUS).includes(normalizedValue)) {
    return normalizedValue;
  }

  return fallback;
};

export const isIssueClosed = (issueOrStatus) =>
  normalizeIssueStatus(
    typeof issueOrStatus === "object" ? issueOrStatus?.status : issueOrStatus
  ) === ISSUE_STATUS.DONE;

export const isIssueOpen = (issueOrStatus) => !isIssueClosed(issueOrStatus);

export const isIssueInProgress = (issueOrStatus) =>
  normalizeIssueStatus(
    typeof issueOrStatus === "object" ? issueOrStatus?.status : issueOrStatus
  ) === ISSUE_STATUS.IN_PROGRESS;

export const getIssueStatusMetrics = (issues = []) => ({
  total: issues.length,
  open: issues.filter((issue) => isIssueOpen(issue)).length,
  inProgress: issues.filter((issue) => isIssueInProgress(issue)).length,
  closed: issues.filter((issue) => isIssueClosed(issue)).length,
});

export const createIssueListFilters = (overrides = {}) => ({
  search: "",
  status: "all",
  priority: "all",
  projectId: "all",
  teamId: "all",
  assigneeId: "all",
  sortBy: "newest",
  ...overrides,
});

export const getIssueStatusLabel = (status) =>
  ISSUE_STATUS_OPTIONS.find(
    (option) => option.value === normalizeIssueStatus(status, "")
  )?.label || "Unknown";

export const getIssueStatusVariant = (status) => {
  const normalizedStatus = normalizeIssueStatus(status);

  if (normalizedStatus === ISSUE_STATUS.DONE) {
    return "success";
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
  if (type === "Bug") {
    return "danger";
  }

  if (type === "Story") {
    return "default";
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

export const filterIssues = (issues, filters) => {
  const searchTerm = filters.search?.trim().toLowerCase() || "";
  const assigneeFilter = filters.assigneeId ?? filters.assignee ?? "all";
  const normalizedStatusFilter =
    filters.status && filters.status !== "all"
      ? normalizeIssueStatus(filters.status)
      : "all";

  return issues.filter((issue) => {
    if (
      normalizedStatusFilter !== "all" &&
      normalizeIssueStatus(issue.status) !== normalizedStatusFilter
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

    return [issue.title, issue.description]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(searchTerm));
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
      const statusDelta =
        (statusRank[normalizeIssueStatus(left.status)] ?? Number.MAX_SAFE_INTEGER) -
        (statusRank[normalizeIssueStatus(right.status)] ?? Number.MAX_SAFE_INTEGER);

      if (statusDelta !== 0) {
        return statusDelta;
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
  [ISSUE_STATUS.DONE]: issues.filter(
    (issue) => normalizeIssueStatus(issue.status) === ISSUE_STATUS.DONE
  ).length,
});
