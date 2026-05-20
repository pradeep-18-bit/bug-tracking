import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  Bug,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderKanban,
  Layers3,
  Search,
  ShieldAlert,
  Sparkles,
  Timer,
  Users2,
  X,
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
import { fetchProjects } from "@/lib/api";
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
  ANALYTICS_SUBPANEL_CLASS,
  CHART_GRID_COLOR,
  AnalyticsEmptyState,
  AnalyticsKpiCard,
  AnalyticsPanel,
  AnalyticsSkeletonGrid,
  chartTooltipStyle,
  formatCompactNumber,
  formatDuration,
} from "@/components/analytics/analytics-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ISSUE_STATUS_OPTIONS,
  getIssuePriorityVariant,
  getIssueStatusVariant,
} from "@/lib/issues";
import { cn, formatDate, getInitials } from "@/lib/utils";

const PAGE_SIZE = 9;
const PRIORITY_ORDER = ["Critical", "High", "Medium", "Low"];
const PRIORITY_COLORS = {
  Critical: "#be123c",
  High: "#ef4444",
  Medium: "#f59e0b",
  Low: "#3b82f6",
};
const STATUS_FILTERS = [
  { value: "all", label: "All statuses", status: "all", statusGroup: "all" },
  {
    value: "group:open",
    label: "Open / In Progress / Reopened",
    status: "all",
    statusGroup: "open",
  },
  {
    value: "group:closed",
    label: "Closed / Resolved / Done",
    status: "all",
    statusGroup: "closed",
  },
  ...ISSUE_STATUS_OPTIONS.filter((option) => option.value !== "all"),
];

const getStatusFilterValue = (filters) =>
  filters.statusGroup && filters.statusGroup !== "all"
    ? `group:${filters.statusGroup}`
    : filters.status || "all";

const getStatusFilterParts = (value) => {
  if (String(value || "").startsWith("group:")) {
    return {
      status: "all",
      statusGroup: String(value).replace("group:", "") || "all",
    };
  }

  return {
    status: value || "all",
    statusGroup: "all",
  };
};

const emptyOverview = {
  totalIssues: 0,
  openIssues: 0,
  closedIssues: 0,
  highPriorityIssues: 0,
  activeTeams: 0,
  resolutionRate: 0,
  teamProductivity: 0,
  avgResolutionTimeMs: null,
};

