import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Bug,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  TimerReset,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
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
import { fetchIssues, fetchProjects } from "@/lib/api";
import {
  ISSUE_STATUS,
  getIssueDisplayKey,
  getIssuePriorityVariant,
  getIssueStatusLabel,
  getIssueStatusVariant,
  normalizeBugStatusForIssue,
  normalizeIssueStatus,
  resolveBugDetails,
  resolveIssueProjectId,
} from "@/lib/issues";
import { getProjectTeams, resolveUserId } from "@/lib/project-teams";
import { cn, formatDateTime, getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import EmptyState from "@/components/shared/EmptyState";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_BUCKETS = {
  open: [ISSUE_STATUS.NEW, ISSUE_STATUS.OPEN, ISSUE_STATUS.TODO],
  inProgress: [ISSUE_STATUS.ASSIGNED, ISSUE_STATUS.IN_PROGRESS, ISSUE_STATUS.BLOCKED],
  resolved: [ISSUE_STATUS.FIXED, ISSUE_STATUS.QA, ISSUE_STATUS.REVIEW],
  reopened: [ISSUE_STATUS.REOPEN],
  closed: [ISSUE_STATUS.CLOSED, ISSUE_STATUS.DONE],
  deferred: [ISSUE_STATUS.DEFERRED, ISSUE_STATUS.REJECTED],
};

const STATUS_CHART_META = [
  {
    key: "open",
    label: "Open",
    color: "#f59e0b",
    gradient: "from-amber-400 to-orange-500",
  },
  {
    key: "inProgress",
    label: "In Progress",
    color: "#6366f1",
    gradient: "from-indigo-500 to-violet-500",
  },
  {
    key: "resolved",
    label: "Resolved",
    color: "#10b981",
    gradient: "from-emerald-500 to-teal-400",
  },
  {
    key: "reopened",
    label: "Reopened",
    color: "#ec4899",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    key: "closed",
    label: "Closed",
    color: "#64748b",
    gradient: "from-slate-500 to-slate-700",
  },
  {
    key: "deferred",
    label: "Deferred",
    color: "#14b8a6",
    gradient: "from-cyan-500 to-teal-500",
  },
];

const SUMMARY_CARDS = [
  {
    key: "total",
    label: "Total Bugs",
    Icon: Bug,
    className: "from-blue-500 to-indigo-500",
  },
  {
    key: "open",
    label: "Open Bugs",
    Icon: Clock3,
    className: "from-amber-400 to-orange-500",
  },
  {
    key: "inProgress",
    label: "In Progress",
    Icon: TimerReset,
    className: "from-indigo-500 to-violet-500",
  },
  {
    key: "resolved",
    label: "Resolved",
    Icon: CheckCircle2,
    className: "from-emerald-500 to-teal-400",
  },
  {
    key: "closed",
    label: "Closed",
    Icon: CheckCircle2,
    className: "from-slate-500 to-slate-700",
  },
];

const createEmptyMetrics = () => ({
  total: 0,
  open: 0,
  inProgress: 0,
  resolved: 0,
  reopened: 0,
  closed: 0,
  deferred: 0,
});

const getReporterId = (issue) => resolveUserId(issue?.reporter);

const getComparableStatus = (issue) =>
  issue?.type === "Bug"
    ? normalizeBugStatusForIssue(issue)
    : normalizeIssueStatus(issue?.status);

const incrementMetrics = (metrics, issue) => {
  const status = getComparableStatus(issue);

  metrics.total += 1;

  Object.entries(STATUS_BUCKETS).forEach(([key, values]) => {
    if (values.includes(status)) {
      metrics[key] += 1;
    }
  });
};

const isTesterTeam = (team, testerId) =>
  (team?.members || []).some((member) => resolveUserId(member) === testerId);

const getAssignedTeamsForTester = (project, testerId) =>
  getProjectTeams(project).filter((team) => isTesterTeam(team, testerId));

const buildTesterProject = (project, testerId) => {
  const teams = getAssignedTeamsForTester(project, testerId);

  if (!teams.length) {
    return null;
  }

  return {
    ...project,
    teams,
  };
};

const getProjectName = (issue, projects = []) => {
  const projectId = resolveIssueProjectId(issue);
  const project = projects.find((item) => String(item._id) === projectId);

  return issue?.projectId?.name || project?.name || "Assigned project";
};

const getAssigneeName = (issue) => {
  const bugDetails = resolveBugDetails(issue);

  return bugDetails?.developerLead?.name || issue?.assignee?.name || "Unassigned";
};

const getBugUpdatedAt = (issue) =>
  issue?.updatedAt || issue?.lastUpdatedAt || issue?.createdAt || null;

const getDateKey = (value) => {
  const date = value ? new Date(value) : new Date();

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const buildTimeSeries = (issues) => {
  const today = new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));

    const key = getDateKey(date);
    const count = issues.filter((issue) => getDateKey(issue.createdAt) === key).length;

    return {
      date: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(date),
      created: count,
      resolved: issues.filter(
        (issue) =>
          STATUS_BUCKETS.resolved.includes(getComparableStatus(issue)) &&
          getDateKey(getBugUpdatedAt(issue)) === key
      ).length,
      closed: issues.filter(
        (issue) =>
          STATUS_BUCKETS.closed.includes(getComparableStatus(issue)) &&
          getDateKey(getBugUpdatedAt(issue)) === key
      ).length,
    };
  });
};

