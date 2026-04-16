import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  createIssue,
  deleteIssue,
  fetchIssues,
  fetchProjects,
  updateIssue,
} from "@/lib/api";
import { ISSUE_STATUS, normalizeIssueStatus } from "@/lib/issues";
import {
  findProjectById,
  getProjectTeams,
  resolveTeamId,
} from "@/lib/project-teams";
import IssueBoard from "@/components/issues/IssueBoard";
import IssueCreateDialog from "@/components/issues/IssueCreateDialog";
import IssueDetailsDialog from "@/components/issues/IssueDetailsDialog";
import IssuesToolbar from "@/components/issues/IssuesToolbar";
import EmptyState from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { canCreateIssues, canDeleteIssues, hasAdminPanelAccess } from "@/lib/roles";

const isValidIssueType = (value) => ["Bug", "Task", "Story"].includes(value);
const ALL_PROJECTS_VALUE = "ALL";
const OPEN_ISSUES_QUERY_VALUE = "OPEN";
const CLOSED_ISSUES_QUERY_VALUE = "CLOSED";

const normalizeStatusFilterValue = (value) => {
  if (!value) {
    return "";
  }

  const normalizedValue = String(value).trim().toUpperCase();

  if (normalizedValue === OPEN_ISSUES_QUERY_VALUE) {
    return OPEN_ISSUES_QUERY_VALUE;
  }

  if (normalizedValue === CLOSED_ISSUES_QUERY_VALUE) {
    return CLOSED_ISSUES_QUERY_VALUE;
  }

  return "";
};

const normalizeProjectFilterValue = (value) => {
  if (!value) {
    return ALL_PROJECTS_VALUE;
  }

  return String(value).toLowerCase() === "all" ? ALL_PROJECTS_VALUE : String(value);
};

const sanitizeComposeParams = (searchParams, setSearchParams) => {
  const nextParams = new URLSearchParams(searchParams);
  nextParams.delete("compose");
  nextParams.delete("type");
  setSearchParams(nextParams, { replace: true });
};

const getAvailableTeams = (projects = [], projectId = ALL_PROJECTS_VALUE) => {
  if (projectId !== ALL_PROJECTS_VALUE) {
    return getProjectTeams(findProjectById(projects, projectId));
  }

  const uniqueTeams = new Map();

  projects.forEach((project) => {
    getProjectTeams(project).forEach((team) => {
      const teamId = resolveTeamId(team);

      if (!teamId || uniqueTeams.has(teamId)) {
        return;
      }

      uniqueTeams.set(teamId, team);
    });
  });

  return Array.from(uniqueTeams.values()).sort((left, right) =>
    (left.name || "").localeCompare(right.name || "")
  );
};

