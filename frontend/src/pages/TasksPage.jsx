import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Layers3, ListTodo, TimerReset } from "lucide-react";
import { fetchMyIssues, fetchProjects, updateIssue } from "@/lib/api";
import { createIssueListFilters, getIssueStatusMetrics } from "@/lib/issues";
import IssueDetailsDialog from "@/components/issues/IssueDetailsDialog";
import IssueListView from "@/components/issues/IssueListView";
import EmptyState from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const defaultFilters = createIssueListFilters({
  assigneeId: "all",
});

const TasksPage = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(defaultFilters);
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
    queryKey: ["issues", "my"],
    queryFn: () => fetchMyIssues(),
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
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  const stats = useMemo(() => getIssueStatusMetrics(issues), [issues]);

  const error = projectsError || issuesError;

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-rose-700">
          {error.response?.data?.message || "Unable to load your tasks right now."}
        </CardContent>
      </Card>
    );
  }

  if (!isIssuesLoading && !issues.length) {
    return (
      <EmptyState
        title="No tasks assigned yet"
        description="Once work is assigned to you, it will appear here in a clean, searchable issue list."
        icon={<ListTodo className="h-5 w-5" />}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isIssuesLoading ? (
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

      {isProjectsLoading || isIssuesLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[220px] w-full rounded-[32px]" />
          <Skeleton className="h-[720px] w-full rounded-[32px]" />
        </div>
      ) : (
        <IssueListView
          title="Assigned work"
          description="Search your queue, sort by urgency, and update issue status without leaving the list."
          issues={issues}
          filters={filters}
          projects={projects}
          onFilterChange={(field, value) =>
            setFilters((current) => ({
              ...current,
              [field]: value,
            }))
          }
          onResetFilters={() => setFilters(defaultFilters)}
          onSelectIssue={setSelectedIssue}
          onStatusChange={(id, status) =>
            updateIssueMutation.mutateAsync({
              id,
              payload: { status },
            })
          }
          updatingId={updateIssueMutation.isPending ? updateIssueMutation.variables?.id : ""}
          showAssigneeFilter={false}
          emptyStateTitle="No tasks match these filters"
          emptyStateDescription="Try clearing one or more filters to bring more assigned work back into view."
        />
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
