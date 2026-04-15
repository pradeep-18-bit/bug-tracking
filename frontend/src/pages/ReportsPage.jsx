import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
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
  X,
} from "lucide-react";
import {
  fetchProjectReports,
  fetchProjects,
  fetchReports,
  fetchSelectedUserReport,
  fetchTeamReports,
  fetchTeams,
  fetchUsers,
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { ISSUE_STATUS, getIssueStatusLabel } from "@/lib/issues";
import { hasAdminPanelAccess } from "@/lib/roles";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { getWorkspaceScope } from "@/lib/workspace";
import {
  formatMemberOptionLabel,
  memberSelectStyles,
} from "@/components/projects/memberSelectTheme";
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
const REPORT_SUBPANEL_CLASS =
  "rounded-[16px] border border-white/55 bg-white/52 shadow-[0_16px_36px_-26px_rgba(15,23,42,0.34)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_42px_-24px_rgba(15,23,42,0.38)]";
const OPEN_STATUS_KEY = "OPEN";
const STATUS_ORDER = [OPEN_STATUS_KEY, ISSUE_STATUS.DONE];
const PRIORITY_ORDER = ["High", "Medium", "Low"];
const STATUS_ROW_META = {
  [OPEN_STATUS_KEY]: {
    tone: "blue",
    helper: "",
  },
  [ISSUE_STATUS.DONE]: {
    tone: "green",
    helper: "",
  },
};
const PRIORITY_ROW_META = {
  High: {
    tone: "high",
    helper: "Immediate attention",
  },
  Medium: {
    tone: "medium",
    helper: "Balanced workload",
  },
  Low: {
    tone: "low",
    helper: "Lower urgency",
  },
};
const REPORT_USER_SELECT_STYLES = {
  ...memberSelectStyles,
  control: (base, state) => ({
    ...memberSelectStyles.control(base, state),
    minHeight: 54,
    borderRadius: 20,
    paddingLeft: 4,
    paddingRight: 4,
    boxShadow: state.isFocused
      ? "0 0 0 4px rgba(59, 130, 246, 0.12), 0 14px 30px -24px rgba(15, 23, 42, 0.34)"
      : "0 14px 28px -24px rgba(15, 23, 42, 0.24)",
  }),
  valueContainer: (base) => ({
    ...memberSelectStyles.valueContainer(base),
    paddingTop: 6,
    paddingBottom: 6,
  }),
  menu: (base) => ({
    ...memberSelectStyles.menu(base),
    borderRadius: 20,
  }),
  menuList: (base) => ({
    ...memberSelectStyles.menuList(base),
    maxHeight: 240,
    overflowY: "auto",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),
};

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
  all: "All Issues",
  [OPEN_STATUS_KEY]: "Open Issues",
  [ISSUE_STATUS.TODO]: "To Do",
  [ISSUE_STATUS.IN_PROGRESS]: "Open Issues",
  [ISSUE_STATUS.DONE]: "Closed",
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

const DistributionBar = ({ total, open, closed }) => {
  const segments = [
    {
      key: "open",
      value: open,
      className: "bg-[linear-gradient(90deg,#f59e0b,#fb7185)]",
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

const getPercentage = (count, total) =>
  total ? Math.round((Number(count || 0) / total) * 100) : 0;

const getCountLabel = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const AnalyticsFilterChip = ({
  active = false,
  label,
  onClick,
  tone = "slate",
}) => {
  const toneClasses = {
    slate: active
      ? "border-slate-300 bg-slate-100 text-slate-900"
      : "border-white/60 bg-white/72 text-slate-700 hover:border-slate-300 hover:text-slate-900",
    blue: active
      ? "border-blue-300 bg-blue-50 text-blue-700"
      : "border-blue-200/80 bg-blue-50/80 text-blue-700 hover:border-blue-300 hover:bg-blue-100/80",
    orange: active
      ? "border-orange-300 bg-orange-50 text-orange-700"
      : "border-orange-200/80 bg-orange-50/80 text-orange-700 hover:border-orange-300 hover:bg-orange-100/80",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5",
        toneClasses[tone] || toneClasses.slate
      )}
    >
      {label}
    </button>
  );
};

const StatusDonutChart = ({
  activeKey,
  onSelect,
  rows,
  total,
}) => {
  const drawableRows = rows.filter((row) => row.count > 0);
  let accumulatedOffset = 0;
  const chartRows = drawableRows.map((row) => {
    const normalizedLength =
      total && row.count ? Math.max((row.count / total) * 100 - 1.5, 0) : 0;
    const chartRow = {
      ...row,
      normalizedLength,
      offset: accumulatedOffset,
    };

    accumulatedOffset += (row.count / total) * 100;
    return chartRow;
  });
  return (
    <div className="relative mx-auto flex h-[224px] w-[224px] items-center justify-center">
      <svg
        viewBox="0 0 160 160"
        className="relative z-10 h-full w-full -rotate-90 overflow-visible"
        aria-label="Issues by status chart"
      >
        <defs>
          <linearGradient id="reports-status-open-gradient" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id="reports-status-closed-gradient" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>

        <circle
          cx="80"
          cy="80"
          r="48"
          fill="none"
          pathLength="100"
          strokeWidth="10"
          className="stroke-slate-200/85"
        />

        {chartRows.map((row) => (
          <circle
            key={row.key}
            cx="80"
            cy="80"
            r="48"
            fill="none"
            pathLength="100"
            strokeWidth={activeKey === row.key ? 13 : 10}
            stroke={row.key === OPEN_STATUS_KEY
              ? "url(#reports-status-open-gradient)"
              : "url(#reports-status-closed-gradient)"}
            strokeDasharray={`${row.normalizedLength} ${100 - row.normalizedLength}`}
            strokeDashoffset={-row.offset}
            strokeLinecap="round"
            className="cursor-pointer transition-all duration-300"
            style={{
              filter:
                activeKey === row.key
                  ? "drop-shadow(0 0 10px rgba(59,130,246,0.16))"
                  : "drop-shadow(0 4px 10px rgba(15,23,42,0.06))",
            }}
            onClick={() => onSelect(row.key)}
          />
        ))}
      </svg>

      <div className="absolute inset-[52px] rounded-full border border-slate-200/80 bg-white/95 shadow-[0_8px_18px_-18px_rgba(15,23,42,0.24)]" />
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Total
        </p>
        <p className="mt-1.5 text-3xl font-semibold leading-none tracking-tight text-slate-950">
          {total}
        </p>
      </div>
    </div>
  );
};

const sortByName = (left, right) =>
  (left?.name || left?.email || "").localeCompare(right?.name || right?.email || "");

const buildReportUserOption = (user) => ({
  value: String(user?._id || ""),
  label: user?.name || user?.email || "Unnamed user",
  email: user?.email || "",
  role: user?.role || "Contributor",
});

const formatReportUserOptionLabel = (option, meta) => {
  if (meta.context === "menu") {
    return formatMemberOptionLabel(option, meta);
  }

  const secondaryText = [option.role, option.email].filter(Boolean).join(" | ");

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-slate-900">{option.label}</p>
      {secondaryText ? (
        <p className="truncate text-xs text-slate-500">{secondaryText}</p>
      ) : null}
    </div>
  );
};

const buildEmptyUserPerformance = (option) => ({
  assigneeId: option?.value || "",
  name: option?.label || "Selected user",
  email: option?.email || "",
  role: option?.role || "Contributor",
  total: 0,
  open: 0,
  closed: 0,
  completionRate: 0,
});

const ReportsPage = () => {
  const { user } = useAuth();
  const workspaceScope = getWorkspaceScope(user);
  const [filters, setFilters] = useState(createDefaultFilters);
  const [selectedPerformanceUserId, setSelectedPerformanceUserId] = useState("");
  const activeStatusFilter =
    filters.status === ISSUE_STATUS.IN_PROGRESS ? OPEN_STATUS_KEY : filters.status;
  const reportSelectPortalTarget =
    typeof document !== "undefined" ? document.body : undefined;

  const reportFilters = useMemo(
    () => ({
      projectId: filters.projectId,
      teamId: filters.teamId,
      assigneeId: filters.assigneeId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      status: activeStatusFilter,
      priority: filters.priority,
    }),
    [activeStatusFilter, filters]
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
    data: workspaceUsers = [],
    isLoading: isWorkspaceUsersLoading,
    error: workspaceUsersError,
  } = useQuery({
    queryKey: ["users", "reports-directory", workspaceScope],
    queryFn: fetchUsers,
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
    teamReportsError;
  const isLoading =
    isProjectsLoading ||
    isTeamsLoading ||
    isSummaryLoading ||
    isProjectReportsLoading ||
    isTeamReportsLoading;

  const scopedTeams = useMemo(() => {
    if (hasAdminPanelAccess(user?.role)) {
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

  const hasStatusBreakdown = Boolean(summaryData?.issuesByStatus?.length);

  const statusCounts = useMemo(() => {
    const countsByKey = new Map(
      (summaryData?.issuesByStatus || []).map((entry) => [entry.key, Number(entry.count) || 0])
    );
    const todoIssues = countsByKey.get(ISSUE_STATUS.TODO) || 0;
    const inProgressIssues = countsByKey.get(ISSUE_STATUS.IN_PROGRESS) || 0;
    const closedIssues = countsByKey.get(ISSUE_STATUS.DONE) || 0;

    return {
      totalIssues: todoIssues + inProgressIssues + closedIssues,
      openIssues: todoIssues + inProgressIssues,
      closedIssues,
    };
  }, [summaryData?.issuesByStatus]);

  const summary = useMemo(
    () => ({
      totalIssues: hasStatusBreakdown
        ? statusCounts.totalIssues
        : Number(summaryData?.totalIssues ?? 0),
      openIssues: hasStatusBreakdown
        ? statusCounts.openIssues
        : Number(summaryData?.openIssues ?? 0),
      closedIssues: hasStatusBreakdown
        ? statusCounts.closedIssues
        : Number(summaryData?.closedIssues ?? 0),
    }),
    [
      hasStatusBreakdown,
      statusCounts.closedIssues,
      statusCounts.openIssues,
      statusCounts.totalIssues,
      summaryData?.closedIssues,
      summaryData?.openIssues,
      summaryData?.totalIssues,
    ]
  );

  const issuesByStatus = useMemo(() => {
    return STATUS_ORDER.map((status) => ({
      key: status,
      label: statusFilterLabels[status] || getIssueStatusLabel(status),
      count: status === OPEN_STATUS_KEY ? summary.openIssues : summary.closedIssues,
    }));
  }, [summary.closedIssues, summary.openIssues]);

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

  const statusRows = useMemo(() => {
    const total = summary.totalIssues || 0;

    return issuesByStatus.map((entry) => {
      const meta = STATUS_ROW_META[entry.key] || STATUS_ROW_META[OPEN_STATUS_KEY];
      const percentage = getPercentage(entry.count, total);

      return {
        ...entry,
        helper: meta.helper,
        tone: meta.tone,
        percentage,
        shareLabel: total ? `${percentage}% of scope` : "No issues yet",
      };
    });
  }, [activeStatusFilter, issuesByStatus, summary.totalIssues]);

  const priorityRows = useMemo(() => {
    const total = summary.totalIssues || 0;

    return issuesByPriority.map((entry) => {
      const meta = PRIORITY_ROW_META[entry.key] || PRIORITY_ROW_META.Medium;
      const percentage = getPercentage(entry.count, total);
      const width = total
        ? Math.max(percentage, entry.count ? 10 : 0)
        : 0;

      return {
        ...entry,
        helper: meta.helper,
        tone: meta.tone,
        percentage,
        shareLabel: total ? `${percentage}% of all issues` : "No issues yet",
        width,
      };
    });
  }, [filters.priority, issuesByPriority, summary.totalIssues]);
  const openStatusRow = useMemo(
    () => statusRows.find((entry) => entry.key === OPEN_STATUS_KEY) || null,
    [statusRows]
  );
  const closedStatusRow = useMemo(
    () => statusRows.find((entry) => entry.key === ISSUE_STATUS.DONE) || null,
    [statusRows]
  );
  const statusInsight = useMemo(() => {
    if (!summary.totalIssues || !openStatusRow || !closedStatusRow) {
      return "Status balance appears here once issues enter the selected scope.";
    }

    if (openStatusRow.count === closedStatusRow.count) {
      return "Open and closed issues are evenly balanced in the current scope.";
    }

    return openStatusRow.count > closedStatusRow.count
      ? "Open issues are leading the current workload."
      : "Closed issues are currently leading the scope.";
  }, [closedStatusRow, openStatusRow, summary.totalIssues]);
  const dominantPriority = useMemo(() => {
    const [firstRow] = [...priorityRows].sort((left, right) => right.count - left.count);
    return firstRow || null;
  }, [priorityRows]);
  const priorityInsight = useMemo(() => {
    if (!summary.totalIssues || !dominantPriority?.count) {
      return "Priority distribution will appear once issues exist in the current scope.";
    }

    if (dominantPriority.percentage >= 50) {
      return `Most issues are ${dominantPriority.label.toLowerCase()} priority right now.`;
    }

    return `${dominantPriority.label} priority leads the current mix with ${dominantPriority.count} issues.`;
  }, [dominantPriority, summary.totalIssues]);

  const projectReports = projectReportsData?.projects || [];
  const teamReports = teamReportsData?.teams || [];

  const scopedPerformanceUsers = useMemo(() => {
    const sortedUsers = [...workspaceUsers].sort(sortByName);

    if (filters.projectId === "all" && filters.teamId === "all") {
      return sortedUsers;
    }

    const scopedMemberIds = new Set(memberOptions.map((member) => String(member._id)));

    return sortedUsers.filter((member) => scopedMemberIds.has(String(member._id)));
  }, [filters.projectId, filters.teamId, memberOptions, workspaceUsers]);

  const performanceUserOptions = useMemo(
    () => scopedPerformanceUsers.map(buildReportUserOption),
    [scopedPerformanceUsers]
  );

  const selectedPerformanceUserOption = useMemo(
    () =>
      performanceUserOptions.find((option) => option.value === selectedPerformanceUserId) ||
      null,
    [performanceUserOptions, selectedPerformanceUserId]
  );

  useEffect(() => {
    if (!selectedPerformanceUserId) {
      return;
    }

    const isStillAvailable = performanceUserOptions.some(
      (option) => option.value === selectedPerformanceUserId
    );

    if (!isStillAvailable) {
      setSelectedPerformanceUserId("");
    }
  }, [performanceUserOptions, selectedPerformanceUserId]);

  const selectedUserReportFilters = useMemo(
    () => ({
      ...reportFilters,
      assigneeId: selectedPerformanceUserId,
    }),
    [reportFilters, selectedPerformanceUserId]
  );

  const {
    data: selectedUserReport,
    isLoading: isSelectedUserReportLoading,
    isFetching: isSelectedUserReportFetching,
    error: selectedUserReportError,
  } = useQuery({
    queryKey: ["reports", "individual-user", selectedUserReportFilters],
    queryFn: () => fetchSelectedUserReport(selectedUserReportFilters),
    enabled: Boolean(selectedPerformanceUserId),
  });

  const selectedUserPerformance = useMemo(() => {
    if (!selectedPerformanceUserOption) {
      return null;
    }

    return selectedUserReport || buildEmptyUserPerformance(selectedPerformanceUserOption);
  }, [selectedPerformanceUserOption, selectedUserReport]);

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

    if (activeStatusFilter !== "all") {
      chips.push({
        key: "status",
        label: `Status: ${statusFilterLabels[activeStatusFilter] || activeStatusFilter}`,
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
    activeStatusFilter,
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
        activeStatusFilter === OPEN_STATUS_KEY ? "Open filter active" : "Click to focus",
    },
    {
      key: ISSUE_STATUS.DONE,
      title: "Closed",
      value: summary.closedIssues,
      icon: CheckCircle2,
      tone: "emerald",
      helperText: "Delivered work",
      trendLabel:
        activeStatusFilter === ISSUE_STATUS.DONE
          ? "Closed filter active"
          : "Click to focus",
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
      status:
        status === "all"
          ? "all"
          : (current.status === ISSUE_STATUS.IN_PROGRESS
              ? OPEN_STATUS_KEY
              : current.status) === status
            ? "all"
            : status,
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
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {isLoading ? (
              <>
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
                    activeStatusFilter === card.key
                      ? "ring-2 ring-white/75 ring-offset-0"
                      : card.key === "all" && activeStatusFilter === "all"
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
              <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                <Card className={REPORT_PANEL_CLASS}>
                  <CardHeader className="border-b border-white/45 p-4">
                    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle>Issues Overview</CardTitle>
                        <CardDescription>
                          Open versus closed issue balance for the current report scope.
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {activeStatusFilter !== "all" ? (
                          <span className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                            {statusFilterLabels[activeStatusFilter] || activeStatusFilter}
                          </span>
                        ) : null}
                        <AnalyticsFilterChip
                          active={activeStatusFilter === "all"}
                          label="All Issues"
                          onClick={() => handleStatusFilter("all")}
                          tone="blue"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {isLoading ? (
                      <Skeleton className="h-[252px] w-full rounded-[16px]" />
                    ) : (
                      <div className="grid gap-5 lg:grid-cols-[236px_minmax(0,1fr)] lg:items-start">
                        <div className="mx-auto flex w-full max-w-[240px] flex-col items-center gap-3.5">
                          <StatusDonutChart
                            activeKey={activeStatusFilter === "all" ? "" : activeStatusFilter}
                            onSelect={handleStatusFilter}
                            rows={statusRows}
                            total={summary.totalIssues}
                          />

                          <div className="w-full space-y-2 text-center lg:text-left">
                            <p className="text-sm leading-5 text-slate-500">{statusInsight}</p>
                            <div className="flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
                              <button
                                type="button"
                                onClick={() => handleStatusFilter(OPEN_STATUS_KEY)}
                                className={cn(
                                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-700",
                                  activeStatusFilter === OPEN_STATUS_KEY
                                    ? "border-blue-200 bg-blue-50/80 text-blue-700"
                                    : "border-slate-200/80 bg-white/78"
                                )}
                              >
                                <span className="h-2 w-2 rounded-full bg-[linear-gradient(135deg,#2563eb,#38bdf8)]" />
                                Open {openStatusRow?.count || 0}
                                <span className="text-slate-400">
                                  {openStatusRow?.percentage || 0}%
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleStatusFilter(ISSUE_STATUS.DONE)}
                                className={cn(
                                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700",
                                  activeStatusFilter === ISSUE_STATUS.DONE
                                    ? "border-emerald-200 bg-emerald-50/80 text-emerald-700"
                                    : "border-slate-200/80 bg-white/78"
                                )}
                              >
                                <span className="h-2 w-2 rounded-full bg-[linear-gradient(135deg,#10b981,#34d399)]" />
                                Closed {closedStatusRow?.count || 0}
                                <span className="text-slate-400">
                                  {closedStatusRow?.percentage || 0}%
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3.5">
                          <button
                            type="button"
                            onClick={() => handleStatusFilter(OPEN_STATUS_KEY)}
                            aria-pressed={activeStatusFilter === OPEN_STATUS_KEY}
                            className={cn(
                              "group w-full rounded-[18px] border px-3.5 py-3.5 text-left transition-all duration-200 hover:border-blue-200 hover:bg-white/55",
                              activeStatusFilter === OPEN_STATUS_KEY
                                ? "border-blue-300 bg-blue-50/75 shadow-[0_18px_38px_-30px_rgba(37,99,235,0.24)]"
                                : "border-transparent bg-transparent"
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                                  Open Issues
                                </p>
                                <p className="mt-1.5 text-[2rem] font-semibold leading-none tracking-tight text-slate-950">
                                  {openStatusRow?.count || 0}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-semibold text-blue-700">
                                  {openStatusRow?.percentage || 0}%
                                </p>
                                <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition group-hover:text-blue-600">
                                  {activeStatusFilter === OPEN_STATUS_KEY ? "Active" : "Filter"}
                                  <Filter className="h-3 w-3" />
                                </span>
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusFilter(ISSUE_STATUS.DONE)}
                            aria-pressed={activeStatusFilter === ISSUE_STATUS.DONE}
                            className={cn(
                              "group flex w-full items-center justify-between gap-4 rounded-[18px] border px-3.5 py-3 text-left transition-all duration-200 hover:border-emerald-200 hover:bg-white/55",
                              activeStatusFilter === ISSUE_STATUS.DONE
                                ? "border-emerald-300 bg-emerald-50/75 shadow-[0_18px_38px_-30px_rgba(16,185,129,0.22)]"
                                : "border-white/55 bg-white/38"
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(135deg,#10b981,#34d399)]" />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-950">Closed</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {closedStatusRow?.shareLabel || "No issues yet"}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-base font-semibold text-slate-950">
                                  {closedStatusRow?.count || 0}
                                </p>
                                <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                                  {closedStatusRow?.percentage || 0}%
                                </p>
                              </div>
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition group-hover:text-emerald-600">
                                {activeStatusFilter === ISSUE_STATUS.DONE ? "Active" : "Filter"}
                                <Filter className="h-3 w-3" />
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className={REPORT_PANEL_CLASS}>
                  <CardHeader className="border-b border-white/45 p-4">
                    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle>Priority Distribution</CardTitle>
                        <CardDescription>
                          Urgency balance for the current scope with quick, lightweight
                          filtering.
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {filters.priority !== "all" ? (
                          <span className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                            {filters.priority} priority
                          </span>
                        ) : null}
                        <AnalyticsFilterChip
                          active={filters.priority === "all"}
                          label="All priorities"
                          onClick={() =>
                            setFilters((current) => ({
                              ...current,
                              priority: "all",
                            }))
                          }
                          tone="orange"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3.5 p-4">
                    {isLoading ? (
                      <Skeleton className="h-[252px] w-full rounded-[16px]" />
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                              Distribution
                            </p>
                            {dominantPriority?.count ? (
                              <span className="rounded-full border border-slate-200/80 bg-white/78 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                                {dominantPriority.label} leads
                              </span>
                            ) : null}
                          </div>

                          <div className="overflow-hidden rounded-full bg-slate-100/90">
                            <div className="flex h-2 w-full overflow-hidden rounded-full">
                              {priorityRows.map((entry) => {
                                if (!entry.count || !summary.totalIssues) {
                                  return null;
                                }

                                const fillClass =
                                  entry.key === "High"
                                    ? "bg-[linear-gradient(90deg,#ef4444,#f97316)]"
                                    : entry.key === "Medium"
                                      ? "bg-[linear-gradient(90deg,#fb923c,#fbbf24)]"
                                      : "bg-[linear-gradient(90deg,#94a3b8,#cbd5e1)]";

                                return (
                                  <button
                                    key={entry.key}
                                    type="button"
                                    onClick={() => handlePriorityFilter(entry.key)}
                                    aria-label={`${entry.label} priority: ${entry.count} issues`}
                                    className={cn(
                                      "h-full transition-all duration-200 hover:brightness-105",
                                      fillClass,
                                      filters.priority === entry.key ? "brightness-110" : ""
                                    )}
                                    style={{
                                      width: `${Math.max(entry.percentage, 8)}%`,
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>

                          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-orange-200/70 bg-orange-50/70 px-3 py-1 text-[11px] font-medium text-orange-800 shadow-sm">
                            <Sparkles className="h-3.5 w-3.5 shrink-0 text-orange-600" />
                            <span className="truncate">{priorityInsight}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {priorityRows.map((entry) => {
                            const isActive = filters.priority === entry.key;
                            const accentClasses =
                              entry.key === "High"
                                ? {
                                    wrapper: isActive
                                      ? "border-red-200 bg-red-50/70 shadow-[0_16px_30px_-26px_rgba(239,68,68,0.2)]"
                                      : "border-white/60 bg-white/58 hover:border-red-200/70",
                                    dot: "bg-[linear-gradient(135deg,#ef4444,#f97316)]",
                                    fill: "bg-[linear-gradient(90deg,#ef4444,#f97316)]",
                                    count: "text-red-700",
                                  }
                                : entry.key === "Medium"
                                  ? {
                                      wrapper: isActive
                                        ? "border-orange-200 bg-orange-50/70 shadow-[0_16px_30px_-26px_rgba(249,115,22,0.18)]"
                                        : "border-white/60 bg-white/58 hover:border-orange-200/70",
                                      dot: "bg-[linear-gradient(135deg,#fb923c,#fbbf24)]",
                                      fill: "bg-[linear-gradient(90deg,#fb923c,#fbbf24)]",
                                      count: "text-orange-700",
                                    }
                                  : {
                                      wrapper: isActive
                                        ? "border-slate-200 bg-slate-100/80 shadow-[0_16px_30px_-26px_rgba(100,116,139,0.16)]"
                                        : "border-white/60 bg-white/58 hover:border-slate-200/80",
                                      dot: "bg-[linear-gradient(135deg,#94a3b8,#cbd5e1)]",
                                      fill: "bg-[linear-gradient(90deg,#94a3b8,#cbd5e1)]",
                                      count: "text-slate-700",
                                    };

                            return (
                              <button
                                key={entry.key}
                                type="button"
                                onClick={() => handlePriorityFilter(entry.key)}
                                aria-pressed={isActive}
                                className={cn(
                                  "w-full rounded-[18px] border px-3.5 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-24px_rgba(15,23,42,0.18)]",
                                  accentClasses.wrapper
                                )}
                              >
                                <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={cn(
                                          "h-2.5 w-2.5 rounded-full",
                                          accentClasses.dot
                                        )}
                                      />
                                      <span className="text-sm font-semibold text-slate-950">
                                        {entry.label}
                                      </span>
                                    </div>
                                    <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
                                      {entry.helper}
                                    </p>
                                  </div>

                                  <div className="flex items-baseline justify-end gap-3 text-right sm:min-w-[94px]">
                                    <p className={cn("text-base font-semibold", accentClasses.count)}>
                                      {entry.count}
                                    </p>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                      {entry.percentage}%
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-2.5 space-y-1">
                                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100/90">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all duration-500 ease-out",
                                        accentClasses.fill
                                      )}
                                      style={{
                                        width: `${entry.width}%`,
                                      }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between gap-3 text-[10px] text-slate-500">
                                    <span>{entry.shareLabel}</span>
                                    <span>{getCountLabel(entry.count, "issue")}</span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
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
                          Search for a teammate and review one focused delivery
                          snapshot at a time.
                        </CardDescription>
                      </div>
                      <span className="rounded-full border border-white/55 bg-white/68 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-xl">
                        Single-user focus
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                        <div className="flex-1 space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Select User
                          </label>

                          {isWorkspaceUsersLoading ? (
                            <Skeleton className="h-[54px] w-full rounded-[20px]" />
                          ) : (
                            <Select
                              options={performanceUserOptions}
                              value={selectedPerformanceUserOption}
                              onChange={(option) =>
                                setSelectedPerformanceUserId(option?.value || "")
                              }
                              isSearchable
                              isClearable
                              placeholder="Search user by name or email"
                              styles={REPORT_USER_SELECT_STYLES}
                              formatOptionLabel={formatReportUserOptionLabel}
                              menuPortalTarget={reportSelectPortalTarget}
                              menuPosition="fixed"
                              filterOption={(option, inputValue) =>
                                [option.label, option.data.email, option.data.role]
                                  .filter(Boolean)
                                  .join(" ")
                                  .toLowerCase()
                                  .includes(inputValue.trim().toLowerCase())
                              }
                              noOptionsMessage={({ inputValue }) =>
                                inputValue.trim()
                                  ? "No matching users found."
                                  : filters.projectId !== "all" || filters.teamId !== "all"
                                    ? "No users available in the current report scope."
                                    : "No users available."
                              }
                            />
                          )}
                        </div>

                        {selectedPerformanceUserId ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full border-white/60 bg-white/72 text-slate-700 shadow-[0_12px_26px_-18px_rgba(15,23,42,0.24)] backdrop-blur-xl"
                            onClick={() => setSelectedPerformanceUserId("")}
                          >
                            <X className="h-4 w-4" />
                            Clear
                          </Button>
                        ) : null}
                      </div>

                      {workspaceUsersError ? (
                        <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                          {workspaceUsersError.response?.data?.message ||
                            "Unable to load users for this report view right now."}
                        </div>
                      ) : isWorkspaceUsersLoading ? (
                        <div className="mx-auto max-w-2xl">
                          <Skeleton className="h-[220px] w-full rounded-[18px]" />
                        </div>
                      ) : null}

                      {!workspaceUsersError && !isWorkspaceUsersLoading && !selectedPerformanceUserOption ? (
                        <ReportEmptyPanel
                          icon={Users2}
                          title="Search and select a user to view performance"
                          description="Find a teammate by name or email to load a focused delivery snapshot for the current report scope."
                        />
                      ) : !workspaceUsersError &&
                        !isWorkspaceUsersLoading &&
                        selectedUserReportError ? (
                        <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                          {selectedUserReportError.response?.data?.message ||
                            "Unable to load this user's performance right now."}
                        </div>
                      ) : !workspaceUsersError &&
                        !isWorkspaceUsersLoading &&
                        (isSelectedUserReportLoading || isSelectedUserReportFetching) ? (
                        <div className="mx-auto max-w-2xl">
                          <Skeleton className="h-[244px] w-full rounded-[18px]" />
                        </div>
                      ) : !workspaceUsersError && !isWorkspaceUsersLoading && selectedUserPerformance ? (
                        <div className="mx-auto max-w-2xl">
                          <div
                            className={cn(
                              REPORT_SUBPANEL_CLASS,
                              "flex flex-col gap-5 border-violet-200/80 bg-[linear-gradient(180deg,rgba(245,243,255,0.94),rgba(255,255,255,0.84))] p-5"
                            )}
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex min-w-0 items-center gap-4">
                                <Avatar className="h-14 w-14 rounded-2xl avatar-pop-in">
                                  <AvatarFallback>
                                    {getInitials(selectedUserPerformance.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="truncate text-lg font-semibold text-slate-950">
                                    {selectedUserPerformance.name}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    <span className="rounded-full bg-white/80 px-2.5 py-1 font-semibold text-slate-600">
                                      {selectedUserPerformance.role || "Contributor"}
                                    </span>
                                    {selectedUserPerformance.email ? (
                                      <span className="truncate">
                                        {selectedUserPerformance.email}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-[18px] bg-violet-50/90 px-4 py-3 text-right">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600">
                                  Completion
                                </p>
                                <p className="mt-1 text-2xl font-semibold text-violet-900">
                                  {selectedUserPerformance.completionRate}%
                                </p>
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="rounded-[16px] bg-slate-950/[0.03] px-4 py-3">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                                  Total Issues
                                </p>
                                <p className="mt-1 text-xl font-semibold text-slate-950">
                                  {selectedUserPerformance.total}
                                </p>
                              </div>
                              <div className="rounded-[16px] bg-amber-50/85 px-4 py-3">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-amber-700">
                                  Open Issues
                                </p>
                                <p className="mt-1 text-xl font-semibold text-amber-900">
                                  {selectedUserPerformance.open}
                                </p>
                              </div>
                              <div className="rounded-[16px] bg-emerald-50/90 px-4 py-3">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-700">
                                  Closed Issues
                                </p>
                                <p className="mt-1 text-xl font-semibold text-emerald-900">
                                  {selectedUserPerformance.closed}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                <span>Completion Progress</span>
                                <span>{selectedUserPerformance.completionRate}% complete</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-[linear-gradient(90deg,#8b5cf6,#6366f1)] transition-all duration-300"
                                  style={{
                                    width: `${Math.max(
                                      selectedUserPerformance.completionRate,
                                      selectedUserPerformance.total ? 6 : 0
                                    )}%`,
                                  }}
                                />
                              </div>
                              <p className="text-sm text-slate-500">
                                {selectedUserPerformance.total
                                  ? `${selectedUserPerformance.closed} of ${selectedUserPerformance.total} issues in this scope are closed.`
                                  : "This user does not have any issues in the current report scope yet."}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
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
                                <div className="rounded-[14px] bg-amber-50/85 px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-amber-700">
                                    Open
                                  </p>
                                  <p className="mt-1 text-base font-semibold text-amber-900">
                                    {team.open}
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
