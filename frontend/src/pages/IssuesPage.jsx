import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  createIssue,
  deleteIssue,
  fetchIssues,
  fetchProjects,
  updateIssue,
} from "@/lib/api";
import {
  getIssuePriorityVariant,
  getIssueStatusLabel,
  getIssueStatusVariant,
  resolveIssueAssignee,
} from "@/lib/issues";
import { findProjectById, getProjectTeams } from "@/lib/project-teams";
import { formatDateTime } from "@/lib/utils";
import IssueCreateDialog from "@/components/issues/IssueCreateDialog";
import IssueDetailsDialog from "@/components/issues/IssueDetailsDialog";
import EmptyState from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import DeveloperDashboardPage from "@/pages/DeveloperDashboardPage";
import TesterDashboardPage from "@/pages/TesterDashboardPage";
import { ROLE_ADMIN, ROLE_TESTER } from "@/lib/roles";

const isValidIssueType = (value) => ["Bug", "Task", "Story"].includes(value);

const sanitizeComposeParams = (searchParams, setSearchParams) => {
  const nextParams = new URLSearchParams(searchParams);
  nextParams.delete("compose");
  nextParams.delete("type");
  setSearchParams(nextParams, { replace: true });
};

const formatDueAt = (value) => (value ? formatDateTime(value) : "No due date");

