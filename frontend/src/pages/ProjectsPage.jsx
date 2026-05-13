import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Plus, UserRoundPlus, Users2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  attachProjectTeam,
  createProject,
  createTeam,
  deleteProject,
  fetchProjects,
  fetchTeams,
  fetchWorkspaceUsers,
  fetchUsers,
  detachProjectTeam,
  updateProjectStatus,
} from "@/lib/api";
import ProjectComposer from "@/components/projects/ProjectComposer";
import ProjectCard from "@/components/projects/ProjectCard";
import TeamCard from "@/components/teams/TeamCard";
import TeamComposer from "@/components/teams/TeamComposer";
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

const PROJECT_GRID_SKELETON_COUNT = 4;
const TEAM_PANEL_SKELETON_COUNT = 3;

const ProjectsPage = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const workspaceScope = getWorkspaceScope(user);
  const [activeTab, setActiveTab] = useState("projects");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
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

  const {
    data: workspaceUsers = [],
    isLoading: isWorkspaceUsersLoading,
    error: workspaceUsersError,
  } = useQuery({
    queryKey: ["workspace-users", workspaceScope],
    queryFn: () => fetchWorkspaceUsers(workspaceScope),
  });

  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
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
  const workspaceUsersErrorMessage =
    workspaceUsersError?.response?.data?.message ||
    (workspaceUsersError
      ? "Couldn't load workspace users for team creation right now."
      : "");

  const teamStats = useMemo(() => {
    const emptyTeams = teams.filter(
      (team) => !(team.memberCount || team.members?.length)
    ).length;
    const totalMembersAssigned = teams.reduce(
      (total, team) => total + (team.memberCount || team.members?.length || 0),
      0
    );

    return {
      totalTeams: teams.length,
      emptyTeams,
      totalMembersAssigned,
    };
  }, [teams]);

  const handleCreateProject = async (payload) => {
    await createProjectMutation.mutateAsync(payload);
    setIsCreateDialogOpen(false);
  };

  const handleCreateTeam = async (payload) => {
    await createTeamMutation.mutateAsync(payload);
    setIsCreateTeamDialogOpen(false);
    showToast("success", "Team created successfully.");
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
    <div className="w-full space-y-6">
      <ToastNotice toast={toast} onDismiss={() => setToast(null)} />

      <section className="w-full">
        <Card className="overflow-hidden border-white/70 bg-white/82 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.32)] backdrop-blur-xl">
          <CardContent className="flex flex-col gap-3 p-2 sm:flex-row sm:items-center sm:justify-between sm:p-3">
            <div
              aria-label="Projects and teams"
              className="grid gap-2 rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-1 sm:inline-grid sm:grid-cols-2"
              role="tablist"
            >
              {[
                { id: "projects", label: "Projects", Icon: FolderKanban },
                { id: "teams", label: "Teams", Icon: Users2 },
              ].map(({ id, label, Icon }) => {
                const isSelected = activeTab === id;

                return (
                  <button
                    key={id}
                    aria-controls={`${id}-panel`}
                    aria-selected={isSelected}
                    className={`interactive-button inline-flex h-11 items-center justify-center gap-2 rounded-[20px] px-5 text-sm font-semibold transition ${
                      isSelected
                        ? "bg-slate-950 text-white shadow-[0_14px_30px_-20px_rgba(15,23,42,0.8)]"
                        : "border border-transparent bg-white/70 text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-950"
                    }`}
                    id={`${id}-tab`}
                    role="tab"
                    type="button"
                    onClick={() => setActiveTab(id)}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>

            {activeTab === "projects" ? (
              <Button
                className="interactive-button h-11 w-full rounded-2xl border border-indigo-300/30 bg-[linear-gradient(90deg,#2563EB_0%,#6366F1_55%,#8B5CF6_100%)] px-6 text-white shadow-[0_14px_28px_-18px_rgba(99,102,241,0.82)] hover:brightness-105 sm:w-auto"
                onClick={() => setIsCreateDialogOpen(true)}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Create Project
              </Button>
            ) : (
              <Button
                className="interactive-button h-11 w-full rounded-2xl border border-emerald-300/40 bg-[linear-gradient(90deg,#059669_0%,#0891B2_100%)] px-6 text-white shadow-[0_14px_28px_-18px_rgba(16,185,129,0.72)] hover:brightness-105 sm:w-auto"
                onClick={() => setIsCreateTeamDialogOpen(true)}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Create Team
              </Button>
            )}
          </CardContent>
        </Card>
      </section>

      {activeTab === "projects" ? (
        <section
          aria-labelledby="projects-tab"
          className="min-w-0 w-full space-y-4"
          id="projects-panel"
          role="tabpanel"
        >
          <div className="grid min-w-0 w-full grid-cols-1 gap-5 lg:grid-cols-2">
            {isProjectsLoading ? (
              Array.from({ length: PROJECT_GRID_SKELETON_COUNT }).map((_, index) => (
                <Skeleton
                  key={`project-skeleton-${index}`}
                  className="h-[360px] w-full rounded-[32px]"
                />
              ))
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
              <div className="lg:col-span-2">
                <EmptyState
                  title="No projects yet"
                  description="Create a project, attach a team, and start organizing work in a tighter project space."
                  icon={<FolderKanban className="h-5 w-5" />}
                />
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "teams" ? (
        <section
          aria-labelledby="teams-tab"
          className="min-w-0 w-full space-y-5"
          id="teams-panel"
          role="tabpanel"
        >
          <div className="grid gap-4 md:grid-cols-3">
            {isTeamsLoading ? (
              <>
                <Skeleton className="h-28 w-full rounded-[28px]" />
                <Skeleton className="h-28 w-full rounded-[28px]" />
                <Skeleton className="h-28 w-full rounded-[28px]" />
              </>
            ) : (
              <>
                <Card className="stats-tile">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 text-slate-600">
                      <Users2 className="h-5 w-5 text-emerald-600" />
                      <span>Total teams</span>
                    </div>
                    <p className="mt-4 text-4xl font-semibold text-slate-950">
                      {teamStats.totalTeams}
                    </p>
                  </CardContent>
                </Card>

                <Card className="stats-tile">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 text-slate-600">
                      <UserRoundPlus className="h-5 w-5 text-sky-600" />
                      <span>Members assigned</span>
                    </div>
                    <p className="mt-4 text-4xl font-semibold text-slate-950">
                      {teamStats.totalMembersAssigned}
                    </p>
                  </CardContent>
                </Card>

                <Card className="stats-tile">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 text-slate-600">
                      <Users2 className="h-5 w-5 text-amber-600" />
                      <span>Empty teams</span>
                    </div>
                    <p className="mt-4 text-4xl font-semibold text-slate-950">
                      {teamStats.emptyTeams}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {teamsErrorMessage && !isTeamsLoading ? (
            <Card>
              <CardContent className="p-4 text-sm text-rose-700">
                {teamsErrorMessage}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
            {isTeamsLoading ? (
              Array.from({ length: TEAM_PANEL_SKELETON_COUNT }).map((_, index) => (
                <Skeleton
                  key={`team-skeleton-${index}`}
                  className="h-[290px] w-full rounded-[32px]"
                />
              ))
            ) : teams.length ? (
              teams.map((team) => <TeamCard key={team._id} team={team} />)
            ) : (
              <div className="lg:col-span-2">
                <EmptyState
                  title="No teams yet. Create your first team."
                  description="Build workspace-specific teams to keep ownership, planning, and delivery clearer across projects."
                  icon={<Users2 className="h-5 w-5" />}
                  action={
                    <Button
                      onClick={() => setIsCreateTeamDialogOpen(true)}
                      type="button"
                    >
                      <Plus className="h-4 w-4" />
                      Create Team
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </section>
      ) : null}

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

      <Dialog open={isCreateTeamDialogOpen} onOpenChange={setIsCreateTeamDialogOpen}>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)] max-h-[88vh] w-[calc(100%-1rem)] max-w-[860px] gap-0 overflow-hidden rounded-[26px] border-white/80 bg-white/94 p-0 shadow-[0_34px_90px_-54px_rgba(15,23,42,0.44)] backdrop-blur-xl sm:w-[calc(100%-2rem)] [&>button]:right-4 [&>button]:top-4 [&>button]:h-8 [&>button]:w-8 [&>button]:rounded-lg [&>button]:border-slate-200/90 [&>button]:bg-white/90 [&>button]:p-0 [&>button]:text-slate-400 [&>button]:shadow-sm [&>button:hover]:bg-slate-50 [&>button:hover]:text-slate-700">
          <DialogHeader className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] px-4 py-3 sm:px-5 sm:py-3.5">
            <DialogTitle className="pr-10 text-lg tracking-tight text-slate-950">
              Create Team
            </DialogTitle>
            <DialogDescription className="max-w-[34rem] pr-10 text-[13px] leading-5 text-slate-600">
              Build a workspace-scoped team and add members from the current
              workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4">
            {workspaceUsersErrorMessage && !isWorkspaceUsersLoading ? (
              <div className="mb-4 rounded-[20px] border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                {workspaceUsersErrorMessage}
              </div>
            ) : null}

            {isWorkspaceUsersLoading ? (
              <Skeleton className="h-[700px] w-full rounded-[28px]" />
            ) : (
              <TeamComposer
                users={workspaceUsers}
                workspaceId={workspaceScope}
                isPending={createTeamMutation.isPending}
                onSubmit={handleCreateTeam}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectsPage;
