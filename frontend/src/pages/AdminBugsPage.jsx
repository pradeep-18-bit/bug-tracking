import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Bug,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Eye,
  Filter,
  ListChecks,
  MessageSquarePlus,
  RefreshCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TimerReset,
  UserPlus,
} from "lucide-react";
import {
  fetchBugs,
  fetchEpics,
  fetchProjects,
  fetchSprints,
  updateIssue,
} from "@/lib/api";
import {
  BUG_SEVERITY_OPTIONS,
  ISSUE_STATUS,
  getCriticalIssues,
  getIssueDisplayKey,
  getIssuePriorityVariant,
  getIssueStatusLabel,
  getIssueStatusVariant,
  getReopenedIssues,
  normalizeIssueFilterAlias,
  normalizeBugStatusForIssue,
  resolveBugDetails,
  resolveIssueProjectId,
} from "@/lib/issues";
import {
  findProjectById,
  getProjectMembers,
  getProjectTeamMembers,
  getProjectTeams,
  resolveTeamId,
  resolveUserId,
} from "@/lib/project-teams";
import { cn, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import IssueDetailsDialog from "@/components/issues/IssueDetailsDialog";
import EmptyState from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const ALL_PROJECTS_VALUE = "ALL";

const BUG_STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: ISSUE_STATUS.NEW, label: "New" },
  { value: ISSUE_STATUS.OPEN, label: "Open" },
  { value: ISSUE_STATUS.ASSIGNED, label: "Assigned" },
  { value: ISSUE_STATUS.IN_PROGRESS, label: "In Progress" },
  { value: ISSUE_STATUS.READY_FOR_QA, label: "Ready for QA" },
  { value: ISSUE_STATUS.TESTING, label: "Testing" },
  { value: ISSUE_STATUS.FIXED, label: "Fixed" },
  { value: ISSUE_STATUS.REOPEN, label: "Reopened" },
  { value: ISSUE_STATUS.CLOSED, label: "Closed" },
  { value: ISSUE_STATUS.REJECTED, label: "Rejected" },
];

const normalizeStatusQueryValue = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (!normalizedValue || normalizedValue === "all") {
    return { status: "all", lifecycle: "all" };
  }

  if (normalizedValue === "open") {
    return { status: "all", lifecycle: "open" };
  }

  if (normalizedValue === "resolved") {
    return { status: "all", lifecycle: "resolved" };
  }

  if (normalizedValue === "closed") {
    return { status: ISSUE_STATUS.CLOSED, lifecycle: "all" };
  }

  const status = Object.values(ISSUE_STATUS).find(
    (item) => item.toLowerCase() === normalizedValue
  );

  return { status: status || "all", lifecycle: "all" };
};

const normalizePriorityQueryValue = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  const priority = ["Critical", "High", "Medium", "Low"].find(
    (item) => item.toLowerCase() === normalizedValue
  );

  return priority || "all";
};

const normalizeLifecycleQueryValue = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();

  return ["open", "reopened", "fixed", "resolved"].includes(normalizedValue)
    ? normalizedValue
    : "all";
};

const getDashboardFilterQueryValue = (value) => {
  const filterAlias = normalizeIssueFilterAlias(value);

  return ["reopened", "critical"].includes(filterAlias) ? filterAlias : "all";
};

const getNestedUser = (value) => (value && typeof value === "object" ? value : null);
const getReporter = (issue) => getNestedUser(issue?.reporter);
const getBugDeveloper = (issue) =>
  getNestedUser(resolveBugDetails(issue)?.developerLead) || getNestedUser(issue?.assignee);

const getProjectName = (issue, projects = []) => {
  const projectId = resolveIssueProjectId(issue);
  const project = projects.find((item) => String(item._id) === projectId);

  return issue?.projectId?.name || project?.name || "Unknown project";
};

const getTeamName = (issue) =>
  issue?.teamId?.name || "Unassigned team";

const getUserLabel = (user, fallback = "Unassigned") =>
  user?.name || user?.email || fallback;

const getSeverity = (issue) => resolveBugDetails(issue)?.severity || "Not set";

const getResolutionEta = (issue) => {
  const bugDetails = resolveBugDetails(issue);

  if (bugDetails.targetRelease) {
    return bugDetails.targetRelease;
  }

  if (issue.dueAt) {
    return formatDateTime(issue.dueAt, { hour: undefined, minute: undefined });
  }

  return "Not set";
};

const isReopenedBug = (issue) =>
  normalizeBugStatusForIssue(issue) === ISSUE_STATUS.REOPEN;

const isReadyForQa = (issue) =>
  [ISSUE_STATUS.READY_FOR_QA, ISSUE_STATUS.TESTING, ISSUE_STATUS.FIXED, ISSUE_STATUS.QA].includes(
    normalizeBugStatusForIssue(issue)
  );

const isClosedBug = (issue) =>
  [ISSUE_STATUS.CLOSED, ISSUE_STATUS.DONE, ISSUE_STATUS.REJECTED].includes(
    normalizeBugStatusForIssue(issue)
  );

