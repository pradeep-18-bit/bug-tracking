import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Eye,
  RefreshCcw,
  Search,
  ShieldCheck,
  TimerReset,
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
  { value: ISSUE_STATUS.QA, label: "Ready for QA" },
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
  [ISSUE_STATUS.FIXED, ISSUE_STATUS.QA].includes(normalizeBugStatusForIssue(issue));

const isClosedBug = (issue) =>
  [ISSUE_STATUS.CLOSED, ISSUE_STATUS.REJECTED].includes(normalizeBugStatusForIssue(issue));

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

const MetricTile = ({ icon: Icon, label, tone, value }) => (
  <Card className="overflow-hidden rounded-[16px] border-white/70 bg-white/82 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.34)] backdrop-blur-xl">
    <CardContent className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
        </div>
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", tone)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </CardContent>
  </Card>
);

const DistributionPanel = ({ title, rows }) => {
  const maxCount = Math.max(...rows.map((row) => row.count), 1);

  return (
    <Card className="overflow-hidden rounded-[16px] border-white/70 bg-white/82 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.34)] backdrop-blur-xl">
      <CardHeader className="border-b border-slate-200/70 px-4 py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                <span className="truncate">{row.label}</span>
                <span>{row.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
                <div
                  className={cn("h-full rounded-full", row.className || "bg-blue-500")}
                  style={{ width: `${Math.max((row.count / maxCount) * 100, 6)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No data yet.</p>
        )}
      </CardContent>
    </Card>
  );
};

const AdminBugsPage = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamString = searchParams.toString();
  const initialStatusQuery = normalizeStatusQueryValue(searchParams.get("status"));
  const initialDashboardFilter = getDashboardFilterQueryValue(
    searchParams.get("filter") || searchParams.get("status")
  );
  const [selectedBug, setSelectedBug] = useState(null);
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

      if (filters.developerId !== "all" && resolveUserId(developer) !== filters.developerId) {
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
      reopened: getReopenedIssues(filteredBugs).length,
      readyForQa: filteredBugs.filter(isReadyForQa).length,
      closed: filteredBugs.filter((bugIssue) => normalizeBugStatusForIssue(bugIssue) === ISSUE_STATUS.CLOSED).length,
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
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricTile icon={Bug} label="Total Bugs" value={metrics.total} tone="bg-blue-50 text-blue-700" />
        <MetricTile icon={TimerReset} label="Open Bugs" value={metrics.open} tone="bg-amber-50 text-amber-700" />
        <MetricTile icon={AlertTriangle} label="Critical Bugs" value={metrics.critical} tone="bg-rose-50 text-rose-700" />
        <MetricTile icon={RefreshCcw} label="Reopened" value={metrics.reopened} tone="bg-pink-50 text-pink-700" />
        <MetricTile icon={ShieldCheck} label="Ready For QA" value={metrics.readyForQa} tone="bg-cyan-50 text-cyan-700" />
        <MetricTile icon={CheckCircle2} label="Closed Bugs" value={metrics.closed} tone="bg-emerald-50 text-emerald-700" />
      </section>

      <Card className="sticky top-24 z-20 overflow-hidden border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Bug Tracker</h2>
              <p className="text-sm text-slate-500">
                Project-wise tester bug tracking, QA progress, developer ownership, and reopen monitoring.
              </p>
            </div>
            <Badge className="border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50">
              {filteredBugs.length} visible
            </Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Project</span>
              <select className="field-select" value={filters.projectId} onChange={(event) => updateFilter("projectId", event.target.value)}>
                <option value={ALL_PROJECTS_VALUE}>All projects</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>{project.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Team</span>
              <select className="field-select" value={filters.teamId} onChange={(event) => updateFilter("teamId", event.target.value)}>
                <option value="all">All teams</option>
                {teams.map((team) => (
                  <option key={resolveTeamId(team)} value={resolveTeamId(team)}>{team.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Tester</span>
              <select className="field-select" value={filters.testerId} onChange={(event) => updateFilter("testerId", event.target.value)}>
                <option value="all">All testers</option>
                {testers.map((tester) => (
                  <option key={resolveUserId(tester)} value={resolveUserId(tester)}>{getUserLabel(tester)}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Developer</span>
              <select className="field-select" value={filters.developerId} onChange={(event) => updateFilter("developerId", event.target.value)}>
                <option value="all">All developers</option>
                {developers.map((developer) => (
                  <option key={resolveUserId(developer)} value={resolveUserId(developer)}>{getUserLabel(developer)}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Severity</span>
              <select className="field-select" value={filters.severity} onChange={(event) => updateFilter("severity", event.target.value)}>
                <option value="all">All severities</option>
                {BUG_SEVERITY_OPTIONS.map((severity) => (
                  <option key={severity} value={severity}>{severity}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Priority</span>
              <select className="field-select" value={filters.priority} onChange={(event) => updateFilter("priority", event.target.value)}>
                <option value="all">All priorities</option>
                {["Critical", "High", "Medium", "Low"].map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</span>
              <select className="field-select" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                {BUG_STATUS_FILTERS.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Epic</span>
              <select className="field-select" value={filters.epicId} disabled={!selectedProjectId} onChange={(event) => updateFilter("epicId", event.target.value)}>
                <option value="all">All epics</option>
                <option value="unassigned">No epic</option>
                {epics.map((epic) => (
                  <option key={epic._id} value={epic._id}>{epic.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Sprint</span>
              <select className="field-select" value={filters.sprintId} disabled={!selectedProjectId} onChange={(event) => updateFilter("sprintId", event.target.value)}>
                <option value="all">All sprints</option>
                <option value="backlog">Backlog</option>
                {sprints.map((sprint) => (
                  <option key={sprint._id} value={sprint._id}>{sprint.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Bug State</span>
              <select className="field-select" value={filters.lifecycle} onChange={(event) => updateFilter("lifecycle", event.target.value)}>
                <option value="all">All bugs</option>
                <option value="reopened">Reopened bugs</option>
                <option value="fixed">Fixed / Ready for QA</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Date From</span>
              <Input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Date To</span>
              <Input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
            </label>
            <label className="space-y-1.5 md:col-span-2 xl:col-span-3">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-11"
                  placeholder="Search bug ID, title, developer, tester, or severity"
                  value={filters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                />
              </div>
            </label>
          </div>
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
