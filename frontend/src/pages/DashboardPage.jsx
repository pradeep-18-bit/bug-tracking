import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ClipboardList,
  Layers3,
  Plus,
  Users2,
  Zap,
} from "lucide-react";
import {
  deleteIssue,
  fetchIssues,
  fetchProjects,
  fetchTeams,
  updateIssue,
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import {
  getIssueStatusMetrics,
  getIssuePriorityVariant,
  ISSUE_STATUS,
  isIssueClosed,
  isIssueOpen,
  resolveIssueAssignee,
  getIssueTypeVariant,
} from "@/lib/issues";
import { cn, formatDateTime, getInitials } from "@/lib/utils";
import { getWorkspaceScope } from "@/lib/workspace";
import DashboardStatCard from "@/components/dashboard/DashboardStatCard";
import IssueDetailsDialog from "@/components/issues/IssueDetailsDialog";
import EmptyState from "@/components/shared/EmptyState";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUS_KEY = "OPEN";
const CLOSED_STATUS_KEY = "CLOSED";
const STATUS_CARD_META = {
  [OPEN_STATUS_KEY]: {
    tone: "blue",
    helper: "Backlog + active work",
  },
  [ISSUE_STATUS.DONE]: {
    tone: "green",
    helper: "Completed and resolved",
  },
};
const DASHBOARD_PANEL_CLASS =
  "overflow-hidden rounded-[16px] border border-white/55 bg-white/58 shadow-[0_22px_55px_-32px_rgba(15,23,42,0.38)] backdrop-blur-2xl";

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const getProjectKey = (project) => String(project?._id || "");
const getIssueProjectKey = (issue) => String(issue?.projectId?._id || issue?.projectId || "");
const getIssuesRouteFromCardKey = (cardKey) => {
  if (cardKey === "open-issues") {
    return `/issues?status=${OPEN_STATUS_KEY}`;
  }

  if (cardKey === "closed") {
    return `/issues?status=${CLOSED_STATUS_KEY}`;
  }

  return "/issues";
};

const buildWindowSnapshot = ({
  items,
  getDate,
  predicate = () => true,
  days = 7,
}) => {
  const today = startOfDay(Date.now());
  const currentStart = today - (days - 1) * DAY_IN_MS;
  const previousStart = currentStart - days * DAY_IN_MS;

  const current = items.filter((item) => {
    const timestamp = getDate(item);

    return (
      predicate(item) &&
      timestamp &&
      timestamp >= currentStart &&
      timestamp <= today + DAY_IN_MS
    );
  }).length;

  const previous = items.filter((item) => {
    const timestamp = getDate(item);

    return (
      predicate(item) &&
      timestamp &&
      timestamp >= previousStart &&
      timestamp < currentStart
    );
  }).length;

  return {
    current,
    previous,
    difference: current - previous,
  };
};

const formatTrend = (
  { current, previous, difference },
  directionLabel = "vs previous 7 days"
) => {
  if (!current && !previous) {
    return {
      current,
      previous,
      difference,
      direction: "flat",
      label: `0 ${directionLabel}`,
    };
  }

  if (!previous) {
    return {
      current,
      previous,
      difference,
      direction: "up",
      label: `+${current} ${directionLabel}`,
    };
  }

  if (difference === 0) {
    return {
      current,
      previous,
      difference,
      direction: "flat",
      label: `0 ${directionLabel}`,
    };
  }

  return {
    current,
    previous,
    difference,
    direction: difference > 0 ? "up" : "down",
    label: `${difference > 0 ? "+" : ""}${difference} ${directionLabel}`,
  };
};

const buildWindowTrend = (config) => formatTrend(buildWindowSnapshot(config));
const formatSignedCount = (value) => `${value > 0 ? "+" : ""}${value}`;
const getDashboardIssueBadge = (issue) =>
  isIssueClosed(issue)
    ? {
        label: "Closed",
        variant: "success",
      }
    : {
        label: "Open",
        variant: "default",
      };

const QuickActionButton = ({ icon: Icon, title, className, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-[0_16px_34px_-22px_rgba(15,23,42,0.45)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_44px_-22px_rgba(15,23,42,0.5)]",
      className
    )}
  >
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/18 backdrop-blur">
      <Icon className="h-4 w-4" />
    </span>
    <span>{title}</span>
  </button>
);

const DashboardPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedIssue, setSelectedIssue] = useState(null);
  const { user } = useAuth();
  const workspaceScope = getWorkspaceScope(user);

  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    error: projectsError,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const {
    data: issues = [],
    isLoading: isIssuesLoading,
    error: issuesError,
  } = useQuery({
    queryKey: ["issues", "admin-dashboard"],
    queryFn: () => fetchIssues(),
  });

  const {
    data: teams = [],
    isLoading: isTeamsLoading,
    error: teamsError,
  } = useQuery({
    queryKey: ["teams", "admin-dashboard", workspaceScope],
    queryFn: () => fetchTeams(workspaceScope),
  });

  useEffect(() => {
    if (!selectedIssue) {
      return;
    }

    const nextIssue = issues.find((issue) => issue._id === selectedIssue._id);

    if (nextIssue) {
      setSelectedIssue(nextIssue);
    }
  }, [issues, selectedIssue]);

  const updateIssueMutation = useMutation({
    mutationFn: updateIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  const deleteIssueMutation = useMutation({
    mutationFn: deleteIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  const error = projectsError || issuesError || teamsError;
  const isLoading = isProjectsLoading || isIssuesLoading || isTeamsLoading;

  const projectInsights = useMemo(() => {
    const base = projects.map((project) => ({
      key: getProjectKey(project),
      name: project.name,
      total: 0,
      open: 0,
      createdAt: project.createdAt,
    }));

    const projectMap = new Map(base.map((project) => [project.key, project]));

    issues.forEach((issue) => {
      const key = getIssueProjectKey(issue);

      if (!key) {
        return;
      }

      const project = projectMap.get(key) || {
        key,
        name: issue.projectId?.name || "Unknown project",
        total: 0,
        open: 0,
        createdAt: issue.projectId?.createdAt || issue.createdAt,
      };

      project.total += 1;

      if (isIssueOpen(issue)) {
        project.open += 1;
      }

      projectMap.set(key, project);
    });

    return Array.from(projectMap.values()).sort(
      (left, right) =>
        right.total - left.total ||
        right.open - left.open ||
        new Date(right.createdAt || 0) - new Date(left.createdAt || 0)
    );
  }, [issues, projects]);

  const stats = useMemo(() => {
    const statusMetrics = getIssueStatusMetrics(issues);
    const highPriorityPending = issues.filter(
      (issue) => issue.priority === "High" && isIssueOpen(issue)
    ).length;
    const completionRate = issues.length
      ? Math.round((statusMetrics.closed / issues.length) * 100)
      : 0;
    const startedThisWeek = issues.filter((issue) => {
      if (!issue.startedAt) {
        return false;
      }

      return new Date(issue.startedAt).getTime() >= Date.now() - 7 * DAY_IN_MS;
    }).length;

    return {
      totalIssues: statusMetrics.total,
      openIssues: statusMetrics.open,
      closedIssues: statusMetrics.closed,
      highPriorityPending,
      completionRate,
      startedThisWeek,
      teamsCount: teams.length,
      teamMembersAssigned: teams.reduce(
        (total, team) => total + (team.memberCount || team.members?.length || 0),
        0
      ),
    };
  }, [issues, teams]);

  const totalIssuesTrend = useMemo(
    () =>
      buildWindowTrend({
        items: issues,
        getDate: (issue) => new Date(issue.createdAt).getTime(),
      }),
    [issues]
  );

  const openIssuesTrend = useMemo(
    () =>
      buildWindowTrend({
        items: issues,
        getDate: (issue) => new Date(issue.createdAt).getTime(),
        predicate: (issue) => isIssueOpen(issue),
      }),
    [issues]
  );

  const highPriorityTrend = useMemo(
    () =>
      buildWindowTrend({
        items: issues,
        getDate: (issue) => new Date(issue.createdAt).getTime(),
        predicate: (issue) => issue.priority === "High" && isIssueOpen(issue),
      }),
    [issues]
  );

  const startedThisWeekTrend = useMemo(
    () =>
      buildWindowTrend({
        items: issues,
        getDate: (issue) => new Date(issue.startedAt || issue.createdAt).getTime(),
        predicate: (issue) => Boolean(issue.startedAt),
      }),
    [issues]
  );

  const statCards = useMemo(
    () => [
      {
        key: "total-issues",
        title: "Total Issues",
        value: stats.totalIssues,
        icon: Layers3,
        tone: "blue",
        helperText: "Tracked work",
        trend: totalIssuesTrend,
      },
      {
        key: "open-issues",
        title: "Open Issues",
        value: stats.openIssues,
        icon: ClipboardList,
        tone: "amber",
        helperText: "Backlog + active",
        trend: openIssuesTrend,
      },
      {
        key: "closed",
        title: "Closed",
        value: stats.closedIssues,
        icon: CheckCircle2,
        tone: "emerald",
        helperText: "Resolved work",
        trend: {
          direction: "flat",
          label: `${stats.completionRate}% of all issues`,
        },
      },
      {
        key: "teams",
        title: "Teams",
        value: stats.teamsCount,
        icon: Users2,
        tone: "cyan",
        helperText: "Workspace teams",
        trend: {
          direction: "flat",
          label: `${stats.teamMembersAssigned} members assigned`,
        },
      },
    ],
    [
      stats.closedIssues,
      openIssuesTrend,
      stats.completionRate,
      stats.openIssues,
      stats.teamMembersAssigned,
      stats.teamsCount,
      stats.totalIssues,
      totalIssuesTrend,
    ]
  );

  const statusData = useMemo(
    () => [
      {
        key: OPEN_STATUS_KEY,
        name: "Open Issues",
        value: stats.openIssues,
      },
      {
        key: ISSUE_STATUS.DONE,
        name: "Closed",
        value: stats.closedIssues,
      },
    ],
    [stats.closedIssues, stats.openIssues]
  );

  const statusOverview = useMemo(() => {
    const maxValue = Math.max(...statusData.map((entry) => entry.value), 0);

    return statusData.map((entry) => {
      const meta = STATUS_CARD_META[entry.key] || STATUS_CARD_META[OPEN_STATUS_KEY];
      const share = stats.totalIssues
        ? Math.round((entry.value / stats.totalIssues) * 100)
        : 0;
      const progressWidth = maxValue
        ? Math.max(Math.round((entry.value / maxValue) * 100), entry.value ? 18 : 0)
        : 0;

      return {
        ...entry,
        helper: meta.helper,
        tone: meta.tone,
        progressWidth,
        shareLabel: `${share}% of all issues`,
      };
    });
  }, [statusData, stats.totalIssues]);

  const leadingStatus = useMemo(
    () =>
      statusOverview.reduce(
        (leader, entry) => (entry.value > (leader?.value ?? -1) ? entry : leader),
        null
      ),
    [statusOverview]
  );

  const trendTiles = useMemo(
    () => [
      {
        key: "total",
        label: "Total Issues",
        value: stats.totalIssues,
        helper: `${stats.openIssues} still active`,
        tone: "blue",
      },
      {
        key: "weekly",
        label: "This Week",
        value: formatSignedCount(totalIssuesTrend.current),
        helper: totalIssuesTrend.label,
        tone: "purple",
      },
      {
        key: "completion",
        label: "Completion Rate",
        value: `${stats.completionRate}%`,
        helper: `${stats.closedIssues} issues closed`,
        tone: "green",
      },
    ],
    [
      stats.closedIssues,
      stats.completionRate,
      stats.openIssues,
      stats.totalIssues,
      totalIssuesTrend.current,
      totalIssuesTrend.label,
    ]
  );

  const recentIssues = useMemo(
    () =>
      [...issues]
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(0, 6),
    [issues]
  );

  const mostActiveProject =
    projectInsights.find((project) => project.total > 0) || null;

  const headerHighlights = useMemo(
    () => [
      {
        key: "priority",
        label: "Pending High",
        value: stats.highPriorityPending,
        helper: highPriorityTrend.label,
        toneClassName: "bg-rose-50 text-rose-700 border-rose-100/90",
      },
      {
        key: "active-project",
        label: "Most Active",
        value: mostActiveProject?.name || "No project",
        helper: mostActiveProject
          ? `${mostActiveProject.total} issues tracked`
          : "Waiting for issue activity",
        toneClassName: "bg-violet-50 text-violet-700 border-violet-100/90",
      },
      {
        key: "weekly",
        label: "7 Day Pulse",
        value: `${stats.startedThisWeek} started`,
        helper: startedThisWeekTrend.label,
        toneClassName: "bg-emerald-50 text-emerald-700 border-emerald-100/90",
      },
    ],
    [
      highPriorityTrend.label,
      mostActiveProject,
      startedThisWeekTrend.label,
      stats.highPriorityPending,
      stats.startedThisWeek,
    ]
  );

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-rose-700">
          {error.response?.data?.message || "Unable to load admin dashboard data."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[16px] border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(239,246,255,0.72),rgba(238,242,255,0.64))] shadow-[0_24px_70px_-36px_rgba(15,23,42,0.42)] backdrop-blur-2xl">
        <CardContent className="relative p-4 sm:p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(129,140,248,0.14),transparent_34%)]" />
          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-3">
              <QuickActionButton
                icon={Plus}
                title="Create Project"
                className="border-blue-200/70 bg-white text-slate-900 hover:border-blue-300 hover:bg-blue-50"
                onClick={() => navigate("/projects")}
              />
              <QuickActionButton
                icon={Users2}
                title="Create Team"
                className="border-violet-200/70 bg-violet-50/80 text-violet-900 hover:border-violet-300 hover:bg-violet-100/80"
                onClick={() => navigate("/teams/create")}
              />
              <QuickActionButton
                icon={Zap}
                title="Create Issue"
                className="border-amber-200/70 bg-amber-50/85 text-amber-900 hover:border-amber-300 hover:bg-amber-100/80"
                onClick={() => navigate("/issues?compose=1")}
              />
            </div>

            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[540px]">
                <Skeleton className="h-[78px] w-full rounded-[24px]" />
                <Skeleton className="h-[78px] w-full rounded-[24px]" />
                <Skeleton className="h-[78px] w-full rounded-[24px]" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[540px]">
                {headerHighlights.map((item) => (
                  <div
                    key={item.key}
                    className={cn(
                      "rounded-[16px] border bg-white/56 px-4 py-3 shadow-[0_16px_34px_-24px_rgba(15,23,42,0.28)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_42px_-24px_rgba(15,23,42,0.34)]",
                      item.toneClassName
                    )}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-70">
                      {item.label}
                    </p>
                    <p className="mt-2 truncate text-sm font-semibold">{item.value}</p>
                    <p className="mt-1 truncate text-xs opacity-75">{item.helper}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          <>
            <Skeleton className="h-[162px] w-full rounded-[16px]" />
            <Skeleton className="h-[162px] w-full rounded-[16px]" />
            <Skeleton className="h-[162px] w-full rounded-[16px]" />
            <Skeleton className="h-[162px] w-full rounded-[16px]" />
          </>
        ) : (
          statCards.map((card) => (
            <DashboardStatCard
              key={card.key}
              title={card.title}
              value={card.value}
              icon={card.icon}
              tone={card.tone}
              helperText={card.helperText}
              trendDirection={card.trend.direction}
              trendLabel={card.trend.label}
              compact
              onClick={() =>
                navigate(card.key === "teams" ? "/teams" : getIssuesRouteFromCardKey(card.key))
              }
            />
          ))
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className={DASHBOARD_PANEL_CLASS}>
          <CardHeader className="border-b border-white/45 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Issues by Status</CardTitle>
                <CardDescription>
                  Open workload and completed delivery in one quick scan.
                </CardDescription>
              </div>
              <Badge className="rounded-full border border-white/45 bg-white/62 text-rose-600 shadow-sm backdrop-blur-xl hover:bg-white/62">
                {stats.highPriorityPending} pending high
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {isLoading ? (
              <Skeleton className="h-[320px] w-full rounded-[16px]" />
            ) : (
              <div className="status-card">
                <div className="status-card-summary">
                  <span className="status-chip">Total {stats.totalIssues}</span>
                  <span className="status-chip muted">
                    {leadingStatus?.value
                      ? `${leadingStatus.name} holds the largest share`
                      : "No issue activity yet"}
                  </span>
                </div>

                <div className="space-y-1">
                  {statusOverview.map((entry) => (
                    <div key={entry.key} className="status-item">
                      <div className="status-meta">
                        <span className={cn("status-dot", entry.tone)} />
                        <div>
                          <span className="status-name">{entry.name}</span>
                          <p className="status-helper">{entry.helper}</p>
                        </div>
                      </div>

                      <div className="status-progress-wrap">
                        <div className="progress-bar">
                          <div
                            className={cn("progress", entry.tone)}
                            style={{ width: `${entry.progressWidth}%` }}
                          />
                        </div>
                        <p className="status-share">{entry.shareLabel}</p>
                      </div>

                      <div className="status-count">
                        <span>{entry.value}</span>
                        <small>{entry.value === 1 ? "issue" : "issues"}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={DASHBOARD_PANEL_CLASS}>
          <CardHeader className="border-b border-white/45 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Issues Trend</CardTitle>
                <CardDescription>
                  Compact KPIs for volume, weekly intake, and delivery health.
                </CardDescription>
              </div>
              <Badge className="rounded-full border border-white/45 bg-white/62 text-blue-600 shadow-sm backdrop-blur-xl hover:bg-white/62">
                {totalIssuesTrend.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {isLoading ? (
              <Skeleton className="h-[320px] w-full rounded-[16px]" />
            ) : (
              <div className="trend-card">
                <div className="trend-stats">
                  {trendTiles.map((tile) => (
                    <div key={tile.key} className={cn("trend-stat", tile.tone)}>
                      <p>{tile.label}</p>
                      <h2>{tile.value}</h2>
                      <span>{tile.helper}</span>
                    </div>
                  ))}
                </div>

                <div className="trend-footer">
                  <span>Most Active Project</span>
                  <strong>{mostActiveProject?.name || "No project yet"}</strong>
                  <p>
                    {mostActiveProject
                      ? `${mostActiveProject.total} issues tracked and ${mostActiveProject.open} still open.`
                      : "Create a few issues to reveal where work is clustering."}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className={cn(DASHBOARD_PANEL_CLASS, "bg-white/62")}>
        <CardHeader className="border-b border-white/45">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Recent Issues</CardTitle>
              <CardDescription>
                Latest issue activity with clearer assignee context, status, priority,
                and created time.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              type="button"
              className="rounded-full border-white/60 bg-white/70 text-slate-700 shadow-[0_16px_34px_-22px_rgba(15,23,42,0.24)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/90 hover:text-blue-700 hover:shadow-[0_22px_42px_-24px_rgba(59,130,246,0.28)]"
              onClick={() => navigate("/issues")}
            >
              View all issues
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-[16px]" />
              <Skeleton className="h-28 w-full rounded-[16px]" />
              <Skeleton className="h-28 w-full rounded-[16px]" />
            </div>
          ) : recentIssues.length ? (
            <div className="space-y-3">
              {recentIssues.map((issue) => {
                const assignee = resolveIssueAssignee(issue);
                const assigneeName = assignee?.name || "";
                const assigneeRole = assignee?.role || "";
                const statusBadge = getDashboardIssueBadge(issue);

                return (
                  <button
                    key={issue._id}
                    className="group flex w-full flex-col gap-4 rounded-[16px] border border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(248,250,252,0.52))] p-4 text-left shadow-[0_16px_34px_-24px_rgba(15,23,42,0.26)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:border-blue-200/70 hover:shadow-[0_24px_48px_-24px_rgba(59,130,246,0.32)] sm:p-5"
                    type="button"
                    onClick={() => setSelectedIssue(issue)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-semibold text-slate-950 transition group-hover:text-blue-700">
                            {issue.title}
                          </p>
                          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                          <Badge variant={getIssuePriorityVariant(issue.priority)}>
                            {issue.priority}
                          </Badge>
                          <Badge variant={getIssueTypeVariant(issue.type)}>{issue.type}</Badge>
                        </div>

                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                          {issue.description || "No description provided."}
                        </p>
                      </div>

                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                        #{issue._id.slice(-6)}
                      </span>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                          {issue.projectId?.name || "Unknown project"}
                        </span>
                        <span>Created {formatDateTime(issue.createdAt)}</span>
                        {issue.startedAt ? (
                          <span>Started {formatDateTime(issue.startedAt)}</span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3">
                        {assigneeName ? (
                          <>
                            <Avatar className="h-10 w-10 rounded-2xl">
                              <AvatarFallback>{getInitials(assigneeName)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {assigneeName}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {assigneeRole || "Assignee"}
                              </p>
                            </div>
                          </>
                        ) : (
                          <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
                            Unassigned
                          </div>
                        )}
                      </div>

                      <div className="flex justify-start lg:justify-end">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold",
                            isIssueClosed(issue)
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-blue-200 bg-blue-50 text-blue-700"
                          )}
                        >
                          {isIssueClosed(issue) ? "Closed issue" : "Open issue"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No issue activity yet"
              description="Create a project and add the first issue to turn this dashboard into a live command center."
              icon={<Layers3 className="h-5 w-5" />}
            />
          )}
        </CardContent>
      </Card>

      <IssueDetailsDialog
        deletingId={deleteIssueMutation.isPending ? deleteIssueMutation.variables : ""}
        issue={selectedIssue}
        onDeleteIssue={(id) => deleteIssueMutation.mutateAsync(id)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedIssue(null);
          }
        }}
        onUpdateIssue={(id, payload) =>
          updateIssueMutation.mutateAsync({ id, payload })
        }
        open={Boolean(selectedIssue)}
        projects={projects}
        updatingId={updateIssueMutation.isPending ? updateIssueMutation.variables?.id : ""}
        canEditCoreDetails
      />
    </div>
  );
};

export default DashboardPage;
