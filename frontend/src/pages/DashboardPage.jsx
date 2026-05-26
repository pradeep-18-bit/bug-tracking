import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bug,
  CheckCircle2,
  FolderKanban,
  Layers3,
  Plus,
  RefreshCcw,
  Rocket,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Users2,
  Zap,
} from "lucide-react";
import { fetchBugs, fetchIssueStats } from "@/lib/api";
import useAnalytics from "@/hooks/use-analytics";
import {
  ANALYTICS_PANEL_CLASS,
  ANALYTICS_SUBPANEL_CLASS,
  AnalyticsEmptyState,
  AnalyticsKpiCard,
  AnalyticsPanel,
  AnalyticsSkeletonGrid,
  formatCompactNumber,
  formatDuration,
} from "@/components/analytics/analytics-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ISSUE_STATUS,
  ISSUE_TYPES,
  getIssueDisplayKey,
  getIssuePriorityVariant,
  getIssueStatusLabel,
  getIssueStatusVariant,
  normalizeBugStatusForIssue,
  resolveBugDetails,
  resolveIssueProjectId,
} from "@/lib/issues";
import { cn, formatDateTime, getInitials } from "@/lib/utils";

const statusTone = {
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-blue-500",
  BLOCKED: "bg-rose-500",
  REVIEW: "bg-violet-500",
  QA: "bg-cyan-500",
  DONE: "bg-emerald-500",
  NEW: "bg-amber-500",
  OPEN: "bg-blue-500",
  ASSIGNED: "bg-indigo-500",
  FIXED: "bg-emerald-400",
  CLOSED: "bg-emerald-600",
  REOPEN: "bg-pink-500",
  REJECTED: "bg-slate-500",
  DEFERRED: "bg-teal-500",
};

const activityIcon = {
  created: Layers3,
  closed: CheckCircle2,
  assigned: Users2,
  critical: AlertTriangle,
};

const activityTone = {
  created: "border-blue-200 bg-blue-50 text-blue-700",
  closed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  assigned: "border-violet-200 bg-violet-50 text-violet-700",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
};

const BUG_PRIORITY_META = [
  { key: "Low", className: "bg-emerald-500", tone: "text-emerald-700" },
  { key: "Medium", className: "bg-amber-500", tone: "text-amber-700" },
  { key: "High", className: "bg-orange-500", tone: "text-orange-700" },
  { key: "Critical", className: "bg-rose-500", tone: "text-rose-700" },
];

const BUG_RESOLVED_STATUSES = [
  ISSUE_STATUS.FIXED,
  ISSUE_STATUS.QA,
  ISSUE_STATUS.CLOSED,
];

const BUG_CLOSED_STATUSES = [
  ISSUE_STATUS.CLOSED,
  ISSUE_STATUS.REJECTED,
  ISSUE_STATUS.DEFERRED,
];

const getBugProjectName = (bug) => bug?.projectId?.name || "Unknown project";
const getBugAssigneeName = (bug) => {
  const developer = resolveBugDetails(bug)?.developerLead || bug?.assignee;

  return developer?.name || developer?.email || "Unassigned";
};
const getBugSeverity = (bug) => resolveBugDetails(bug)?.severity || "";
const isCriticalBug = (bug) =>
  bug?.priority === "Critical" || ["Blocker", "Critical"].includes(getBugSeverity(bug));
const isOpenBug = (bug) => !BUG_CLOSED_STATUSES.includes(normalizeBugStatusForIssue(bug));
const isResolvedBug = (bug) =>
  BUG_RESOLVED_STATUSES.includes(normalizeBugStatusForIssue(bug));
const isReopenedBug = (bug) =>
  normalizeBugStatusForIssue(bug) === ISSUE_STATUS.REOPEN ||
  Boolean(resolveBugDetails(bug)?.reopenReason);

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const startOfWeek = (date) => {
  const value = startOfDay(date);
  const day = value.getDay();
  const diff = value.getDate() - day + (day === 0 ? -6 : 1);
  value.setDate(diff);
  return value;
};