const isInProgressBug = (issue) =>
  [ISSUE_STATUS.ASSIGNED, ISSUE_STATUS.IN_PROGRESS].includes(
    normalizeBugStatusForIssue(issue)
  );

const getCategoryTag = (issue) => {
  const category = String(resolveBugDetails(issue)?.category || "").toLowerCase();
  const platform = String(resolveBugDetails(issue)?.affectedPlatform || "").toLowerCase();

  if (category.includes("security")) return "Security";
  if (category.includes("database")) return "Database";
  if (category.includes("api") || platform.includes("api")) return "API";
  if (category.includes("backend")) return "Backend";
  if (category.includes("mobile") || platform.includes("mobile")) return "Mobile";
  if (category.includes("ui")) return "UI";

  return "";
};

const tagClassMap = {
  UI: "border-sky-200 bg-sky-50 text-sky-700",
  Backend: "border-indigo-200 bg-indigo-50 text-indigo-700",
  API: "border-cyan-200 bg-cyan-50 text-cyan-700",
  Database: "border-violet-200 bg-violet-50 text-violet-700",
  Security: "border-rose-200 bg-rose-50 text-rose-700",
  Mobile: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const getReopenCount = (issue) => (isReopenedBug(issue) ? 1 : 0);

const getAvailableTeams = (projects = [], projectId = ALL_PROJECTS_VALUE) => {
  if (projectId !== ALL_PROJECTS_VALUE) {
    return getProjectTeams(findProjectById(projects, projectId));
  }

  const teamsById = new Map();

  projects.forEach((project) => {
    getProjectTeams(project).forEach((team) => {
      const teamId = resolveTeamId(team);

      if (teamId && !teamsById.has(teamId)) {
        teamsById.set(teamId, team);
      }
    });
  });

  return Array.from(teamsById.values()).sort((left, right) =>
    (left.name || "").localeCompare(right.name || "")
  );
};

const getAvailableMembers = (
  projects = [],
  projectId = ALL_PROJECTS_VALUE,
  teamId = "all"
) => {
  const membersById = new Map();
  const collectMembers = (members = []) => {
    members.forEach((member) => {
      const memberId = resolveUserId(member);

      if (memberId && !membersById.has(memberId)) {
        membersById.set(memberId, member);
      }
    });
  };

  if (projectId !== ALL_PROJECTS_VALUE) {
    const project = findProjectById(projects, projectId);
    collectMembers(
      teamId !== "all"
        ? getProjectTeamMembers(project, teamId)
        : getProjectMembers(project)
    );
  } else {
    projects.forEach((project) => collectMembers(getProjectMembers(project)));
  }

  return Array.from(membersById.values()).sort((left, right) =>
    (left.name || "").localeCompare(right.name || "")
  );
};

const CompactSelect = ({ className, ...props }) => (
  <select
    className={cn(
      "h-9 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400",
      className
    )}
    {...props}
  />
);

const CompactInput = ({ className, ...props }) => (
  <Input
    className={cn(
      "h-9 rounded-[10px] border-slate-200 bg-white text-[12px] shadow-sm focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-500/20",
      className
    )}
    {...props}
  />
);

const FieldLabel = ({ children }) => (
  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
    {children}
  </span>
);

const SoftBadge = ({ children, className }) => (
  <span
    className={cn(
      "inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-semibold leading-none",
      className
    )}
  >
    {children}
  </span>
);

const MetricTile = ({ icon: Icon, label, tone, value }) => (
  <Card className="overflow-hidden rounded-[14px] border-white/70 bg-white/86 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.3)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-26px_rgba(15,23,42,0.32)]">
    <CardContent className="p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold leading-none text-slate-950">{value}</p>
        </div>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-[12px]", tone)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </CardContent>
  </Card>
);

const DistributionPanel = ({ title, rows }) => {
  const maxCount = Math.max(...rows.map((row) => row.count), 1);

  return (
    <Card className="overflow-hidden rounded-[14px] border-white/70 bg-white/82 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.28)] backdrop-blur-xl">
      <CardHeader className="border-b border-slate-200/70 px-3.5 py-2.5">
        <CardTitle className="text-[13px]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 p-3.5">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
                <span className="truncate">{row.label}</span>
                <span>{row.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                <div
                  className={cn("h-full rounded-full", row.className || "bg-blue-500")}
                  style={{ width: `${Math.max((row.count / maxCount) * 100, 6)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-[12px] text-slate-500">No data yet.</p>
        )}
      </CardContent>
    </Card>
  );
};

const AdminBugsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamString = searchParams.toString();
  const initialStatusQuery = normalizeStatusQueryValue(searchParams.get("status"));
  const initialDashboardFilter = getDashboardFilterQueryValue(
    searchParams.get("filter") || searchParams.get("status")
  );
  const [selectedBug, setSelectedBug] = useState(null);
  const [selectedTriageIds, setSelectedTriageIds] = useState([]);
  const [bulkPriority, setBulkPriority] = useState("");
  const [bulkDeveloperId, setBulkDeveloperId] = useState("");
  const [areFiltersOpen, setAreFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    projectId: searchParams.get("projectId") || ALL_PROJECTS_VALUE,
    teamId: "all",
    testerId: "all",
    developerId: "all",
    severity: "all",
    priority: normalizePriorityQueryValue(searchParams.get("priority")),
    status: initialStatusQuery.status,
    sprintId: "all",
    epicId: "all",
    lifecycle:
      initialDashboardFilter === "reopened"
        ? "reopened"
        : normalizeLifecycleQueryValue(searchParams.get("lifecycle")) !== "all"
        ? normalizeLifecycleQueryValue(searchParams.get("lifecycle"))
        : initialStatusQuery.lifecycle,
    filter: initialDashboardFilter,
    dateFrom: searchParams.get("dateFrom") || "",
    dateTo: searchParams.get("dateTo") || "",
    search: searchParams.get("search") || "",
  });
  const deferredSearch = useDeferredValue(filters.search);

  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    error: projectsError,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const selectedProject = useMemo(
    () => findProjectById(projects, filters.projectId),
    [filters.projectId, projects]
  );
  const selectedProjectId =
    selectedProject && filters.projectId !== ALL_PROJECTS_VALUE ? selectedProject._id : "";

  const { data: epics = [] } = useQuery({
    queryKey: ["admin-bugs", "epics", selectedProjectId],
    queryFn: () => fetchEpics({ projectId: selectedProjectId }),
    enabled: Boolean(selectedProjectId),
  });
  const { data: sprints = [] } = useQuery({
    queryKey: ["admin-bugs", "sprints", selectedProjectId],
    queryFn: () => fetchSprints({ projectId: selectedProjectId }),
    enabled: Boolean(selectedProjectId),
  });

  const teams = useMemo(
    () => getAvailableTeams(projects, filters.projectId),
    [filters.projectId, projects]
  );
  const members = useMemo(
    () => getAvailableMembers(projects, filters.projectId, filters.teamId),
    [filters.projectId, filters.teamId, projects]
  );
  const testers = useMemo(
    () => members.filter((member) => member.role === "Tester"),
    [members]
  );
  const developers = useMemo(
    () => members.filter((member) => member.role === "Developer"),
    [members]
  );

  const {
    data: bugsData = [],
    isLoading: isBugsLoading,
    error: bugsError,
  } = useQuery({
    queryKey: [
      "bugs",
      "admin-tracker",
      filters.projectId,
      filters.teamId,
      filters.priority,
      filters.status,
      filters.sprintId,
      filters.epicId,
      filters.dateFrom,
      filters.dateTo,
      filters.filter,
    ],
    queryFn: () =>
      fetchBugs({
        projectId: filters.projectId === ALL_PROJECTS_VALUE ? "" : filters.projectId,
        teamId: filters.teamId,
        priority: filters.priority,
        status: filters.status,
        sprintId: filters.sprintId,
        epicId: filters.epicId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        filter: filters.filter,
        sortBy: "recently-updated",
      }),
  });

  const bugs = useMemo(() => (Array.isArray(bugsData) ? bugsData : []), [bugsData]);

  useEffect(() => {
    if (!projects.length) {
      return;
    }

    const currentParams = new URLSearchParams(searchParamString);
    const requestedProjectId = currentParams.get("projectId");
    const requestedProjectName = currentParams.get("project");
    const matchedProjectByName = requestedProjectName
      ? projects.find(
          (project) =>
            String(project.name || "").trim().toLowerCase() ===
            requestedProjectName.trim().toLowerCase()
        )
      : null;
    const nextProjectId =
      requestedProjectId ||
      matchedProjectByName?._id ||
      (requestedProjectName ? ALL_PROJECTS_VALUE : filters.projectId);
    const statusQuery = normalizeStatusQueryValue(currentParams.get("status"));
    const lifecycleQuery = normalizeLifecycleQueryValue(currentParams.get("lifecycle"));
    const dashboardFilter = getDashboardFilterQueryValue(
      currentParams.get("filter") || currentParams.get("status")
    );
    const nextLifecycle =
      dashboardFilter === "reopened"
        ? "reopened"
        : lifecycleQuery !== "all"
          ? lifecycleQuery
          : statusQuery.lifecycle || "all";

    setFilters((current) => {
      const nextFilters = {
        ...current,
        projectId: nextProjectId,
        priority: normalizePriorityQueryValue(currentParams.get("priority")),
        status: statusQuery.status,
        lifecycle: nextLifecycle,
        filter: dashboardFilter,
        dateFrom: currentParams.get("dateFrom") || "",
        dateTo: currentParams.get("dateTo") || "",
        search: currentParams.get("search") || "",
        teamId: nextProjectId !== current.projectId ? "all" : current.teamId,
        testerId: nextProjectId !== current.projectId ? "all" : current.testerId,
        developerId: nextProjectId !== current.projectId ? "all" : current.developerId,
        epicId: nextProjectId !== current.projectId ? "all" : current.epicId,
        sprintId: nextProjectId !== current.projectId ? "all" : current.sprintId,
      };

      return Object.entries(nextFilters).every(([key, value]) => current[key] === value)
        ? current
        : nextFilters;
    });
  }, [filters.projectId, projects, searchParamString]);

  useEffect(() => {
    const bugParam = new URLSearchParams(searchParamString).get("bug");

    if (!bugParam || isBugsLoading) {
      return;
    }

    const routedBug = bugs.find(
      (bugIssue) =>
        String(bugIssue._id) === String(bugParam) ||
        getIssueDisplayKey(bugIssue).toLowerCase() ===
          String(bugParam).trim().toLowerCase()
    );

    if (routedBug && String(selectedBug?._id || "") !== String(routedBug._id)) {
      setSelectedBug(routedBug);
    }
  }, [bugs, isBugsLoading, searchParamString, selectedBug?._id]);

  const filteredBugs = useMemo(() => {
    const searchTerm = deferredSearch.trim().toLowerCase();

    return bugs.filter((bugIssue) => {
      const bugDetails = resolveBugDetails(bugIssue);
      const reporter = getReporter(bugIssue);
      const developer = getBugDeveloper(bugIssue);

      if (filters.severity !== "all" && getSeverity(bugIssue) !== filters.severity) {
        return false;
      }

      if (filters.testerId !== "all" && resolveUserId(reporter) !== filters.testerId) {
        return false;
      }

      if (filters.developerId === "unassigned" && resolveUserId(developer)) {
        return false;
      }

      if (
        filters.developerId !== "all" &&
        filters.developerId !== "unassigned" &&
        resolveUserId(developer) !== filters.developerId
      ) {
        return false;
      }

      if (filters.filter === "reopened" && !isReopenedBug(bugIssue)) {
        return false;
      }

      if (filters.filter === "critical" && !getCriticalIssues([bugIssue]).length) {
        return false;
      }

      if (filters.lifecycle === "reopened" && !isReopenedBug(bugIssue)) {
        return false;
      }

      if (filters.lifecycle === "open" && isClosedBug(bugIssue)) {
        return false;
      }

      if (filters.lifecycle === "fixed" && !isReadyForQa(bugIssue)) {
        return false;
      }

      if (
        filters.lifecycle === "resolved" &&
        ![ISSUE_STATUS.FIXED, ISSUE_STATUS.QA, ISSUE_STATUS.CLOSED].includes(
          normalizeBugStatusForIssue(bugIssue)
        )
      ) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      return [
        getIssueDisplayKey(bugIssue),
        bugIssue.title,
        bugIssue.description,
        reporter?.name,
        reporter?.email,
        developer?.name,
        developer?.email,
        bugDetails.severity,
        bugDetails.moduleName,
        bugDetails.category,
        bugDetails.affectedPlatform,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchTerm));
    });
  }, [bugs, deferredSearch, filters.developerId, filters.filter, filters.lifecycle, filters.severity, filters.testerId]);

  const metrics = useMemo(
    () => ({
      total: filteredBugs.length,
      open: filteredBugs.filter((bugIssue) => !isClosedBug(bugIssue)).length,
      critical: getCriticalIssues(filteredBugs).length,
      unassigned: filteredBugs.filter((bugIssue) => !resolveUserId(getBugDeveloper(bugIssue))).length,
      inProgress: filteredBugs.filter(isInProgressBug).length,
      reopened: getReopenedIssues(filteredBugs).length,
      readyForQa: filteredBugs.filter(isReadyForQa).length,
      closed: filteredBugs.filter(isClosedBug).length,
    }),
    [filteredBugs]
  );

  const triageBugs = useMemo(
    () =>
      filteredBugs.filter((bugIssue) => {
        const status = normalizeBugStatusForIssue(bugIssue);
        const developer = getBugDeveloper(bugIssue);

        return (
          [ISSUE_STATUS.NEW, ISSUE_STATUS.TRIAGED, ISSUE_STATUS.OPEN].includes(status) ||
          !resolveUserId(developer)
        );
      }),
    [filteredBugs]
  );

  const severityRows = useMemo(
    () =>
      BUG_SEVERITY_OPTIONS.map((severity) => ({
        label: severity,
        count: filteredBugs.filter((bugIssue) => getSeverity(bugIssue) === severity).length,
        className:
          severity === "Blocker" || severity === "Critical"
            ? "bg-rose-500"
            : severity === "Major"
              ? "bg-amber-500"
              : "bg-emerald-500",
      })).filter((row) => row.count > 0),
    [filteredBugs]
  );

  const statusRows = useMemo(
    () =>
      BUG_STATUS_FILTERS.filter((status) => status.value !== "all")
        .map((status) => ({
          label: status.label,
          count: filteredBugs.filter(
            (bugIssue) => normalizeBugStatusForIssue(bugIssue) === status.value
          ).length,
          className:
            status.value === ISSUE_STATUS.CLOSED
              ? "bg-emerald-500"
              : status.value === ISSUE_STATUS.REOPEN
                ? "bg-rose-500"
                : "bg-blue-500",
        }))
        .filter((row) => row.count > 0),
    [filteredBugs]
  );

  const developerRows = useMemo(() => {
    const rowsByDeveloper = new Map();

    filteredBugs.forEach((bugIssue) => {
      const developer = getBugDeveloper(bugIssue);
      const developerId = resolveUserId(developer) || "unassigned";
      const row = rowsByDeveloper.get(developerId) || {
        label: getUserLabel(developer, "Unassigned"),
        total: 0,
        closed: 0,
      };

      row.total += 1;

      if (isClosedBug(bugIssue)) {
        row.closed += 1;
      }

      rowsByDeveloper.set(developerId, row);
    });

    return Array.from(rowsByDeveloper.values())
      .sort((left, right) => right.total - left.total)
      .slice(0, 5)
      .map((row) => ({
        label: row.label,
        count: row.total ? Math.round((row.closed / row.total) * 100) : 0,
        className: "bg-cyan-500",
      }));
  }, [filteredBugs]);

  const updateIssueMutation = useMutation({
    mutationFn: updateIssue,
    onSuccess: async (updatedIssue) => {
      setSelectedBug(updatedIssue);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bugs"] }),
        queryClient.invalidateQueries({ queryKey: ["issues"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ]);
    },
  });

  const handleToggleTriageBug = (issueId, checked) => {
    setSelectedTriageIds((current) =>
      checked
        ? Array.from(new Set([...current, issueId]))
        : current.filter((id) => id !== issueId)
    );
  };

  const handleBulkTriage = async () => {
    const selectedBugs = triageBugs.filter((bugIssue) =>
      selectedTriageIds.includes(bugIssue._id)
    );

    if (!selectedBugs.length) {
      return;
    }

    for (const bugIssue of selectedBugs) {
      const currentStatus = normalizeBugStatusForIssue(bugIssue);

      await updateIssueMutation.mutateAsync({
        id: bugIssue._id,
        payload: {
          ...(bulkPriority ? { priority: bulkPriority } : {}),
          ...(bulkDeveloperId
            ? {
                assigneeId: bulkDeveloperId,
                bugDetails: {
                  ...resolveBugDetails(bugIssue),
                  developerLeadId: bulkDeveloperId,
                },
                status: ISSUE_STATUS.ASSIGNED,
              }
            : currentStatus === ISSUE_STATUS.NEW
              ? { status: ISSUE_STATUS.TRIAGED }
              : {}),
        },
      });
    }

    setSelectedTriageIds([]);
  };

  const error = projectsError || bugsError;
  const isLoading = isProjectsLoading || isBugsLoading;

  const updateFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "projectId"
        ? {
            teamId: "all",
            testerId: "all",
            developerId: "all",
            epicId: "all",
            sprintId: "all",
          }
        : {}),
      ...(key === "teamId"
        ? {
            testerId: "all",
            developerId: "all",
          }
        : {}),
    }));
  };

  const applyQuickFilter = (filterId) => {
    setFilters((current) => {
      const baseFilters = {
        ...current,
        filter: "all",
        lifecycle: "all",
        priority: "all",
        status: "all",
        developerId: "all",
      };

      if (filterId === "mine") {
        return {
          ...baseFilters,
          developerId: String(user?._id || user?.id || "all"),
        };
      }

      if (filterId === "critical") {
        return {
          ...baseFilters,
          filter: "critical",
          priority: "Critical",
        };
      }

      if (filterId === "unassigned") {
        return {
          ...baseFilters,
          developerId: "unassigned",
        };
      }

      if (filterId === "reopened") {
        return {
          ...baseFilters,
          filter: "reopened",
          lifecycle: "reopened",
        };
      }

      if (filterId === "ready") {
        return {
          ...baseFilters,
          lifecycle: "fixed",
        };
      }

      return baseFilters;
    });
  };

  const handleQuickAssign = (bugIssue, developerId) => {
    if (!developerId) {
      return;
    }

    updateIssueMutation.mutate({
      id: bugIssue._id,
      payload: {
        assigneeId: developerId,
        bugDetails: {
          ...resolveBugDetails(bugIssue),
          developerLeadId: developerId,
        },
        status: ISSUE_STATUS.ASSIGNED,
      },
    });
  };

  const handleQuickPriority = (bugIssue, priority) => {
    if (!priority || priority === bugIssue.priority) {
      return;
    }

    updateIssueMutation.mutate({
      id: bugIssue._id,
      payload: {
        priority,
      },
    });
  };

  const handleQuickStatus = (bugIssue, status) => {
    if (!status || status === normalizeBugStatusForIssue(bugIssue)) {
      return;
    }

    updateIssueMutation.mutate({
      id: bugIssue._id,
      payload: {
        status,
      },
    });
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-rose-700">
          {error.response?.data?.message || "Unable to load bug tracker."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 text-[13px]">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricTile icon={Bug} label="Total Bugs" value={metrics.total} tone="bg-blue-50 text-blue-700" />
        <MetricTile icon={AlertTriangle} label="Critical" value={metrics.critical} tone="bg-rose-50 text-rose-700" />
        <MetricTile icon={UserPlus} label="Unassigned" value={metrics.unassigned} tone="bg-slate-100 text-slate-700" />
        <MetricTile icon={TimerReset} label="In Progress" value={metrics.inProgress} tone="bg-indigo-50 text-indigo-700" />
        <MetricTile icon={RefreshCcw} label="Reopened" value={metrics.reopened} tone="bg-pink-50 text-pink-700" />
        <MetricTile icon={CheckCircle2} label="Closed" value={metrics.closed} tone="bg-emerald-50 text-emerald-700" />
      </section>

      <Card className="overflow-hidden rounded-[16px] border-white/70 bg-white/92 shadow-[0_16px_42px_-32px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <CardHeader className="sticky top-20 z-10 border-b border-slate-200/80 bg-white/94 px-4 py-3 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-blue-600" />
                Triage Board
              </CardTitle>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Validate new and unassigned bugs, then assign or move them to the triaged bucket.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SoftBadge className="border-blue-100 bg-blue-50 text-blue-700">
                {triageBugs.length} needs review
              </SoftBadge>
              <SoftBadge className="border-slate-200 bg-slate-50 text-slate-600">
                {selectedTriageIds.length} selected
              </SoftBadge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-3.5 sm:p-4">
          <div className="grid items-end gap-2 md:grid-cols-[minmax(150px,0.8fr)_minmax(210px,1fr)_auto]">
            <label className="space-y-1">
              <FieldLabel>Bulk Priority</FieldLabel>
              <CompactSelect value={bulkPriority} onChange={(event) => setBulkPriority(event.target.value)}>
                <option value="">Keep priority</option>
                {["Critical", "High", "Medium", "Low"].map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </CompactSelect>
            </label>
            <label className="space-y-1">
              <FieldLabel>Bulk Assignment</FieldLabel>
              <CompactSelect value={bulkDeveloperId} onChange={(event) => setBulkDeveloperId(event.target.value)}>
                <option value="">Move to triaged bucket</option>
                {developers.map((developer) => (
                  <option key={resolveUserId(developer)} value={resolveUserId(developer)}>
                    Assign to {getUserLabel(developer)}
                  </option>
                ))}
              </CompactSelect>
            </label>
            <Button
              className="h-9 rounded-[10px] px-3 text-[12px]"
              type="button"
              disabled={!selectedTriageIds.length || updateIssueMutation.isPending}
              onClick={handleBulkTriage}
            >
              Apply to {selectedTriageIds.length || 0}
            </Button>
          </div>

          <div className="max-h-[360px] overflow-auto rounded-[14px] border border-slate-200/80 bg-white/70">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-[12px]">
              <thead className="sticky top-0 z-10 bg-slate-50/96 text-[10px] uppercase tracking-[0.14em] text-slate-500 backdrop-blur">
                <tr>
                  <th className="w-11 border-b border-slate-200 px-3 py-2.5 text-center">
                    <input
                      aria-label="Select all triage bugs"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      type="checkbox"
                      checked={triageBugs.length > 0 && triageBugs.every((bugIssue) => selectedTriageIds.includes(bugIssue._id))}
                      onChange={(event) =>
                        setSelectedTriageIds(event.target.checked ? triageBugs.map((bugIssue) => bugIssue._id) : [])
                      }
                    />
                  </th>
                  {["Bug", "Module", "Tag", "Severity", "Priority", "Developer", "Status"].map((header) => (
                    <th key={header} className="border-b border-slate-200 px-3 py-2.5 font-semibold">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {triageBugs.slice(0, 24).map((bugIssue, index) => {
                  const details = resolveBugDetails(bugIssue);
                  const developer = getBugDeveloper(bugIssue);
                  const status = normalizeBugStatusForIssue(bugIssue);
                  const categoryTag = getCategoryTag(bugIssue);

                  return (
                    <tr key={bugIssue._id} className={cn("transition hover:bg-blue-50/60", index % 2 ? "bg-slate-50/38" : "bg-white/78")}>
                      <td className="border-b border-slate-100 px-3 py-2.5 text-center align-middle">
                        <input
                          aria-label={`Select ${getIssueDisplayKey(bugIssue)}`}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          type="checkbox"
                          checked={selectedTriageIds.includes(bugIssue._id)}
                          onChange={(event) => handleToggleTriageBug(bugIssue._id, event.target.checked)}
                        />
                      </td>
                      <td className="max-w-[270px] border-b border-slate-100 px-3 py-2.5 align-middle">
                        <button type="button" className="block max-w-full truncate text-left font-semibold text-slate-950 transition hover:text-blue-700" onClick={() => setSelectedBug(bugIssue)}>
                          {getIssueDisplayKey(bugIssue)} - {bugIssue.title}
                        </button>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{getProjectName(bugIssue, projects)}</p>
                      </td>
                      <td className="max-w-[160px] border-b border-slate-100 px-3 py-2.5 text-slate-600">
                        <span className="block truncate">{details.moduleName || "Unmapped"}</span>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2.5">
                        {categoryTag ? (
                          <SoftBadge className={tagClassMap[categoryTag]}>{categoryTag}</SoftBadge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2.5 text-slate-600">{getSeverity(bugIssue)}</td>
                      <td className="border-b border-slate-100 px-3 py-2.5">
                        <Badge className="px-2 py-0.5 text-[11px]" variant={getIssuePriorityVariant(bugIssue.priority)}>
                          {bugIssue.priority || "Medium"}
                        </Badge>
                      </td>
                      <td className="max-w-[160px] border-b border-slate-100 px-3 py-2.5 text-slate-600">
                        <span className="block truncate">{getUserLabel(developer)}</span>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2.5">
                        <Badge className="px-2 py-0.5 text-[11px]" variant={getIssueStatusVariant(status)}>
                          {getIssueStatusLabel(status)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {!triageBugs.length ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-[12px] text-slate-500" colSpan={8}>
                      No new or unassigned bugs need triage in this filtered view.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="sticky top-20 z-20 overflow-hidden rounded-[16px] border-white/70 bg-white/94 shadow-[0_16px_42px_-32px_rgba(15,23,42,0.4)] backdrop-blur-xl">
        <CardContent className="space-y-3 p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                Bug Tracker
              </h2>
              <p className="mt-0.5 text-[12px] text-slate-500">
                {filteredBugs.length} visible bugs across QA, ownership, and lifecycle filters.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                ["mine", "My Bugs"],
                ["critical", "Critical"],
                ["unassigned", "Unassigned"],
                ["reopened", "Reopened"],
                ["ready", "Ready for QA"],
              ].map(([id, label]) => (
                <Button
                  key={id}
                  className="h-8 rounded-[10px] px-2.5 text-[11px]"
                  type="button"
                  variant="outline"
                  onClick={() => applyQuickFilter(id)}
                >
                  {label}
                </Button>
              ))}
              <Button
                className="h-8 rounded-[10px] px-2.5 text-[11px]"
                type="button"
                onClick={() => setAreFiltersOpen((current) => !current)}
              >
                <Filter className="h-3.5 w-3.5" />
                {areFiltersOpen ? "Hide Filters" : "Show Filters"}
                {areFiltersOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {areFiltersOpen ? (
            <div className="grid gap-2 border-t border-slate-200/80 pt-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5">
              <FieldLabel>Project</FieldLabel>
              <CompactSelect value={filters.projectId} onChange={(event) => updateFilter("projectId", event.target.value)}>
                <option value={ALL_PROJECTS_VALUE}>All projects</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>{project.name}</option>
                ))}
              </CompactSelect>
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Team</FieldLabel>
              <CompactSelect value={filters.teamId} onChange={(event) => updateFilter("teamId", event.target.value)}>
                <option value="all">All teams</option>
                {teams.map((team) => (
                  <option key={resolveTeamId(team)} value={resolveTeamId(team)}>{team.name}</option>
                ))}
              </CompactSelect>
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Tester</FieldLabel>
              <CompactSelect value={filters.testerId} onChange={(event) => updateFilter("testerId", event.target.value)}>
                <option value="all">All testers</option>
                {testers.map((tester) => (
                  <option key={resolveUserId(tester)} value={resolveUserId(tester)}>{getUserLabel(tester)}</option>
                ))}
              </CompactSelect>
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Developer</FieldLabel>
              <CompactSelect value={filters.developerId} onChange={(event) => updateFilter("developerId", event.target.value)}>
                <option value="all">All developers</option>
                <option value="unassigned">Unassigned</option>
                {developers.map((developer) => (
                  <option key={resolveUserId(developer)} value={resolveUserId(developer)}>{getUserLabel(developer)}</option>
                ))}
              </CompactSelect>
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Severity</FieldLabel>
              <CompactSelect value={filters.severity} onChange={(event) => updateFilter("severity", event.target.value)}>
                <option value="all">All severities</option>
                {BUG_SEVERITY_OPTIONS.map((severity) => (
                  <option key={severity} value={severity}>{severity}</option>
                ))}
              </CompactSelect>
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Priority</FieldLabel>
              <CompactSelect value={filters.priority} onChange={(event) => updateFilter("priority", event.target.value)}>
                <option value="all">All priorities</option>
                {["Critical", "High", "Medium", "Low"].map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </CompactSelect>
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Status</FieldLabel>
              <CompactSelect value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                {BUG_STATUS_FILTERS.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </CompactSelect>
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Epic</FieldLabel>
              <CompactSelect value={filters.epicId} disabled={!selectedProjectId} onChange={(event) => updateFilter("epicId", event.target.value)}>
                <option value="all">All epics</option>
                <option value="unassigned">No epic</option>
                {epics.map((epic) => (
                  <option key={epic._id} value={epic._id}>{epic.name}</option>
                ))}
              </CompactSelect>
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Sprint</FieldLabel>
              <CompactSelect value={filters.sprintId} disabled={!selectedProjectId} onChange={(event) => updateFilter("sprintId", event.target.value)}>
                <option value="all">All sprints</option>
                <option value="backlog">Backlog</option>
                {sprints.map((sprint) => (
                  <option key={sprint._id} value={sprint._id}>{sprint.name}</option>
                ))}
              </CompactSelect>
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Bug State</FieldLabel>
              <CompactSelect value={filters.lifecycle} onChange={(event) => updateFilter("lifecycle", event.target.value)}>
                <option value="all">All bugs</option>
                <option value="reopened">Reopened bugs</option>
                <option value="fixed">Fixed / Ready for QA</option>
              </CompactSelect>
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Date From</FieldLabel>
              <CompactInput type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Date To</FieldLabel>
              <CompactInput type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
            </label>
            <label className="space-y-1.5 md:col-span-2 xl:col-span-4">
              <FieldLabel>Search</FieldLabel>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <CompactInput
                  className="pl-9"
                  placeholder="Search bug ID, title, developer, tester, or severity"
                  value={filters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                />
              </div>
            </label>
          </div>
          ) : null}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        <DistributionPanel title="Severity Distribution" rows={severityRows} />
        <DistributionPanel title="Bug Trend By Status" rows={statusRows} />
        <DistributionPanel title="Developer Resolution Rate" rows={developerRows} />
      </section>

      <Card className="overflow-hidden border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={`bug-row-skeleton-${index}`} className="h-14 rounded-2xl" />
              ))}
            </div>
          ) : filteredBugs.length ? (
            <div className="max-h-[620px] overflow-auto">
              <table className="w-full min-w-[1280px] border-separate border-spacing-0 text-left">
                <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-500">
                    {["Bug ID", "Title", "Project", "Tester", "Severity", "Priority", "Developer", "Status", "Reopens", "Updated", "Resolution ETA", "Actions"].map((header) => (
                      <th key={header} className="border-b border-slate-200 px-3 py-3 font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBugs.map((bugIssue) => {
                    const reporter = getReporter(bugIssue);
                    const developer = getBugDeveloper(bugIssue);
                    const status = normalizeBugStatusForIssue(bugIssue);

                    return (
                      <tr
                        key={bugIssue._id}
                        className="cursor-pointer border-b border-slate-100 transition hover:bg-blue-50/50"
                        onClick={() => setSelectedBug(bugIssue)}
                      >
                        <td className="border-b border-slate-100 px-3 py-3 font-mono text-xs font-semibold text-slate-600">
                          {getIssueDisplayKey(bugIssue)}
                        </td>
                        <td className="max-w-[280px] border-b border-slate-100 px-3 py-3">
                          <p className="truncate text-sm font-semibold text-slate-950">{bugIssue.title}</p>
                          <p className="truncate text-xs text-slate-500">{getTeamName(bugIssue)}</p>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-sm text-slate-600">
                          {getProjectName(bugIssue, projects)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-sm text-slate-600">
                          {getUserLabel(reporter, "Unknown tester")}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <span className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                            ["Blocker", "Critical"].includes(getSeverity(bugIssue))
                              ? "bg-rose-50 text-rose-700"
                              : "bg-slate-100 text-slate-700"
                          )}>
                            {getSeverity(bugIssue)}
                          </span>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <Badge variant={getIssuePriorityVariant(bugIssue.priority)}>
                            {bugIssue.priority || "Medium"}
                          </Badge>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-sm text-slate-600">
                          {getUserLabel(developer)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <Badge variant={getIssueStatusVariant(status)}>
                            {status === ISSUE_STATUS.QA ? "Ready for QA" : getIssueStatusLabel(status)}
                          </Badge>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-sm font-semibold text-slate-700">
                          {getReopenCount(bugIssue)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-sm text-slate-600">
                          {formatDateTime(bugIssue.updatedAt || bugIssue.createdAt)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-sm text-slate-600">
                          {getResolutionEta(bugIssue)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedBug(bugIssue);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8">
              <EmptyState
                title="No bugs match this view"
                description="Adjust project, QA, developer, lifecycle, date, or search filters to widen the bug tracker."
                icon={<Bug className="h-5 w-5" />}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <IssueDetailsDialog
        deletingId=""
        issue={selectedBug}
        onDeleteIssue={async () => {}}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedBug(null);

            if (searchParams.get("bug")) {
              const nextParams = new URLSearchParams(searchParams);
              nextParams.delete("bug");
              setSearchParams(nextParams, { replace: true });
            }
          }
        }}
        onUpdateIssue={(id, payload) =>
          updateIssueMutation.mutateAsync({ id, payload })
        }
        open={Boolean(selectedBug)}
        projects={projects}
        availableIssues={[]}
        updatingId={updateIssueMutation.isPending ? updateIssueMutation.variables?.id : ""}
        canEditCoreDetails
        canEditPriority
        canEditAssignee
        canDeleteIssue={false}
      />
    </div>
  );
};

export default AdminBugsPage;