const IssueBoardSkeleton = () => (
  <Card className="overflow-hidden border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
    <CardContent className="grid gap-4 p-4 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={`issue-column-skeleton-${index}`}
          className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-4"
        >
          <div className="space-y-3">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-40 w-full rounded-[24px]" />
            <Skeleton className="h-40 w-full rounded-[24px]" />
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

const IssuesPage = () => {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    projectId: normalizeProjectFilterValue(searchParams.get("projectId")),
    teamId: searchParams.get("teamId") || "all",
    search: searchParams.get("search") || "",
  });
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const deferredSearch = useDeferredValue(filters.search);
  const activeStatusFilter = useMemo(
    () => normalizeStatusFilterValue(searchParams.get("status")),
    [searchParams]
  );
  const isAdminView = hasAdminPanelAccess(role);
  const canCreateIssue = canCreateIssues(role);
  const canDeleteIssue = canDeleteIssues(role);

  const {
    data: projectsData = [],
    isLoading: isProjectsLoading,
    error: projectsError,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });
  const projects = useMemo(
    () => (Array.isArray(projectsData) ? projectsData : []),
    [projectsData]
  );

  useEffect(() => {
    if (!projects.length) {
      return;
    }

    setFilters((current) => {
      const requestedProjectId = normalizeProjectFilterValue(
        searchParams.get("projectId") || current.projectId
      );
      const nextProject =
        requestedProjectId === ALL_PROJECTS_VALUE
          ? null
          : findProjectById(projects, requestedProjectId);
      const nextProjectId = nextProject?._id || ALL_PROJECTS_VALUE;
      const requestedTeamId = searchParams.get("teamId") || current.teamId;
      const nextAvailableTeams = getAvailableTeams(projects, nextProjectId);
      const nextTeamId = nextAvailableTeams.some(
        (team) => resolveTeamId(team) === String(requestedTeamId)
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
    if (searchParams.get("compose") !== "1") {
      return;
    }

    if (!canCreateIssue) {
      sanitizeComposeParams(searchParams, setSearchParams);
      setIsCreateDialogOpen(false);
      return;
    }

    if (projects.length) {
      setIsCreateDialogOpen(true);
    }
  }, [canCreateIssue, projects.length, searchParams, setSearchParams]);

  const selectedProject = useMemo(
    () => findProjectById(projects, filters.projectId),
    [filters.projectId, projects]
  );
  const availableTeams = useMemo(
    () => getAvailableTeams(projects, filters.projectId),
    [filters.projectId, projects]
  );

  const {
    data: issuesData = [],
    isLoading: isIssuesLoading,
    error: issuesError,
  } = useQuery({
    queryKey: [
      "issues",
      "issues-page",
      role,
      filters.projectId,
      filters.teamId,
      deferredSearch,
    ],
    queryFn: () =>
      fetchIssues({
        projectId:
          filters.projectId === ALL_PROJECTS_VALUE ? "" : filters.projectId,
        teamId: filters.teamId,
        search: deferredSearch,
    }),
    enabled: Boolean(projects.length),
  });
  const issues = useMemo(
    () => (Array.isArray(issuesData) ? issuesData : []),
    [issuesData]
  );

  const filteredIssues = useMemo(() => {
    if (!activeStatusFilter) {
      return issues;
    }

    if (activeStatusFilter === OPEN_ISSUES_QUERY_VALUE) {
      return issues.filter(
        (issue) => normalizeIssueStatus(issue.status, "") !== ISSUE_STATUS.DONE
      );
    }

    if (activeStatusFilter === CLOSED_ISSUES_QUERY_VALUE) {
      return issues.filter(
        (issue) => normalizeIssueStatus(issue.status, "") === ISSUE_STATUS.DONE
      );
    }

    return issues;
  }, [activeStatusFilter, issues]);

  const activeStatusLabel = useMemo(() => {
    if (activeStatusFilter === OPEN_ISSUES_QUERY_VALUE) {
      return "Showing: Open Issues";
    }

    if (activeStatusFilter === CLOSED_ISSUES_QUERY_VALUE) {
      return "Showing: Closed Issues";
    }

    return "";
  }, [activeStatusFilter]);

  const { data: dependencyIssuesData = [] } = useQuery({
    queryKey: ["issues", "issues-page", "dependency-options", role],
    queryFn: () => fetchIssues(),
    enabled:
      Boolean(projects.length) &&
      Boolean(isCreateDialogOpen || (isAdminView && selectedIssue)),
  });
  const dependencyIssues = useMemo(
    () => (Array.isArray(dependencyIssuesData) ? dependencyIssuesData : []),
    [dependencyIssuesData]
  );

  useEffect(() => {
    if (!selectedIssue) {
      return;
    }

    const nextIssue = filteredIssues.find((issue) => issue._id === selectedIssue._id);
    setSelectedIssue(nextIssue || null);
  }, [filteredIssues, selectedIssue]);

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
    const nextProjectId = normalizeProjectFilterValue(projectId);
    const nextAvailableTeams = getAvailableTeams(projects, nextProjectId);

    setFilters((current) => ({
      ...current,
      projectId: nextProjectId,
      teamId: nextAvailableTeams.some(
        (team) => resolveTeamId(team) === String(current.teamId)
      )
        ? current.teamId
        : "all",
    }));
  };

  const handleTeamChange = (teamId) => {
    setFilters((current) => ({
      ...current,
      teamId,
    }));
  };

  const handleSearchChange = (search) => {
    setFilters((current) => ({
      ...current,
      search,
    }));
  };

  const error = projectsError || issuesError;
  const composeType = isValidIssueType(searchParams.get("type"))
    ? searchParams.get("type")
    : "Task";
  const lockComposeType = searchParams.get("type") === "Task";
  const hasVisibleFilters = Boolean(
    activeStatusFilter ||
      filters.projectId !== ALL_PROJECTS_VALUE ||
      filters.teamId !== "all" ||
      filters.search.trim()
  );

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

  return (
    <div className="space-y-4">
      <IssuesToolbar
        filters={filters}
        projects={projects}
        teams={availableTeams}
        visibleIssueCount={filteredIssues.length}
        activeStatusLabel={activeStatusLabel}
        selectedProject={selectedProject}
        canCreateIssue={canCreateIssue}
        isCreateDisabled={!projects.length || !canCreateIssue}
        onProjectChange={handleProjectChange}
        onTeamChange={handleTeamChange}
        onSearchChange={handleSearchChange}
        onCreateIssue={() => setIsCreateDialogOpen(true)}
      />

      {isProjectsLoading || isIssuesLoading ? (
        <IssueBoardSkeleton />
      ) : (
        <IssueBoard
          issues={filteredIssues}
          updatingId={updateIssueMutation.isPending ? updateIssueMutation.variables?.id : ""}
          canEditIssue={isAdminView}
          canChangeStatus
          onSelectIssue={setSelectedIssue}
          onStatusChange={(id, status) =>
            updateIssueMutation.mutateAsync({
              id,
              payload: { status },
            })
          }
          emptyStateTitle={
            hasVisibleFilters ? "No issues match this board view" : "No issues in this board"
          }
          emptyStateDescription={
            hasVisibleFilters
              ? "Adjust the project, team, or search filters to widen the board."
              : "Create the first issue to populate the kanban board."
          }
        />
      )}

      <IssueCreateDialog
        open={canCreateIssue && isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);

          if (!open && searchParams.get("compose") === "1") {
            sanitizeComposeParams(searchParams, setSearchParams);
          }
        }}
        projects={projects}
        availableIssues={dependencyIssues}
        defaultProjectId={
          filters.projectId === ALL_PROJECTS_VALUE ? "" : filters.projectId
        }
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
        canEditCoreDetails={isAdminView}
        canEditPriority={isAdminView}
        canEditAssignee={isAdminView}
        canDeleteIssue={canDeleteIssue}
      />
    </div>
  );
};

export default IssuesPage;
