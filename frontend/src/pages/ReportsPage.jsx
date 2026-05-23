import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  AreaChart as AreaChartIcon,
  Bug,
  CheckCircle2,
  Download,
  FileText,
  Flame,
  Gauge,
  GitBranch,
  Layers3,
  RefreshCcw,
  Search,
  ShieldCheck,
  TimerReset,
  TrendingUp,
  UserCheck,
  Users2,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import useAnalytics from "@/hooks/use-analytics";
import { fetchEpics, fetchProjects, fetchSprints } from "@/lib/api";
import {
  BUG_SEVERITY_OPTIONS,
  ISSUE_STATUS,
  ISSUE_TYPES,
  getIssuePriorityVariant,
  getIssueStatusLabel,
  getIssueStatusVariant,
} from "@/lib/issues";
import {
  getProjectMembers,
  getProjectTeams,
  resolveTeamId,
  resolveUserId,
} from "@/lib/project-teams";
import {
  ANALYTICS_FIELD_CLASS,
  ANALYTICS_PANEL_CLASS,
  ANALYTICS_SELECT_CLASS,
  CHART_GRID_COLOR,
  AnalyticsEmptyState,
  AnalyticsPanel,
  chartTooltipStyle,
  formatCompactNumber,
  formatDuration,
} from "@/components/analytics/analytics-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateTime } from "@/lib/utils";

const PRIORITIES = ["Critical", "High", "Medium", "Low"];
const WORK_TYPE_OPTIONS = [
  { value: "both", label: "Tasks + Bugs" },
  { value: "tasks", label: "Tasks only" },
  { value: "bugs", label: "Bugs only" },
];
const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open group", statusGroup: "open" },
  { value: "closed", label: "Closed group", statusGroup: "closed" },
  { value: ISSUE_STATUS.TODO, label: "To Do" },
  { value: ISSUE_STATUS.IN_PROGRESS, label: "In Progress" },
  { value: ISSUE_STATUS.REVIEW, label: "Review" },
  { value: ISSUE_STATUS.QA, label: "Ready for QA" },
  { value: ISSUE_STATUS.DONE, label: "Done" },
  { value: ISSUE_STATUS.NEW, label: "New" },
  { value: ISSUE_STATUS.OPEN, label: "Open" },
  { value: ISSUE_STATUS.ASSIGNED, label: "Assigned" },
  { value: ISSUE_STATUS.FIXED, label: "Fixed" },
  { value: ISSUE_STATUS.REOPEN, label: "Reopened" },
  { value: ISSUE_STATUS.CLOSED, label: "Closed" },
  { value: ISSUE_STATUS.REJECTED, label: "Rejected" },
];
const CHART_COLORS = ["#2563eb", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
const CLOSED_STATUSES = new Set([
  ISSUE_STATUS.DONE,
  ISSUE_STATUS.CLOSED,
  ISSUE_STATUS.REJECTED,
  ISSUE_STATUS.DEFERRED,
]);
const ACTIVE_STATUSES = new Set([
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.REVIEW,
  ISSUE_STATUS.QA,
  ISSUE_STATUS.OPEN,
  ISSUE_STATUS.ASSIGNED,
  ISSUE_STATUS.FIXED,
  ISSUE_STATUS.REOPEN,
]);

const asArray = (value) => (Array.isArray(value) ? value : []);
const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
const percent = (part, total) => (total ? Math.round((part / total) * 100) : 0);
const resolveUserLabel = (user, fallback = "Unassigned") =>
  user?.name || user?.email || fallback;
const isClosed = (issue) => CLOSED_STATUSES.has(issue?.status);
const isActive = (issue) => ACTIVE_STATUSES.has(issue?.status);
const isCriticalBug = (issue) =>
  ["Blocker", "Critical"].includes(issue?.severity) ||
  ["Critical", "High"].includes(issue?.priority);
const isReadyForQa = (issue) =>
  [ISSUE_STATUS.QA, ISSUE_STATUS.FIXED].includes(issue?.status);
const isReopened = (issue) => issue?.status === ISSUE_STATUS.REOPEN;
const isOverdue = (issue) =>
  Boolean(issue?.dueAt) && !isClosed(issue) && new Date(issue.dueAt) < new Date();

const buildRows = (rows = [], keyAccessor, labelAccessor) => {
  const buckets = new Map();

  rows.forEach((row) => {
    const key = keyAccessor(row) || "unassigned";
    const label = labelAccessor(row) || "Unassigned";
    const bucket = buckets.get(key) || { key, label, count: 0 };
    bucket.count += 1;
    buckets.set(key, bucket);
  });

  return Array.from(buckets.values()).sort((left, right) => right.count - left.count);
};

const exportCsv = (rows) => {
  if (typeof document === "undefined") {
    return;
  }

  const escapeValue = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = rows.map((row) => row.map(escapeValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `workflow-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const getStatusParts = (statusFilter) => {
  const match = STATUS_OPTIONS.find((option) => option.value === statusFilter);

  if (match?.statusGroup) {
    return { status: "all", statusGroup: match.statusGroup };
  }

  return { status: statusFilter || "all", statusGroup: "all" };
};

const ChartFrame = ({ children, className }) => (
  <div className={cn("h-[260px] w-full", className)}>{children}</div>
);

const KpiCard = ({ accent = "blue", helper, icon: Icon, label, trend, value }) => {
  const tones = {
    blue: "from-blue-600 to-cyan-400 text-white",
    emerald: "from-emerald-600 to-teal-400 text-white",
    amber: "from-amber-500 to-orange-500 text-white",
    rose: "from-rose-600 to-pink-500 text-white",
    violet: "from-violet-600 to-fuchsia-500 text-white",
    slate: "from-slate-800 to-slate-600 text-white",
  };

  return (
    <Card className={cn("overflow-hidden rounded-[16px] border-white/10 bg-gradient-to-br shadow-[0_20px_48px_-30px_rgba(15,23,42,0.55)]", tones[accent])}>
      <CardContent className="relative p-4">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(255,255,255,0.24),transparent_46%,rgba(255,255,255,0.12))]" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/72">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
            <p className="mt-1 truncate text-xs text-white/74">{helper}</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/16">
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <div className="relative mt-3 flex items-center gap-1">
          {[32, 54, 42, 68, 56, 78, 62].map((height, index) => (
            <span
              key={`${label}-spark-${index}`}
              className="w-full rounded-full bg-white/28"
              style={{ height: `${height / 6}px` }}
            />
          ))}
        </div>
        {trend ? (
          <p className="relative mt-2 text-[11px] font-semibold text-white/82">{trend}</p>
        ) : null}
      </CardContent>
    </Card>
  );
};

const SectionTitle = ({ kicker, title, description }) => (
  <div className="flex flex-col gap-1">
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">{kicker}</p>
    <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">{title}</h2>
    {description ? <p className="text-sm text-slate-500">{description}</p> : null}
  </div>
);

const ProgressRow = ({ label, meta, tone = "bg-blue-500", value }) => (
  <div className="rounded-[16px] border border-white/55 bg-white/58 p-3 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.34)] backdrop-blur-xl">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950">{label}</p>
        {meta ? <p className="mt-1 truncate text-xs text-slate-500">{meta}</p> : null}
      </div>
      <span className="text-sm font-semibold text-slate-700">{value}%</span>
    </div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80">
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(value, 4)}%` }} />
    </div>
  </div>
);

const ReportsLoading = () => (
  <div className="space-y-5">
    <Skeleton className="h-[170px] rounded-[16px]" />
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={`report-kpi-${index}`} className="h-[132px] rounded-[16px]" />
      ))}
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <Skeleton className="h-[360px] rounded-[16px]" />
      <Skeleton className="h-[360px] rounded-[16px]" />
      <Skeleton className="h-[360px] rounded-[16px]" />
      <Skeleton className="h-[360px] rounded-[16px]" />
    </div>
  </div>
);

