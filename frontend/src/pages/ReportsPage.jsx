import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Filter,
  FolderKanban,
  Layers3,
  RotateCcw,
  Sparkles,
  Users2,
  Workflow,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchProjectReports,
  fetchProjects,
  fetchReports,
  fetchTeamReports,
  fetchTeams,
  fetchUserReports,
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { ISSUE_STATUS, getIssueStatusLabel } from "@/lib/issues";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { getWorkspaceScope } from "@/lib/workspace";
import DashboardStatCard from "@/components/dashboard/DashboardStatCard";
import EmptyState from "@/components/shared/EmptyState";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const REPORT_PANEL_CLASS =
  "overflow-hidden rounded-[16px] border border-white/55 bg-white/58 shadow-[0_22px_55px_-32px_rgba(15,23,42,0.38)] backdrop-blur-2xl";
const REPORT_CHART_SHELL_CLASS =
  "rounded-[16px] border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.34),rgba(255,255,255,0.18))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur-2xl";
const REPORT_SUBPANEL_CLASS =
  "rounded-[16px] border border-white/55 bg-white/52 shadow-[0_16px_36px_-26px_rgba(15,23,42,0.34)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_42px_-24px_rgba(15,23,42,0.38)]";
const REPORT_GRID_COLOR = "rgba(148, 163, 184, 0.18)";
const STATUS_CHART_COLORS = {
  [ISSUE_STATUS.TODO]: "#5b7cff",
  [ISSUE_STATUS.IN_PROGRESS]: "#a855f7",
  [ISSUE_STATUS.DONE]: "#22c55e",
};
const PRIORITY_CHART_COLORS = {
  High: "#fb7185",
  Medium: "#f59e0b",
  Low: "#38bdf8",
};
const STATUS_ORDER = [ISSUE_STATUS.TODO, ISSUE_STATUS.IN_PROGRESS, ISSUE_STATUS.DONE];
const PRIORITY_ORDER = ["High", "Medium", "Low"];

const createDefaultFilters = () => ({
  projectId: "all",
  teamId: "all",
  assigneeId: "all",
  dateFrom: "",
  dateTo: "",
  status: "all",
  priority: "all",
});

const statusFilterLabels = {
  all: "All issues",
  OPEN: "Open issues",
  [ISSUE_STATUS.TODO]: "To Do",
  [ISSUE_STATUS.IN_PROGRESS]: "In Progress",
  [ISSUE_STATUS.DONE]: "Closed",
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0];
  const displayLabel = entry?.payload?.label || label || entry?.name;

  return (
    <div className="rounded-[16px] border border-white/10 bg-slate-950/82 px-4 py-3 text-sm text-white/80 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.65)] backdrop-blur-2xl">
      {displayLabel ? <p className="font-semibold text-white">{displayLabel}</p> : null}
      <p className="mt-1">
        <span className="font-semibold text-white">{entry.value}</span> issues
      </p>
    </div>
  );
};

const FilterField = ({ icon: Icon, label, children }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/60 bg-white/70 text-slate-600 shadow-sm backdrop-blur-xl">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span>{label}</span>
    </div>
    {children}
  </div>
);

const ReportEmptyPanel = ({ icon: Icon, title, description }) => (
  <div className="flex min-h-[220px] items-center justify-center rounded-[16px] border border-dashed border-white/60 bg-white/34 px-6 text-center backdrop-blur-xl">
    <div className="max-w-sm">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/55 bg-white/70 text-slate-600 shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  </div>
);

