import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Layers3, TimerReset } from "lucide-react";
import { fetchIssues, fetchProjects, updateIssue } from "@/lib/api";
import { createIssueListFilters, getIssueStatusMetrics } from "@/lib/issues";
import { useAuth } from "@/hooks/use-auth";
import IssueDetailsDialog from "@/components/issues/IssueDetailsDialog";
import IssueListView from "@/components/issues/IssueListView";
import EmptyState from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const defaultFilters = createIssueListFilters();

const DeveloperDashboardPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
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
    queryKey: ["issues", "developer-dashboard", user?._id],
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

  const updateIssueMutation = useMutation({
    mutationFn: updateIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
    },
  });

  const stats = useMemo(() => getIssueStatusMetrics(issues), [issues]);

  const error = projectsError || issuesError;
  const isLoading = isProjectsLoading || isIssuesLoading;
  const urgentIssues = issues.filter((issue) => issue.priority === "High").slice(0, 4);

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

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[220px] w-full rounded-[32px]" />
            <Skeleton className="h-[720px] w-full rounded-[32px]" />
          </div>
        ) : (
          <IssueListView
            title="Assigned work"
            description="Manage active delivery work from a structured list with quick status updates and clear timestamps."
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
            emptyStateTitle="No assigned issues"
            emptyStateDescription="New work assigned to you will appear here automatically."
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Priority queue</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : urgentIssues.length ? (
              <div className="space-y-3">
                {urgentIssues.map((issue) => (
                  <button
                    key={issue._id}
                    className="w-full rounded-[24px] border border-gray-200 bg-gray-50 p-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-white"
                    type="button"
                    onClick={() => setSelectedIssue(issue)}
                  >
                    <p className="text-base font-semibold text-gray-900">{issue.title}</p>
                    <p className="mt-2 text-sm text-gray-600">
                      {issue.projectId?.name || "Unknown project"}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No urgent issues"
                description="Your currently assigned work is in a healthy state."
              />
            )}
          </CardContent>
        </Card>
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

export default DeveloperDashboardPage;