const AdminIssuesPage = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    projectId: searchParams.get("projectId") || "",
    teamId: searchParams.get("teamId") || "all",
    search: searchParams.get("search") || "",
  });
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(
    searchParams.get("compose") === "1"
  );
  const deferredSearch = useDeferredValue(filters.search);

  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    error: projectsError,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  useEffect(() => {
    if (!projects.length) {
      return;
    }

    setFilters((current) => {
      const requestedProjectId = searchParams.get("projectId") || current.projectId;
      const nextProject =
        findProjectById(projects, requestedProjectId) ||
        findProjectById(projects, current.projectId) ||
        projects[0];
      const nextProjectId = nextProject?._id || "";
      const requestedTeamId = searchParams.get("teamId") || current.teamId;
      const nextTeamId = getProjectTeams(nextProject).some(
        (team) => String(team._id) === String(requestedTeamId)
      )
        ? String(requestedTeamId)
        : "all";
      const nextSearch = searchParams.get("search") || current.search;

      if (
        current.projectId === nextProjectId &&
        current.teamId === nextTeamId &&
        current.search === nextSearch
      ) {
        return current;
      }

      return {
        projectId: nextProjectId,
        teamId: nextTeamId,
        search: nextSearch,
      };
    });
  }, [projects, searchParams]);

  useEffect(() => {
    if (searchParams.get("compose") === "1" && projects.length) {
      setIsCreateDialogOpen(true);
    }
  }, [projects.length, searchParams]);

  const selectedProject = useMemo(
    () => findProjectById(projects, filters.projectId),
    [filters.projectId, projects]
  );
  const availableTeams = useMemo(
    () => getProjectTeams(selectedProject),
    [selectedProject]
  );

  const {
    data: issues = [],
    isLoading: isIssuesLoading,
    error: issuesError,
  } = useQuery({
    queryKey: [
      "issues",
      "admin-issues",
      filters.projectId,
      filters.teamId,
      deferredSearch,
    ],
    queryFn: () =>
      fetchIssues({
        projectId: filters.projectId,
        teamId: filters.teamId,
        search: deferredSearch,
      }),
    enabled: Boolean(filters.projectId),
  });

  const { data: dependencyIssues = [] } = useQuery({
    queryKey: ["issues", "admin-issue-options"],
    queryFn: () => fetchIssues(),
    enabled: Boolean(projects.length),
  });

  useEffect(() => {
    if (!selectedIssue) {
      return;
    }

    const nextIssue = issues.find((issue) => issue._id === selectedIssue._id);
    setSelectedIssue(nextIssue || null);
  }, [issues, selectedIssue]);

  const createIssueMutation = useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  const updateIssueMutation = useMutation({
    mutationFn: updateIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  const deleteIssueMutation = useMutation({
    mutationFn: deleteIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  const handleProjectChange = (projectId) => {
    setFilters((current) => ({
      ...current,
      projectId,
      teamId: "all",
    }));
  };

  const error = projectsError || issuesError;

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-rose-700">
          {error.response?.data?.message || "Unable to load issue data."}
        </CardContent>
      </Card>
    );
  }

  if (!isProjectsLoading && !projects.length) {
    return (
      <EmptyState
        title="Create a project before managing issues"
        description="Projects and attached teams define who can own work. Add a project first, then attach a team to start tracking issues."
      />
    );
  }

  const composeType = isValidIssueType(searchParams.get("type"))
    ? searchParams.get("type")
    : "Task";
  const lockComposeType = searchParams.get("type") === "Task";

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 xl:grid-cols-[220px_220px_minmax(0,1fr)_auto]">
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Project
              </span>
              <select
                className="field-select"
                value={filters.projectId}
                onChange={(event) => handleProjectChange(event.target.value)}
              >
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Team
              </span>
              <select
                className="field-select"
                value={filters.teamId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    teamId: event.target.value,
                  }))
                }
                disabled={!availableTeams.length}
              >
                <option value="all">All teams</option>
                {availableTeams.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Search
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-10"
                  placeholder="Search issues"
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

            <div className="flex items-end">
              <Button
                className="w-full xl:w-auto"
                type="button"
                onClick={() => setIsCreateDialogOpen(true)}
                disabled={!filters.projectId || !availableTeams.length}
              >
                <Plus className="h-4 w-4" />
                Create Issue
              </Button>
            </div>
          </div>

          {!availableTeams.length && selectedProject ? (
            <p className="text-sm text-amber-700">
              Attach a team to <span className="font-semibold">{selectedProject.name}</span>{" "}
              before creating issues.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {isProjectsLoading || isIssuesLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : issues.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="px-4 py-3 font-semibold">Team</th>
                    <th className="px-4 py-3 font-semibold">Assignee</th>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                    <th className="px-4 py-3 font-semibold">Due Date</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue) => {
                    const assignee = resolveIssueAssignee(issue);

                    return (
                      <tr
                        key={issue._id}
                        className="cursor-pointer border-b border-slate-200/80 transition hover:bg-slate-50"
                        onClick={() => setSelectedIssue(issue)}
                      >
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {issue.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              #{issue._id.slice(-6)}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {issue.teamId?.name || "No team"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {assignee?.name || "Unassigned"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={getIssuePriorityVariant(issue.priority)}>
                            {issue.priority}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {formatDueAt(issue.dueAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={getIssueStatusVariant(issue.status)}>
                            {getIssueStatusLabel(issue.status)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6">
              <EmptyState
                title="No issues in this view"
                description="Adjust the project or team filter, or create the first issue for this project."
              />
            </div>
          )}
        </CardContent>
      </Card>

      <IssueCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);

          if (!open && searchParams.get("compose") === "1") {
            sanitizeComposeParams(searchParams, setSearchParams);
          }
        }}
        projects={projects}
        availableIssues={dependencyIssues}
        defaultProjectId={filters.projectId}
        defaultTeamId={filters.teamId !== "all" ? filters.teamId : ""}
        defaultType={composeType}
        lockType={lockComposeType}
        isPending={createIssueMutation.isPending}
        onSubmit={async (payload) => {
          await createIssueMutation.mutateAsync(payload);
          setIsCreateDialogOpen(false);
          sanitizeComposeParams(searchParams, setSearchParams);
        }}
      />

      <IssueDetailsDialog
        issue={selectedIssue}
        open={Boolean(selectedIssue)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedIssue(null);
          }
        }}
        projects={projects}
        availableIssues={dependencyIssues}
        onUpdateIssue={(id, payload) =>
          updateIssueMutation.mutateAsync({ id, payload })
        }
        onDeleteIssue={(id) => deleteIssueMutation.mutateAsync(id)}
        updatingId={updateIssueMutation.isPending ? updateIssueMutation.variables?.id : ""}
        deletingId={deleteIssueMutation.isPending ? deleteIssueMutation.variables : ""}
        canEditCoreDetails
      />
    </div>
  );
};

const IssuesPage = () => {
  const { role } = useAuth();

  if (role !== ROLE_ADMIN) {
    return role === ROLE_TESTER ? <TesterDashboardPage /> : <DeveloperDashboardPage />;
  }

  return <AdminIssuesPage />;
};

export default IssuesPage;