const countBetween = (items, getDate, from, to = new Date()) =>
  items.filter((item) => {
    const time = new Date(getDate(item) || 0).getTime();

    return time >= from.getTime() && time < to.getTime();
  }).length;

const buildTrend = (current, previous, suffix = "vs last week") => {
  const delta = current - previous;

  return {
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    label: `${delta > 0 ? "+" : ""}${delta} ${suffix}`,
  };
};

const QuickActionButton = ({ icon: Icon, title, helper, className, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "group flex min-h-[76px] w-full items-center gap-3 rounded-[16px] border px-4 py-3 text-left shadow-[0_16px_34px_-24px_rgba(15,23,42,0.34)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgba(15,23,42,0.38)]",
      className
    )}
  >
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/26 text-current shadow-sm backdrop-blur transition-transform duration-200 group-hover:scale-105">
      <Icon className="h-5 w-5" />
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-semibold">{title}</span>
      <span className="mt-1 block truncate text-xs opacity-75">{helper}</span>
    </span>
  </button>
);

const ProjectBugCard = ({ project, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen(project)}
    className={cn(
      ANALYTICS_SUBPANEL_CLASS,
      "block w-full px-4 py-3 text-left hover:border-rose-200/80"
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
          {project.name}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Open: {project.open} | Closed: {project.closed} | Critical: {project.critical}
        </p>
      </div>
      <Badge className="shrink-0 border-rose-200 bg-rose-50 text-rose-700">
        {project.total} Bugs
      </Badge>
    </div>
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
        <span>Resolution rate</span>
        <span>{project.resolutionRate}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#fb7185,#f97316,#22c55e)] transition-all duration-500"
          style={{ width: `${Math.max(project.resolutionRate, project.total ? 5 : 0)}%` }}
        />
      </div>
    </div>
  </button>
);

const PriorityDistribution = ({ rows, total }) => (
  <AnalyticsPanel
    title="Bug Priority Distribution"
    description="Live severity pressure across all tracked bug records."
  >
    {total ? (
      <div className="space-y-4">
        {rows.map((row) => (
          <div className="space-y-2" key={row.key}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className={cn("font-semibold", row.tone)}>{row.key}</span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {row.count}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
              <div
                className={cn("h-full rounded-full transition-all duration-500", row.className)}
                style={{ width: `${Math.max(row.percentage, row.count ? 6 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <AnalyticsEmptyState
        icon={Bug}
        title="No bug priorities yet"
        description="Priority distribution appears once bugs are reported."
      />
    )}
  </AnalyticsPanel>
);

const RecentCriticalBugs = ({ bugs, onOpen }) => (
  <AnalyticsPanel
    title="Recent Critical Bugs"
    description="Latest high-risk bug records that need operational attention."
  >
    {bugs.length ? (
      <div className="space-y-3">
        {bugs.map((bug) => {
          const status = normalizeBugStatusForIssue(bug);

          return (
            <button
              key={bug._id}
              type="button"
              onClick={() => onOpen(bug)}
              className={cn(
                ANALYTICS_SUBPANEL_CLASS,
                "grid w-full gap-3 px-4 py-3 text-left lg:grid-cols-[110px_minmax(0,1fr)_120px_130px_110px] lg:items-center"
              )}
            >
              <span className="font-mono text-xs font-semibold text-slate-500">
                {getIssueDisplayKey(bug)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
                  {getBugProjectName(bug)}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {bug.title || "Untitled bug"}
                </span>
              </span>
              <Badge variant={getIssuePriorityVariant(bug.priority)}>
                {bug.priority || "Medium"}
              </Badge>
              <span className="truncate text-sm text-slate-600 dark:text-slate-300">
                {getBugAssigneeName(bug)}
              </span>
              <Badge variant={getIssueStatusVariant(status)}>
                {getIssueStatusLabel(status)}
              </Badge>
            </button>
          );
        })}
      </div>
    ) : (
      <AnalyticsEmptyState
        icon={AlertTriangle}
        title="No critical bugs right now"
        description="Critical bug alerts appear here as soon as high-risk bugs are logged."
      />
    )}
  </AnalyticsPanel>
);

const ActiveProjectCard = ({ project, onOpen }) => {
  const teams = project.teams || [];

  return (
    <button
      type="button"
      className="group block w-full rounded-2xl border border-white/50 bg-white/78 p-4 text-left shadow-sm backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200/80 hover:bg-white/90 hover:shadow-md dark:border-white/10 dark:bg-slate-900/58 dark:hover:bg-slate-900/78"
      onClick={() => onOpen(project)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
              {project.name}
            </p>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {project.teamCount || 0} assigned team{project.teamCount === 1 ? "" : "s"}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
          {project.completionRate}% complete
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded-xl bg-slate-950/[0.03] px-3 py-2 dark:bg-white/[0.06]">
          <p className="truncate text-[11px] font-medium text-slate-500">Issues</p>
          <p className="mt-0.5 truncate text-base font-semibold text-slate-950 dark:text-slate-100">
            {project.totalIssues}
          </p>
        </div>
        <div className="min-w-0 rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-500/10">
          <p className="truncate text-[11px] font-medium text-amber-700">Open</p>
          <p className="mt-0.5 truncate text-base font-semibold text-amber-900 dark:text-amber-200">
            {project.openIssues}
          </p>
        </div>
        <div className="min-w-0 rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-500/10">
          <p className="truncate text-[11px] font-medium text-emerald-700">Closed</p>
          <p className="mt-0.5 truncate text-base font-semibold text-emerald-900 dark:text-emerald-200">
            {project.closedIssues}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
          <span>Resolution progress</span>
          <span>{project.openIssues} open</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#8b5cf6,#06b6d4)] transition-all duration-500"
            style={{ width: `${Math.max(project.completionRate, 5)}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {teams.length ? (
          teams.map((team) => (
            <span
              key={team}
              className="max-w-full break-words rounded-full border border-white/60 bg-white/72 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-950/46 dark:text-slate-300"
            >
              {team}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:border-white/10 dark:bg-slate-950/46 dark:text-slate-400">
            No teams assigned
          </span>
        )}
      </div>
    </button>
  );
};

const DashboardLoading = () => (
  <div className="space-y-5">
    <Skeleton className="h-[170px] rounded-[16px] bg-gradient-to-r from-slate-200/70 via-white/80 to-slate-200/70" />
    <AnalyticsSkeletonGrid />
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Skeleton className="h-[350px] rounded-[16px]" />
      <Skeleton className="h-[350px] rounded-[16px]" />
    </div>
  </div>
);

const DashboardPage = () => {
  const navigate = useNavigate();
  const analytics = useAnalytics();
  const {
    data: issueStatsData = {},
    isLoading: isIssueStatsLoading,
    error: issueStatsError,
  } = useQuery({
    queryKey: ["issues", "stats", "admin-dashboard-overview", { excludeType: ISSUE_TYPES.BUG }],
    queryFn: () => fetchIssueStats({ excludeType: ISSUE_TYPES.BUG }),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const {
    data: bugsData = [],
    isLoading: isBugsLoading,
    error: bugsError,
  } = useQuery({
    queryKey: ["bugs", "admin-dashboard-overview"],
    queryFn: () => fetchBugs({ sortBy: "recently-updated" }),
  });
  const bugs = useMemo(() => (Array.isArray(bugsData) ? bugsData : []), [bugsData]);
  const summary = analytics.overview?.summary || {};
  const issueStats = {
    total: Number(issueStatsData?.total || 0),
    open: Number(issueStatsData?.open || 0),
    closed: Number(issueStatsData?.closed || 0),
    highPriority: Number(issueStatsData?.highPriority || 0),
  };
  const trends = analytics.overview?.trends || {};
  const statusRows = useMemo(
    () =>
      (analytics.overview?.statusDistribution || []).filter((row) => row.count > 0),
    [analytics.overview?.statusDistribution]
  );
  const projects = analytics.projects?.projects || [];
  const teams = analytics.teams?.teams || [];
  const activity = analytics.recentActivity?.activity || [];
  const activeProjects = projects;
  const highestWorkloadTeam = teams[0] || null;
  const maxStatusCount = Math.max(...statusRows.map((row) => row.count), 0);
  const now = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => startOfWeek(now), [now]);
  const previousWeekStart = useMemo(() => {
    const value = new Date(weekStart);
    value.setDate(value.getDate() - 7);
    return value;
  }, [weekStart]);
  const todayStart = useMemo(() => startOfDay(now), [now]);
  const navigateToIssues = (params = {}) => {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== "all") {
        searchParams.set(key, value);
      }
    });

    navigate(`/issues${searchParams.toString() ? `?${searchParams}` : ""}`);
  };
  const navigateToBugs = (params = {}) => {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== "all") {
        searchParams.set(key, value);
      }
    });

    navigate(`/admin/bugs${searchParams.toString() ? `?${searchParams}` : ""}`);
  };
  const bugMetrics = useMemo(() => {
    const openBugs = bugs.filter(isOpenBug);
    const criticalBugs = bugs.filter(isCriticalBug);
    const resolvedBugs = bugs.filter(isResolvedBug);
    const reopenedBugs = bugs.filter(isReopenedBug);
    const thisWeek = countBetween(bugs, (bug) => bug.createdAt, weekStart);
    const previousWeek = countBetween(bugs, (bug) => bug.createdAt, previousWeekStart, weekStart);
    const resolvedThisWeek = countBetween(
      resolvedBugs,
      (bug) => bug.updatedAt || bug.createdAt,
      weekStart
    );
    const resolvedLastWeek = countBetween(
      resolvedBugs,
      (bug) => bug.updatedAt || bug.createdAt,
      previousWeekStart,
      weekStart
    );
    const resolvedToday = countBetween(
      resolvedBugs,
      (bug) => bug.updatedAt || bug.createdAt,
      todayStart
    );

    return {
      total: bugs.length,
      open: openBugs.length,
      critical: criticalBugs.length,
      resolved: resolvedBugs.length,
      reopened: reopenedBugs.length,
      thisWeek,
      previousWeek,
      resolvedThisWeek,
      resolvedLastWeek,
      resolvedToday,
    };
  }, [bugs, previousWeekStart, todayStart, weekStart]);
  const bugProjectRows = useMemo(() => {
    const rowsByProject = new Map();

    bugs.forEach((bug) => {
      const projectId = resolveIssueProjectId(bug) || getBugProjectName(bug);
      const row = rowsByProject.get(projectId) || {
        projectId,
        name: getBugProjectName(bug),
        total: 0,
        open: 0,
        closed: 0,
        critical: 0,
      };

      row.total += 1;
      row.open += isOpenBug(bug) ? 1 : 0;
      row.closed += BUG_CLOSED_STATUSES.includes(normalizeBugStatusForIssue(bug)) ? 1 : 0;
      row.critical += isCriticalBug(bug) ? 1 : 0;
      row.resolutionRate = row.total ? Math.round((row.closed / row.total) * 100) : 0;
      rowsByProject.set(projectId, row);
    });

    return Array.from(rowsByProject.values())
      .sort((left, right) => right.total - left.total)
      .slice(0, 6);
  }, [bugs]);
  const priorityRows = useMemo(
    () =>
      BUG_PRIORITY_META.map((item) => {
        const count = bugs.filter((bug) => (bug.priority || "Medium") === item.key).length;

        return {
          ...item,
          count,
          percentage: bugMetrics.total ? Math.round((count / bugMetrics.total) * 100) : 0,
        };
      }),
    [bugMetrics.total, bugs]
  );
  const recentCriticalBugs = useMemo(
    () =>
      bugs
        .filter(isCriticalBug)
        .sort(
          (left, right) =>
            new Date(right.updatedAt || right.createdAt || 0).getTime() -
            new Date(left.updatedAt || left.createdAt || 0).getTime()
        )
        .slice(0, 6),
    [bugs]
  );
  const bugKpiCards = [
    {
      key: "total-bugs",
      title: "Total Bugs",
      value: formatCompactNumber(bugMetrics.total),
      helper: "All bug records",
      icon: Bug,
      tone: "blue",
      trend: buildTrend(bugMetrics.thisWeek, bugMetrics.previousWeek),
      onClick: () => navigateToBugs(),
    },
    {
      key: "open-bugs",
      title: "Open Bugs",
      value: formatCompactNumber(bugMetrics.open),
      helper: "Needs action",
      icon: TimerReset,
      tone: "amber",
      trend: { direction: bugMetrics.open ? "up" : "flat", label: `${bugMetrics.open} active` },
      onClick: () => navigateToBugs({ status: "open" }),
    },
    {
      key: "critical-bugs",
      title: "Critical Bugs",
      value: formatCompactNumber(bugMetrics.critical),
      helper: "High risk",
      icon: AlertTriangle,
      tone: "rose",
      trend: {
        direction: bugMetrics.critical ? "up" : "flat",
        label: `${bugMetrics.critical} urgent`,
      },
      onClick: () => navigateToBugs({ priority: "Critical" }),
    },
    {
      key: "resolved-bugs",
      title: "Resolved Bugs",
      value: formatCompactNumber(bugMetrics.resolved),
      helper: "Fixed / closed",
      icon: CheckCircle2,
      tone: "emerald",
      trend: buildTrend(bugMetrics.resolvedThisWeek, bugMetrics.resolvedLastWeek, "resolved this week"),
      onClick: () => navigateToBugs({ status: "resolved" }),
    },
    {
      key: "reopened-bugs",
      title: "Reopened Bugs",
      value: formatCompactNumber(bugMetrics.reopened),
      helper: "Needs review",
      icon: RefreshCcw,
      tone: "violet",
      trend: { direction: bugMetrics.reopened ? "up" : "flat", label: `${bugMetrics.reopened} reopened` },
      onClick: () => navigateToBugs({ lifecycle: "reopened" }),
    },
    {
      key: "bugs-this-week",
      title: "Bugs This Week",
      value: formatCompactNumber(bugMetrics.thisWeek),
      helper: "New reports",
      icon: Activity,
      tone: "cyan",
      trend: {
        direction: bugMetrics.resolvedToday ? "down" : "flat",
        label: `${bugMetrics.resolvedToday} resolved today`,
      },
      onClick: () => navigateToBugs({ dateFrom: weekStart.toISOString().slice(0, 10) }),
    },
  ];
  const kpiCards = [
    {
      key: "total",
      title: "Total Issues",
      value: formatCompactNumber(issueStats.total),
      helper: "Tracked work",
      icon: Layers3,
      tone: "blue",
      trend: trends.totalIssues,
      onClick: () => navigateToIssues(),
    },
    {
      key: "open",
      title: "Open Issues",
      value: formatCompactNumber(issueStats.open),
      helper: "Active workload",
      icon: AlertTriangle,
      tone: "amber",
      trend: trends.openIssues,
      onClick: () => navigateToIssues({ statusGroup: "open" }),
    },
    {
      key: "closed",
      title: "Closed Issues",
      value: formatCompactNumber(issueStats.closed),
      helper: "Resolved work",
      icon: CheckCircle2,
      tone: "emerald",
      trend: trends.closedIssues,
      onClick: () => navigateToIssues({ statusGroup: "closed" }),
    },
    {
      key: "priority",
      title: "High Priority",
      value: formatCompactNumber(issueStats.highPriority),
      helper: "High / critical / urgent",
      icon: ShieldCheck,
      tone: "rose",
      trend: trends.highPriorityIssues,
      onClick: () => navigateToIssues({ priorityGroup: "high" }),
    },
    {
      key: "teams",
      title: "Active Teams",
      value: formatCompactNumber(summary.activeTeams),
      helper: "Teams with workload",
      icon: Users2,
      tone: "cyan",
      trend: {
        direction: "flat",
        label: `${teams.length} in reports`,
      },
      onClick: () => navigate("/projects"),
    },
    {
      key: "rate",
      title: "Resolution Rate",
      value: `${summary.resolutionRate || 0}%`,
      helper: "Closed / total",
      icon: Rocket,
      tone: "violet",
      trend: {
        direction: "flat",
        label: `${formatDuration(summary.avgResolutionTimeMs)} avg`,
      },
      onClick: () => navigate("/reports"),
    },
  ];

  if (analytics.isLoading || isIssueStatsLoading) {
    return <DashboardLoading />;
  }

  if (analytics.error || issueStatsError) {
    return (
      <Card className={ANALYTICS_PANEL_CLASS}>
        <CardContent className="p-6 text-sm text-rose-700">
          {analytics.error?.response?.data?.message ||
            issueStatsError?.response?.data?.message ||
            "Unable to load dashboard analytics right now."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden rounded-[16px] border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(239,246,255,0.74),rgba(238,242,255,0.66))] shadow-[0_24px_70px_-36px_rgba(15,23,42,0.42)] backdrop-blur-2xl dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(30,41,59,0.76),rgba(15,23,42,0.82))]">
        <CardContent className="relative p-4 sm:p-5">
          <div className="relative grid gap-4 xl:grid-cols-[1fr_1.4fr] xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/65 bg-white/72 px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm backdrop-blur-xl">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                Operational Overview
              </div>
              <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-100">
                Admin Command Center
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <QuickActionButton
                icon={Plus}
                title="Create Project"
                helper="Set up delivery space"
                className="border-blue-200/70 bg-white/72 text-blue-900 hover:border-blue-300 hover:bg-blue-50"
                onClick={() => navigate("/projects")}
              />
              <QuickActionButton
                icon={Zap}
                title="Create Issue"
                helper="Log work or bug"
                className="border-amber-200/70 bg-amber-50/85 text-amber-900 hover:border-amber-300"
                onClick={() => navigate("/issues?compose=1")}
              />
              <QuickActionButton
                icon={Users2}
                title="Projects & Teams"
                helper="Manage ownership"
                className="border-violet-200/70 bg-violet-50/80 text-violet-900 hover:border-violet-300"
                onClick={() => navigate("/projects")}
              />
              <QuickActionButton
                icon={BarChart3}
                title="Reports"
                helper="Open analytics center"
                className="border-cyan-200/70 bg-cyan-50/80 text-cyan-900 hover:border-cyan-300"
                onClick={() => navigate("/reports")}
              />
              <QuickActionButton
                icon={Activity}
                title="Recent Activity"
                helper="Jump to live feed"
                className="border-emerald-200/70 bg-emerald-50/80 text-emerald-900 hover:border-emerald-300"
                onClick={() =>
                  document
                    .getElementById("dashboard-activity")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {kpiCards.map((card) => (
          <AnalyticsKpiCard
            key={card.key}
            title={card.title}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
            helper={card.helper}
            trend={card.trend}
            onClick={card.onClick}
          />
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">
              Bug Management Overview
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Live bug analytics, project risk, and critical bug navigation.
            </p>
          </div>
          <Badge className="w-fit border-white/60 bg-white/72 text-slate-600">
            {isBugsLoading ? "Syncing bugs" : `${bugMetrics.total} tracked bugs`}
          </Badge>
        </div>

        {bugsError ? (
          <Card className={ANALYTICS_PANEL_CLASS}>
            <CardContent className="p-6 text-sm text-rose-700">
              {bugsError.response?.data?.message || "Unable to load bug analytics."}
            </CardContent>
          </Card>
        ) : isBugsLoading ? (
          <AnalyticsSkeletonGrid />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              {bugKpiCards.map((card) => (
                <AnalyticsKpiCard
                  key={card.key}
                  title={card.title}
                  value={card.value}
                  icon={card.icon}
                  tone={card.tone}
                  helper={card.helper}
                  trend={card.trend}
                  onClick={card.onClick}
                />
              ))}
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <AnalyticsPanel
                title="Project-wise Bug Overview"
                description="Projects ranked by live bug volume with resolution progress."
                action={
                  bugProjectRows.length ? (
                    <Badge className="border-white/60 bg-white/72 text-slate-600">
                      {bugProjectRows.length} projects
                    </Badge>
                  ) : null
                }
              >
                {bugProjectRows.length ? (
                  <div className="dashboard-scrollbar dashboard-scroll-fade max-h-[430px] space-y-3 overflow-y-auto pr-2">
                    {bugProjectRows.map((project) => (
                      <ProjectBugCard
                        key={project.projectId}
                        project={project}
                        onOpen={(selectedProject) =>
                          navigateToBugs({
                            projectId:
                              selectedProject.projectId === selectedProject.name
                                ? ""
                                : selectedProject.projectId,
                            project:
                              selectedProject.projectId === selectedProject.name
                                ? selectedProject.name
                                : "",
                          })
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <AnalyticsEmptyState
                    icon={FolderKanban}
                    title="No project bug data yet"
                    description="Project bug insights appear once bugs are linked to projects."
                  />
                )}
              </AnalyticsPanel>

              <PriorityDistribution rows={priorityRows} total={bugMetrics.total} />
            </section>

            <RecentCriticalBugs
              bugs={recentCriticalBugs}
              onOpen={(bug) => navigateToBugs({ bug: bug._id })}
            />
          </>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <AnalyticsPanel
          title="Issue Status Overview"
          description="Distribution of active and resolved workload from live issue data."
          action={
            <Badge className="border-white/60 bg-white/72 text-slate-600">
              {issueStats.total || 0} total
            </Badge>
          }
        >
          {statusRows.length ? (
            <div className="space-y-3">
              {statusRows.map((row) => {
                const width = maxStatusCount
                  ? Math.max(Math.round((row.count / maxStatusCount) * 100), 8)
                  : 0;

                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => navigateToIssues({ status: row.key })}
                    className={cn(
                      ANALYTICS_SUBPANEL_CLASS,
                      "grid w-full gap-3 px-4 py-3 text-left md:grid-cols-[180px_minmax(0,1fr)_90px] md:items-center"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "h-3 w-3 shrink-0 rounded-full",
                          statusTone[row.key] || "bg-slate-400"
                        )}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
                          {row.label}
                        </p>
                        <p className="text-xs text-slate-500">{row.percentage}% of scope</p>
                      </div>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          statusTone[row.key] || "bg-slate-400"
                        )}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-lg font-semibold text-slate-950 dark:text-slate-100">
                        {row.count}
                      </p>
                      <p className="text-xs text-slate-500">issues</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <AnalyticsEmptyState
              icon={Layers3}
              title="No issue status data yet"
              description="Create issues to populate the operational status overview."
            />
          )}
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Most Active Projects"
          description="All active projects sorted by issue volume, open workload, and assigned teams."
          action={
            activeProjects.length ? (
              <Badge className="border-white/60 bg-white/72 text-slate-600">
                {activeProjects.length} active
              </Badge>
            ) : null
          }
        >
          {activeProjects.length ? (
            <div className="dashboard-scrollbar dashboard-scroll-fade max-h-[500px] space-y-3 overflow-y-auto pr-2">
              {activeProjects.map((project) => (
                <ActiveProjectCard
                  key={project.projectId || project.name}
                  project={project}
                  onOpen={(selectedProject) =>
                    navigateToIssues({ projectId: selectedProject.projectId })
                  }
                />
              ))}
            </div>
          ) : (
            <AnalyticsEmptyState
              icon={FolderKanban}
              title="No active project yet"
              description="Project analytics appear once issues are created."
            />
          )}
        </AnalyticsPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <AnalyticsPanel
          title="Live Activity Feed"
          description="Recently created issues, resolved tickets, assignments, and critical alerts."
          className="scroll-mt-28"
          action={
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-white/60 bg-white/72 text-slate-700 shadow-sm"
              onClick={() => navigate("/issues")}
            >
              View all
            </Button>
          }
        >
          <div id="dashboard-activity" className="space-y-3">
            {activity.length ? (
              activity.slice(0, 8).map((item) => {
                const Icon = activityIcon[item.activityType] || Activity;

                return (
                  <button
                    key={`${item.activityType}-${item._id}`}
                    type="button"
                    onClick={() => navigateToIssues({ search: item.issueId })}
                    className={cn(
                      ANALYTICS_SUBPANEL_CLASS,
                      "flex w-full items-start gap-3 px-4 py-3 text-left"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-sm",
                        activityTone[item.activityType] || activityTone.created
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
                          {item.title}
                        </span>
                        <Badge variant={item.priority === "High" ? "danger" : "secondary"}>
                          {item.priority}
                        </Badge>
                      </span>
                      <span className="mt-1 block text-sm text-slate-500">
                        {item.activityLabel} in {item.project?.name || "Unknown project"}
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        {formatDateTime(item.activityAt)}
                      </span>
                    </span>
                    {item.assignee ? (
                      <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/76 text-xs font-semibold text-slate-600 shadow-sm sm:flex">
                        {getInitials(item.assignee.name)}
                      </span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <AnalyticsEmptyState
                icon={Activity}
                title="No live activity yet"
                description="Recent issue movement will appear here as work changes."
              />
            )}
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Active Workload"
          description="Team and delivery pressure signals from current issue volume."
        >
          <div className="space-y-4">
            {highestWorkloadTeam ? (
              <div className={cn(ANALYTICS_SUBPANEL_CLASS, "p-4")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                      {highestWorkloadTeam.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Highest current workload
                    </p>
                  </div>
                  <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                    {highestWorkloadTeam.productivity}% productivity
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-[14px] bg-slate-950/[0.03] px-3 py-2">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-lg font-semibold">{highestWorkloadTeam.totalIssues}</p>
                  </div>
                  <div className="rounded-[14px] bg-amber-50 px-3 py-2">
                    <p className="text-xs text-amber-700">Pending</p>
                    <p className="text-lg font-semibold text-amber-900">
                      {highestWorkloadTeam.pendingWorkload}
                    </p>
                  </div>
                  <div className="rounded-[14px] bg-emerald-50 px-3 py-2">
                    <p className="text-xs text-emerald-700">Closed</p>
                    <p className="text-lg font-semibold text-emerald-900">
                      {highestWorkloadTeam.closedIssues}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {teams.length ? (
              <div className="space-y-3">
                {teams.slice(0, 5).map((team) => (
                  <button
                    key={team.teamId}
                    type="button"
                    className={cn(
                      ANALYTICS_SUBPANEL_CLASS,
                      "flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    )}
                    onClick={() => navigateToIssues({ teamId: team.teamId })}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-950">
                        {team.name}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {team.assignedIssues || 0} assigned - {team.pendingWorkload || 0} pending
                      </span>
                    </span>
                    <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                      {team.efficiency ?? team.productivity}% efficiency
                    </Badge>
                  </button>
                ))}
              </div>
            ) : (
              <AnalyticsEmptyState
                icon={Users2}
                title="No team workload yet"
                description="Team workload appears once issues are assigned to teams."
              />
            )}
          </div>
        </AnalyticsPanel>
      </section>
    </div>
  );
};

export default DashboardPage;
