import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ClipboardList,
  Eye,
  Layers3,
  ListTodo,
  LoaderCircle,
  RotateCcw,
  TimerReset,
  Trash2,
  UserCircle2,
} from "lucide-react";
import {
  deleteIssue,
  fetchIssues,
  fetchProjects,
  updateIssue,
  updateTaskStatus,
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import {
  ISSUE_STATUS,
  ISSUE_TYPES,
  getIssueDisplayKey,
  getIssuePriorityVariant,
  getIssueStatusLabel,
  getIssueStatusMetrics,
  getIssueStatusVariant,
  normalizeBugStatusForIssue,
  resolveBugDetails,
  resolveIssueProjectId,
} from "@/lib/issues";
import { ROLE_TESTER } from "@/lib/roles";
import { cn, formatDateTime } from "@/lib/utils";
import IssueDetailsDialog from "@/components/issues/IssueDetailsDialog";
import TaskKanbanBoard from "@/components/tasks/TaskKanbanBoard";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const TASK_TABS = [
  {
    key: "tasks",
    label: "Assigned Tasks",
    icon: ListTodo,
  },
  {
    key: "bugs",
    label: "Bug Review Progress",
    icon: Bug,
  },
];

const BUG_PROGRESS = {
  [ISSUE_STATUS.NEW]: 10,
  [ISSUE_STATUS.OPEN]: 24,
  [ISSUE_STATUS.ASSIGNED]: 48,
  [ISSUE_STATUS.IN_PROGRESS]: 56,
  [ISSUE_STATUS.FIXED]: 78,
  [ISSUE_STATUS.QA]: 84,
  [ISSUE_STATUS.REOPEN]: 38,
  [ISSUE_STATUS.CLOSED]: 100,
  [ISSUE_STATUS.REJECTED]: 100,
};

const getProjectName = (issue, projects = []) => {
  const projectId = resolveIssueProjectId(issue);
  const project = projects.find((item) => String(item._id) === projectId);

  return issue?.projectId?.name || project?.name || "Assigned project";
};

const getDeveloperName = (issue) => {
  const bugDetails = resolveBugDetails(issue);

  return bugDetails?.developerLead?.name || issue?.assignee?.name || "Unassigned";
};

const getBugSeverity = (issue) => resolveBugDetails(issue)?.severity || "Not set";

const getBugReviewLabel = (issue) => {
  const status = normalizeBugStatusForIssue(issue);

  if (status === ISSUE_STATUS.FIXED) {
    return "Ready for QA";
  }

  if (status === ISSUE_STATUS.REOPEN) {
    return "Reopened";
  }

  return getIssueStatusLabel(status);
};

const getBugProgress = (issue) =>
  BUG_PROGRESS[normalizeBugStatusForIssue(issue)] ?? 10;

const getReporterId = (issue) =>
  String(issue?.reporter?._id || issue?.reporter || "");

const getTesterOwnerId = (issue) =>
  String(resolveBugDetails(issue)?.testerOwner?._id || resolveBugDetails(issue)?.testerOwner || "");

const ReviewMetric = ({ label, value, children }) => (
  <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
      {label}
    </p>
    {children || (
      <p className="mt-1 truncate text-sm font-semibold text-slate-950">
        {value}
      </p>
    )}
  </div>
);

const BugReviewCard = ({
  issue,
  isUpdating,
  isDeleting = false,
  onApproveFix,
  onDelete,
  onOpen,
  onReopen,
  projects,
}) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const currentStatus = normalizeBugStatusForIssue(issue);
  const canQaAct = currentStatus === ISSUE_STATUS.FIXED;
  const progress = getBugProgress(issue);

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await onDelete(issue);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting bug:", error);
    }
  };

  return (
    <>
      <article className="rounded-[24px] border border-white/70 bg-white/88 p-4 shadow-[0_18px_44px_-32px_rgba(15,23,42,0.38)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-[0_24px_62px_-36px_rgba(15,23,42,0.44)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {getIssueDisplayKey(issue)}
            </p>
            <h3 className="mt-1 line-clamp-2 text-base font-semibold text-slate-950">
              {issue.title || "Untitled bug"}
            </h3>
            <p className="mt-1 truncate text-sm text-slate-500">
              {getProjectName(issue, projects)}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant={getIssuePriorityVariant(issue.priority)}>
              {issue.priority || "Medium"}
            </Badge>
            <Badge variant={getIssueStatusVariant(currentStatus)}>
              {getBugReviewLabel(issue)}
            </Badge>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <ReviewMetric label="Severity" value={getBugSeverity(issue)} />
          <ReviewMetric label="Priority" value={issue.priority || "Medium"} />
          <ReviewMetric label="Developer">
            <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-slate-950">
              <UserCircle2 className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">{getDeveloperName(issue)}</span>
            </p>
          </ReviewMetric>
          <ReviewMetric label="Current Status" value={getBugReviewLabel(issue)} />
          <ReviewMetric
            label="Last Updated"
            value={formatDateTime(issue.updatedAt || issue.createdAt)}
          />
          <ReviewMetric label="QA Stage">
            <p className="mt-1 truncate text-sm font-semibold text-slate-950">
              {canQaAct ? "Awaiting verification" : "Monitoring"}
            </p>
          </ReviewMetric>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
            <span>Resolution progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#2563EB,#06B6D4,#10B981)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpen(issue)}
          >
            <Eye className="h-4 w-4" />
            Verify
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canQaAct || isUpdating || isDeleting}
            onClick={() => onReopen(issue)}
          >
            <RotateCcw className="h-4 w-4" />
            Reopen
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canQaAct || isUpdating || isDeleting}
            onClick={() => onApproveFix(issue)}
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve Fix
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={isUpdating || isDeleting}
            onClick={handleDeleteClick}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </article>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="rounded-[24px]">
          <DialogHeader className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <DialogTitle>Delete Bug?</DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete this bug report?
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="rounded-[18px] border border-red-200 bg-red-50/50 p-3 text-sm text-red-900">
            <p className="font-semibold">This action cannot be undone.</p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Bug
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const TasksPage = () => {
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIssue, setSelectedIssue] = useState(null);
  const isTester = role === ROLE_TESTER;
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    isTester && requestedTab === "bugs" ? "bugs" : "tasks"
  );
  const testerId = String(user?._id || user?.id || "");

  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    error: projectsError,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const {
    data: taskIssues = [],
    isLoading: isTasksLoading,
    error: tasksError,
  } = useQuery({
    queryKey: ["issues", "my", "tasks"],
    queryFn: () => fetchIssues({ type: ISSUE_TYPES.TASK, assigneeId: "me" }),
  });

  const {
    data: bugIssues = [],
    isLoading: isBugsLoading,
    error: bugsError,
  } = useQuery({
    queryKey: ["issues", "tester-bug-progress", testerId],
    queryFn: () => fetchIssues({ type: ISSUE_TYPES.BUG, sortBy: "recently-updated" }),
    enabled: Boolean(isTester && testerId),
  });

  useEffect(() => {
    if (isTester && requestedTab === "bugs") {
      setActiveTab("bugs");
    }
  }, [isTester, requestedTab]);

  useEffect(() => {
    if (!isTester && activeTab === "bugs") {
      setActiveTab("tasks");
    }
  }, [activeTab, isTester]);

  useEffect(() => {
    if (!selectedIssue) {
      return;
    }

    const nextIssue = [...taskIssues, ...bugIssues].find(
      (issue) => issue._id === selectedIssue._id
    );

    if (nextIssue) {
      setSelectedIssue(nextIssue);
    }
  }, [bugIssues, selectedIssue, taskIssues]);

  const updateIssueMutation = useMutation({
    mutationFn: updateIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: updateTaskStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  const reportedBugIssues = useMemo(
    () =>
      bugIssues.filter(
        (issue) =>
          getReporterId(issue) === testerId || getTesterOwnerId(issue) === testerId
      ),
    [bugIssues, testerId]
  );

  const stats = useMemo(() => getIssueStatusMetrics(taskIssues), [taskIssues]);

  const error = projectsError || tasksError || bugsError;
  const isWorkLoading = isProjectsLoading || isTasksLoading || (isTester && isBugsLoading);

  const handleApproveFix = (issue) =>
    updateIssueMutation.mutateAsync({
      id: issue._id,
      payload: {
        status: ISSUE_STATUS.CLOSED,
        statusChangeComment: "QA approved the fixed bug.",
      },
    });

  const handleReopenBug = (issue) => {
    const reason = window.prompt("Add a brief reason for reopening this bug:");

    if (!reason?.trim()) {
      return Promise.resolve();
    }

    return updateIssueMutation.mutateAsync({
      id: issue._id,
      payload: {
        status: ISSUE_STATUS.REOPEN,
        reopenReason: reason.trim(),
      },
    });
  };

  const deleteBugMutation = useMutation({
    mutationFn: deleteIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  const handleDeleteBug = (issue) => {
    return deleteBugMutation.mutateAsync(issue._id);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-rose-700">
          {error.response?.data?.message || "Unable to load your tasks right now."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isTasksLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : (
          <>
            <Card className="stats-tile">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 text-gray-600">
                  <Layers3 className="h-5 w-5 text-blue-600" />
                  <span>Total</span>
                </div>
                <p className="mt-4 text-4xl font-semibold text-gray-900">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className="stats-tile">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 text-gray-600">
                  <ClipboardList className="h-5 w-5 text-amber-500" />
                  <span>Open</span>
                </div>
                <p className="mt-4 text-4xl font-semibold text-gray-900">{stats.open}</p>
              </CardContent>
            </Card>
            <Card className="stats-tile">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 text-gray-600">
                  <TimerReset className="h-5 w-5 text-violet-500" />
                  <span>In Progress</span>
                </div>
                <p className="mt-4 text-4xl font-semibold text-gray-900">
                  {stats.inProgress}
                </p>
              </CardContent>
            </Card>
            <Card className="stats-tile">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 text-gray-600">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span>Closed</span>
                </div>
                <p className="mt-4 text-4xl font-semibold text-gray-900">{stats.closed}</p>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      {isWorkLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[92px] w-full rounded-[16px]" />
          <div className="grid gap-4 xl:grid-cols-3">
            <Skeleton className="h-[520px] w-full rounded-[16px]" />
            <Skeleton className="h-[520px] w-full rounded-[16px]" />
            <Skeleton className="h-[520px] w-full rounded-[16px]" />
          </div>
        </div>
      ) : (
        <Card className="overflow-hidden border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
          <CardHeader className="border-b border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(239,246,255,0.92),rgba(238,242,255,0.88))]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Tasks</CardTitle>
                <CardDescription>
                  Assigned task work stays separate from reported bug review.
                </CardDescription>
              </div>
              {isTester ? (
                <div className="grid w-full grid-cols-2 rounded-2xl border border-white/70 bg-white/70 p-1 shadow-sm backdrop-blur sm:w-auto">
                  {TASK_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        className={cn(
                          "inline-flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-center text-sm font-semibold transition-all duration-200",
                          isActive
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-600 hover:bg-white hover:text-slate-950"
                        )}
                        onClick={() => {
                          setActiveTab(tab.key);

                          if (tab.key === "bugs") {
                            setSearchParams({ tab: "bugs" });
                          } else {
                            setSearchParams({});
                          }
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {activeTab === "bugs" && isTester ? (
              <div className="space-y-4 transition-opacity duration-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-950">
                      Bug Review Progress
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Track bugs you reported, developer status, QA verification, and resolution flow.
                    </p>
                  </div>
                  <Badge className="border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50">
                    {reportedBugIssues.length} reported
                  </Badge>
                </div>

                {reportedBugIssues.length ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {reportedBugIssues.map((issue) => (
                      <BugReviewCard
                        key={issue._id}
                        issue={issue}
                        isUpdating={
                          updateIssueMutation.isPending &&
                          updateIssueMutation.variables?.id === issue._id
                        }
                        isDeleting={
                          deleteBugMutation.isPending &&
                          deleteBugMutation.variables === issue._id
                        }
                        onApproveFix={handleApproveFix}
                        onDelete={handleDeleteBug}
                        onOpen={setSelectedIssue}
                        onReopen={handleReopenBug}
                        projects={projects}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No reported bugs to review"
                    description="Bugs you report stay in bug progress until a manager or developer moves them through the QA flow."
                    icon={<Bug className="h-5 w-5" />}
                  />
                )}
              </div>
            ) : (
              taskIssues.length ? (
                <TaskKanbanBoard
                  issues={taskIssues}
                  updatingId={
                    updateTaskStatusMutation.isPending
                      ? updateTaskStatusMutation.variables?.id
                      : ""
                  }
                  onSelectIssue={setSelectedIssue}
                  onStatusChange={(id, status) =>
                    updateTaskStatusMutation.mutateAsync({
                      id,
                      status,
                    })
                  }
                />
              ) : (
                <EmptyState
                  title="No tasks assigned yet"
                  description="Only manager/admin assigned Task work items appear here. Reported bugs remain in bug review progress."
                  icon={<ListTodo className="h-5 w-5" />}
                />
              )
            )}
          </CardContent>
        </Card>
      )}

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
        updatingId={updateIssueMutation.isPending ? updateIssueMutation.variables?.id : ""}
        canEditPriority={false}
        canEditAssignee={false}
        canDeleteIssue={false}
      />
    </div>
  );
};

export default TasksPage;
