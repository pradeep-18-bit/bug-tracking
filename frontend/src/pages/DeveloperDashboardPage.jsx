import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  Bug,
  CalendarClock,
  CheckCircle2,
  CircleDotDashed,
  ClipboardList,
  Flame,
  FolderKanban,
  ListTodo,
  Plus,
  RefreshCcw,
  Search,
  TimerReset,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  fetchIssueActivity,
  fetchMyIssues,
  fetchProjects,
  updateIssue,
} from "@/lib/api";
import {
  BUG_STATUS_OPTIONS,
  ISSUE_SORT_OPTIONS,
  ISSUE_STATUS,
  ISSUE_STATUS_OPTIONS,
  createIssueListFilters,
  filterIssues,
  getIssueDisplayKey,
  getIssueStatusLabel,
  getIssueStatusMetrics,
  isBugIssue,
  isIssueClosed,
  normalizeBugStatusForIssue,
  resolveBugDetails,
  resolveIssueProjectId,
  sortIssues,
} from "@/lib/issues";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import IssueDetailsDialog from "@/components/issues/IssueDetailsDialog";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const TABS = [
  { id: "tasks", label: "Tasks", Icon: ClipboardList },
  { id: "bugs", label: "Bugs / Issues", Icon: Bug },
];

const defaultFilters = createIssueListFilters({
  assigneeId: "all",
  sortBy: "priority",
});

const statusStyleMap = {
  [ISSUE_STATUS.NEW]: "border-orange-200 bg-orange-50 text-orange-700",
  [ISSUE_STATUS.OPEN]: "border-red-200 bg-red-50 text-red-700",
  [ISSUE_STATUS.ASSIGNED]: "border-violet-200 bg-violet-50 text-violet-700",
  [ISSUE_STATUS.IN_PROGRESS]: "border-blue-200 bg-blue-50 text-blue-700",
  [ISSUE_STATUS.QA]: "border-cyan-200 bg-cyan-50 text-cyan-700",
  [ISSUE_STATUS.FIXED]: "border-cyan-200 bg-cyan-50 text-cyan-700",
  [ISSUE_STATUS.REVIEW]: "border-cyan-200 bg-cyan-50 text-cyan-700",
  [ISSUE_STATUS.DONE]: "border-emerald-200 bg-emerald-50 text-emerald-700",
  [ISSUE_STATUS.CLOSED]: "border-green-300 bg-green-50 text-green-800",
  [ISSUE_STATUS.REJECTED]: "border-slate-200 bg-slate-100 text-slate-700",
  [ISSUE_STATUS.DEFERRED]: "border-slate-200 bg-slate-100 text-slate-700",
  [ISSUE_STATUS.BLOCKED]: "border-rose-200 bg-rose-50 text-rose-700",
  [ISSUE_STATUS.REOPEN]: "border-amber-200 bg-amber-50 text-amber-700",
  [ISSUE_STATUS.TODO]: "border-slate-200 bg-slate-50 text-slate-700",
};

const priorityStyleMap = {
  Critical: "border-red-300 bg-red-50 text-red-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Medium: "border-yellow-200 bg-yellow-50 text-yellow-700",
  Low: "border-slate-200 bg-blue-50 text-slate-700",
};

const severityStyleMap = {
  Blocker: "border-red-300 bg-red-950 text-white",
  Critical: "border-red-200 bg-red-50 text-red-700",
  Major: "border-orange-200 bg-orange-50 text-orange-700",
  Minor: "border-blue-200 bg-blue-50 text-blue-700",
  Trivial: "border-slate-200 bg-slate-100 text-slate-700",
};

const priorityRank = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const severityRank = {
  Blocker: 0,
  Critical: 1,
  Major: 2,
  Minor: 3,
  Trivial: 4,
};

const bugWorkflowLabels = {
  [ISSUE_STATUS.NEW]: "Open",
  [ISSUE_STATUS.OPEN]: "Open",
  [ISSUE_STATUS.ASSIGNED]: "In Progress",
  [ISSUE_STATUS.FIXED]: "Testing",
  [ISSUE_STATUS.CLOSED]: "Closed",
  [ISSUE_STATUS.REOPEN]: "Reopened",
  [ISSUE_STATUS.REJECTED]: "Rejected",
  [ISSUE_STATUS.DEFERRED]: "Deferred",
};

const developerBugTransitions = {
  [ISSUE_STATUS.NEW]: [ISSUE_STATUS.OPEN],
  [ISSUE_STATUS.OPEN]: [ISSUE_STATUS.ASSIGNED, ISSUE_STATUS.REJECTED],
  [ISSUE_STATUS.ASSIGNED]: [ISSUE_STATUS.FIXED, ISSUE_STATUS.REJECTED],
  [ISSUE_STATUS.REOPEN]: [ISSUE_STATUS.ASSIGNED],
};