const filterBugs = ({ issues, projects, projectId, searchTerm }) => {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  return issues.filter((issue) => {
    if (projectId !== "all" && resolveIssueProjectId(issue) !== projectId) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [
      getIssueDisplayKey(issue),
      issue.title,
      getProjectName(issue, projects),
      getIssueStatusLabel(issue.status),
      issue.priority,
      getAssigneeName(issue),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch));
  });
};

const DashboardIconButton = ({ children, className, ...props }) => (
  <Button
    className={cn(
      "h-11 w-11 rounded-2xl border border-slate-200/80 bg-white/78 p-0 text-slate-600 shadow-sm hover:bg-white hover:text-slate-950",
      className
    )}
    size="icon"
    type="button"
    variant="outline"
    {...props}
  >
    {children}
  </Button>
);

const SummaryCard = ({ Icon, className, label, value }) => (
  <Card className="overflow-hidden border-white/70 bg-white/86 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.34)] backdrop-blur-xl">
    <CardContent className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-[0_14px_26px_-18px_rgba(37,99,235,0.75)]",
            className
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-3xl font-semibold tracking-tight text-slate-950">
          {value}
        </p>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-600">{label}</p>
    </CardContent>
  </Card>
);

const ChartCard = ({ children, title }) => (
  <Card className="min-w-0 overflow-hidden border-white/70 bg-white/88 shadow-[0_20px_56px_-36px_rgba(15,23,42,0.38)] backdrop-blur-xl">
    <CardContent className="p-5">
      <h2 className="text-base font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </CardContent>
  </Card>
);

const EmptyChartState = ({ children }) => (
  <div className="flex h-[240px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center text-sm text-slate-500">
    {children}
  </div>
);

const TableBadge = ({ children, variant }) => (
  <Badge className="justify-center whitespace-nowrap px-2.5 py-1" variant={variant}>
    {children}
  </Badge>
);

const TesterDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const testerId = String(user?._id || user?.id || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [selectedBugIds, setSelectedBugIds] = useState([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date());

  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const {
    data: issues = [],
    isLoading: isIssuesLoading,
    error: issuesError,
    refetch: refetchIssues,
    isFetching: isIssuesFetching,
  } = useQuery({
    queryKey: ["issues", "tester-dashboard", testerId],
    queryFn: () => fetchIssues({ type: "Bug" }),
    enabled: Boolean(testerId),
  });

  const assignedProjects = useMemo(
    () =>
      projects
        .map((project) => buildTesterProject(project, testerId))
        .filter(Boolean),
    [projects, testerId]
  );

  const reportedIssues = useMemo(
    () => issues.filter((issue) => getReporterId(issue) === testerId),
    [issues, testerId]
  );

  const visibleIssues = useMemo(
    () =>
      filterBugs({
        issues: reportedIssues,
        projects: assignedProjects,
        projectId: projectFilter,
        searchTerm,
      }),
    [assignedProjects, projectFilter, reportedIssues, searchTerm]
  );

  const recentlyUpdatedBugs = useMemo(
    () =>
      [...visibleIssues]
        .sort((left, right) => {
          const leftDate = new Date(getBugUpdatedAt(left) || 0).getTime();
          const rightDate = new Date(getBugUpdatedAt(right) || 0).getTime();

          return rightDate - leftDate;
        })
        .slice(0, 8),
    [visibleIssues]
  );

  const dashboardMetrics = useMemo(() => {
    const metrics = createEmptyMetrics();

    visibleIssues.forEach((issue) => incrementMetrics(metrics, issue));

    return metrics;
  }, [visibleIssues]);

  const statusChartData = useMemo(
    () =>
      STATUS_CHART_META.map((item) => ({
        ...item,
        value: dashboardMetrics[item.key],
        percentage: dashboardMetrics.total
          ? Math.round((dashboardMetrics[item.key] / dashboardMetrics.total) * 100)
          : 0,
      })),
    [dashboardMetrics]
  );
  const visibleStatusChartData = useMemo(
    () => statusChartData.filter((item) => item.value > 0),
    [statusChartData]
  );

  const timeSeries = useMemo(() => buildTimeSeries(visibleIssues), [visibleIssues]);

  const allRecentRowsSelected =
    recentlyUpdatedBugs.length > 0 &&
    recentlyUpdatedBugs.every((issue) => selectedBugIds.includes(issue._id));

  const handleRefresh = async () => {
    await Promise.all([refetchProjects(), refetchIssues()]);
    setLastRefreshedAt(new Date());
  };

  const handleToggleAllRows = (checked) => {
    const currentRowIds = recentlyUpdatedBugs.map((issue) => issue._id);

    setSelectedBugIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...currentRowIds]));
      }

      return current.filter((id) => !currentRowIds.includes(id));
    });
  };

  const handleToggleRow = (issueId, checked) => {
    setSelectedBugIds((current) =>
      checked
        ? Array.from(new Set([...current, issueId]))
        : current.filter((id) => id !== issueId)
    );
  };

  const error = projectsError || issuesError;
  const isLoading = isProjectsLoading || isIssuesLoading;

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-rose-700">
          {error.response?.data?.message || "Unable to load tester dashboard data."}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-20 w-full rounded-[28px]" />
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={`tester-stat-${index}`} className="h-32 w-full" />
          ))}
        </section>
        <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <Skeleton className="h-[320px] w-full rounded-[28px]" />
          <Skeleton className="h-[320px] w-full rounded-[28px]" />
        </section>
        <Skeleton className="h-[430px] w-full rounded-[28px]" />
      </div>
    );
  }

  if (!assignedProjects.length) {
    return (
      <EmptyState
        title="No assigned projects yet"
        description="Once an admin adds you to a project team, your tester dashboard metrics will appear here."
        icon={<FolderKanban className="h-5 w-5" />}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/70 bg-white/82 p-3 shadow-[0_22px_58px_-38px_rgba(15,23,42,0.36)] backdrop-blur-xl lg:flex-nowrap">
        <div className="flex min-w-0 items-center gap-3 max-sm:w-full max-sm:flex-wrap sm:gap-4 lg:flex-nowrap">
          <div className="relative w-full min-w-0 shrink-0 sm:w-[380px] lg:w-[420px] xl:w-[460px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Search bugs"
              className="h-11 rounded-2xl border-slate-200/90 bg-white/86 pl-10 shadow-sm"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search bugs"
              value={searchTerm}
            />
          </div>

          <Button
            className="interactive-button h-11 w-full shrink-0 rounded-2xl border border-indigo-300/30 bg-[linear-gradient(90deg,#2563EB_0%,#6366F1_55%,#8B5CF6_100%)] px-4 text-white shadow-[0_14px_28px_-18px_rgba(99,102,241,0.82)] hover:brightness-105 sm:w-auto sm:px-5"
            onClick={() => navigate("/bugs")}
            type="button"
          >
            <Plus className="h-4 w-4" />
            New Bug
          </Button>
        </div>

        <div className="ml-0 flex w-full shrink-0 items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end">
          <DashboardIconButton aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </DashboardIconButton>
          <DashboardIconButton
            aria-label="Settings"
            onClick={() => navigate("/dev/settings")}
          >
            <Settings2 className="h-4 w-4" />
          </DashboardIconButton>
          <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/78 px-3 py-2 shadow-sm">
            <Avatar className="h-9 w-9 rounded-xl">
              <AvatarFallback className="rounded-xl">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold text-slate-950">
                {user?.name || "Tester"}
              </p>
              <p className="truncate text-xs text-slate-500">
                {user?.email || "tester workspace"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {SUMMARY_CARDS.map((item) => (
          <SummaryCard
            key={item.key}
            Icon={item.Icon}
            className={item.className}
            label={item.label}
            value={dashboardMetrics[item.key]}
          />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.86fr_1.14fr]">
        <ChartCard title="Bug Status">
          {dashboardMetrics.total ? (
            <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
              <div className="relative mx-auto h-[260px] w-full max-w-[280px]">
                <ResponsiveContainer height="100%" width="100%">
                  <PieChart aria-label="Bug status donut chart">
                    <Pie
                      cx="50%"
                      cy="50%"
                      data={visibleStatusChartData}
                      dataKey="value"
                      innerRadius={74}
                      outerRadius={104}
                      paddingAngle={3}
                      labelLine={false}
                      stroke="rgba(255,255,255,0.96)"
                      strokeWidth={4}
                    >
                      {visibleStatusChartData.map((entry) => (
                        <Cell fill={entry.color} key={entry.key} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, _name, item) => [
                        `${value} bug${Number(value) === 1 ? "" : "s"}`,
                        item?.payload?.label || "",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Bugs
                  </span>
                  <span className="mt-1 text-3xl font-semibold leading-none text-slate-950">
                    {dashboardMetrics.total}
                  </span>
                </div>
              </div>

              <div className="grid gap-2.5">
                {statusChartData.map((item) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-slate-50/80 px-3.5 py-3 shadow-sm"
                    key={item.key}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate text-sm font-semibold text-slate-700">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-baseline gap-2">
                      <span className="text-sm font-semibold text-slate-950">
                        {item.value}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChartState>No bug status data yet.</EmptyChartState>
          )}
        </ChartCard>

        <ChartCard title="Bugs Over Time (Last 7 Days)">
          {dashboardMetrics.total ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                {[
                  { label: "Created", color: "bg-blue-500" },
                  { label: "Resolved", color: "bg-emerald-500" },
                  { label: "Closed", color: "bg-slate-600" },
                ].map((item) => (
                  <div
                    className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-1.5"
                    key={item.label}
                  >
                    <span className={cn("h-2.5 w-2.5 rounded-full", item.color)} />
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="h-[260px]">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart
                  data={timeSeries}
                  margin={{ bottom: 8, left: -20, right: 18, top: 10 }}
                >
                  <defs>
                    <linearGradient id="tester-bugs-created" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                    <linearGradient id="tester-bugs-resolved" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                    <linearGradient id="tester-bugs-closed" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#64748b" />
                      <stop offset="100%" stopColor="#475569" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 6" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="date"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Line
                    activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 3 }}
                    dataKey="created"
                    dot={{ r: 3.5, stroke: "#ffffff", strokeWidth: 2 }}
                    name="Created"
                    stroke="url(#tester-bugs-created)"
                    strokeLinecap="round"
                    strokeWidth={3.5}
                    type="monotone"
                  />
                  <Line
                    activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 3 }}
                    dataKey="resolved"
                    dot={{ r: 3.5, stroke: "#ffffff", strokeWidth: 2 }}
                    name="Resolved"
                    stroke="url(#tester-bugs-resolved)"
                    strokeLinecap="round"
                    strokeWidth={3.5}
                    type="monotone"
                  />
                  <Line
                    activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 3 }}
                    dataKey="closed"
                    dot={{ r: 3.5, stroke: "#ffffff", strokeWidth: 2 }}
                    name="Closed"
                    stroke="url(#tester-bugs-closed)"
                    strokeLinecap="round"
                    strokeWidth={3.5}
                    type="monotone"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            </div>
          ) : (
            <EmptyChartState>No bug trend data yet.</EmptyChartState>
          )}
        </ChartCard>
      </section>

      <Card className="overflow-hidden border-white/70 bg-white/90 shadow-[0_20px_56px_-36px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <CardContent className="p-0">
          <div className="border-b border-slate-200/80 px-4 py-4 sm:px-5">
            <h2 className="text-base font-semibold tracking-tight text-slate-950">
              Recently Updated Bugs
            </h2>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {recentlyUpdatedBugs.length ? (
              recentlyUpdatedBugs.map((issue) => {
                const updatedAt = getBugUpdatedAt(issue);

                return (
                  <article
                    className="rounded-[20px] border border-slate-200/80 bg-white/78 p-4 shadow-sm"
                    key={issue._id}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        aria-label={`Select ${getIssueDisplayKey(issue)}`}
                        checked={selectedBugIds.includes(issue._id)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        onChange={(event) =>
                          handleToggleRow(issue._id, event.target.checked)
                        }
                        type="checkbox"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-500">
                            {getIssueDisplayKey(issue)}
                          </span>
                          <TableBadge variant={getIssueStatusVariant(issue.status)}>
                            {getIssueStatusLabel(issue.status)}
                          </TableBadge>
                        </div>
                        <h3 className="mt-2 break-words text-sm font-semibold text-slate-950">
                          {issue.title || "Untitled bug"}
                        </h3>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Project
                        </span>
                        <span className="min-w-0 truncate text-right font-medium">
                          {getProjectName(issue, assignedProjects)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Priority
                        </span>
                        <TableBadge variant={getIssuePriorityVariant(issue.priority)}>
                          {issue.priority || "Not set"}
                        </TableBadge>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Assignee
                        </span>
                        <span className="min-w-0 truncate text-right font-medium">
                          {getAssigneeName(issue)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Updated
                        </span>
                        <span className="text-right font-medium">
                          {updatedAt
                            ? formatDateTime(updatedAt, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Unknown"}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
                No bugs match the current dashboard filters.
              </p>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50/90 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="w-12 px-5 py-3">
                    <input
                      aria-label="Select all recently updated bugs"
                      checked={allRecentRowsSelected}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      onChange={(event) => handleToggleAllRows(event.target.checked)}
                      type="checkbox"
                    />
                  </th>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {recentlyUpdatedBugs.length ? (
                  recentlyUpdatedBugs.map((issue) => {
                    const updatedAt = getBugUpdatedAt(issue);

                    return (
                      <tr
                        className="bg-white/64 transition hover:bg-blue-50/42"
                        key={issue._id}
                      >
                        <td className="px-5 py-4">
                          <input
                            aria-label={`Select ${getIssueDisplayKey(issue)}`}
                            checked={selectedBugIds.includes(issue._id)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            onChange={(event) =>
                              handleToggleRow(issue._id, event.target.checked)
                            }
                            type="checkbox"
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-mono text-xs font-semibold text-slate-500">
                          {getIssueDisplayKey(issue)}
                        </td>
                        <td className="max-w-[280px] px-4 py-4">
                          <p className="truncate font-semibold text-slate-950">
                            {issue.title || "Untitled bug"}
                          </p>
                        </td>
                        <td className="max-w-[190px] px-4 py-4">
                          <p className="truncate text-slate-600">
                            {getProjectName(issue, assignedProjects)}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <TableBadge variant={getIssueStatusVariant(issue.status)}>
                            {getIssueStatusLabel(issue.status)}
                          </TableBadge>
                        </td>
                        <td className="px-4 py-4">
                          <TableBadge variant={getIssuePriorityVariant(issue.priority)}>
                            {issue.priority || "Not set"}
                          </TableBadge>
                        </td>
                        <td className="max-w-[170px] px-4 py-4">
                          <p className="truncate text-slate-600">
                            {getAssigneeName(issue)}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                          {updatedAt
                            ? formatDateTime(updatedAt, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Unknown"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      className="px-5 py-12 text-center text-sm text-slate-500"
                      colSpan={8}
                    >
                      No bugs match the current dashboard filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3 rounded-[24px] border border-white/70 bg-white/78 p-3 shadow-[0_16px_42px_-34px_rgba(15,23,42,0.32)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <label className="flex w-full items-center gap-3 sm:w-auto">
          <span className="sr-only">Project filter</span>
          <select
            className="h-11 w-full rounded-2xl border border-slate-200/90 bg-white/86 px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/25 sm:w-auto"
            onChange={(event) => setProjectFilter(event.target.value)}
            value={projectFilter}
          >
            <option value="all">All projects</option>
            {assignedProjects.map((project) => (
              <option key={project._id} value={String(project._id)}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-sm text-slate-500">
            Last refreshed {formatDateTime(lastRefreshedAt)}
          </p>
          <DashboardIconButton
            aria-label="Refresh dashboard"
            className={isIssuesFetching ? "animate-pulse" : ""}
            onClick={handleRefresh}
          >
            <RefreshCcw className={cn("h-4 w-4", isIssuesFetching && "animate-spin")} />
          </DashboardIconButton>
        </div>
      </section>
    </div>
  );
};

export default TesterDashboardPage;
