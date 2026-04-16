import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  attachProjectTeam,
  createProject,
  deleteProject,
  fetchProjects,
  fetchTeams,
  fetchUsers,
  detachProjectTeam,
  updateProjectStatus,
} from "@/lib/api";
import ProjectComposer from "@/components/projects/ProjectComposer";
import ProjectCard from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import ToastNotice from "@/components/shared/ToastNotice";
import { useAuth } from "@/hooks/use-auth";
import { hasAdminPanelAccess } from "@/lib/roles";
import { getWorkspaceScope } from "@/lib/workspace";

const ProjectsPage = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const workspaceScope = getWorkspaceScope(user);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
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

  useEffect(() => {
    if (!location.state?.toast) {
      return;
    }

    setToast({
      id: Date.now(),
      ...location.state.toast,
    });

    navigate(location.pathname, {
      replace: true,
      state: null,
    });
  }, [location.pathname, location.state, navigate]);

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

  const {
    data: users = [],
    isLoading: isUsersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ["users", "project-composer"],
    queryFn: fetchUsers,
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

  const deleteProjectMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: async (_, deletedProjectId) => {
      queryClient.removeQueries({
        queryKey: ["project-meetings", deletedProjectId],
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["issues"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
    },
    onError: (error) => {
      showToast(
        "error",
        error.response?.data?.message || "Unable to delete this project right now."
      );
    },
  });

  const teamsErrorMessage =
    teamsError?.response?.data?.message ||
    (teamsError ? "Couldn't load workspace teams right now." : "");
  const usersErrorMessage =
    usersError?.response?.data?.message ||
    (usersError ? "Couldn't load workspace users right now." : "");

  const handleCreateProject = async (payload) => {
    await createProjectMutation.mutateAsync(payload);
    setIsCreateDialogOpen(false);
  };

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
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
      <ToastNotice toast={toast} onDismiss={() => setToast(null)} />

      <section>
        <Card className="overflow-hidden border-white/70 bg-white/90 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.3)] backdrop-blur-xl">
          <CardContent className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-4">
              <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-200/70 bg-white text-blue-700 shadow-sm">
                <FolderKanban className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight text-slate-950">
                  Projects
                </h1>
                <p className="text-sm leading-6 text-slate-600">
                  Keep the showcase in view and open the create flow only when you
                  need it.
                </p>
              </div>
            </div>

            <Button
              className="interactive-button h-11 rounded-2xl border border-indigo-300/30 bg-[linear-gradient(90deg,#2563EB_0%,#6366F1_55%,#8B5CF6_100%)] px-6 text-white shadow-[0_14px_28px_-18px_rgba(99,102,241,0.82)] hover:brightness-105"
              onClick={() => setIsCreateDialogOpen(true)}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="min-w-0">
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
                canManageProject={hasAdminPanelAccess(user?.role)}
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
                onDeleteProject={(projectId) =>
                  deleteProjectMutation.mutateAsync(projectId)
                }
                onOpenTeamsComposer={() =>
                  showToast("success", "Opening Microsoft Teams...")
                }
                isDeletingProject={
                  deleteProjectMutation.isPending &&
                  deleteProjectMutation.variables === project._id
                }
                project={project}
                workspaceTeams={teams}
                teamsErrorMessage={isTeamsLoading ? "" : teamsErrorMessage}
              />
            ))
          ) : (
            <div className="2xl:col-span-2">
              <EmptyState
                title="No projects yet"
                description="Create a project, attach a team, and start organizing work in a tighter project space."
                icon={<FolderKanban className="h-5 w-5" />}
              />
            </div>
          )}
        </div>
      </section>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)] max-h-[88vh] w-[calc(100%-1rem)] max-w-[720px] gap-0 overflow-hidden rounded-[26px] border-white/80 bg-white/94 p-0 shadow-[0_34px_90px_-54px_rgba(15,23,42,0.44)] backdrop-blur-xl sm:w-[calc(100%-2rem)] [&>button]:right-4 [&>button]:top-4 [&>button]:h-8 [&>button]:w-8 [&>button]:rounded-lg [&>button]:border-slate-200/90 [&>button]:bg-white/90 [&>button]:p-0 [&>button]:text-slate-400 [&>button]:shadow-sm [&>button:hover]:bg-slate-50 [&>button:hover]:text-slate-700">
          <DialogHeader className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] px-4 py-3 sm:px-5 sm:py-3.5">
            <DialogTitle className="pr-10 text-lg tracking-tight text-slate-950">
              Create Project
            </DialogTitle>
            <DialogDescription className="max-w-[34rem] pr-10 text-[13px] leading-5 text-slate-600">
              Capture ownership, scope, and the first workstreams for the new
              project.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4">
            <ProjectComposer
              onSubmit={handleCreateProject}
              isPending={createProjectMutation.isPending}
              onCancel={() => setIsCreateDialogOpen(false)}
              users={users}
              usersErrorMessage={isUsersLoading ? "" : usersErrorMessage}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectsPage;
