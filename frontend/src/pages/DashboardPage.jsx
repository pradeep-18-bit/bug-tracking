import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bug,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Layers3,
  Plus,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users2,
  Zap,
} from "lucide-react";
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
  const summary = analytics.overview?.summary || {};
  const trends = analytics.overview?.trends || {};
  const statusRows = useMemo(
    () =>
      (analytics.overview?.statusDistribution || []).filter((row) => row.count > 0),
    [analytics.overview?.statusDistribution]
  );
  const projects = analytics.projects?.projects || [];
  const teams = analytics.teams?.teams || [];
  const activity = analytics.recentActivity?.activity || [];
  const mostActiveProject = analytics.overview?.mostActiveProject || projects[0] || null;
  const highestWorkloadTeam = teams[0] || null;
  const maxStatusCount = Math.max(...statusRows.map((row) => row.count), 0);
  const kpiCards = [
    {
      key: "total",
      title: "Total Issues",
      value: formatCompactNumber(summary.totalIssues),
      helper: "Tracked work",
      icon: Layers3,
      tone: "blue",
      trend: trends.totalIssues,
      route: "/issues",
    },
    {
      key: "open",
      title: "Open Issues",
      value: formatCompactNumber(summary.openIssues),
      helper: "Active workload",
      icon: AlertTriangle,
      tone: "amber",
      trend: trends.openIssues,
      route: "/issues?status=OPEN",
    },
    {
      key: "closed",
      title: "Closed Issues",
      value: formatCompactNumber(summary.closedIssues),
      helper: "Resolved work",
      icon: CheckCircle2,
      tone: "emerald",
      trend: trends.closedIssues,
      route: "/issues?status=CLOSED",
    },
    {
      key: "priority",
      title: "High Priority",
      value: formatCompactNumber(summary.highPriorityIssues),
      helper: "Open risk items",
      icon: ShieldCheck,
      tone: "rose",
      trend: trends.highPriorityIssues,
      route: "/issues?priority=High",
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
      route: "/projects",
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
      route: "/reports",
    },
  ];

  if (analytics.isLoading) {
    return <DashboardLoading />;
  }

  if (analytics.error) {
    return (
      <Card className={ANALYTICS_PANEL_CLASS}>
        <CardContent className="p-6 text-sm text-rose-700">
          {analytics.error.response?.data?.message ||
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
                Live workload, issue health, recent movement, and project risk from the
                shared analytics engine.
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
            onClick={() => navigate(card.route)}
          />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <AnalyticsPanel
          title="Issue Status Overview"
          description="Distribution of active and resolved workload from live issue data."
          action={
            <Badge className="border-white/60 bg-white/72 text-slate-600">
              {summary.totalIssues || 0} total
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
                    onClick={() => navigate(`/issues?status=${row.key}`)}
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
          title="Most Active Project"
          description="Highest issue volume with open workload and assigned teams."
        >
          {mostActiveProject ? (
            <div className={cn(ANALYTICS_SUBPANEL_CLASS, "space-y-5 p-5")}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-slate-950 dark:text-slate-100">
                    {mostActiveProject.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {mostActiveProject.teamCount || 0} assigned team
                    {mostActiveProject.teamCount === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                  {mostActiveProject.completionRate}% complete
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-[14px] bg-slate-950/[0.03] px-3 py-2">
                  <p className="text-xs text-slate-500">Issues</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">
                    {mostActiveProject.totalIssues}
                  </p>
                </div>
                <div className="rounded-[14px] bg-amber-50 px-3 py-2">
                  <p className="text-xs text-amber-700">Open</p>
                  <p className="mt-1 text-xl font-semibold text-amber-900">
                    {mostActiveProject.openIssues}
                  </p>
                </div>
                <div className="rounded-[14px] bg-emerald-50 px-3 py-2">
                  <p className="text-xs text-emerald-700">Closed</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-900">
                    {mostActiveProject.closedIssues}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Resolution progress</span>
                  <span>{mostActiveProject.openIssues} open</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/70">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#8b5cf6,#06b6d4)]"
                    style={{ width: `${Math.max(mostActiveProject.completionRate, 5)}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(mostActiveProject.teams || []).slice(0, 4).map((team) => (
                  <span
                    key={team}
                    className="rounded-full border border-white/60 bg-white/72 px-3 py-1 text-xs font-semibold text-slate-600"
                  >
                    {team}
                  </span>
                ))}
              </div>
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
                    onClick={() => navigate(`/issues?search=${encodeURIComponent(item.issueId)}`)}
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

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: CalendarClock,
                  title: "SLA Tracking",
                  helper: "Reserved widget slot",
                },
                {
                  icon: Rocket,
                  title: "Sprint Metrics",
                  helper: "Velocity and carryover",
                },
                {
                  icon: Activity,
                  title: "Deployment Health",
                  helper: "Release signals",
                },
                {
                  icon: Bug,
                  title: "AI Insights",
                  helper: "Risk summaries",
                },
              ].map((widget) => {
                const Icon = widget.icon;

                return (
                  <div
                    key={widget.title}
                    className="rounded-[16px] border border-dashed border-white/65 bg-white/34 p-4 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/48"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/60 bg-white/72 text-slate-600 shadow-sm">
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-slate-950">
                      {widget.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{widget.helper}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </AnalyticsPanel>
      </section>
    </div>
  );
};

export default DashboardPage;
