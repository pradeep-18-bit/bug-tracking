import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  BarChart3,
  ClipboardList,
  Plus,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  createIssue,
  fetchIssues,
  fetchMyIssues,
  fetchProjects,
  updateIssue,
} from "@/lib/api";
import {
  createIssueListFilters,
  filterIssues,
  getIssuePriorityVariant,
  getIssueStatusLabel,
  getIssueStatusMetrics,
  getIssueStatusVariant,
  ISSUE_SORT_OPTIONS,
  ISSUE_STATUS_OPTIONS,
  isIssueClosed,
  normalizeIssueStatus,
  sortIssues,
} from "@/lib/issues";
import { cn, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import IssueCreateDialog from "@/components/issues/IssueCreateDialog";
import IssueDetailsDialog from "@/components/issues/IssueDetailsDialog";
import EmptyState from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
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

const defaultFilters = createIssueListFilters({
  assigneeId: "all",
  sortBy: "priority",
});

const getPriorityKey = (priority = "Medium") => String(priority).trim().toLowerCase();
const formatDueDate = (value) => (value ? formatDateTime(value) : "No due date");

const tableSelectClassName =
  "field-select h-9 min-w-[144px] rounded-xl border-slate-200 bg-white px-3 py-1 text-xs shadow-none";

const DeveloperDashboardPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const deferredSearch = useDeferredValue(filters.search);

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
    queryKey: ["issues", "my", user?._id, "developer-dashboard"],
    queryFn: () => fetchMyIssues(),
    enabled: Boolean(user?._id),
  });

  const { data: availableIssues = [] } = useQuery({
    queryKey: ["issues", "developer-dashboard", "create-options"],
    queryFn: () => fetchIssues(),
    enabled: Boolean(user?._id) && isCreateDialogOpen,
  });

  useEffect(() => {
    if (!selectedIssue) {
      return;
    }

    const nextIssue = issues.find((issue) => issue._id === selectedIssue._id);
    setSelectedIssue(nextIssue || null);
  }, [issues, selectedIssue]);

  const updateIssueMutation = useMutation({
    mutationFn: updateIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  const createIssueMutation = useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  const stats = useMemo(() => getIssueStatusMetrics(issues), [issues]);

  const normalizedFilters = useMemo(
    () => ({
      ...filters,
      search: deferredSearch,
    }),
    [deferredSearch, filters]
  );

  const visibleIssues = useMemo(
    () => sortIssues(filterIssues(issues, normalizedFilters), normalizedFilters.sortBy),
    [issues, normalizedFilters]
  );

  const priorityQueue = useMemo(
    () => sortIssues(issues.filter((issue) => !isIssueClosed(issue)), "priority").slice(0, 4),
    [issues]
  );

  const summaryCards = useMemo(
    () => [
      {
        key: "total",
        label: "Total",
        value: stats.total,
        helper: `${projects.length} accessible projects`,
        icon: "\uD83D\uDCCA",
        className: "total-card",
      },
      {
        key: "open",
        label: "Open",
        value: stats.open,
        helper: "Ready to pick up",
        icon: "\uD83D\uDCC2",
        className: "open-card",
      },
      {
        key: "progress",
        label: "In Progress",
        value: stats.inProgress,
        helper: "Currently moving",
        icon: "\u26A1",
        className: "progress-card",
      },
      {
        key: "closed",
        label: "Closed",
        value: stats.closed,
        helper: "Wrapped and shipped",
        icon: "\u2705",
        className: "closed-card",
      },
    ],
    [projects.length, stats.closed, stats.inProgress, stats.open, stats.total]
  );

  const error = projectsError || issuesError;
  const isLoading = isProjectsLoading || isIssuesLoading;

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
        description="Once an admin adds you to a project, your delivery dashboard will light up here."
      />
    );
  }

  return (
    <div className="page-wrapper space-y-5">
      <section className="dashboard-summary-grid">
        {isLoading
          ? Array.from({ length: 4 }, (_, index) => (
              <Skeleton
                key={`summary-skeleton-${index}`}
                className="h-[136px] w-full rounded-[20px]"
              />
            ))
          : summaryCards.map((card) => (
              <article
                key={card.key}
                className={cn("dashboard-summary-card", card.className)}
              >
                <div className="dashboard-summary-icon" aria-hidden="true">
                  {card.icon}
                </div>
                <p className="dashboard-summary-label">{card.label}</p>
                <p className="dashboard-summary-value">{card.value}</p>
                <p className="dashboard-summary-helper">{card.helper}</p>
              </article>
            ))}
      </section>

      <section className="quick-actions">
        <button
          className="quick-action-button"
          type="button"
          onClick={() => setIsCreateDialogOpen(true)}
          disabled={!projects.length}
        >
          <Plus className="h-4 w-4" />
          <span>Create Issue</span>
        </button>
        <button
          className="quick-action-button"
          type="button"
          onClick={() => navigate("/tasks")}
        >
          <ClipboardList className="h-4 w-4" />
          <span>View Tasks</span>
        </button>
        <button
          className="quick-action-button"
          type="button"
          onClick={() => navigate("/reports")}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Reports</span>
        </button>
      </section>

      <section className="dashboard-container">
        <div className="left-content">
          <Card className="overflow-hidden border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
            <CardHeader className="border-b border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(239,246,255,0.92),rgba(238,242,255,0.88))]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Assigned Tasks</CardTitle>
                  <CardDescription>
                    Your previous My Work view now lives here in one compact dashboard.
                  </CardDescription>
                </div>
                <Badge className="rounded-full border border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-50">
                  {visibleIssues.length} in view
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="dashboard-toolbar">
                <div className="dashboard-toolbar-grid">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                      Search
                    </span>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        className="pl-11"
                        placeholder="Search assigned tasks"
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

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                      Project
                    </span>
                    <select
                      className="field-select"
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

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                      Status
                    </span>
                    <select
                      className="field-select"
                      value={filters.status}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                    >
                      {ISSUE_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                      Priority
                    </span>
                    <select
                      className="field-select"
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

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                      Sort
                    </span>
                    <div className="relative">
                      <ArrowUpDown className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <select
                        className="field-select pl-11"
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

                <div className="flex flex-wrap items-end gap-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setFilters(defaultFilters)}
                  >
                    Reset
                  </Button>
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-[16px]" />
                  <Skeleton className="h-16 w-full rounded-[16px]" />
                  <Skeleton className="h-16 w-full rounded-[16px]" />
                  <Skeleton className="h-16 w-full rounded-[16px]" />
                </div>
              ) : visibleIssues.length ? (
                <div className="issue-table issue-table-fixed rounded-[18px] border border-slate-200/80 bg-white">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/95 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        <th className="px-4 py-3 font-semibold">Task</th>
                        <th className="px-4 py-3 font-semibold">Project</th>
                        <th className="px-4 py-3 font-semibold">Priority</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Due</th>
                        <th className="px-4 py-3 font-semibold">Created</th>
                        <th className="px-4 py-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleIssues.map((issue) => (
                        <tr
                          key={issue._id}
                          className="dashboard-task-row"
                          onClick={() => setSelectedIssue(issue)}
                        >
                          <td className="px-4 py-3 align-top">
                            <div className="min-w-0">
                              <button
                                className="max-w-full text-left"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedIssue(issue);
                                }}
                              >
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {issue.title}
                                </p>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                  {issue.description || "No description provided."}
                                </p>
                              </button>
                            </div>
                          </td>

                          <td className="px-4 py-3 align-top">
                            <div className="space-y-1 text-sm text-slate-700">
                              <p className="font-medium text-slate-900">
                                {issue.projectId?.name || "Unknown project"}
                              </p>
                              <p className="text-xs text-slate-500">
                                #{issue._id.slice(-6)}
                              </p>
                            </div>
                          </td>

                          <td className="px-4 py-3 align-top">
                            <Badge
                              variant={getIssuePriorityVariant(issue.priority)}
                              className="shadow-sm"
                            >
                              {issue.priority}
                            </Badge>
                          </td>

                          <td className="px-4 py-3 align-top">
                            <div className="space-y-2">
                              <Badge
                                variant={getIssueStatusVariant(issue.status)}
                                className="shadow-sm"
                              >
                                {getIssueStatusLabel(issue.status)}
                              </Badge>
                              <select
                                className={tableSelectClassName}
                                value={normalizeIssueStatus(issue.status)}
                                disabled={updateIssueMutation.isPending}
                                onChange={(event) =>
                                  updateIssueMutation.mutateAsync({
                                    id: issue._id,
                                    payload: { status: event.target.value },
                                  })
                                }
                                onClick={(event) => event.stopPropagation()}
                              >
                                {ISSUE_STATUS_OPTIONS.filter(
                                  (option) => option.value !== "all"
                                ).map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          <td className="px-4 py-3 align-top text-sm text-slate-600">
                            {formatDueDate(issue.dueAt)}
                          </td>

                          <td className="px-4 py-3 align-top text-sm text-slate-600">
                            {formatDateTime(issue.createdAt)}
                          </td>

                          <td className="px-4 py-3 align-top">
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedIssue(issue);
                              }}
                            >
                              Open
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No tasks match these filters"
                  description="Reset one or more filters to bring your assigned work back into view."
                />
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="right-panel">
          <Card className="overflow-hidden border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
            <CardHeader className="border-b border-slate-200/80">
              <CardTitle>Priority Queue</CardTitle>
              <CardDescription>
                Sticky focus list for the highest-impact items in your queue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {isLoading ? (
                <div className="priority-queue">
                  <Skeleton className="h-24 w-full rounded-[16px]" />
                  <Skeleton className="h-24 w-full rounded-[16px]" />
                  <Skeleton className="h-24 w-full rounded-[16px]" />
                </div>
              ) : priorityQueue.length ? (
                <div className="priority-queue">
                  {priorityQueue.map((issue) => {
                    const priorityKey = getPriorityKey(issue.priority);

                    return (
                      <button
                        key={issue._id}
                        className={cn("priority-card", priorityKey)}
                        type="button"
                        onClick={() => setSelectedIssue(issue)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cn("priority-badge", priorityKey)}>
                                {issue.priority}
                              </span>
                              <span className="rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
                                {getIssueStatusLabel(issue.status)}
                              </span>
                            </div>
                            <h4 className="mt-3 truncate">{issue.title}</h4>
                            <p className="mt-2 line-clamp-2">
                              {issue.description || "No description provided yet."}
                            </p>
                          </div>

                          <span className="shrink-0 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                            #{issue._id.slice(-6)}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
                          <span className="rounded-full bg-white/70 px-3 py-1.5 shadow-sm">
                            {issue.projectId?.name || "Unknown project"}
                          </span>
                          {issue.teamId?.name ? (
                            <span className="rounded-full bg-white/60 px-3 py-1.5 shadow-sm">
                              {issue.teamId.name}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No priority issues"
                  description="You do not have any active assigned work in the priority queue."
                />
              )}
            </CardContent>
          </Card>
        </aside>
      </section>

      <IssueCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        projects={projects}
        availableIssues={availableIssues}
        defaultProjectId={filters.projectId}
        defaultType="Task"
        isPending={createIssueMutation.isPending}
        onSubmit={async (payload) => {
          await createIssueMutation.mutateAsync({
            ...payload,
            assigneeId: payload.assigneeId || user?._id || null,
          });
        }}
      />

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
          updateIssueMutation.mutateAsync({ id, payload })
        }
        open={Boolean(selectedIssue)}
        projects={projects}
        availableIssues={availableIssues}
        updatingId={updateIssueMutation.isPending ? updateIssueMutation.variables?.id : ""}
        canEditPriority={false}
        canEditAssignee={false}
        canDeleteIssue={false}
      />
    </div>
  );
};

export default DeveloperDashboardPage;