const DistributionBar = ({ total, open, inProgress, closed }) => {
  const segments = [
    {
      key: "open",
      value: open,
      className: "bg-[linear-gradient(90deg,#f59e0b,#fb7185)]",
    },
    {
      key: "in-progress",
      value: inProgress,
      className: "bg-[linear-gradient(90deg,#7c3aed,#d946ef)]",
    },
    {
      key: "closed",
      value: closed,
      className: "bg-[linear-gradient(90deg,#10b981,#34d399)]",
    },
  ].filter((segment) => segment.value > 0);

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100/90">
      {segments.length && total ? (
        <div className="flex h-full w-full overflow-hidden rounded-full">
          {segments.map((segment) => (
            <span
              key={segment.key}
              className={segment.className}
              style={{
                width: `${Math.max((segment.value / total) * 100, segment.value ? 6 : 0)}%`,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const ActiveFilterChip = ({ label, onClear }) => (
  <button
    type="button"
    onClick={onClear}
    className="inline-flex items-center gap-2 rounded-full border border-white/65 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700"
  >
    <span>{label}</span>
    <span className="text-slate-400">x</span>
  </button>
);

const sortByName = (left, right) => left.name.localeCompare(right.name);

const ReportsPage = () => {
  const { user } = useAuth();
  const workspaceScope = getWorkspaceScope(user);
  const [filters, setFilters] = useState(createDefaultFilters);

  const reportFilters = useMemo(
    () => ({
      projectId: filters.projectId,
      teamId: filters.teamId,
      assigneeId: filters.assigneeId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      status: filters.status,
      priority: filters.priority,
    }),
    [filters]
  );

  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    error: projectsError,
  } = useQuery({
    queryKey: ["projects", "reports-page"],
    queryFn: fetchProjects,
  });

  const {
    data: teams = [],
    isLoading: isTeamsLoading,
    error: teamsError,
  } = useQuery({
    queryKey: ["teams", "reports-page", workspaceScope],
    queryFn: () => fetchTeams(workspaceScope),
  });

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = useQuery({
    queryKey: ["reports", "summary", reportFilters],
    queryFn: () => fetchReports(reportFilters),
  });

  const {
    data: projectReportsData,
    isLoading: isProjectReportsLoading,
    error: projectReportsError,
  } = useQuery({
    queryKey: ["reports", "projects", reportFilters],
    queryFn: () => fetchProjectReports(reportFilters),
  });

  const {
    data: userReportsData,
    isLoading: isUserReportsLoading,
    error: userReportsError,
  } = useQuery({
    queryKey: ["reports", "users", reportFilters],
    queryFn: () => fetchUserReports(reportFilters),
  });

  const {
    data: teamReportsData,
    isLoading: isTeamReportsLoading,
    error: teamReportsError,
  } = useQuery({
    queryKey: ["reports", "team", reportFilters],
    queryFn: () => fetchTeamReports(reportFilters),
  });

  const error =
    projectsError ||
    teamsError ||
    summaryError ||
    projectReportsError ||
    userReportsError ||
    teamReportsError;
  const isLoading =
    isProjectsLoading ||
    isTeamsLoading ||
    isSummaryLoading ||
    isProjectReportsLoading ||
    isUserReportsLoading ||
    isTeamReportsLoading;

  const scopedTeams = useMemo(() => {
    if (user?.role === "Admin") {
      return [...teams].sort(sortByName);
    }

    const teamMap = new Map();

    projects.forEach((project) => {
      (project.teams || []).forEach((team) => {
        teamMap.set(String(team._id), team);
      });
    });

    return Array.from(teamMap.values()).sort(sortByName);
  }, [projects, teams, user?.role]);

  const selectedProject = useMemo(
    () => projects.find((project) => String(project._id) === String(filters.projectId)) || null,
    [filters.projectId, projects]
  );

  const teamOptions = useMemo(() => {
    if (filters.projectId !== "all") {
      return [...(selectedProject?.teams || [])].sort(sortByName);
    }

    return scopedTeams;
  }, [filters.projectId, scopedTeams, selectedProject]);

  const selectedTeam = useMemo(
    () => teamOptions.find((team) => String(team._id) === String(filters.teamId)) || null,
    [filters.teamId, teamOptions]
  );

  const memberOptions = useMemo(() => {
    const sourceTeams =
      filters.teamId !== "all" ? [selectedTeam].filter(Boolean) : teamOptions;
    const memberMap = new Map();

    sourceTeams.forEach((team) => {
      (team?.members || []).forEach((member) => {
        memberMap.set(String(member._id), member);
      });
    });

    return Array.from(memberMap.values()).sort(sortByName);
  }, [filters.teamId, selectedTeam, teamOptions]);

  const selectedMember = useMemo(
    () =>
      memberOptions.find((member) => String(member._id) === String(filters.assigneeId)) ||
      null,
    [filters.assigneeId, memberOptions]
  );

  const summary = {
    totalIssues: summaryData?.totalIssues || 0,
    openIssues: summaryData?.openIssues || 0,
    inProgressIssues: summaryData?.inProgressIssues || 0,
    closedIssues: summaryData?.closedIssues || 0,
  };

  const issuesByStatus = useMemo(() => {
    const countsByKey = new Map(
      (summaryData?.issuesByStatus || []).map((entry) => [entry.key, entry.count])
    );

    return STATUS_ORDER.map((status) => ({
      key: status,
      label: getIssueStatusLabel(status),
      count: countsByKey.get(status) || 0,
    }));
  }, [summaryData?.issuesByStatus]);

  const issuesByPriority = useMemo(() => {
    const countsByKey = new Map(
      (summaryData?.issuesByPriority || []).map((entry) => [entry.key, entry.count])
    );

    return PRIORITY_ORDER.map((priority) => ({
      key: priority,
      label: priority,
      count: countsByKey.get(priority) || 0,
    }));
  }, [summaryData?.issuesByPriority]);

  const projectReports = projectReportsData?.projects || [];
  const userReports = userReportsData?.users || [];
  const teamReports = teamReportsData?.teams || [];

  const activeFilterChips = useMemo(() => {
    const chips = [];

    if (selectedProject) {
      chips.push({
        key: "project",
        label: `Project: ${selectedProject.name}`,
        onClear: () =>
          setFilters((current) => ({
            ...current,
            projectId: "all",
            teamId: "all",
            assigneeId: "all",
          })),
      });
    }

    if (selectedTeam) {
      chips.push({
        key: "team",
        label: `Team: ${selectedTeam.name}`,
        onClear: () =>
          setFilters((current) => ({
            ...current,
            teamId: "all",
            assigneeId: "all",
          })),
      });
    }

    if (selectedMember) {
      chips.push({
        key: "member",
        label: `Member: ${selectedMember.name}`,
        onClear: () =>
          setFilters((current) => ({
            ...current,
            assigneeId: "all",
          })),
      });
    }

    if (filters.dateFrom || filters.dateTo) {
      const dateLabel =
        filters.dateFrom && filters.dateTo
          ? `Date: ${formatDate(filters.dateFrom)} - ${formatDate(filters.dateTo)}`
          : filters.dateFrom
            ? `Date: From ${formatDate(filters.dateFrom)}`
            : `Date: Until ${formatDate(filters.dateTo)}`;

      chips.push({
        key: "date",
        label: dateLabel,
        onClear: () =>
          setFilters((current) => ({
            ...current,
            dateFrom: "",
            dateTo: "",
          })),
      });
    }

    if (filters.status !== "all") {
      chips.push({
        key: "status",
        label: `Status: ${statusFilterLabels[filters.status] || filters.status}`,
        onClear: () =>
          setFilters((current) => ({
            ...current,
            status: "all",
          })),
      });
    }

    if (filters.priority !== "all") {
      chips.push({
        key: "priority",
        label: `Priority: ${filters.priority}`,
        onClear: () =>
          setFilters((current) => ({
            ...current,
            priority: "all",
          })),
      });
    }

    return chips;
  }, [
    filters.dateFrom,
    filters.dateTo,
    filters.priority,
    filters.status,
    selectedMember,
    selectedProject,
    selectedTeam,
  ]);

  const metricCards = [
    {
      key: "all",
      title: "Total Issues",
      value: summary.totalIssues,
      icon: Layers3,
      tone: "blue",
      helperText: "Entire report scope",
      trendLabel: filters.status === "all" ? "Full scope" : "Click to reset",
    },
    {
      key: "OPEN",
      title: "Open Issues",
      value: summary.openIssues,
      icon: AlertTriangle,
      tone: "amber",
      helperText: "Queued + active work",
      trendLabel:
        filters.status === "OPEN" ? "Open filter active" : "Click to focus",
    },
    {
      key: ISSUE_STATUS.IN_PROGRESS,
      title: "In Progress",
      value: summary.inProgressIssues,
      icon: BarChart3,
      tone: "violet",
      helperText: "Currently moving",
      trendLabel:
        filters.status === ISSUE_STATUS.IN_PROGRESS
          ? "In progress active"
          : "Click to focus",
    },
    {
      key: ISSUE_STATUS.DONE,
      title: "Closed",
      value: summary.closedIssues,
      icon: CheckCircle2,
      tone: "emerald",
      helperText: "Delivered work",
      trendLabel:
        filters.status === ISSUE_STATUS.DONE ? "Closed filter active" : "Click to focus",
    },
  ];

  const handleProjectSelect = (projectId) => {
    setFilters((current) => ({
      ...current,
      projectId,
      teamId: "all",
      assigneeId: "all",
    }));
  };

  const handleTeamSelect = (teamId) => {
    setFilters((current) => ({
      ...current,
      teamId,
      assigneeId: "all",
    }));
  };

  const handleStatusFilter = (status) => {
    setFilters((current) => ({
      ...current,
      status: status === "all" ? "all" : current.status === status ? "all" : status,
    }));
  };

  const handlePriorityFilter = (priority) => {
    setFilters((current) => ({
      ...current,
      priority: current.priority === priority ? "all" : priority,
    }));
  };

  const handleClearFilters = () => setFilters(createDefaultFilters());

  const hasAnyData =
    summary.totalIssues > 0 ||
    projectReports.length > 0 ||
    userReports.length > 0 ||
    teamReports.length > 0;

  return (
    <div className="space-y-6 page-shell-enter">
      <Card className="overflow-hidden rounded-[16px] border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(239,246,255,0.74),rgba(238,242,255,0.66))] shadow-[0_24px_70px_-36px_rgba(15,23,42,0.42)] backdrop-blur-2xl">
        <CardContent className="relative p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(244,114,182,0.14),transparent_34%)]" />

          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/65 bg-white/72 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm backdrop-blur-xl">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  Analytics
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  Reports
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Filter the workspace by project, team, member, and date range to
                  inspect delivery health from every angle.
                </p>
              </div>

              <Button
                variant="outline"
                type="button"
                className="rounded-full border-white/60 bg-white/72 text-slate-700 shadow-[0_16px_34px_-22px_rgba(15,23,42,0.24)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/90 hover:text-blue-700 hover:shadow-[0_22px_42px_-24px_rgba(59,130,246,0.28)]"
                onClick={handleClearFilters}
              >
                <RotateCcw className="h-4 w-4" />
                Clear filters
              </Button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1.2fr]">
              <FilterField icon={FolderKanban} label="Project">
                <select
                  className="field-select border-white/60 bg-white/78 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.3)] backdrop-blur-xl"
                  value={filters.projectId}
                  onChange={(event) => handleProjectSelect(event.target.value)}
                >
                  <option value="all">All projects</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField icon={Workflow} label="Team">
                <select
                  className="field-select border-white/60 bg-white/78 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.3)] backdrop-blur-xl"
                  value={filters.teamId}
                  onChange={(event) => handleTeamSelect(event.target.value)}
                >
                  <option value="all">All teams</option>
                  {teamOptions.map((team) => (
                    <option key={team._id} value={team._id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField icon={Users2} label="Member">
                <select
                  className="field-select border-white/60 bg-white/78 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.3)] backdrop-blur-xl"
                  value={filters.assigneeId}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      assigneeId: event.target.value,
                    }))
                  }
                >
                  <option value="all">All members</option>
                  {memberOptions.map((member) => (
                    <option key={member._id} value={member._id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField icon={CalendarRange} label="Date Range">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    type="date"
                    className="border-white/60 bg-white/78 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.3)] backdrop-blur-xl"
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
                    className="border-white/60 bg-white/78 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.3)] backdrop-blur-xl"
                    value={filters.dateTo}
                    min={filters.dateFrom || undefined}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        dateTo: event.target.value,
                      }))
                    }
                  />
                </div>
              </FilterField>
            </div>

            {activeFilterChips.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/72 px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm backdrop-blur-xl">
                  <Filter className="h-3.5 w-3.5" />
                  Active Filters
                </div>
                {activeFilterChips.map((chip) => (
                  <ActiveFilterChip
                    key={chip.key}
                    label={chip.label}
                    onClear={chip.onClear}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className={REPORT_PANEL_CLASS}>
          <CardContent className="p-6 text-sm text-rose-700">
            {error.response?.data?.message || "Unable to load report analytics right now."}
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {isLoading ? (
              <>
                <Skeleton className="h-[164px] w-full rounded-[16px]" />
                <Skeleton className="h-[164px] w-full rounded-[16px]" />
                <Skeleton className="h-[164px] w-full rounded-[16px]" />
                <Skeleton className="h-[164px] w-full rounded-[16px]" />
              </>
            ) : (
              metricCards.map((card) => (
                <DashboardStatCard
                  key={card.key}
                  title={card.title}
                  value={card.value}
                  icon={card.icon}
                  tone={card.tone}
                  helperText={card.helperText}
                  trendLabel={card.trendLabel}
                  trendDirection="flat"
                  compact
                  className={cn(
                    filters.status === card.key
                      ? "ring-2 ring-white/75 ring-offset-0"
                      : card.key === "all" && filters.status === "all"
                        ? "ring-2 ring-white/75 ring-offset-0"
                        : ""
                  )}
                  onClick={() => handleStatusFilter(card.key)}
                />
              ))
            )}
          </section>

          {!isLoading && !hasAnyData ? (
            <EmptyState
              title="No analytics in this scope"
              description="Try widening the filters or create more issues to unlock project, user, and team insights."
              icon={<BarChart3 className="h-5 w-5" />}
            />
          ) : (
            <>
              <section className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
                <Card className={REPORT_PANEL_CLASS}>
                  <CardHeader className="border-b border-white/45 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle>Issues by Status</CardTitle>
                        <CardDescription>
                          Click any bar to narrow the full report view to a specific status.
                        </CardDescription>
                      </div>
                      <span className="rounded-full border border-white/55 bg-white/68 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-xl">
                        {statusFilterLabels[filters.status] || "All issues"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5">
                    {isLoading ? (
                      <Skeleton className="h-[320px] w-full rounded-[16px]" />
                    ) : summary.totalIssues ? (
                      <div className="grid gap-4 lg:grid-cols-[1fr_0.92fr] lg:items-center">
                        <div className={cn(REPORT_CHART_SHELL_CLASS, "h-[280px]")}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={issuesByStatus} barCategoryGap={24}>
                              <CartesianGrid
                                stroke={REPORT_GRID_COLOR}
                                strokeDasharray="4 4"
                                vertical={false}
                              />
                              <XAxis dataKey="label" tickLine={false} axisLine={false} />
                              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.28)" }} />
                              <Bar dataKey="count" radius={[16, 16, 0, 0]}>
                                {issuesByStatus.map((entry) => (
                                  <Cell
                                    key={entry.key}
                                    cursor="pointer"
                                    fill={STATUS_CHART_COLORS[entry.key]}
                                    onClick={() => handleStatusFilter(entry.key)}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="space-y-3">
                          {issuesByStatus.map((entry) => (
                            <button
                              key={entry.key}
                              type="button"
                              onClick={() => handleStatusFilter(entry.key)}
                              className={cn(
                                REPORT_SUBPANEL_CLASS,
                                "w-full p-4 text-left",
                                filters.status === entry.key ? "border-blue-200/90" : ""
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <span
                                    className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-white/45 shadow-sm"
                                    style={{
                                      background: `linear-gradient(135deg, ${STATUS_CHART_COLORS[entry.key]}, rgba(255,255,255,0.92))`,
                                    }}
                                  >
                                    <span className="h-3 w-3 rounded-full bg-white/92" />
                                  </span>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                      {entry.label}
                                    </p>
                                    <p className="text-xs text-slate-500">Tap to focus</p>
                                  </div>
                                </div>
                                <span className="text-lg font-semibold text-slate-950">
                                  {entry.count}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <ReportEmptyPanel
                        icon={BarChart3}
                        title="Status trends appear here"
                        description="Once issues match the current filters, this chart becomes a quick control surface for the whole report."
                      />
                    )}
                  </CardContent>
                </Card>

                <Card className={REPORT_PANEL_CLASS}>
                  <CardHeader className="border-b border-white/45 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle>Priority Mix</CardTitle>
                        <CardDescription>
                          Click any slice to focus the dashboard on a single priority band.
                        </CardDescription>
                      </div>
                      <span className="rounded-full border border-white/55 bg-white/68 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-xl">
                        {filters.priority === "all" ? "All priorities" : filters.priority}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 p-5">
                    {isLoading ? (
                      <Skeleton className="h-[320px] w-full rounded-[16px]" />
                    ) : summary.totalIssues ? (
                      <>
                        <div className={cn(REPORT_CHART_SHELL_CLASS, "h-[250px]")}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Tooltip content={<ChartTooltip />} />
                              <Pie
                                data={issuesByPriority}
                                dataKey="count"
                                nameKey="label"
                                innerRadius={66}
                                outerRadius={108}
                                paddingAngle={5}
                              >
                                {issuesByPriority.map((entry) => (
                                  <Cell
                                    key={entry.key}
                                    cursor="pointer"
                                    fill={PRIORITY_CHART_COLORS[entry.key]}
                                    onClick={() => handlePriorityFilter(entry.key)}
                                  />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="grid gap-3">
                          {issuesByPriority.map((entry) => (
                            <button
                              key={entry.key}
                              type="button"
                              onClick={() => handlePriorityFilter(entry.key)}
                              className={cn(
                                REPORT_SUBPANEL_CLASS,
                                "w-full p-4 text-left",
                                filters.priority === entry.key ? "border-rose-200/90" : ""
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <span
                                    className="h-3.5 w-3.5 rounded-full"
                                    style={{
                                      backgroundColor: PRIORITY_CHART_COLORS[entry.key],
                                    }}
                                  />
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                      {entry.label}
                                    </p>
                                    <p className="text-xs text-slate-500">Interactive slice</p>
                                  </div>
                                </div>
                                <span className="text-lg font-semibold text-slate-950">
                                  {entry.count}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <ReportEmptyPanel
                        icon={Sparkles}
                        title="Priority balance is waiting"
                        description="Once issues enter the selected scope, this mix chart will show how urgent the workload feels."
                      />
                    )}
                  </CardContent>
                </Card>
              </section>

              <Card className={REPORT_PANEL_CLASS}>
                <CardHeader className="border-b border-white/45 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle>Project Performance</CardTitle>
                      <CardDescription>
                        Compare total, open, and closed work by project. Selecting a project
                        refocuses the rest of the report immediately.
                      </CardDescription>
                    </div>
                    <span className="rounded-full border border-white/55 bg-white/68 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-xl">
                      {projectReports.length} active projects
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  {isLoading ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <Skeleton className="h-[188px] w-full rounded-[16px]" />
                      <Skeleton className="h-[188px] w-full rounded-[16px]" />
                      <Skeleton className="h-[188px] w-full rounded-[16px]" />
                    </div>
                  ) : projectReports.length ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {projectReports.map((project) => {
                        const isActive =
                          String(filters.projectId) === String(project.projectId);

                        return (
                          <button
                            key={project.projectId}
                            type="button"
                            onClick={() =>
                              handleProjectSelect(isActive ? "all" : project.projectId)
                            }
                            className={cn(
                              REPORT_SUBPANEL_CLASS,
                              "group flex flex-col gap-4 p-5 text-left",
                              isActive
                                ? "border-blue-200/90 bg-[linear-gradient(180deg,rgba(239,246,255,0.94),rgba(224,231,255,0.7))]"
                                : "bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(248,250,252,0.54))]"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-base font-semibold text-slate-950">
                                  {project.name}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {project.isCompleted ? "Completed project" : "Active project"}
                                </p>
                              </div>
                              <span
                                className={cn(
                                  "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
                                  project.isCompleted
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-blue-50 text-blue-700"
                                )}
                              >
                                {isActive ? "Selected" : "Filter"}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div className="rounded-[14px] bg-slate-950/[0.03] px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                                  Total
                                </p>
                                <p className="mt-1 text-lg font-semibold text-slate-950">
                                  {project.total}
                                </p>
                              </div>
                              <div className="rounded-[14px] bg-amber-50/80 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-amber-700">
                                  Open
                                </p>
                                <p className="mt-1 text-lg font-semibold text-amber-900">
                                  {project.open}
                                </p>
                              </div>
                              <div className="rounded-[14px] bg-emerald-50/85 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-700">
                                  Closed
                                </p>
                                <p className="mt-1 text-lg font-semibold text-emerald-900">
                                  {project.closed}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                <span>Completion Rate</span>
                                <span>{project.completionRate}%</span>
                              </div>
                              <DistributionBar
                                total={project.total}
                                open={project.open}
                                inProgress={project.inProgress}
                                closed={project.closed}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <ReportEmptyPanel
                      icon={FolderKanban}
                      title="Project performance will light up here"
                      description="Once projects have issues in the selected scope, you'll see delivery spread and completion rates side by side."
                    />
                  )}
                </CardContent>
              </Card>

              <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
                <Card className={REPORT_PANEL_CLASS}>
                  <CardHeader className="border-b border-white/45 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle>Individual Performance</CardTitle>
                        <CardDescription>
                          Assignee-level delivery view with open, in-progress, and closed
                          counts plus a visual completion bar.
                        </CardDescription>
                      </div>
                      <span className="rounded-full border border-white/55 bg-white/68 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-xl">
                        {userReports.length} contributors
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5">
                    {isLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-[118px] w-full rounded-[16px]" />
                        <Skeleton className="h-[118px] w-full rounded-[16px]" />
                        <Skeleton className="h-[118px] w-full rounded-[16px]" />
                      </div>
                    ) : userReports.length ? (
                      <div className="space-y-3">
                        {userReports.map((person) => {
                          const isActive =
                            String(filters.assigneeId) === String(person.assigneeId);

                          return (
                            <button
                              key={person.assigneeId}
                              type="button"
                              onClick={() =>
                                setFilters((current) => ({
                                  ...current,
                                  assigneeId: isActive ? "all" : person.assigneeId,
                                }))
                              }
                              className={cn(
                                REPORT_SUBPANEL_CLASS,
                                "group flex w-full flex-col gap-4 p-4 text-left sm:p-5",
                                isActive
                                  ? "border-violet-200/90 bg-[linear-gradient(180deg,rgba(245,243,255,0.94),rgba(238,242,255,0.7))]"
                                  : "bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(248,250,252,0.54))]"
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <Avatar className="h-11 w-11 rounded-2xl avatar-pop-in">
                                    <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-950">
                                      {person.name}
                                    </p>
                                    <p className="truncate text-xs text-slate-500">
                                      {person.role || "Contributor"}
                                    </p>
                                  </div>
                                </div>
                                <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                                  {person.completionRate}% closed
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-[14px] bg-amber-50/85 px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-amber-700">
                                    Open
                                  </p>
                                  <p className="mt-1 text-base font-semibold text-amber-900">
                                    {person.open}
                                  </p>
                                </div>
                                <div className="rounded-[14px] bg-violet-50/90 px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-violet-700">
                                    In Progress
                                  </p>
                                  <p className="mt-1 text-base font-semibold text-violet-900">
                                    {person.inProgress}
                                  </p>
                                </div>
                                <div className="rounded-[14px] bg-emerald-50/90 px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-700">
                                    Closed
                                  </p>
                                  <p className="mt-1 text-base font-semibold text-emerald-900">
                                    {person.closed}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                  <span>Issue Distribution</span>
                                  <span>{person.total} total</span>
                                </div>
                                <DistributionBar
                                  total={person.total}
                                  open={person.open}
                                  inProgress={person.inProgress}
                                  closed={person.closed}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <ReportEmptyPanel
                        icon={Users2}
                        title="Individual insights are waiting"
                        description="As soon as issues are assigned in this scope, each assignee's delivery picture will appear here."
                      />
                    )}
                  </CardContent>
                </Card>

                <Card className={REPORT_PANEL_CLASS}>
                  <CardHeader className="border-b border-white/45 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle>Team Performance</CardTitle>
                        <CardDescription>
                          Completion rate and workload split for each team in the current
                          report scope.
                        </CardDescription>
                      </div>
                      <span className="rounded-full border border-white/55 bg-white/68 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-xl">
                        {teamReports.length} teams
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5">
                    {isLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-[112px] w-full rounded-[16px]" />
                        <Skeleton className="h-[112px] w-full rounded-[16px]" />
                        <Skeleton className="h-[112px] w-full rounded-[16px]" />
                      </div>
                    ) : teamReports.length ? (
                      <div className="space-y-3">
                        {teamReports.map((team) => {
                          const isActive =
                            String(filters.teamId) === String(team.teamId);

                          return (
                            <button
                              key={team.teamId}
                              type="button"
                              onClick={() =>
                                handleTeamSelect(isActive ? "all" : team.teamId)
                              }
                              className={cn(
                                REPORT_SUBPANEL_CLASS,
                                "group flex w-full flex-col gap-4 p-4 text-left sm:p-5",
                                isActive
                                  ? "border-cyan-200/90 bg-[linear-gradient(180deg,rgba(236,254,255,0.94),rgba(239,246,255,0.7))]"
                                  : "bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(248,250,252,0.54))]"
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">
                                    {team.name}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {team.memberCount} members
                                  </p>
                                </div>
                                <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700">
                                  {team.completionRate}% complete
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-[14px] bg-slate-950/[0.03] px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                                    Total
                                  </p>
                                  <p className="mt-1 text-base font-semibold text-slate-950">
                                    {team.total}
                                  </p>
                                </div>
                                <div className="rounded-[14px] bg-violet-50/90 px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-violet-700">
                                    In Progress
                                  </p>
                                  <p className="mt-1 text-base font-semibold text-violet-900">
                                    {team.inProgress}
                                  </p>
                                </div>
                                <div className="rounded-[14px] bg-emerald-50/90 px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-700">
                                    Closed
                                  </p>
                                  <p className="mt-1 text-base font-semibold text-emerald-900">
                                    {team.closed}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                  <span>Team Completion</span>
                                  <span>{team.open} open</span>
                                </div>
                                <DistributionBar
                                  total={team.total}
                                  open={team.open}
                                  inProgress={team.inProgress}
                                  closed={team.closed}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <ReportEmptyPanel
                        icon={Workflow}
                        title="Team insights appear here"
                        description="Once teams have issue activity in this filter scope, completion rates and workload balance will appear here."
                      />
                    )}
                  </CardContent>
                </Card>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ReportsPage;
