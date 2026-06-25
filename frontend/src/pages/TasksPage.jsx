import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ListTodo,
} from "lucide-react";
import {
  fetchIssues,
  fetchProjects,
  updateIssue,
  updateTaskStatus,
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import {
  ISSUE_TYPES,
} from "@/lib/issues";
import IssueDetailsDialog from "@/components/issues/IssueDetailsDialog";
import TaskKanbanBoard from "@/components/tasks/TaskKanbanBoard";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const TasksPage = () => {
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
    data: taskIssues = [],
    isLoading: isTasksLoading,
    error: tasksError,
  } = useQuery({
    queryKey: ["issues", "my", "tasks"],
    queryFn: () => fetchIssues({ type: ISSUE_TYPES.TASK, assigneeId: "me" }),
  });

  useEffect(() => {
    if (!selectedIssue) {
      return;
    }

    const nextIssue = taskIssues.find(
      (issue) => issue._id === selectedIssue._id
    );

    if (nextIssue) {
      setSelectedIssue(nextIssue);
    }
  }, [selectedIssue, taskIssues]);

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

  const error = projectsError || tasksError;
  const isWorkLoading = isProjectsLoading || isTasksLoading;

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
            <div>
              <CardTitle>Assigned Tasks</CardTitle>
              <CardDescription>
                Tasks assigned to you by managers or admins. For bug reporting and review, visit the Bugs page.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {taskIssues.length ? (
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
                description="Tasks assigned to you by managers or admins will appear here. For bug reporting and review, visit the Bugs page."
                icon={<ListTodo className="h-5 w-5" />}
              />
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
