import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Layers3, TimerReset } from "lucide-react";
import {
  createIssue,
  fetchIssues,
  fetchProjects,
  updateIssue,
  updateTaskStatus,
} from "@/lib/api";
import {
  ISSUE_STATUS,
  getIssueStatusMetrics,
} from "@/lib/issues";
import { useAuth } from "@/hooks/use-auth";
import IssueComposer from "@/components/issues/IssueComposer";
import IssueDetailsDialog from "@/components/issues/IssueDetailsDialog";
import TaskKanbanBoard from "@/components/tasks/TaskKanbanBoard";
import EmptyState from "@/components/shared/EmptyState";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const TesterDashboardPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedIssue, setSelectedIssue] = useState(null);

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
    queryKey: ["issues", "tester-dashboard", user?._id],
    queryFn: () => fetchIssues({ assignedTo: "me" }),
    enabled: Boolean(user?._id),
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

  const createIssueMutation = useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const updateIssueMutation = useMutation({
    mutationFn: updateIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: updateTaskStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  const stats = useMemo(() => getIssueStatusMetrics(issues), [issues]);

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

  if (!isProjectsLoading && !projects.length) {
    return (
      <EmptyState
        title="No testing projects yet"
        description="Once an admin adds you to a project, you'll be able to track validation work and report bugs here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
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
                <p className="mt-4 text-4xl font-semibold text-gray-900">
                  {stats.total}
                </p>
              </CardContent>
            </Card>
            <Card className="stats-tile">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 text-gray-600">
                  <ClipboardList className="h-5 w-5 text-amber-500" />
                  <span>Open</span>
                </div>
                <p className="mt-4 text-4xl font-semibold text-gray-900">
                  {stats.open}
                </p>
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
                <p className="mt-4 text-4xl font-semibold text-gray-900">
                  {stats.closed}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)] xl:items-start">
        <div className="min-w-0 xl:sticky xl:top-28">
          {isProjectsLoading ? (
            <Skeleton className="h-[640px] w-full rounded-[32px]" />
          ) : (
            <IssueComposer
              defaultAssigneeId={user?._id}
              defaultStatus={ISSUE_STATUS.TODO}
              defaultType="Bug"
              isPending={createIssueMutation.isPending}
              lockType
              onSubmit={(payload) => createIssueMutation.mutateAsync(payload)}
              projects={projects}
              allowedTypes={["Bug"]}
              showAssigneeField={false}
              showStatusField={false}
              submitLabel="Report Bug"
            />
          )}
        </div>

        {isLoading ? (
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
              <CardTitle>Testing Queue</CardTitle>
              <CardDescription>
                Assigned validation work grouped by status and priority.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              {issues.length ? (
                <TaskKanbanBoard
                  issues={issues}
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
                  emptyStateTitle="No testing issues"
                  emptyStateDescription="Reported bugs and assigned validation tasks will appear here."
                />
              ) : (
                <EmptyState
                  title="No testing issues"
                  description="Reported bugs and assigned validation tasks will appear here."
                />
              )}
            </CardContent>
          </Card>
        )}
      </section>

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

export default TesterDashboardPage;
