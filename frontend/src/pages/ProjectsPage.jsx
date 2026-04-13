import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban } from "lucide-react";
import {
  attachProjectTeam,
  createProject,
  fetchProjects,
  fetchTeams,
  detachProjectTeam,
  updateProjectStatus,
} from "@/lib/api";
import ProjectComposer from "@/components/projects/ProjectComposer";
import ProjectCard from "@/components/projects/ProjectCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import ToastNotice from "@/components/shared/ToastNotice";
import { useAuth } from "@/hooks/use-auth";
import { getWorkspaceScope } from "@/lib/workspace";

const ProjectsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const workspaceScope = getWorkspaceScope(user);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({
      id: Date.now(),
      type,
      message,
    });
  };

  useEffect(() => {
    if (!toast?.id) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3600);

    return () => window.clearTimeout(timer);
  }, [toast?.id]);

  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    error: projectsError,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const {
    data: teams = [],
    isLoading: isTeamsLoading,
    error: teamsError,
  } = useQuery({
    queryKey: ["teams", "project-attachments", workspaceScope],
    queryFn: () => fetchTeams(workspaceScope),
  });

  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const attachProjectTeamMutation = useMutation({
    mutationFn: attachProjectTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const detachProjectTeamMutation = useMutation({
    mutationFn: detachProjectTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const updateProjectStatusMutation = useMutation({
    mutationFn: updateProjectStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const teamsErrorMessage =
    teamsError?.response?.data?.message ||
    (teamsError ? "Couldn't load workspace teams right now." : "");

  if (projectsError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-rose-700">
          {projectsError.response?.data?.message || "Unable to load projects."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden lg:flex-row">
      <ToastNotice toast={toast} onDismiss={() => setToast(null)} />

      <aside className="hidden h-full w-[312px] shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 h-full">
          <ProjectComposer
            onSubmit={(payload) => createProjectMutation.mutateAsync(payload)}
            isPending={createProjectMutation.isPending}
          />
        </div>
      </aside>

      <div className="shrink-0 border-b border-slate-200 bg-white p-4 lg:hidden">
        <ProjectComposer
          onSubmit={(payload) => createProjectMutation.mutateAsync(payload)}
          isPending={createProjectMutation.isPending}
        />
      </div>

      <section className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
        <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
          {isProjectsLoading ? (
            <>
              <Skeleton className="h-[360px] w-full rounded-[32px]" />
              <Skeleton className="h-[360px] w-full rounded-[32px]" />
            </>
          ) : projects.length ? (
            projects.map((project, index) => (
              <ProjectCard
                key={project._id}
                canManageProject={user?.role === "Admin"}
                index={index}
                isAttachingTeam={
                  attachProjectTeamMutation.isPending &&
                  attachProjectTeamMutation.variables?.projectId === project._id
                }
                isUpdatingStatus={
                  updateProjectStatusMutation.isPending &&
                  updateProjectStatusMutation.variables?.projectId === project._id
                }
                detachingTeamId={
                  detachProjectTeamMutation.isPending &&
                  detachProjectTeamMutation.variables?.projectId === project._id
                    ? detachProjectTeamMutation.variables?.teamId
                    : ""
                }
                onAttachTeam={(payload) =>
                  attachProjectTeamMutation.mutateAsync(payload)
                }
                onDetachTeam={(payload) =>
                  detachProjectTeamMutation.mutateAsync(payload)
                }
                onUpdateStatus={(payload) =>
                  updateProjectStatusMutation.mutateAsync(payload)
                }
                onOpenTeamsComposer={() =>
                  showToast("success", "Opening Microsoft Teams...")
                }
                project={project}
                workspaceTeams={teams}
                teamsErrorMessage={isTeamsLoading ? "" : teamsErrorMessage}
              />
            ))
          ) : (
            <EmptyState
              title="No projects yet"
              description="Create a project, attach a team, and start organizing work in a tighter project space."
              icon={<FolderKanban className="h-5 w-5" />}
            />
          )}
        </div>
      </section>
    </div>
  );
};

export default ProjectsPage;