const exportRowsToCsv = (rows) => {
  if (typeof document === "undefined") {
    return;
  }

  const escapeValue = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = rows.map((row) => row.map(escapeValue).join(",")).join("\n");
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `analytics-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const SortHeader = ({ activeSort, children, onSort, sortKey }) => (
  <button
    type="button"
    className={cn(
      "inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
      activeSort.key === sortKey ? "text-blue-700 dark:text-blue-300" : ""
    )}
    onClick={() => onSort(sortKey)}
  >
    {children}
    <ArrowUpDown className="h-3.5 w-3.5" />
  </button>
);

const ChartCard = ({ title, description, children }) => (
  <AnalyticsPanel title={title} description={description}>
    {children}
  </AnalyticsPanel>
);

const ReportsLoading = () => (
  <div className="space-y-5">
    <Skeleton className="h-[220px] rounded-[16px] bg-gradient-to-r from-slate-200/70 via-white/80 to-slate-200/70" />
    <AnalyticsSkeletonGrid />
    <div className="grid gap-5 xl:grid-cols-2">
      <Skeleton className="h-[340px] rounded-[16px]" />
      <Skeleton className="h-[340px] rounded-[16px]" />
      <Skeleton className="h-[340px] rounded-[16px]" />
      <Skeleton className="h-[340px] rounded-[16px]" />
    </div>
    <Skeleton className="h-[480px] rounded-[16px]" />
  </div>
);

const ReportsPage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    projectId: "all",
    teamId: "all",
    assigneeId: "all",
    priority: "all",
    priorityGroup: "all",
    status: "all",
    statusGroup: "all",
    search: "",
  });
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const analytics = useAnalytics(filters, {
    includeIssues: true,
  });
  const { data: projectOptions = [] } = useQuery({
    queryKey: ["projects", "analytics-filter-options"],
    queryFn: fetchProjects,
    staleTime: 60_000,
  });
  const teamOptions = useMemo(() => {
    const uniqueTeams = new Map();

    projectOptions.forEach((project) => {
      if (filters.projectId !== "all" && String(project._id) !== String(filters.projectId)) {
        return;
      }

      getProjectTeams(project).forEach((team) => {
        const teamId = resolveTeamId(team);

        if (teamId && !uniqueTeams.has(teamId)) {
          uniqueTeams.set(teamId, team);
        }
      });
    });

    return Array.from(uniqueTeams.values()).sort((left, right) =>
      (left.name || "").localeCompare(right.name || "")
    );
  }, [filters.projectId, projectOptions]);
  const assigneeOptions = useMemo(() => {
    const uniqueAssignees = new Map();

    projectOptions.forEach((project) => {
      if (filters.projectId !== "all" && String(project._id) !== String(filters.projectId)) {
        return;
      }

      getProjectMembers(project).forEach((member) => {
        const userId = resolveUserId(member);

        if (userId && !uniqueAssignees.has(userId)) {
          uniqueAssignees.set(userId, member);
        }
      });
    });

    return Array.from(uniqueAssignees.values()).sort((left, right) =>
      (left.name || "").localeCompare(right.name || "")
    );
  }, [filters.projectId, projectOptions]);
  const summary = analytics.overview?.summary || emptyOverview;
  const trends = analytics.overview?.trends || {};
  const issueTrend = analytics.trends?.issueTrend || [];
  const weeklyResolution = analytics.trends?.weeklyResolution || [];
  const monthlyGrowth = analytics.trends?.monthlyGrowth || [];
  const priorityRows =
    analytics.priorities?.priorities || analytics.overview?.priorityDistribution || [];
  const projectRows = analytics.projects?.projects || [];
  const teamRows = analytics.teams?.teams || [];
  const issueRows = analytics.issues?.issues || [];
  const activityRows = analytics.recentActivity?.activity || [];
  const totalPages = Math.max(Math.ceil(issueRows.length / PAGE_SIZE), 1);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortConfig]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setFilters((current) => {
      const nextTeamId =
        current.teamId === "all" ||
        teamOptions.some((team) => resolveTeamId(team) === String(current.teamId))
          ? current.teamId
          : "all";
      const nextAssigneeId =
        current.assigneeId === "all" ||
        assigneeOptions.some(
          (assignee) => resolveUserId(assignee) === String(current.assigneeId)
        )
          ? current.assigneeId
          : "all";

      if (current.teamId === nextTeamId && current.assigneeId === nextAssigneeId) {
        return current;
      }

      return {
        ...current,
        teamId: nextTeamId,
        assigneeId: nextAssigneeId,
      };
    });
  }, [assigneeOptions, teamOptions]);

  const sortedIssues = useMemo(() => {
    const accessors = {
      issueId: (issue) => issue.issueId || "",
      project: (issue) => issue.project?.name || "",
      assignee: (issue) => issue.assignee?.name || "",
      priority: (issue) => PRIORITY_ORDER.indexOf(issue.priority),
      status: (issue) => issue.status || "",
      createdAt: (issue) => new Date(issue.createdAt || 0).getTime(),
      resolutionTime: (issue) => issue.resolutionTimeMs || 0,
      tags: (issue) => (issue.tags || []).join(" "),
    };
    const getValue = accessors[sortConfig.key] || accessors.createdAt;

    return [...issueRows].sort((left, right) => {
      const leftValue = getValue(left);
      const rightValue = getValue(right);

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return sortConfig.direction === "asc"
          ? leftValue - rightValue
          : rightValue - leftValue;
      }

      return sortConfig.direction === "asc"
        ? String(leftValue).localeCompare(String(rightValue))
        : String(rightValue).localeCompare(String(leftValue));
    });
  }, [issueRows, sortConfig]);
  const pagedIssues = sortedIssues.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const hasAnalytics = summary.totalIssues > 0;
  const hasIssueTrendData = issueTrend.some((row) => row.created || row.closed);
  const hasWeeklyResolutionData = weeklyResolution.some(
    (row) => row.opened || row.resolved
  );
  const hasMonthlyGrowthData = monthlyGrowth.some((row) => row.issues);
  const strongestTeam = useMemo(
    () =>
      [...teamRows].sort(
        (left, right) =>
          right.productivity - left.productivity ||
          right.closedIssues - left.closedIssues
      )[0] || null,
    [teamRows]
  );
  const riskiestProject = useMemo(
    () =>
      [...projectRows].sort(
        (left, right) =>
          right.openIssues - left.openIssues ||
          right.highPriorityIssues - left.highPriorityIssues
      )[0] || null,
    [projectRows]
  );
  const bugHotspot = useMemo(
    () =>
      [...issueRows]
        .filter((issue) => issue.type === "Bug")
        .reduce((map, issue) => {
          const key = issue.project?.name || "Unknown project";
          map.set(key, (map.get(key) || 0) + 1);
          return map;
        }, new Map()),
    [issueRows]
  );
  const bugHotspotEntry = useMemo(
    () =>
      Array.from(bugHotspot.entries()).sort((left, right) => right[1] - left[1])[0] ||
      null,
    [bugHotspot]
  );
  const insightCards = [
    {
      key: "open-trend",
      icon: Activity,
      tone: trends.openIssues?.direction === "up" ? "amber" : "emerald",
      title:
        trends.openIssues?.difference === 0
          ? "Open issue intake is stable this week"
          : `Open issues ${trends.openIssues?.direction === "up" ? "increased" : "decreased"} by ${Math.abs(
              trends.openIssues?.percent || 0
            )}% this week`,
      helper: trends.openIssues?.label || "No weekly comparison available",
    },
    {
      key: "bug-density",
      icon: Bug,
      tone: "rose",
      title: bugHotspotEntry
        ? `${bugHotspotEntry[0]} has the highest bug density`
        : "Bug density is clear in this scope",
      helper: bugHotspotEntry
        ? `${bugHotspotEntry[1]} bug${bugHotspotEntry[1] === 1 ? "" : "s"} in filtered data`
        : "No bug issues match the selected filters",
    },
    {
      key: "team-speed",
      icon: Zap,
      tone: "cyan",
      title: strongestTeam
        ? `${strongestTeam.name} resolves fastest`
        : "Team speed insights need issue activity",
      helper: strongestTeam
        ? `${strongestTeam.productivity}% completion across ${strongestTeam.totalIssues} issues`
        : "Assign issues to teams to compare throughput",
    },
    {
      key: "risk",
      icon: ShieldAlert,
      tone: "amber",
      title: riskiestProject
        ? `${riskiestProject.name} carries the largest open workload`
        : "Project risk is balanced",
      helper: riskiestProject
        ? `${riskiestProject.openIssues} open issues, ${riskiestProject.highPriorityIssues} high priority`
        : "No active project risk in this scope",
    },
  ];
  const kpiCards = [
    {
      title: "Total Issues",
      value: formatCompactNumber(summary.totalIssues),
      helper: "Analytics scope",
      icon: Layers3,
      tone: "blue",
      trend: trends.totalIssues,
      onClick: () => openIssueList(),
    },
    {
      title: "Open",
      value: formatCompactNumber(summary.openIssues),
      helper: "Active workload",
      icon: AlertTriangle,
      tone: "amber",
      trend: trends.openIssues,
      onClick: () => openIssueList({ status: "all", statusGroup: "open" }),
    },
    {
      title: "Closed",
      value: formatCompactNumber(summary.closedIssues),
      helper: "Resolved work",
      icon: CheckCircle2,
      tone: "emerald",
      trend: trends.closedIssues,
      onClick: () => openIssueList({ status: "all", statusGroup: "closed" }),
    },
    {
      title: "High Priority",
      value: formatCompactNumber(summary.highPriorityIssues),
      helper: "Open risks",
      icon: ShieldAlert,
      tone: "rose",
      trend: trends.highPriorityIssues,
      onClick: () => openIssueList({ priority: "all", priorityGroup: "high" }),
    },
    {
      title: "Avg Resolution Time",
      value: formatDuration(summary.avgResolutionTimeMs),
      helper: "Status history",
      icon: Timer,
      tone: "violet",
      trend: {
        direction: "flat",
        label: `${summary.resolutionRate || 0}% closed`,
      },
      onClick: () => openIssueList({ status: "all", statusGroup: "closed" }),
    },
    {
      title: "Team Productivity",
      value: `${summary.teamProductivity || 0}%`,
      helper: "Completion ratio",
      icon: Users2,
      tone: "cyan",
      trend: {
        direction: "flat",
        label: `${summary.activeTeams || 0} active teams`,
      },
      onClick: () => openIssueList(),
    },
  ];

  const updateSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: "",
      dateTo: "",
      projectId: "all",
      teamId: "all",
      assigneeId: "all",
      priority: "all",
      priorityGroup: "all",
      status: "all",
      statusGroup: "all",
      search: "",
    });
  };

  function openIssueList(overrides = {}) {
    const params = new URLSearchParams();
    const definedOverrides = Object.fromEntries(
      Object.entries(overrides).filter(
        ([, value]) => value !== undefined && value !== null && value !== ""
      )
    );
    const mergedFilters = {
      ...filters,
      ...definedOverrides,
    };

    [
      "dateFrom",
      "dateTo",
      "projectId",
      "teamId",
      "assigneeId",
      "priority",
      "priorityGroup",
      "status",
      "statusGroup",
      "search",
    ].forEach((key) => {
      const value = mergedFilters[key];

      if (value && value !== "all") {
        params.set(key, value);
      }
    });

    navigate(`/issues${params.toString() ? `?${params}` : ""}`);
  }

  const exportCsv = () => {
    exportRowsToCsv([
      [
        "Issue ID",
        "Project",
        "Assignee",
        "Priority",
        "Status",
        "Created Date",
        "Resolution Time",
        "Tags",
      ],
      ...sortedIssues.map((issue) => [
        issue.issueId,
        issue.project?.name || "Unknown project",
        issue.assignee?.name || "Unassigned",
        issue.priority,
        issue.status,
        issue.createdAt ? formatDate(issue.createdAt) : "N/A",
        formatDuration(issue.resolutionTimeMs),
        (issue.tags || []).join(", "),
      ]),
    ]);
  };

  const openDatePoint = (chartState) => {
    const key = chartState?.activePayload?.[0]?.payload?.key;

    if (key) {
      openIssueList({ dateFrom: key, dateTo: key });
    } else {
      openIssueList();
    }
  };

  if (analytics.isLoading) {
    return <ReportsLoading />;
  }

  if (analytics.error) {
    return (
      <Card className={ANALYTICS_PANEL_CLASS}>
        <CardContent className="p-6 text-sm text-rose-700">
          {analytics.error.response?.data?.message ||
            "Unable to load analytics reports right now."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5 page-shell-enter">
      <Card className="overflow-hidden rounded-[16px] border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(239,246,255,0.74),rgba(238,242,255,0.66))] shadow-[0_24px_70px_-36px_rgba(15,23,42,0.42)] backdrop-blur-2xl dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(30,41,59,0.76),rgba(15,23,42,0.82))]">
        <CardContent className="relative p-4 sm:p-5">
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.3fr] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/65 bg-white/72 px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm backdrop-blur-xl">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                Management Insights Center
              </div>
              <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-100">
                Reports & Analytics
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              </p>
            </div>

            <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px_180px_auto_auto]">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  type="date"
                  className={ANALYTICS_FIELD_CLASS}
                  value={filters.dateFrom}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      dateFrom: event.target.value,
                    }))
                  }
                />
                <Input
                  type="date"
                  className={ANALYTICS_FIELD_CLASS}
                  min={filters.dateFrom || undefined}
                  value={filters.dateTo}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      dateTo: event.target.value,
                    }))
                  }
                />
              </div>
              <select
                className={ANALYTICS_SELECT_CLASS}
                value={filters.projectId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    projectId: event.target.value,
                    teamId: "all",
                    assigneeId: "all",
                  }))
                }
              >
                <option value="all">All projects</option>
                {projectOptions.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <select
                className={ANALYTICS_SELECT_CLASS}
                value={filters.teamId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    teamId: event.target.value,
                  }))
                }
              >
                <option value="all">All teams</option>
                {teamOptions.map((team) => (
                  <option key={resolveTeamId(team)} value={resolveTeamId(team)}>
                    {team.name}
                  </option>
                ))}
              </select>
              <select
                className={ANALYTICS_SELECT_CLASS}
                value={filters.assigneeId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    assigneeId: event.target.value,
                  }))
                }
              >
                <option value="all">All assignees</option>
                {assigneeOptions.map((assignee) => (
                  <option key={resolveUserId(assignee)} value={resolveUserId(assignee)}>
                    {assignee.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-white/60 bg-white/72 text-slate-700 shadow-sm"
                onClick={() => window.print()}
              >
                <FileText className="h-4 w-4" />
                Export PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-white/60 bg-white/72 text-slate-700 shadow-sm"
                onClick={exportCsv}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {kpiCards.map((card) => (
          <AnalyticsKpiCard key={card.title} {...card} />
        ))}
      </section>

      {!hasAnalytics ? (
        <AnalyticsEmptyState
          icon={BarChart3}
          title="No analytics found"
          description="Widen the date range or clear filters to restore report data."
        />
      ) : null}

      <section className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Issue Trend"
          description="Created and closed issue movement in the selected scope."
        >
          {hasIssueTrendData ? (
            <div
              className="h-[290px] cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openIssueList();
                }
              }}
            >
              <ResponsiveContainer height="100%" width="100%">
                <LineChart
                  data={issueTrend}
                  margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                  onClick={openDatePoint}
                >
                  <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Line type="monotone" dataKey="created" stroke="#2563eb" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="closed" stroke="#10b981" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsEmptyState
              icon={Activity}
              title="No trend data"
              description="Issue trend data appears when the scope contains issue movement."
              className="min-h-[290px]"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Priority Distribution"
          description="Critical, high, medium, and low priority workload split."
        >
          {priorityRows.some((row) => row.count > 0) ? (
            <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-center">
              <div className="relative h-[250px]">
                <ResponsiveContainer height="100%" width="100%">
                  <PieChart>
                    <Pie
                      data={priorityRows}
                      dataKey="count"
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={98}
                      paddingAngle={4}
                      stroke="rgba(255,255,255,0.94)"
                      strokeWidth={4}
                    >
                      {priorityRows.map((row) => (
                        <Cell
                          fill={PRIORITY_COLORS[row.key] || "#64748b"}
                          key={row.key}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-semibold text-slate-400">Total</span>
                  <span className="mt-1 text-3xl font-semibold text-slate-950">
                    {summary.totalIssues}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {priorityRows.map((row) => (
                  <button
                    type="button"
                    key={row.key}
                    className={cn(
                      ANALYTICS_SUBPANEL_CLASS,
                      "flex w-full items-center justify-between gap-3 px-4 py-3 text-left",
                      filters.priority === row.key
                        ? "border-blue-200 bg-blue-50/80"
                        : ""
                    )}
                    onClick={() => openIssueList({ priority: row.key })}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: PRIORITY_COLORS[row.key] }}
                      />
                      <span className="text-sm font-semibold text-slate-800">
                        {row.label}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-slate-950">
                      {row.count}
                      <span className="ml-2 text-xs text-slate-400">
                        {row.percentage}%
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <AnalyticsEmptyState
              icon={Filter}
              title="No priority distribution"
              description="Priority analytics appear when matching issues exist."
              className="min-h-[290px]"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Team Performance"
          description="Open and closed workload by team."
        >
          {teamRows.length ? (
            <div
              className="h-[300px] cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openIssueList();
                }
              }}
            >
              <ResponsiveContainer height="100%" width="100%">
                <BarChart
                  data={teamRows.slice(0, 8)}
                  margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                  onClick={(chartState) => {
                    const teamId = chartState?.activePayload?.[0]?.payload?.teamId;

                    openIssueList(teamId ? { teamId } : {});
                  }}
                >
                  <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar
                    dataKey="openIssues"
                    fill="#f59e0b"
                    radius={[10, 10, 0, 0]}
                  />
                  <Bar
                    dataKey="closedIssues"
                    fill="#10b981"
                    radius={[10, 10, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsEmptyState
              icon={Users2}
              title="No team performance yet"
              description="Assign issues to teams to compare delivery performance."
              className="min-h-[300px]"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Weekly Resolution Trend"
          description="Opened versus resolved work over the latest weeks."
        >
          {hasWeeklyResolutionData ? (
            <div
              className="h-[300px] cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openIssueList();
                }
              }}
            >
              <ResponsiveContainer height="100%" width="100%">
                <AreaChart
                  data={weeklyResolution}
                  margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                  onClick={openDatePoint}
                >
                  <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="opened" stroke="#2563eb" strokeWidth={2} fill="#bfdbfe" fillOpacity={0.72} />
                  <Area type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} fill="#bbf7d0" fillOpacity={0.72} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsEmptyState
              icon={Clock3}
              title="No weekly resolution data"
              description="Resolution trend appears once issue history is available."
              className="min-h-[300px]"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Issues by Project"
          description="Project-level issue volume and open workload."
        >
          {projectRows.length ? (
            <div
              className="h-[300px] cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openIssueList();
                }
              }}
            >
              <ResponsiveContainer height="100%" width="100%">
                <BarChart
                  data={projectRows.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 8, right: 18, left: 12, bottom: 0 }}
                  onClick={(chartState) => {
                    const projectId = chartState?.activePayload?.[0]?.payload?.projectId;

                    openIssueList(projectId ? { projectId } : {});
                  }}
                >
                  <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="4 4" horizontal={false} />
                  <XAxis allowDecimals={false} type="number" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" width={108} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar
                    dataKey="totalIssues"
                    fill="#2563eb"
                    radius={[0, 10, 10, 0]}
                  />
                  <Bar
                    dataKey="openIssues"
                    fill="#f59e0b"
                    radius={[0, 10, 10, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsEmptyState
              icon={FolderKanban}
              title="No project analytics"
              description="Project issue volume appears once matching issues exist."
              className="min-h-[300px]"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Monthly Growth Metrics"
          description="Issue growth over the latest six months."
        >
          {hasMonthlyGrowthData ? (
            <div
              className="h-[300px] cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openIssueList();
                }
              }}
            >
              <ResponsiveContainer height="100%" width="100%">
                <AreaChart
                  data={monthlyGrowth}
                  margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                  onClick={(chartState) => {
                    const key = chartState?.activePayload?.[0]?.payload?.key;

                    if (key) {
                      const [year, month] = key.split("-").map(Number);
                      const monthEndDay = new Date(year, month, 0).getDate();
                      const monthEnd = `${key}-${String(monthEndDay).padStart(2, "0")}`;

                      openIssueList({
                        dateFrom: `${key}-01`,
                        dateTo: monthEnd,
                      });
                    } else {
                      openIssueList();
                    }
                  }}
                >
                  <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="issues" stroke="#8b5cf6" strokeWidth={2} fill="#ddd6fe" fillOpacity={0.75} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsEmptyState
              icon={BarChart3}
              title="No monthly growth data"
              description="Growth metrics appear as issues are created over time."
              className="min-h-[300px]"
            />
          )}
        </ChartCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <AnalyticsPanel
          title="Reports Insights Panel"
          description="Operational signals generated from live analytics data."
        >
          <div className="grid gap-3">
            {insightCards.map((insight) => {
              const Icon = insight.icon;
              const toneClass = {
                amber: "border-amber-200 bg-amber-50 text-amber-700",
                emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
                rose: "border-rose-200 bg-rose-50 text-rose-700",
                cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
              }[insight.tone];

              return (
                <div
                  key={insight.key}
                  className={cn(ANALYTICS_SUBPANEL_CLASS, "flex gap-3 p-4")}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                      toneClass
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                      {insight.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {insight.helper}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Team Productivity Analytics"
          description="Completion ratios, workload balance, and pending work by team."
        >
          {teamRows.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {teamRows.slice(0, 6).map((team) => (
                <button
                  key={team.teamId}
                  type="button"
                  className={cn(ANALYTICS_SUBPANEL_CLASS, "p-4 text-left")}
                  onClick={() => openIssueList({ teamId: team.teamId })}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
                        {team.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {team.memberCount} members
                      </p>
                    </div>
                    <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                      {team.productivity}%
                    </Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-[14px] bg-slate-950/[0.03] px-3 py-2">
                      <p className="text-xs text-slate-500">Total</p>
                      <p className="text-lg font-semibold">{team.totalIssues}</p>
                    </div>
                    <div className="rounded-[14px] bg-amber-50 px-3 py-2">
                      <p className="text-xs text-amber-700">Pending</p>
                      <p className="text-lg font-semibold text-amber-900">
                        {team.pendingWorkload}
                      </p>
                    </div>
                    <div className="rounded-[14px] bg-emerald-50 px-3 py-2">
                      <p className="text-xs text-emerald-700">Closed</p>
                      <p className="text-lg font-semibold text-emerald-900">
                        {team.closedIssues}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200/70">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#06b6d4,#3b82f6)]"
                      style={{ width: `${Math.max(team.productivity, team.totalIssues ? 5 : 0)}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <AnalyticsEmptyState
              icon={Users2}
              title="No team productivity data"
              description="Team productivity analytics appear once teams own issues."
            />
          )}
        </AnalyticsPanel>
      </section>

      <AnalyticsPanel
        title="Detailed Issues Analytics Table"
        description="Search, filter, sort, and paginate live issue analytics rows."
        action={
          <span className="inline-flex items-center rounded-full border border-white/55 bg-white/68 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
            {issueRows.length} rows
          </span>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[1.4fr_0.75fr_0.85fr_0.85fr_0.85fr_0.9fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className={cn(ANALYTICS_FIELD_CLASS, "pl-11")}
                placeholder="Search issues, projects, assignees"
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
              />
            </div>
            <select
              className={ANALYTICS_SELECT_CLASS}
              value={filters.priority}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  priority: event.target.value,
                }))
              }
            >
              <option value="all">All priorities</option>
              {PRIORITY_ORDER.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
            <select
              className={ANALYTICS_SELECT_CLASS}
              value={getStatusFilterValue(filters)}
              onChange={(event) => {
                const statusParts = getStatusFilterParts(event.target.value);

                setFilters((current) => ({
                  ...current,
                  ...statusParts,
                }));
              }}
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <select
              className={ANALYTICS_SELECT_CLASS}
              value={filters.projectId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  projectId: event.target.value,
                  teamId: "all",
                  assigneeId: "all",
                }))
              }
            >
              <option value="all">All projects</option>
              {projectOptions.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
            <select
              className={ANALYTICS_SELECT_CLASS}
              value={filters.teamId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  teamId: event.target.value,
                }))
              }
            >
              <option value="all">All teams</option>
              {teamOptions.map((team) => (
                <option key={resolveTeamId(team)} value={resolveTeamId(team)}>
                  {team.name}
                </option>
              ))}
            </select>
            <select
              className={ANALYTICS_SELECT_CLASS}
              value={filters.assigneeId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  assigneeId: event.target.value,
                }))
              }
            >
              <option value="all">All assignees</option>
              {assigneeOptions.map((assignee) => (
                <option key={resolveUserId(assignee)} value={resolveUserId(assignee)}>
                  {assignee.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-white/60 bg-white/72 text-slate-700 shadow-sm"
              onClick={clearFilters}
            >
              <X className="h-4 w-4" />
              Reset
            </Button>
          </div>

          {pagedIssues.length ? (
            <>
              <div className="overflow-x-auto rounded-[16px] border border-white/55 bg-white/48 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.36)] dark:border-white/10 dark:bg-slate-950/30">
                <table className="w-full min-w-[1060px] text-left text-sm">
                  <thead className="bg-white/70 text-slate-500 backdrop-blur-xl dark:bg-slate-900/72 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">
                        <SortHeader activeSort={sortConfig} onSort={updateSort} sortKey="issueId">
                          Issue ID
                        </SortHeader>
                      </th>
                      <th className="px-4 py-3">
                        <SortHeader activeSort={sortConfig} onSort={updateSort} sortKey="project">
                          Project
                        </SortHeader>
                      </th>
                      <th className="px-4 py-3">
                        <SortHeader activeSort={sortConfig} onSort={updateSort} sortKey="assignee">
                          Assignee
                        </SortHeader>
                      </th>
                      <th className="px-4 py-3">
                        <SortHeader activeSort={sortConfig} onSort={updateSort} sortKey="priority">
                          Priority
                        </SortHeader>
                      </th>
                      <th className="px-4 py-3">
                        <SortHeader activeSort={sortConfig} onSort={updateSort} sortKey="status">
                          Status
                        </SortHeader>
                      </th>
                      <th className="px-4 py-3">
                        <SortHeader activeSort={sortConfig} onSort={updateSort} sortKey="createdAt">
                          Created Date
                        </SortHeader>
                      </th>
                      <th className="px-4 py-3">
                        <SortHeader activeSort={sortConfig} onSort={updateSort} sortKey="resolutionTime">
                          Resolution Time
                        </SortHeader>
                      </th>
                      <th className="px-4 py-3">
                        <SortHeader activeSort={sortConfig} onSort={updateSort} sortKey="tags">
                          Tags
                        </SortHeader>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/55 dark:divide-white/10">
                    {pagedIssues.map((issue) => (
                      <tr
                        key={issue._id}
                        className="bg-white/40 transition hover:bg-blue-50/58 dark:bg-slate-950/20 dark:hover:bg-slate-900/70"
                      >
                        <td className="px-4 py-4 font-semibold text-slate-800">
                          <div className="max-w-[190px]">
                            <p>{issue.issueId}</p>
                            <p className="mt-1 truncate text-xs font-normal text-slate-500">
                              {issue.title}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {issue.project?.name || "Unknown project"}
                        </td>
                        <td className="px-4 py-4">
                          {issue.assignee ? (
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/76 text-xs font-semibold text-slate-600 shadow-sm">
                                {getInitials(issue.assignee.name)}
                              </span>
                              <span className="max-w-[140px] truncate font-semibold text-slate-700">
                                {issue.assignee.name}
                              </span>
                            </div>
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-500">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={getIssuePriorityVariant(issue.priority)}>
                            {issue.priority}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={getIssueStatusVariant(issue.status)}>
                            {issue.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {issue.createdAt ? formatDate(issue.createdAt) : "N/A"}
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-800">
                          {formatDuration(issue.resolutionTimeMs)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex max-w-[230px] flex-wrap gap-1.5">
                            {(issue.tags || []).slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full border border-white/60 bg-white/72 px-2.5 py-1 text-xs font-semibold text-slate-500"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                  {Math.min(currentPage * PAGE_SIZE, sortedIssues.length)} of{" "}
                  {sortedIssues.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full border-white/60 bg-white/72"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <span className="rounded-full border border-white/60 bg-white/72 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full border-white/60 bg-white/72"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <AnalyticsEmptyState
              icon={Search}
              title="No issue rows match"
              description="Adjust search, filters, or the date range to reveal matching issue analytics."
            />
          )}
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel
        title="Recent Analytics Activity"
        description="Recent created, resolved, assigned, and critical issue events."
      >
        {activityRows.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activityRows.slice(0, 9).map((item) => (
              <button
                key={`${item.activityType}-${item._id}`}
                type="button"
                className={cn(ANALYTICS_SUBPANEL_CLASS, "p-4 text-left")}
                onClick={() => openIssueList({ search: item.issueId })}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.activityLabel}
                    </p>
                  </div>
                  <Badge variant={item.activityType === "critical" ? "danger" : "secondary"}>
                    {item.priority}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  {item.project?.name || "Unknown project"} -{" "}
                  {item.activityAt ? formatDate(item.activityAt) : "N/A"}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <AnalyticsEmptyState
            icon={Activity}
            title="No recent analytics activity"
            description="Activity events appear as issues are created, assigned, and resolved."
          />
        )}
      </AnalyticsPanel>
    </div>
  );
};

export default ReportsPage;
