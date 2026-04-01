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
import { useAuth } from "@/hooks/use-auth";
import { getWorkspaceScope } from "@/lib/workspace";

const ProjectsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const workspaceScope = getWorkspaceScope(user);

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
    <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)] xl:items-start">
      <div className="min-w-0 xl:sticky xl:top-28">
        <ProjectComposer
          onSubmit={(payload) => createProjectMutation.mutateAsync(payload)}
          isPending={createProjectMutation.isPending}
        />
      </div>

      <section className="grid min-w-0 gap-4 2xl:grid-cols-2">
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
      </section>
    </div>
  );
};

export default ProjectsPage;