const taskStatusOptions = [
  { value: ISSUE_STATUS.TODO, label: "To Do" },
  { value: ISSUE_STATUS.IN_PROGRESS, label: "In Progress" },
  { value: ISSUE_STATUS.REVIEW, label: "Review" },
  { value: ISSUE_STATUS.QA, label: "Testing" },
  { value: ISSUE_STATUS.DONE, label: "Done" },
];

const getStatusLabel = (issue) =>
  isBugIssue(issue)
    ? bugWorkflowLabels[normalizeBugStatusForIssue(issue)] || getIssueStatusLabel(issue.status)
    : getIssueStatusLabel(issue.status);

const getBadgeClass = (map, key, fallback) =>
  map[key] || fallback || "border-slate-200 bg-slate-100 text-slate-700";

const Pill = ({ children, className }) => (
  <span
    className={cn(
      "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold",
      className
    )}
  >
    {children}
  </span>
);

const getLastUpdated = (issue) => issue?.updatedAt || issue?.lastUpdatedAt || issue?.createdAt;

const getBugSeverity = (issue) => resolveBugDetails(issue)?.severity || "Trivial";

const getAssigneeName = (issue) =>
  issue?.assignee?.name ||
  resolveBugDetails(issue)?.developerLead?.name ||
  "Unassigned";

const getReporterName = (issue) =>
  issue?.reporter?.name || resolveBugDetails(issue)?.testerOwner?.name || "Unknown";

const getProjectName = (issue) => issue?.projectId?.name || "Unknown project";

const getTeamName = (issue) => issue?.teamId?.name || "No team";

const getProjectId = (project) => String(project?._id || project || "");

const getSlaInfo = (issue) => {
  if (!issue?.dueAt) {
    return {
      label: "No SLA date",
      className: "text-slate-500",
      urgent: false,
    };
  }

  const dueTime = new Date(issue.dueAt).getTime();
  const diff = dueTime - Date.now();
  const absDiff = Math.abs(diff);
  const hours = Math.ceil(absDiff / (1000 * 60 * 60));
  const days = Math.ceil(absDiff / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    return {
      label: `${hours}h overdue`,
      className: "text-rose-700",
      urgent: true,
    };
  }

  if (hours <= 24) {
    return {
      label: `${hours}h left`,
      className: "text-orange-700",
      urgent: true,
    };
  }

  return {
    label: `${days}d left`,
    className: "text-slate-600",
    urgent: false,
  };
};

const isCriticalIssue = (issue) => {
  const severity = getBugSeverity(issue);

  return ["Blocker", "Critical"].includes(severity) || issue?.priority === "Critical";
};

const sortPriorityQueue = (issues = []) =>
  [...issues].sort((left, right) => {
    const leftCritical = isCriticalIssue(left) ? 0 : 1;
    const rightCritical = isCriticalIssue(right) ? 0 : 1;

    if (leftCritical !== rightCritical) {
      return leftCritical - rightCritical;
    }

    const severityDelta =
      (severityRank[getBugSeverity(left)] ?? 10) - (severityRank[getBugSeverity(right)] ?? 10);

    if (severityDelta !== 0) {
      return severityDelta;
    }

    const priorityDelta =
      (priorityRank[left.priority] ?? 10) - (priorityRank[right.priority] ?? 10);

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;

    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }

    return new Date(getLastUpdated(right) || 0) - new Date(getLastUpdated(left) || 0);
  });

const getNextBugAction = (issue) => {
  const currentStatus = normalizeBugStatusForIssue(issue);
  const [nextStatus] = developerBugTransitions[currentStatus] || [];

  if (!nextStatus) {
    return null;
  }

  const labels = {
    [ISSUE_STATUS.OPEN]: "Open",
    [ISSUE_STATUS.ASSIGNED]: "Start",
    [ISSUE_STATUS.FIXED]: "Send to Testing",
  };

  return {
    status: nextStatus,
    label: labels[nextStatus] || getIssueStatusLabel(nextStatus),
  };
};

const activityText = (entry) => {
  if (entry?.eventType === "COMMENT_CREATED") {
    return "commented on";
  }

  if (entry?.eventType === "BUG_STATUS_CHANGED") {
    return "moved bug status";
  }

  if (entry?.eventType === "ISSUE_CREATED") {
    return "created";
  }

  return "updated";
};

const StatCard = ({ label, value, helper, Icon, className }) => (
  <Card className="overflow-hidden border-white/70 bg-white/86 shadow-[0_20px_52px_-36px_rgba(15,23,42,0.34)] backdrop-blur-xl">
    <CardContent className="relative p-4">
      <div className={cn("absolute inset-x-0 top-0 h-1", className)} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/80 bg-slate-50 text-slate-700 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-500">{helper}</p>
    </CardContent>
  </Card>
);