const ReportsPage = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    projectId: "all",
    teamId: "all",
    sprintId: "all",
    epicId: "all",
    assigneeId: "all",
    developerId: "all",
    testerId: "all",
    priority: "all",
    severity: "all",
    status: "all",
    dateFrom: "",
    dateTo: "",
    search: "",
    workType: "both",
  });
  const showTasks = filters.workType !== "bugs";
  const showBugs = filters.workType !== "tasks";
  const statusParts = getStatusParts(filters.status);
  const analyticsFilters = {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    projectId: filters.projectId,
    teamId: filters.teamId,
    assigneeId: filters.assigneeId,
    developerId: filters.developerId,
    testerId: filters.testerId,
    priority: filters.priority,
    severity: filters.severity,
    sprintId: filters.sprintId,
    epicId: filters.epicId,
    search: filters.search,
    ...statusParts,
  };
  const taskAnalytics = useAnalytics(
    {
      ...analyticsFilters,
      excludeType: ISSUE_TYPES.BUG,
    },
    { includeIssues: true, enabled: showTasks }
  );
  const bugAnalytics = useAnalytics(
    {
      ...analyticsFilters,
      type: ISSUE_TYPES.BUG,
    },
    { includeIssues: true, enabled: showBugs }
  );
  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    error: projectsError,
  } = useQuery({
    queryKey: ["projects", "reports-v2-options"],
    queryFn: fetchProjects,
    staleTime: 60_000,
  });
  const selectedProjectId = filters.projectId !== "all" ? filters.projectId : "";
  const { data: epics = [] } = useQuery({
    queryKey: ["reports-v2", "epics", selectedProjectId],
    queryFn: () => fetchEpics({ projectId: selectedProjectId }),
    enabled: Boolean(selectedProjectId),
  });
  const { data: sprints = [] } = useQuery({
    queryKey: ["reports-v2", "sprints", selectedProjectId],
    queryFn: () => fetchSprints({ projectId: selectedProjectId }),
    enabled: Boolean(selectedProjectId),
  });

  const teams = useMemo(() => {
    const rows = new Map();

    projects.forEach((project) => {
      if (filters.projectId !== "all" && String(project._id) !== String(filters.projectId)) {
        return;
      }

      getProjectTeams(project).forEach((team) => {
        const teamId = resolveTeamId(team);
        if (teamId && !rows.has(teamId)) {
          rows.set(teamId, team);
        }
      });
    });

    return Array.from(rows.values()).sort((left, right) =>
      (left.name || "").localeCompare(right.name || "")
    );
  }, [filters.projectId, projects]);

  const members = useMemo(() => {
    const rows = new Map();

    projects.forEach((project) => {
      if (filters.projectId !== "all" && String(project._id) !== String(filters.projectId)) {
        return;
      }

      getProjectMembers(project).forEach((member) => {
        const userId = resolveUserId(member);
        if (userId && !rows.has(userId)) {
          rows.set(userId, member);
        }
      });
    });

    return Array.from(rows.values()).sort((left, right) =>
      (left.name || "").localeCompare(right.name || "")
    );
  }, [filters.projectId, projects]);

  const developers = members.filter((member) => member.role === "Developer");
  const testers = members.filter((member) => member.role === "Tester");
  const taskIssues = asArray(taskAnalytics.issues?.issues);
  const bugIssues = asArray(bugAnalytics.issues?.issues);
  const taskSummary = taskAnalytics.overview?.summary || {};
  const bugSummary = bugAnalytics.overview?.summary || {};
  const taskTrend = asArray(taskAnalytics.trends?.issueTrend);
  const bugTrend = asArray(bugAnalytics.trends?.issueTrend);
  const taskProjects = asArray(taskAnalytics.projects?.projects);
  const bugProjects = asArray(bugAnalytics.projects?.projects);
  const taskTeams = asArray(taskAnalytics.teams?.teams);
  const bugTeams = asArray(bugAnalytics.teams?.teams);
  const allVisibleIssues = [...(showTasks ? taskIssues : []), ...(showBugs ? bugIssues : [])];
  const taskMetrics = {
    total: toNumber(taskSummary.totalIssues),
    open: taskIssues.filter((issue) => !isClosed(issue)).length,
    active: taskIssues.filter(isActive).length,
    completed: taskIssues.filter(isClosed).length,
    overdue: taskIssues.filter(isOverdue).length,
    sprintCompletion: percent(taskIssues.filter(isClosed).length, taskIssues.length),
  };
  const bugMetrics = {
    total: toNumber(bugSummary.totalIssues),
    open: bugIssues.filter((issue) => !isClosed(issue)).length,
    critical: bugIssues.filter(isCriticalBug).length,
    reopened: bugIssues.filter(isReopened).length,
    readyForQa: bugIssues.filter(isReadyForQa).length,
    closed: bugIssues.filter((issue) => issue.status === ISSUE_STATUS.CLOSED).length,
  };
  const teamMetrics = {
    productivity: percent(taskMetrics.completed + bugMetrics.closed, taskMetrics.total + bugMetrics.total),
    avgResolution: Math.max(
      toNumber(taskSummary.avgResolutionTimeMs),
      toNumber(bugSummary.avgResolutionTimeMs)
    ),
    velocity: taskMetrics.completed + bugMetrics.closed,
    qaRate: percent(bugMetrics.closed, bugMetrics.readyForQa + bugMetrics.closed),
    reopenRate: percent(bugMetrics.reopened, bugMetrics.total),
  };
  const taskStatusRows = buildRows(taskIssues, (issue) => issue.status, (issue) => getIssueStatusLabel(issue.status));
  const bugSeverityRows = buildRows(bugIssues, (issue) => issue.severity || "Not set", (issue) => issue.severity || "Not set");
  const taskAssigneeRows = buildRows(taskIssues, (issue) => issue.assignee?._id, (issue) => resolveUserLabel(issue.assignee));
  const bugDeveloperRows = buildRows(bugIssues, (issue) => issue.developerLead?._id || issue.assignee?._id, (issue) => resolveUserLabel(issue.developerLead || issue.assignee));
  const bugPriorityRows = buildRows(bugIssues, (issue) => issue.priority, (issue) => issue.priority);
  const taskTypeRows = buildRows(taskIssues, (issue) => issue.type, (issue) => issue.type);
  const trendRows = useMemo(() => {
    const rows = new Map();
    taskTrend.forEach((row) => {
      const key = row.label || row.date || row._id || "";
      rows.set(key, { label: key, tasks: toNumber(row.created), bugs: 0, resolved: toNumber(row.resolved || row.closed) });
    });
    bugTrend.forEach((row) => {
      const key = row.label || row.date || row._id || "";
      const existing = rows.get(key) || { label: key, tasks: 0, bugs: 0, resolved: 0 };
      existing.bugs = toNumber(row.created);
      existing.resolved += toNumber(row.resolved || row.closed);
      rows.set(key, existing);
    });
    return Array.from(rows.values()).slice(-14);
  }, [bugTrend, taskTrend]);
  const teamPerformance = useMemo(() => {
    const rows = new Map();
    const ensureRow = (team) => {
      const key = team.teamId || team.name;
      const row = rows.get(key) || {
        key,
        name: team.name || "Unassigned team",
        productivity: 0,
        tasks: 0,
        bugsFixed: 0,
        total: 0,
        reopened: 0,
      };
      rows.set(key, row);
      return row;
    };
    taskTeams.forEach((team) => {
      const row = ensureRow(team);
      row.tasks += toNumber(team.closedIssues);
      row.total += toNumber(team.totalIssues);
      row.productivity = Math.max(row.productivity, toNumber(team.productivity || team.completionRate));
    });
    bugTeams.forEach((team) => {
      const row = ensureRow(team);
      row.bugsFixed += toNumber(team.closedIssues);
      row.total += toNumber(team.totalIssues);
      row.productivity = Math.max(row.productivity, toNumber(team.productivity || team.completionRate));
    });
    return Array.from(rows.values()).sort((left, right) => right.productivity - left.productivity);
  }, [bugTeams, taskTeams]);
  const projectRows = useMemo(() => {
    const rows = new Map();
    taskProjects.forEach((project) => {
      rows.set(project.projectId, {
        key: project.projectId,
        name: project.name,
        tasks: toNumber(project.totalIssues),
        bugs: 0,
        openBugs: 0,
        closedBugs: 0,
        teamCount: toNumber(project.teamCount),
        developers: toNumber(project.teamCount),
        completion: toNumber(project.completionRate),
      });
    });
    bugProjects.forEach((project) => {
      const row = rows.get(project.projectId) || {
        key: project.projectId,
        name: project.name,
        tasks: 0,
        bugs: 0,
        openBugs: 0,
        closedBugs: 0,
        teamCount: toNumber(project.teamCount),
        developers: toNumber(project.teamCount),
        completion: 0,
      };
      row.bugs = toNumber(project.totalIssues);
      row.openBugs = toNumber(project.openIssues);
      row.closedBugs = toNumber(project.closedIssues);
      row.teamCount = Math.max(row.teamCount, toNumber(project.teamCount));
      row.completion = Math.max(row.completion, toNumber(project.completionRate));
      rows.set(project.projectId, row);
    });
    return Array.from(rows.values()).sort((left, right) => right.tasks + right.bugs - (left.tasks + left.bugs));
  }, [bugProjects, taskProjects]);
  const qaRows = buildRows(bugIssues, (issue) => issue.reporter?._id || issue.testerOwner?._id, (issue) => resolveUserLabel(issue.reporter || issue.testerOwner, "Unknown QA"));
  const developerProductivity = useMemo(() => {
    const rows = new Map();
    [...taskIssues, ...bugIssues].forEach((issue) => {
      const user = issue.developerLead || issue.assignee;
      const key = user?._id || "unassigned";
      const row = rows.get(key) || {
        key,
        name: resolveUserLabel(user),
        assignedTasks: 0,
        completedTasks: 0,
        bugsFixed: 0,
        reopened: 0,
        total: 0,
      };
      if (issue.type === ISSUE_TYPES.BUG) {
        row.bugsFixed += issue.status === ISSUE_STATUS.CLOSED ? 1 : 0;
        row.reopened += isReopened(issue) ? 1 : 0;
      } else {
        row.assignedTasks += 1;
        row.completedTasks += isClosed(issue) ? 1 : 0;
      }
      row.total += 1;
      rows.set(key, row);
    });
    return Array.from(rows.values())
      .map((row) => ({
        ...row,
        velocity: percent(row.completedTasks + row.bugsFixed, row.total),
        reopenRate: percent(row.reopened, row.total),
      }))
      .sort((left, right) => right.velocity - left.velocity);
  }, [bugIssues, taskIssues]);
  const isLoading = isProjectsLoading || (showTasks && taskAnalytics.isLoading) || (showBugs && bugAnalytics.isLoading);
  const error = projectsError || taskAnalytics.error || bugAnalytics.error;

  const updateFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "projectId"
        ? { teamId: "all", assigneeId: "all", developerId: "all", testerId: "all", sprintId: "all", epicId: "all" }
        : {}),
    }));
  };
  const resetFilters = () =>
    setFilters({
      projectId: "all",
      teamId: "all",
      sprintId: "all",
      epicId: "all",
      assigneeId: "all",
      developerId: "all",
      testerId: "all",
      priority: "all",
      severity: "all",
      status: "all",
      dateFrom: "",
      dateTo: "",
      search: "",
      workType: "both",
    });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["analytics"] });
  const exportAnalytics = () =>
    exportCsv([
      ["Workflow", "ID", "Title", "Project", "Team", "Owner", "Status", "Priority", "Severity", "Created", "Resolution ms"],
      ...allVisibleIssues.map((issue) => [
        issue.type === ISSUE_TYPES.BUG ? "Bug" : "Task",
        issue.issueId,
        issue.title,
        issue.project?.name || "",
        issue.team?.name || "",
        resolveUserLabel(issue.developerLead || issue.assignee || issue.reporter, ""),
        issue.status,
        issue.priority,
        issue.severity || "",
        issue.createdAt || "",
        issue.resolutionTimeMs || "",
      ]),
    ]);

  if (error) {
    return (
      <Card className={ANALYTICS_PANEL_CLASS}>
        <CardContent className="p-6 text-sm text-rose-700">
          {error.response?.data?.message || error.message || "Unable to load reports analytics."}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <ReportsLoading />;
  }

  return (
    <div className="space-y-5">
      <Card className="sticky top-24 z-20 overflow-hidden rounded-[16px] border-white/60 bg-white/86 shadow-[0_22px_60px_-36px_rgba(15,23,42,0.4)] backdrop-blur-2xl">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Reports Dashboard</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">Workflow Analytics Command Center</h1>
              <p className="mt-1 text-sm text-slate-500">
                Task flow and bug flow are measured independently with a combined executive view.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={exportAnalytics}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button type="button" variant="outline" onClick={() => window.print()}>
                <FileText className="h-4 w-4" />
                Export PDF
              </Button>
              <Button type="button" onClick={refresh}>
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <select className={ANALYTICS_SELECT_CLASS} value={filters.projectId} onChange={(event) => updateFilter("projectId", event.target.value)}>
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>{project.name}</option>
              ))}
            </select>
            <select className={ANALYTICS_SELECT_CLASS} value={filters.teamId} onChange={(event) => updateFilter("teamId", event.target.value)}>
              <option value="all">All teams</option>
              {teams.map((team) => (
                <option key={resolveTeamId(team)} value={resolveTeamId(team)}>{team.name}</option>
              ))}
            </select>
            <select className={ANALYTICS_SELECT_CLASS} value={filters.sprintId} disabled={!selectedProjectId} onChange={(event) => updateFilter("sprintId", event.target.value)}>
              <option value="all">All sprints</option>
              <option value="backlog">Backlog</option>
              {sprints.map((sprint) => (
                <option key={sprint._id} value={sprint._id}>{sprint.name}</option>
              ))}
            </select>
            <select className={ANALYTICS_SELECT_CLASS} value={filters.epicId} disabled={!selectedProjectId} onChange={(event) => updateFilter("epicId", event.target.value)}>
              <option value="all">All epics</option>
              <option value="unassigned">No epic</option>
              {epics.map((epic) => (
                <option key={epic._id} value={epic._id}>{epic.name}</option>
              ))}
            </select>
            <select className={ANALYTICS_SELECT_CLASS} value={filters.assigneeId} onChange={(event) => updateFilter("assigneeId", event.target.value)}>
              <option value="all">All assignees</option>
              {members.map((member) => (
                <option key={resolveUserId(member)} value={resolveUserId(member)}>{member.name}</option>
              ))}
            </select>
            <select className={ANALYTICS_SELECT_CLASS} value={filters.developerId} onChange={(event) => updateFilter("developerId", event.target.value)}>
              <option value="all">All developers</option>
              {developers.map((developer) => (
                <option key={resolveUserId(developer)} value={resolveUserId(developer)}>{developer.name}</option>
              ))}
            </select>
            <select className={ANALYTICS_SELECT_CLASS} value={filters.testerId} onChange={(event) => updateFilter("testerId", event.target.value)}>
              <option value="all">All testers</option>
              {testers.map((tester) => (
                <option key={resolveUserId(tester)} value={resolveUserId(tester)}>{tester.name}</option>
              ))}
            </select>
            <select className={ANALYTICS_SELECT_CLASS} value={filters.priority} onChange={(event) => updateFilter("priority", event.target.value)}>
              <option value="all">All priorities</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
            <select className={ANALYTICS_SELECT_CLASS} value={filters.severity} onChange={(event) => updateFilter("severity", event.target.value)}>
              <option value="all">All severities</option>
              {BUG_SEVERITY_OPTIONS.map((severity) => (
                <option key={severity} value={severity}>{severity}</option>
              ))}
            </select>
            <select className={ANALYTICS_SELECT_CLASS} value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
            <select className={ANALYTICS_SELECT_CLASS} value={filters.workType} onChange={(event) => updateFilter("workType", event.target.value)}>
              {WORK_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Input className={ANALYTICS_FIELD_CLASS} type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
              <Input className={ANALYTICS_FIELD_CLASS} type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
            </div>
            <div className="relative md:col-span-2 xl:col-span-5">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className={cn(ANALYTICS_FIELD_CLASS, "pl-11")} placeholder="Search reports by ID, title, project, priority, or status" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} />
            </div>
            <Button type="button" variant="outline" onClick={resetFilters}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard accent="blue" icon={Layers3} label="Total Tasks" value={formatCompactNumber(taskMetrics.total)} helper={`${taskMetrics.completed} completed`} trend="Task flow" />
        <KpiCard accent="amber" icon={TimerReset} label="Open Tasks" value={formatCompactNumber(taskMetrics.open)} helper={`${taskMetrics.active} in progress`} />
        <KpiCard accent="emerald" icon={CheckCircle2} label="Completed Tasks" value={formatCompactNumber(taskMetrics.completed)} helper={`${taskMetrics.sprintCompletion}% sprint completion`} />
        <KpiCard accent="rose" icon={Bug} label="Total Bugs" value={formatCompactNumber(bugMetrics.total)} helper={`${bugMetrics.open} open`} trend="Bug flow" />
        <KpiCard accent="violet" icon={ShieldCheck} label="Ready For QA" value={formatCompactNumber(bugMetrics.readyForQa)} helper={`${teamMetrics.qaRate}% QA verification`} />
        <KpiCard accent="slate" icon={Gauge} label="Productivity" value={`${teamMetrics.productivity}%`} helper={`${teamMetrics.reopenRate}% reopen rate`} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard accent="amber" icon={Flame} label="Overdue Tasks" value={taskMetrics.overdue} helper="Due date risk" />
        <KpiCard accent="rose" icon={AlertTriangle} label="Critical Bugs" value={bugMetrics.critical} helper="Severity or high priority" />
        <KpiCard accent="rose" icon={RefreshCcw} label="Reopened Bugs" value={bugMetrics.reopened} helper={`${teamMetrics.reopenRate}% of bugs`} />
        <KpiCard accent="emerald" icon={Zap} label="Velocity" value={teamMetrics.velocity} helper="Closed tasks + bugs" />
        <KpiCard accent="blue" icon={TimerReset} label="Avg Resolution" value={formatDuration(teamMetrics.avgResolution)} helper="Cycle time signal" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <AnalyticsPanel title="Task Analytics" description="Task, story, epic, and sub-task workflow only. Bugs are excluded from this section.">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <SectionTitle kicker="Task Metrics" title="Task Status Distribution" />
              <ChartFrame>
                {taskStatusRows.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={taskStatusRows} dataKey="count" nameKey="label" innerRadius={58} outerRadius={90}>
                        {taskStatusRows.map((row, index) => <Cell key={row.key} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <AnalyticsEmptyState icon={Layers3} title="No task data" description="Task analytics appear when non-bug work exists." />}
              </ChartFrame>
            </div>
            <div>
              <SectionTitle kicker="Sprint Burndown" title="Created vs Resolved Trend" />
              <ChartFrame>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendRows}>
                    <CartesianGrid stroke={CHART_GRID_COLOR} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Area type="monotone" dataKey="tasks" stroke="#2563eb" fill="#bfdbfe" fillOpacity={0.75} />
                    <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="#bbf7d0" fillOpacity={0.55} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartFrame>
            </div>
            <div>
              <SectionTitle kicker="Ownership" title="Tasks By Assignee" />
              <div className="mt-4 space-y-3">
                {taskAssigneeRows.slice(0, 6).map((row) => (
                  <ProgressRow key={row.key} label={row.label} value={percent(row.count, taskMetrics.total)} meta={`${row.count} tasks`} tone="bg-blue-500" />
                ))}
              </div>
            </div>
            <div>
              <SectionTitle kicker="Breakdown" title="Story vs Task Mix" />
              <div className="mt-4 space-y-3">
                {taskTypeRows.map((row) => (
                  <ProgressRow key={row.key} label={row.label} value={percent(row.count, taskMetrics.total)} meta={`${row.count} items`} tone="bg-violet-500" />
                ))}
              </div>
            </div>
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel title="Sprint / Epic Analytics" description="Progress signals for sprint forecasting, burnup, and epic delivery.">
          <div className="space-y-3">
            {projectRows.slice(0, 7).map((project) => (
              <ProgressRow key={project.key} label={project.name} value={project.completion} meta={`${project.tasks} tasks, ${project.bugs} bugs, ${project.teamCount} teams`} tone="bg-cyan-500" />
            ))}
            {!projectRows.length ? (
              <AnalyticsEmptyState icon={GitBranch} title="No project analytics" description="Project and epic analytics appear once work exists in scope." />
            ) : null}
          </div>
        </AnalyticsPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <AnalyticsPanel title="Bug Analytics" description="Bug lifecycle only: tester report, developer fix, QA verification, close.">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <SectionTitle kicker="Severity" title="Bugs By Severity" />
              <ChartFrame>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bugSeverityRows} layout="vertical">
                    <CartesianGrid stroke={CHART_GRID_COLOR} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]} fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            </div>
            <div>
              <SectionTitle kicker="Priority" title="Bugs By Priority" />
              <ChartFrame>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bugPriorityRows} dataKey="count" nameKey="label" outerRadius={92}>
                      {bugPriorityRows.map((row, index) => <Cell key={row.key} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartFrame>
            </div>
            <div className="lg:col-span-2">
              <SectionTitle kicker="Reopen Heatmap" title="Developer Fix Rate" />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {bugDeveloperRows.slice(0, 6).map((row) => (
                  <ProgressRow key={row.key} label={row.label} value={percent(row.count, bugMetrics.total)} meta={`${row.count} assigned/fixed bugs`} tone="bg-rose-500" />
                ))}
              </div>
            </div>
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel title="Bug Resolution Timeline" description="Created task and bug trend with resolved throughput over time.">
          <ChartFrame className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendRows}>
                <CartesianGrid stroke={CHART_GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="tasks" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="bugs" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
        </AnalyticsPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <AnalyticsPanel title="Team Performance" description="Leaderboard across task completion, bug fixes, QA pass rate, reopen rate, and contribution.">
          <div className="space-y-3">
            {teamPerformance.slice(0, 8).map((team, index) => (
              <div key={team.key} className="grid gap-3 rounded-[16px] border border-white/55 bg-white/58 p-3 md:grid-cols-[42px_1fr_90px_90px_120px] md:items-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-sm font-semibold text-blue-700">{index + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{team.name}</p>
                  <p className="text-xs text-slate-500">Productivity {team.productivity}%</p>
                </div>
                <span className="text-sm font-semibold text-slate-700">{team.tasks} tasks</span>
                <span className="text-sm font-semibold text-slate-700">{team.bugsFixed} bugs</span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(team.productivity, 4)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel title="Issues By Projects" description="Project-wise split of tasks and bugs with team count, developers, and completion percentage.">
          <div className="max-h-[430px] overflow-auto pr-2">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="sticky top-0 bg-white/95 text-xs uppercase tracking-[0.16em] text-slate-500 backdrop-blur">
                <tr>
                  <th className="px-3 py-3">Project</th>
                  <th className="px-3 py-3">Tasks</th>
                  <th className="px-3 py-3">Bugs</th>
                  <th className="px-3 py-3">Open Bugs</th>
                  <th className="px-3 py-3">Closed Bugs</th>
                  <th className="px-3 py-3">Teams</th>
                  <th className="px-3 py-3">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projectRows.map((project) => (
                  <tr key={project.key} className="hover:bg-blue-50/50">
                    <td className="px-3 py-3 font-semibold text-slate-950">{project.name}</td>
                    <td className="px-3 py-3">{project.tasks}</td>
                    <td className="px-3 py-3">{project.bugs}</td>
                    <td className="px-3 py-3">{project.openBugs}</td>
                    <td className="px-3 py-3">{project.closedBugs}</td>
                    <td className="px-3 py-3">{project.teamCount}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(project.completion, 4)}%` }} />
                        </div>
                        <span className="text-xs font-semibold">{project.completion}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnalyticsPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <AnalyticsPanel title="Developer Productivity" description="Assigned tasks, completed work, bugs fixed, reopen rate, and velocity score.">
          <div className="grid gap-3 md:grid-cols-2">
            {developerProductivity.slice(0, 8).map((developer) => (
              <div key={developer.key} className="rounded-[16px] border border-white/55 bg-white/58 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{developer.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{developer.assignedTasks} tasks, {developer.bugsFixed} bugs fixed</p>
                  </div>
                  <Badge variant={developer.reopenRate > 20 ? "danger" : "success"}>{developer.velocity}% velocity</Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 px-2 py-2"><p className="text-xs text-slate-500">Done</p><p className="font-semibold">{developer.completedTasks}</p></div>
                  <div className="rounded-xl bg-emerald-50 px-2 py-2"><p className="text-xs text-emerald-700">Fixed</p><p className="font-semibold text-emerald-900">{developer.bugsFixed}</p></div>
                  <div className="rounded-xl bg-rose-50 px-2 py-2"><p className="text-xs text-rose-700">Reopen</p><p className="font-semibold text-rose-900">{developer.reopenRate}%</p></div>
                </div>
              </div>
            ))}
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel title="QA Performance Analytics" description="Bugs reported, verified fixes, reopened bugs, verification rate, efficiency, and false-positive signals.">
          <div className="space-y-3">
            {qaRows.slice(0, 8).map((qa) => {
              const qaIssues = bugIssues.filter((issue) => (issue.reporter?._id || issue.testerOwner?._id || "unassigned") === qa.key);
              const verified = qaIssues.filter((issue) => issue.status === ISSUE_STATUS.CLOSED).length;
              const reopened = qaIssues.filter(isReopened).length;
              const rejected = qaIssues.filter((issue) => issue.status === ISSUE_STATUS.REJECTED).length;
              const efficiency = percent(verified, qaIssues.length);

              return (
                <div key={qa.key} className="rounded-[16px] border border-white/55 bg-white/58 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{qa.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{qa.count} bugs reported</p>
                    </div>
                    <Badge variant={efficiency >= 70 ? "success" : "warning"}>{efficiency}% efficiency</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-xl bg-blue-50 px-2 py-2"><p className="text-xs text-blue-700">Reported</p><p className="font-semibold">{qa.count}</p></div>
                    <div className="rounded-xl bg-emerald-50 px-2 py-2"><p className="text-xs text-emerald-700">Verified</p><p className="font-semibold">{verified}</p></div>
                    <div className="rounded-xl bg-rose-50 px-2 py-2"><p className="text-xs text-rose-700">Reopened</p><p className="font-semibold">{reopened}</p></div>
                    <div className="rounded-xl bg-amber-50 px-2 py-2"><p className="text-xs text-amber-700">False +</p><p className="font-semibold">{rejected}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </AnalyticsPanel>
      </section>

      <AnalyticsPanel title="Detailed Workflow Analytics" description="Separated task and bug rows for audit, export, and operational review.">
        {allVisibleIssues.length ? (
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="sticky top-0 bg-white/95 text-xs uppercase tracking-[0.16em] text-slate-500 backdrop-blur">
                <tr>
                  <th className="px-3 py-3">Flow</th>
                  <th className="px-3 py-3">ID</th>
                  <th className="px-3 py-3">Title</th>
                  <th className="px-3 py-3">Project</th>
                  <th className="px-3 py-3">Owner</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Created</th>
                  <th className="px-3 py-3">Resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allVisibleIssues.slice(0, 80).map((issue) => (
                  <tr key={issue._id} className="hover:bg-blue-50/50">
                    <td className="px-3 py-3"><Badge variant={issue.type === ISSUE_TYPES.BUG ? "danger" : "default"}>{issue.type === ISSUE_TYPES.BUG ? "Bug" : "Task"}</Badge></td>
                    <td className="px-3 py-3 font-mono text-xs font-semibold">{issue.issueId}</td>
                    <td className="max-w-[280px] truncate px-3 py-3 font-semibold text-slate-950">{issue.title}</td>
                    <td className="px-3 py-3">{issue.project?.name || "Unknown"}</td>
                    <td className="px-3 py-3">{resolveUserLabel(issue.developerLead || issue.assignee || issue.reporter)}</td>
                    <td className="px-3 py-3"><Badge variant={getIssueStatusVariant(issue.status)}>{issue.status}</Badge></td>
                    <td className="px-3 py-3"><Badge variant={getIssuePriorityVariant(issue.priority)}>{issue.priority}</Badge></td>
                    <td className="px-3 py-3">{formatDateTime(issue.createdAt)}</td>
                    <td className="px-3 py-3">{formatDuration(issue.resolutionTimeMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AnalyticsEmptyState icon={AreaChartIcon} title="No analytics rows" description="Adjust filters or create task/bug records to populate reports." />
        )}
      </AnalyticsPanel>
    </div>
  );
};

export default ReportsPage;