const ProjectPanel = ({ projects, issues, onOpenProject }) => {
  const projectCards = useMemo(
    () =>
      projects
        .map((project) => {
          const projectIssues = issues.filter(
            (issue) => resolveIssueProjectId(issue) === getProjectId(project)
          );
          const completed = projectIssues.filter(isIssueClosed).length;
          const active = projectIssues.length - completed;
          const progress = projectIssues.length
            ? Math.round((completed / projectIssues.length) * 100)
            : 0;
          const critical = projectIssues.filter(
            (issue) => !isIssueClosed(issue) && isCriticalIssue(issue)
          ).length;

          return {
            ...project,
            active,
            completed,
            progress,
            critical,
            total: projectIssues.length,
          };
        })
        .sort((left, right) => right.active - left.active || right.critical - left.critical),
    [issues, projects]
  );

  return (
    <Card className="h-full border-white/70 bg-white/88 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.36)] backdrop-blur-xl">
      <CardHeader className="border-b border-slate-200/80 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderKanban className="h-4 w-4 text-blue-600" />
          Assigned Projects
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[320px] space-y-3 overflow-y-auto p-3">
        {projectCards.length ? (
          projectCards.map((project) => (
            <button
              key={project._id}
              className="w-full rounded-[20px] border border-slate-200/80 bg-white/76 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-md"
              type="button"
              onClick={() => onOpenProject(project._id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {project.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {project.active} active - {project.completed} completed
                  </p>
                </div>
                <span
                  className={cn(
                    "mt-0.5 h-2.5 w-2.5 rounded-full",
                    project.critical ? "bg-rose-500" : project.active ? "bg-blue-500" : "bg-emerald-500"
                  )}
                />
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#2563EB_0%,#10B981_100%)]"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>{project.progress}% progress</span>
                {project.critical ? (
                  <span className="text-rose-600">{project.critical} critical</span>
                ) : (
                  <span>On track</span>
                )}
              </div>
            </button>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            No assigned projects yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const PriorityQueue = ({
  issues,
  onOpenIssue,
  onStatusChange,
  updatingId,
  onClose,
}) => {
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [queueSort, setQueueSort] = useState("critical");
  const queue = useMemo(() => {
    const activeIssues = issues.filter((issue) => !isIssueClosed(issue));
    const filteredIssues = activeIssues.filter((issue) => {
      if (priorityFilter === "all") {
        return true;
      }

      if (priorityFilter === "critical") {
        return isCriticalIssue(issue);
      }

      if (priorityFilter === "overdue") {
        return getSlaInfo(issue).urgent;
      }

      return issue.priority === priorityFilter;
    });

    if (queueSort === "due") {
      return [...filteredIssues].sort((left, right) => {
        const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;

        return leftDue - rightDue;
      });
    }

    if (queueSort === "updated") {
      return [...filteredIssues].sort(
        (left, right) =>
          new Date(getLastUpdated(right) || 0) - new Date(getLastUpdated(left) || 0)
      );
    }

    return sortPriorityQueue(filteredIssues);
  }, [issues, priorityFilter, queueSort]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Filter
          </span>
          <select
            className="field-select rounded-2xl"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          >
            <option value="all">All active</option>
            <option value="critical">Critical only</option>
            <option value="High">High priority</option>
            <option value="Medium">Medium priority</option>
            <option value="Low">Low priority</option>
            <option value="overdue">Due / SLA risk</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Sort
          </span>
          <select
            className="field-select rounded-2xl"
            value={queueSort}
            onChange={(event) => setQueueSort(event.target.value)}
          >
            <option value="critical">Critical first</option>
            <option value="due">Due date</option>
            <option value="updated">Recently updated</option>
          </select>
        </label>
      </div>

      {queue.length ? (
        <div className="max-h-[62vh] space-y-3 overflow-y-auto pr-1">
          {queue.map((issue) => {
            const severity = getBugSeverity(issue);
            const sla = getSlaInfo(issue);
            const nextAction = isBugIssue(issue) ? getNextBugAction(issue) : null;
            const critical = isCriticalIssue(issue);

            return (
              <article
                key={issue._id}
                className={cn(
                  "grid gap-3 rounded-[22px] border bg-white/82 p-3 shadow-sm transition hover:border-blue-200 hover:bg-white lg:grid-cols-[minmax(0,1.5fr)_120px_110px_150px_130px_auto] lg:items-center",
                  critical
                    ? "border-rose-200 ring-2 ring-rose-100"
                    : "border-slate-200/80"
                )}
              >
                <button
                  className="min-w-0 text-left"
                  type="button"
                  onClick={() => {
                    onOpenIssue(issue);
                    onClose?.();
                  }}
                >
                  <p className="font-mono text-xs font-semibold text-slate-500">
                    {getIssueDisplayKey(issue)}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-950" title={issue.title}>
                    {issue.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {getProjectName(issue)}
                  </p>
                </button>

                <Pill className={getBadgeClass(priorityStyleMap, issue.priority)}>
                  {issue.priority || "Medium"}
                </Pill>
                <Pill className={getBadgeClass(severityStyleMap, severity)}>
                  {severity}
                </Pill>
                <span className="truncate text-sm text-slate-600" title={getAssigneeName(issue)}>
                  {getAssigneeName(issue)}
                </span>
                <Pill
                  className={
                    sla.urgent
                      ? "border-orange-200 bg-orange-50 text-orange-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }
                >
                  {sla.label}
                </Pill>
                <div className="flex justify-start gap-2 lg:justify-end">
                  {nextAction ? (
                    <Button
                      className="h-9 rounded-xl px-3 text-xs"
                      disabled={updatingId === issue._id}
                      type="button"
                      onClick={() => onStatusChange(issue, nextAction.status)}
                    >
                      {updatingId === issue._id ? "Updating" : nextAction.label}
                    </Button>
                  ) : null}
                  <Button
                    className="h-9 rounded-xl px-3 text-xs"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onOpenIssue(issue);
                      onClose?.();
                    }}
                  >
                    Open
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Priority queue clear"
          description="No active assigned work matches the current filter."
        />
      )}
    </div>
  );
};

const ActivityList = ({ activity, compact = false, fallbackIssues = [], onOpenIssue }) => {
  const fallbackActivity = useMemo(
    () =>
      fallbackIssues.slice(0, compact ? 4 : 8).map((issue) => ({
        _id: `issue-${issue._id}`,
        createdAt: getLastUpdated(issue),
        issue: {
          _id: issue._id,
          title: issue.title,
          type: issue.type,
          status: issue.status,
          project: issue.projectId,
        },
        eventType: "ISSUE_UPDATED",
        actor: null,
      })),
    [compact, fallbackIssues]
  );
  const entries = activity.length ? activity.slice(0, compact ? 4 : 8) : fallbackActivity;

  if (!entries.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        No recent activity yet.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {entries.map((entry) => {
        const issue = entry.issue;

        return (
          <button
            key={entry._id}
            className="flex w-full gap-3 rounded-2xl border border-slate-200/80 bg-white/76 p-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-white"
            type="button"
            onClick={() => issue?._id && onOpenIssue(issue._id)}
          >
            <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
              <Activity className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">
                {entry.actor?.name || "System"} {activityText(entry)}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {issue?.title || entry.meta?.title || "Work item"} -{" "}
                {entry.createdAt ? formatDateTime(entry.createdAt) : "Recently"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

const WorkTable = ({
  issues,
  type,
  onOpenIssue,
  onStatusChange,
  updatingId,
}) => {
  if (!issues.length) {
    return (
      <EmptyState
        title={type === "bugs" ? "No bugs match this view" : "No tasks match this view"}
        description="Adjust filters or switch tabs to review another part of your queue."
        icon={type === "bugs" ? <Bug className="h-5 w-5" /> : <ListTodo className="h-5 w-5" />}
      />
    );
  }

  return (
    <>
      <div className="grid gap-3 xl:hidden">
        {issues.map((issue) => {
          const severity = getBugSeverity(issue);
          const currentBugStatus = normalizeBugStatusForIssue(issue);
          const bugOptions = developerBugTransitions[currentBugStatus] || [];
          const nextAction = getNextBugAction(issue);

          return (
            <article
              key={issue._id}
              className="rounded-[22px] border border-slate-200/80 bg-white/78 p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  className="min-w-0 flex-1 text-left"
                  type="button"
                  onClick={() => onOpenIssue(issue)}
                >
                  <p className="font-mono text-xs font-semibold text-slate-500">
                    {getIssueDisplayKey(issue)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-950">
                    {issue.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {getProjectName(issue)}
                  </p>
                </button>
                <Pill className={getBadgeClass(statusStyleMap, issue.status)}>
                  {getStatusLabel(issue)}
                </Pill>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Pill className={getBadgeClass(priorityStyleMap, issue.priority)}>
                  {issue.priority || "Medium"}
                </Pill>
                {type === "bugs" ? (
                  <Pill className={getBadgeClass(severityStyleMap, severity)}>
                    {severity}
                  </Pill>
                ) : null}
                <Pill className="border-slate-200 bg-slate-50 text-slate-600">
                  {getTeamName(issue)}
                </Pill>
                <Pill className="border-slate-200 bg-slate-50 text-slate-600">
                  {getAssigneeName(issue)}
                </Pill>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  Updated {getLastUpdated(issue) ? formatDateTime(getLastUpdated(issue)) : "Unknown"}
                </span>
                <div className="flex items-center gap-2">
                  {type === "bugs" ? (
                    <select
                      aria-label={`Update ${getIssueDisplayKey(issue)} status`}
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20"
                      disabled={!bugOptions.length || updatingId === issue._id}
                      value=""
                      onChange={(event) => {
                        if (event.target.value) {
                          onStatusChange(issue, event.target.value);
                        }
                      }}
                    >
                      <option value="">
                        {bugOptions.length ? "Move" : "Awaiting QA"}
                      </option>
                      {bugOptions.map((status) => (
                        <option key={status} value={status}>
                          {bugWorkflowLabels[status] || getIssueStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      aria-label={`Update ${getIssueDisplayKey(issue)} status`}
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20"
                      disabled={updatingId === issue._id}
                      value={issue.status}
                      onChange={(event) => onStatusChange(issue, event.target.value)}
                    >
                      {taskStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <Button
                    className="h-9 rounded-xl px-3 text-xs"
                    type="button"
                    variant="outline"
                    onClick={() => onOpenIssue(issue)}
                  >
                    Open
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden max-h-[640px] overflow-y-auto overflow-x-hidden rounded-[24px] border border-slate-200/80 bg-white/70 xl:block">
        <table className="w-full table-fixed text-left text-[12px]">
          <colgroup>
            <col className={type === "bugs" ? "w-[7%]" : "w-[8%]"} />
            <col className={type === "bugs" ? "w-[19%]" : "w-[24%]"} />
            <col className={type === "bugs" ? "w-[7%]" : "w-[9%]"} />
            {type === "bugs" ? <col className="w-[7%]" /> : null}
            <col className={type === "bugs" ? "w-[8%]" : "w-[10%]"} />
            <col className={type === "bugs" ? "w-[9%]" : "w-[11%]"} />
            <col className={type === "bugs" ? "w-[9%]" : "w-[11%]"} />
            {type === "bugs" ? <col className="w-[9%]" /> : null}
            <col className={type === "bugs" ? "w-[7%]" : "w-[9%]"} />
            <col className={type === "bugs" ? "w-[9%]" : "w-[10%]"} />
            <col className={type === "bugs" ? "w-[9%]" : "w-[8%]"} />
          </colgroup>
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 backdrop-blur">
          <tr>
            <th className="px-2 py-3">{type === "bugs" ? "Bug ID" : "ID"}</th>
            <th className="px-2 py-3">{type === "bugs" ? "Bug Title" : "Title"}</th>
            <th className="px-2 py-3">Priority</th>
            {type === "bugs" ? <th className="px-2 py-3">Severity</th> : null}
            <th className="px-2 py-3">Status</th>
            <th className="px-2 py-3">Team</th>
            <th className="px-2 py-3">Assigned</th>
            {type === "bugs" ? <th className="px-2 py-3">Reporter</th> : null}
            <th className="px-2 py-3">Created</th>
            <th className="px-2 py-3">Updated</th>
            <th className="px-2 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/80">
          {issues.map((issue) => {
            const severity = getBugSeverity(issue);
            const currentBugStatus = normalizeBugStatusForIssue(issue);
            const bugOptions = developerBugTransitions[currentBugStatus] || [];
            const nextAction = getNextBugAction(issue);

            return (
              <tr
                key={issue._id}
                className="bg-white/58 transition hover:bg-blue-50/42"
              >
                <td className="truncate px-2 py-2.5 font-mono text-[11px] font-semibold text-slate-500" title={getIssueDisplayKey(issue)}>
                  {getIssueDisplayKey(issue)}
                </td>
                <td className="px-2 py-2.5">
                  <button
                    className="block max-w-full truncate text-left font-semibold text-slate-950 hover:text-blue-700"
                    type="button"
                    title={issue.title}
                    onClick={() => onOpenIssue(issue)}
                  >
                    {issue.title}
                  </button>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500" title={getProjectName(issue)}>
                    {getProjectName(issue)}
                  </p>
                </td>
                <td className="px-2 py-2.5">
                  <Pill className={getBadgeClass(priorityStyleMap, issue.priority)}>
                    {issue.priority || "Medium"}
                  </Pill>
                </td>
                {type === "bugs" ? (
                  <td className="px-2 py-2.5">
                    <Pill className={getBadgeClass(severityStyleMap, severity)}>
                      {severity}
                    </Pill>
                  </td>
                ) : null}
                <td className="px-2 py-2.5">
                  <Pill className={getBadgeClass(statusStyleMap, issue.status)}>
                    {getStatusLabel(issue)}
                  </Pill>
                </td>
                <td className="px-2 py-2.5">
                  <span className="block truncate text-slate-600" title={getTeamName(issue)}>
                    {getTeamName(issue)}
                  </span>
                </td>
                <td className="px-2 py-2.5">
                  <span className="block truncate text-slate-700" title={getAssigneeName(issue)}>
                    {getAssigneeName(issue)}
                  </span>
                </td>
                {type === "bugs" ? (
                  <td className="px-2 py-2.5">
                    <span className="block truncate text-slate-600" title={getReporterName(issue)}>
                      {getReporterName(issue)}
                    </span>
                  </td>
                ) : null}
                <td className="truncate px-2 py-2.5 text-slate-500" title={issue.createdAt ? formatDate(issue.createdAt) : "Unknown"}>
                  {issue.createdAt ? formatDate(issue.createdAt) : "Unknown"}
                </td>
                <td className="truncate px-2 py-2.5 text-slate-500" title={getLastUpdated(issue) ? formatDateTime(getLastUpdated(issue)) : "Unknown"}>
                  {getLastUpdated(issue) ? formatDateTime(getLastUpdated(issue)) : "Unknown"}
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {type === "bugs" ? (
                      <select
                        aria-label={`Update ${getIssueDisplayKey(issue)} status`}
                        className="h-8 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20"
                        disabled={!bugOptions.length || updatingId === issue._id}
                        value=""
                        onChange={(event) => {
                          if (event.target.value) {
                            onStatusChange(issue, event.target.value);
                          }
                        }}
                      >
                        <option value="">
                          {bugOptions.length ? "Move status" : "Awaiting QA"}
                        </option>
                        {bugOptions.map((status) => (
                          <option key={status} value={status}>
                            {bugWorkflowLabels[status] || getIssueStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        aria-label={`Update ${getIssueDisplayKey(issue)} status`}
                        className="h-8 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20"
                        disabled={updatingId === issue._id}
                        value={issue.status}
                        onChange={(event) => onStatusChange(issue, event.target.value)}
                      >
                        {taskStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {nextAction ? (
                      <Button
                        className="hidden h-8 rounded-xl px-2 text-[11px] 2xl:inline-flex"
                        disabled={updatingId === issue._id}
                        type="button"
                        onClick={() => onStatusChange(issue, nextAction.status)}
                      >
                        {updatingId === issue._id ? "Syncing" : nextAction.label}
                      </Button>
                    ) : null}
                    <Button
                      className="h-8 shrink-0 rounded-xl px-2 text-[11px]"
                      type="button"
                      variant="outline"
                      onClick={() => onOpenIssue(issue)}
                    >
                      Open
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
};

const DeveloperDashboardPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("bugs");
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const deferredSearch = useDeferredValue(filters.search);
  const myIssuesQueryKey = useMemo(
    () => ["issues", "my", user?._id, "developer-dashboard"],
    [user?._id]
  );

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
    refetch: refetchIssues,
    isFetching: isIssuesFetching,
  } = useQuery({
    queryKey: myIssuesQueryKey,
    queryFn: () => fetchMyIssues({ limit: 200, sortBy: "recently-updated" }),
    enabled: Boolean(user?._id),
  });

  const {
    data: activity = [],
    isLoading: isActivityLoading,
  } = useQuery({
    queryKey: ["issues", "activity", "developer-dashboard", user?._id],
    queryFn: () => fetchIssueActivity({ limit: 12, sortBy: "recently-updated" }),
    enabled: Boolean(user?._id),
  });

  const allIssues = useMemo(() => (Array.isArray(issues) ? issues : []), [issues]);
  const bugIssues = useMemo(
    () => allIssues.filter((issue) => isBugIssue(issue)),
    [allIssues]
  );
  const taskIssues = useMemo(
    () => allIssues.filter((issue) => !isBugIssue(issue)),
    [allIssues]
  );

  useEffect(() => {
    if (!selectedIssue) {
      return;
    }

    const nextIssue = allIssues.find((issue) => issue._id === selectedIssue._id);
    setSelectedIssue(nextIssue || selectedIssue);
  }, [allIssues, selectedIssue]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status, payload }) =>
      updateIssue({
        id,
        payload: payload || { status },
      }),
    onMutate: async ({ id, status }) => {
      setStatusError("");

      if (!status) {
        return {};
      }

      await queryClient.cancelQueries({ queryKey: myIssuesQueryKey });
      const previousIssues = queryClient.getQueryData(myIssuesQueryKey);
      const optimisticUpdatedAt = new Date().toISOString();

      queryClient.setQueryData(myIssuesQueryKey, (current = []) =>
        Array.isArray(current)
          ? current.map((issue) =>
              issue._id === id
                ? {
                    ...issue,
                    status,
                    updatedAt: optimisticUpdatedAt,
                  }
                : issue
            )
          : current
      );
      setSelectedIssue((current) =>
        current?._id === id
          ? {
              ...current,
              status,
              updatedAt: optimisticUpdatedAt,
            }
          : current
      );

      return { previousIssues };
    },
    onError: (error, _variables, context) => {
      if (context?.previousIssues) {
        queryClient.setQueryData(myIssuesQueryKey, context.previousIssues);
      }

      setStatusError(
        error.response?.data?.message || "Unable to update status right now."
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  const stats = useMemo(() => getIssueStatusMetrics(allIssues), [allIssues]);
  const normalizedFilters = useMemo(
    () => ({
      ...filters,
      search: deferredSearch,
    }),
    [deferredSearch, filters]
  );
  const activeIssues = activeTab === "bugs" ? bugIssues : taskIssues;
  const visibleIssues = useMemo(
    () => sortIssues(filterIssues(activeIssues, normalizedFilters), normalizedFilters.sortBy),
    [activeIssues, normalizedFilters]
  );
  const recentlyUpdatedIssues = useMemo(
    () =>
      [...allIssues]
        .sort(
          (left, right) =>
            new Date(getLastUpdated(right) || 0) - new Date(getLastUpdated(left) || 0)
        )
        .slice(0, 8),
    [allIssues]
  );
  const statCards = useMemo(
    () => [
      {
        label: "Total",
        value: stats.total,
        helper: `${bugIssues.length} bugs - ${taskIssues.length} tasks`,
        Icon: CircleDotDashed,
        className: "bg-blue-500",
      },
      {
        label: "Open",
        value: stats.open,
        helper: "Ready or waiting",
        Icon: AlertTriangle,
        className: "bg-orange-500",
      },
      {
        label: "In Progress",
        value: stats.inProgress,
        helper: "Currently moving",
        Icon: TimerReset,
        className: "bg-violet-500",
      },
      {
        label: "Closed",
        value: stats.closed,
        helper: "Completed work",
        Icon: CheckCircle2,
        className: "bg-emerald-500",
      },
    ],
    [bugIssues.length, stats.closed, stats.inProgress, stats.open, stats.total, taskIssues.length]
  );
  const activeStatusLabel = activeTab === "bugs" ? "Bugs / Issues" : "Tasks";
  const error = projectsError || issuesError;
  const isLoading = isProjectsLoading || isIssuesLoading;

  const handleStatusChange = (issue, status) => {
    if (!status || String(issue.status) === String(status)) {
      return;
    }

    statusMutation.mutate({
      id: issue._id,
      status,
    });
  };

  const handleOpenProject = (projectId) => {
    navigate(`/issues?projectId=${projectId}`);
  };

  const handleOpenActivityIssue = (issueId) => {
    const issue = allIssues.find((item) => item._id === issueId);

    if (issue) {
      setSelectedIssue(issue);
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-rose-700">
          {error.response?.data?.message || "Unable to load developer dashboard data."}
        </CardContent>
      </Card>
    );
  }

  if (!isProjectsLoading && !projects.length) {
    return (
      <EmptyState
        title="No assigned projects yet"
        description="Once an admin adds you to a project, your delivery dashboard will appear here."
      />
    );
  }

  return (
    <div className="page-wrapper space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }, (_, index) => (
              <Skeleton
                key={`developer-stat-${index}`}
                className="h-[132px] w-full rounded-[24px]"
              />
            ))
          : statCards.map((card) => <StatCard key={card.label} {...card} />)}
      </section>

      <section className="flex flex-wrap gap-3 rounded-[26px] border border-white/70 bg-white/78 p-3 shadow-sm backdrop-blur-xl">
        <Button
          className="h-11 rounded-2xl"
          type="button"
          variant="outline"
          onClick={() =>
            setStatusError("Developers can update assigned work here. Issue creation remains restricted by workspace permissions.")
          }
        >
          <Plus className="h-4 w-4" />
          Create Issue
        </Button>
        <Button
          className="h-11 rounded-2xl"
          type="button"
          variant="outline"
          onClick={() => navigate("/tasks")}
        >
          <ClipboardList className="h-4 w-4" />
          View Tasks
        </Button>
        <Button
          className="h-11 rounded-2xl"
          type="button"
          variant="outline"
          onClick={() => navigate("/reports")}
        >
          <BarChart3 className="h-4 w-4" />
          Reports
        </Button>
        <Button
          className="h-11 rounded-2xl bg-[linear-gradient(90deg,#E11D48_0%,#F97316_55%,#EAB308_100%)] text-white shadow-[0_14px_28px_-18px_rgba(225,29,72,0.8)] hover:brightness-105"
          type="button"
          onClick={() => setIsPriorityOpen(true)}
        >
          <Flame className="h-4 w-4" />
          Priority Queue
        </Button>
        <Button
          className="ml-auto h-11 w-11 rounded-2xl p-0"
          disabled={isIssuesFetching}
          type="button"
          variant="outline"
          onClick={() => refetchIssues()}
        >
          <RefreshCcw className={cn("h-4 w-4", isIssuesFetching && "animate-spin")} />
        </Button>
      </section>

      <section className="space-y-5">
          <Card className="overflow-hidden border-white/70 bg-white/90 shadow-[0_22px_64px_-42px_rgba(15,23,42,0.42)] backdrop-blur-xl">
            <CardHeader className="border-b border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(239,246,255,0.9),rgba(240,253,250,0.78))]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-xl tracking-tight text-slate-950">
                    Work Overview
                  </CardTitle>
                  <CardDescription>
                    {visibleIssues.length} {activeStatusLabel.toLowerCase()} in the current view
                  </CardDescription>
                </div>

                <div className="grid grid-cols-2 gap-1 rounded-[22px] border border-white/80 bg-slate-100/80 p-1 shadow-inner sm:w-auto">
                  {TABS.map(({ id, label, Icon }) => {
                    const active = activeTab === id;

                    return (
                      <button
                        key={id}
                        className={cn(
                          "inline-flex h-11 items-center justify-center gap-2 rounded-[18px] px-4 text-sm font-semibold transition-all duration-300",
                          active
                            ? "bg-[linear-gradient(90deg,#2563EB_0%,#7C3AED_55%,#0891B2_100%)] text-white shadow-[0_14px_28px_-18px_rgba(37,99,235,0.8)]"
                            : "text-slate-600 hover:bg-white/80 hover:text-slate-950"
                        )}
                        type="button"
                        onClick={() => {
                          setActiveTab(id);
                          setFilters((current) => ({
                            ...current,
                            status: "all",
                          }));
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="grid gap-3 lg:grid-cols-[minmax(240px,1.3fr)_repeat(4,minmax(140px,0.8fr))]">
                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Search
                  </span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="h-11 rounded-2xl border-slate-200 bg-white/92 pl-10 shadow-sm"
                      placeholder={`Search ${activeStatusLabel.toLowerCase()}`}
                      value={filters.search}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          search: event.target.value,
                        }))
                      }
                    />
                  </div>
                </label>

                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Project
                  </span>
                  <select
                    className="field-select rounded-2xl"
                    value={filters.projectId}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        projectId: event.target.value,
                      }))
                    }
                  >
                    <option value="all">All projects</option>
                    {projects.map((project) => (
                      <option key={project._id} value={project._id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Status
                  </span>
                  <select
                    className="field-select rounded-2xl"
                    value={filters.status}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                  >
                    {[
                      ...(activeTab === "bugs"
                        ? [{ value: "all", label: "All" }, ...BUG_STATUS_OPTIONS]
                        : ISSUE_STATUS_OPTIONS),
                    ].map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Priority
                  </span>
                  <select
                    className="field-select rounded-2xl"
                    value={filters.priority}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        priority: event.target.value,
                      }))
                    }
                  >
                    <option value="all">All priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Sort
                  </span>
                  <div className="relative">
                    <ArrowUpDown className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      className="field-select rounded-2xl pl-10"
                      value={filters.sortBy}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          sortBy: event.target.value,
                        }))
                      }
                    >
                      {ISSUE_SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
              </div>

              {statusError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {statusError}
                </div>
              ) : null}

              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full rounded-2xl" />
                  <Skeleton className="h-64 w-full rounded-[24px]" />
                </div>
              ) : (
                <WorkTable
                  issues={visibleIssues}
                  type={activeTab}
                  updatingId={statusMutation.isPending ? statusMutation.variables?.id : ""}
                  onOpenIssue={setSelectedIssue}
                  onStatusChange={handleStatusChange}
                />
              )}
            </CardContent>
          </Card>

          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <ProjectPanel
              projects={projects}
              issues={allIssues}
              onOpenProject={handleOpenProject}
            />

            <Card className="h-full border-white/70 bg-white/88 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.36)] backdrop-blur-xl">
              <CardHeader className="border-b border-slate-200/80">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-blue-600" />
                  Activity Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[320px] overflow-y-auto p-4">
                {isActivityLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full rounded-2xl" />
                    <Skeleton className="h-16 w-full rounded-2xl" />
                    <Skeleton className="h-16 w-full rounded-2xl" />
                  </div>
                ) : (
                  <ActivityList
                    activity={activity}
                    fallbackIssues={recentlyUpdatedIssues}
                    onOpenIssue={handleOpenActivityIssue}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="h-full border-white/70 bg-white/88 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.36)] backdrop-blur-xl md:col-span-2 xl:col-span-1">
              <CardHeader className="border-b border-slate-200/80">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-4 w-4 text-cyan-600" />
                  Recently Updated Issues
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[320px] space-y-3 overflow-y-auto p-4">
                {recentlyUpdatedIssues.length ? (
                  recentlyUpdatedIssues.map((issue) => (
                    <button
                      key={issue._id}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/76 px-3 py-2.5 text-left shadow-sm transition hover:border-blue-200 hover:bg-white"
                      type="button"
                      onClick={() => setSelectedIssue(issue)}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {issue.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {getIssueDisplayKey(issue)} - {formatDateTime(getLastUpdated(issue))}
                        </p>
                      </div>
                      <Pill className={getBadgeClass(statusStyleMap, issue.status)}>
                        {getStatusLabel(issue)}
                      </Pill>
                    </button>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    No recently updated issues yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
      </section>

      <Dialog open={isPriorityOpen} onOpenChange={setIsPriorityOpen}>
        <DialogContent className="max-w-6xl border-white/70 bg-white/95 p-5 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.5)] backdrop-blur-xl sm:p-6">
          <DialogHeader className="pr-10">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Flame className="h-5 w-5 text-rose-600" />
              Priority Queue
            </DialogTitle>
          </DialogHeader>
          <PriorityQueue
            issues={allIssues}
            updatingId={statusMutation.isPending ? statusMutation.variables?.id : ""}
            onClose={() => setIsPriorityOpen(false)}
            onOpenIssue={setSelectedIssue}
            onStatusChange={handleStatusChange}
          />
        </DialogContent>
      </Dialog>

      <IssueDetailsDialog
        deletingId=""
        issue={selectedIssue}
        onDeleteIssue={async () => {}}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedIssue(null);
          }
        }}
        onUpdateIssue={(id, payload) =>
          statusMutation.mutateAsync({
            id,
            status: payload.status,
            payload,
          })
        }
        open={Boolean(selectedIssue)}
        projects={projects}
        updatingId={statusMutation.isPending ? statusMutation.variables?.id : ""}
        canEditPriority={false}
        canEditAssignee={false}
        canDeleteIssue={false}
      />
    </div>
  );
};

export default DeveloperDashboardPage;
