import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ClipboardList,
  Layers3,
  Link2,
  ListChecks,
  LoaderCircle,
  RotateCcw,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDate, getInitials } from "@/lib/utils";
import { getProjectTeams } from "@/lib/project-teams";
import { memberSelectStyles } from "@/components/projects/memberSelectTheme";

const TEAMS_NEW_MEETING_BASE_URL = "https://teams.microsoft.com/l/meeting/new";
const PROJECT_CARD_PALETTES = [
  {
    headerGradient: "linear-gradient(135deg, #1d4ed8 0%, #0f766e 100%)",
    accentGradient: "linear-gradient(90deg, #dbeafe 0%, #ccfbf1 100%)",
    glowColor: "rgba(219, 234, 254, 0.28)",
  },
  {
    headerGradient: "linear-gradient(135deg, #be123c 0%, #7c3aed 100%)",
    accentGradient: "linear-gradient(90deg, #ffe4e6 0%, #ede9fe 100%)",
    glowColor: "rgba(244, 114, 182, 0.18)",
  },
  {
    headerGradient: "linear-gradient(135deg, #047857 0%, #0369a1 100%)",
    accentGradient: "linear-gradient(90deg, #d1fae5 0%, #e0f2fe 100%)",
    glowColor: "rgba(125, 211, 252, 0.18)",
  },
  {
    headerGradient: "linear-gradient(135deg, #334155 0%, #2563eb 100%)",
    accentGradient: "linear-gradient(90deg, #e2e8f0 0%, #dbeafe 100%)",
    glowColor: "rgba(191, 219, 254, 0.2)",
  },
  {
    headerGradient: "linear-gradient(135deg, #0e7490 0%, #4338ca 100%)",
    accentGradient: "linear-gradient(90deg, #cffafe 0%, #e0e7ff 100%)",
    glowColor: "rgba(103, 232, 249, 0.18)",
  },
  {
    headerGradient: "linear-gradient(135deg, #4d7c0f 0%, #0f766e 100%)",
    accentGradient: "linear-gradient(90deg, #ecfccb 0%, #ccfbf1 100%)",
    glowColor: "rgba(190, 242, 100, 0.16)",
  },
];

const buildTeamOption = (team) => ({
  value: team._id,
  label: team.name,
  description: team.description || "",
  memberCount: team.memberCount || team.members?.length || 0,
});

const formatTeamOptionLabel = (option, { context }) => {
  if (context !== "menu") {
    return option.label;
  }

  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-gradient-to-br from-indigo-100 to-pink-100 text-xs font-semibold text-slate-700 shadow-sm">
        {getInitials(option.label)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{option.label}</p>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
            {option.memberCount} members
          </span>
          <span className="truncate">
            {option.description || "No team description provided."}
          </span>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ isCompleted }) => (
  <span
    className={
      isCompleted
        ? "inline-flex h-8 items-center gap-2 rounded-full bg-emerald-400/20 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-200/30 backdrop-blur"
        : "inline-flex h-8 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur"
    }
  >
    <span
      className={
        isCompleted
          ? "h-2 w-2 rounded-full bg-emerald-300"
          : "h-2 w-2 rounded-full bg-white"
      }
    />
    {isCompleted ? "Completed" : "Active"}
  </span>
);

const getProjectAssignmentName = (value) => {
  if (!value || typeof value !== "object") {
    return "Unassigned";
  }

  const name = typeof value.name === "string" ? value.name.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim() : "";

  return name || email || "Unassigned";
};

const ProjectAssignmentsSummary = ({ managerName, teamLeadName }) => (
  <p
    className="mt-4 max-w-full truncate text-sm font-medium leading-6 text-white/90"
    title={`${managerName} \u2022 ${teamLeadName}`}
  >
    <span>{managerName}</span>
    <span className="mx-2 text-white/45">{"\u2022"}</span>
    <span>{teamLeadName}</span>
  </p>
);

const ProjectTeamsPreview = ({ teams = [] }) => {
  const visibleTeams = teams.slice(0, 2);
  const overflowTeams = Math.max(teams.length - visibleTeams.length, 0);

  return (
    <div className="flex w-full max-w-full flex-col gap-3 pt-1">
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase text-white/70">
        <span>Attached Teams</span>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/10 px-2 text-[10px] font-semibold text-white/90 ring-1 ring-white/10">
          {teams.length}
        </span>
      </div>

      <div className="flex max-w-full flex-wrap items-center justify-start gap-2">
        {visibleTeams.length ? (
          visibleTeams.map((team) => (
            <span
              key={team._id}
              className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white/90 ring-1 ring-white/10 backdrop-blur"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white ring-1 ring-white/20">
                {getInitials(team.name)}
              </span>
              <span className="max-w-[11rem] truncate">
                {team.name}
              </span>
              <span className="text-white/55">
                {team.memberCount || team.members?.length || 0}
              </span>
            </span>
          ))
        ) : (
          <span className="text-xs text-white/75">No teams attached</span>
        )}
        {overflowTeams ? (
          <span className="inline-flex h-9 items-center rounded-full bg-white/20 px-3 text-xs font-semibold text-white ring-1 ring-white/10 backdrop-blur">
            +{overflowTeams} more
          </span>
        ) : null}
      </div>
    </div>
  );
};

const ProjectCard = ({
  project,
  index = 0,
  workspaceTeams = [],
  canManageProject = false,
  onAttachTeam,
  onUpdateStatus,
  onDeleteProject,
  onOpenTeamsComposer,
  isAttachingTeam = false,
  isUpdatingStatus = false,
  isDeletingProject = false,
  teamsErrorMessage = "",
}) => {
  const navigate = useNavigate();
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [deleteConfirmationValue, setDeleteConfirmationValue] = useState("");
  const [teamError, setTeamError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [teamsActionError, setTeamsActionError] = useState("");
  const managerName = getProjectAssignmentName(project?.manager);
  const teamLeadName = getProjectAssignmentName(project?.teamLead);
  const palette = PROJECT_CARD_PALETTES[index % PROJECT_CARD_PALETTES.length];
  const projectTitle = String(project?.name || "").trim() || "Untitled project";
  const projectCreatedAt = project?.createdAt ? formatDate(project.createdAt) : "Unknown";
  const projectShortCode = String(project?.shortCode || "").trim().toUpperCase();

  const attachedTeams = useMemo(() => getProjectTeams(project), [project]);
  const attachedTeamIds = useMemo(
    () =>
      new Set(
        attachedTeams
          .map((team) => team?._id || team)
          .filter(Boolean)
          .map((teamId) => String(teamId))
      ),
    [attachedTeams]
  );

  const availableTeams = useMemo(
    () =>
      [...workspaceTeams]
        .filter((team) => !attachedTeamIds.has(String(team._id)))
        .sort((left, right) => (left.name || "").localeCompare(right.name || "")),
    [workspaceTeams, attachedTeamIds]
  );

  const availableTeamOptions = useMemo(
    () => availableTeams.map(buildTeamOption),
    [availableTeams]
  );

  const selectedTeamOption = useMemo(
    () =>
      availableTeamOptions.find((option) => option.value === selectedTeamId) || null,
    [availableTeamOptions, selectedTeamId]
  );

  useEffect(() => {
    if (!isTeamDialogOpen) {
      setTeamError("");
      return;
    }

    if (!availableTeams.length) {
      setSelectedTeamId("");
      return;
    }

    if (!selectedTeamId || !availableTeams.some((team) => team._id === selectedTeamId)) {
      setSelectedTeamId(availableTeams[0]._id);
    }
  }, [availableTeams, isTeamDialogOpen, selectedTeamId]);

  useEffect(() => {
    setTeamsActionError("");
  }, [project?._id]);

  useEffect(() => {
    setDeleteConfirmationValue("");
    setIsDeleteDialogOpen(false);
  }, [project?._id]);

  const handleTeamDialogChange = (open) => {
    setIsTeamDialogOpen(open);

    if (!open) {
      setTeamError("");
      setSelectedTeamId("");
    }
  };

  const handleDeleteDialogChange = (open) => {
    if (isDeletingProject && !open) {
      return;
    }

    setIsDeleteDialogOpen(open);

    if (!open) {
      setDeleteConfirmationValue("");
    }
  };

  const handleAttachTeam = async () => {
    if (!selectedTeamId) {
      setTeamError("Select a workspace team to attach.");
      return;
    }

    try {
      setTeamError("");
      await onAttachTeam({
        projectId: project._id,
        teamId: selectedTeamId,
      });
      handleTeamDialogChange(false);
    } catch (error) {
      setTeamError(
        error.response?.data?.message || "Unable to attach the selected team."
      );
    }
  };

  const handleStatusToggle = async () => {
    try {
      setStatusError("");
      await onUpdateStatus({
        projectId: project._id,
        isCompleted: !project.isCompleted,
      });
    } catch (error) {
      setStatusError(
        error.response?.data?.message || "Unable to update project status."
      );
    }
  };

  const handleDeleteProject = async () => {
    if (typeof onDeleteProject !== "function") {
      return;
    }

    await onDeleteProject(project._id);

    navigate("/projects", {
      replace: true,
      state: {
        toast: {
          type: "success",
          message: "Project deleted successfully",
        },
      },
    });
  };

  const handleOpenTeams = () => {
    const subject = `${String(project?.name || "Project").trim() || "Project"} Meeting`;
    const teamsMeetingUrl = `${TEAMS_NEW_MEETING_BASE_URL}?subject=${encodeURIComponent(subject)}`;
    const openedWindow = window.open(teamsMeetingUrl, "_blank", "noopener,noreferrer");

    if (!openedWindow) {
      setTeamsActionError(
        "Unable to open Microsoft Teams. Please allow pop-ups and try again."
      );
      return;
    }

    if (typeof onOpenTeamsComposer === "function") {
      onOpenTeamsComposer();
    }

    setTeamsActionError("");
  };

  const actionButtonClass =
    "interactive-button h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-sm hover:border-blue-200 hover:bg-blue-50 sm:w-auto";
  const isDeleteConfirmationValid =
    deleteConfirmationValue.trim() === String(project.name || "").trim();
  const metricItems = [
    { label: "Issues", value: project.issueCount || 0, icon: ListChecks },
    { label: "Members", value: project.memberCount || 0, icon: Users },
    { label: "Teams", value: project.teamCount || 0, icon: Layers3 },
  ];

  return (
    <>
      <Card
        className="page-shell-enter interactive-card flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_22px_56px_-42px_rgba(15,23,42,0.42)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_-42px_rgba(15,23,42,0.5)]"
        style={{ animationDelay: `${index * 45}ms` }}
      >
        <div
          className="relative min-h-[238px] overflow-hidden px-5 py-5 text-white sm:px-6"
          style={{ backgroundImage: palette.headerGradient }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.13)_0%,rgba(255,255,255,0)_44%,rgba(15,23,42,0.13)_100%)]" />

          <div className="relative flex h-full min-w-0 flex-col gap-5">
            <div className="flex min-w-0 items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase text-white/70">
                  <span>Project</span>
                  {projectShortCode ? (
                    <>
                      <span className="h-1 w-1 rounded-full bg-white/60" />
                      <span>{projectShortCode}</span>
                    </>
                  ) : null}
                  <span className="h-1 w-1 rounded-full bg-white/60" />
                  <span>Created {projectCreatedAt}</span>
                </div>
                <h3
                  className="mt-3 line-clamp-2 max-w-[32rem] text-2xl font-semibold leading-tight text-white sm:text-[28px]"
                  title={projectTitle}
                >
                  {projectTitle}
                </h3>
                <span
                  aria-hidden="true"
                  className="mt-3 h-[3px] w-24 max-w-[45%] rounded-full opacity-95"
                  style={{
                    backgroundImage: palette.accentGradient,
                    boxShadow: `0 0 0 1px rgba(255, 255, 255, 0.24), 0 0 18px ${palette.glowColor}`,
                  }}
                />
                <ProjectAssignmentsSummary
                  managerName={managerName}
                  teamLeadName={teamLeadName}
                />
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <StatusBadge isCompleted={Boolean(project.isCompleted)} />
                {canManageProject ? (
                  <div className="flex items-center gap-1.5 rounded-2xl bg-white/10 p-1 ring-1 ring-white/20 backdrop-blur">
                    <Button
                      aria-label={project.isCompleted ? "Reopen Project" : "Mark as Completed"}
                      className="interactive-button h-9 w-9 rounded-xl bg-white/10 p-0 text-white ring-1 ring-white/10 hover:bg-white/20"
                      disabled={isUpdatingStatus}
                      title={project.isCompleted ? "Reopen Project" : "Mark as Completed"}
                      type="button"
                      onClick={handleStatusToggle}
                    >
                      {isUpdatingStatus ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : project.isCompleted ? (
                        <RotateCcw className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span className="sr-only">
                        {project.isCompleted ? "Reopen Project" : "Mark as Completed"}
                      </span>
                    </Button>
                    <Button
                      className="interactive-button h-9 w-9 rounded-xl bg-rose-500/20 p-0 text-rose-50 ring-1 ring-rose-200/30 shadow-[0_18px_36px_-24px_rgba(244,63,94,0.95)] backdrop-blur hover:bg-rose-500/30"
                      disabled={isDeletingProject}
                      size="icon"
                      title="Delete Project"
                      type="button"
                      onClick={() => handleDeleteDialogChange(true)}
                    >
                      {isDeletingProject ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span className="sr-only">Delete Project</span>
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            <ProjectTeamsPreview teams={attachedTeams} />
          </div>
        </div>

        <CardContent className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
          {project.description ? (
            <p className="line-clamp-2 text-sm leading-6 text-slate-600">
              {project.description}
            </p>
          ) : (
            <div className="min-h-[3rem]" aria-hidden="true" />
          )}

          {statusError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {statusError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {metricItems.map((item) => {
              const MetricIcon = item.icon;

              return (
                <div
                  key={item.label}
                  className="interactive-card min-h-[88px] rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 shadow-sm transition duration-200 hover:border-blue-200 hover:bg-white hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">
                      {item.label}
                    </p>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
                      <MetricIcon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            <Button
              className={`${actionButtonClass} border-blue-500/20 bg-blue-600 text-white shadow-[0_18px_32px_-24px_rgba(37,99,235,0.95)] hover:border-blue-500/30 hover:bg-blue-700`}
              type="button"
              onClick={() => navigate(`/issues?projectId=${project._id}&compose=1`)}
            >
              <Bug className="h-4 w-4" />
              Create Issue
            </Button>

            <Button
              className={actionButtonClass}
              type="button"
              onClick={() =>
                navigate(`/issues?projectId=${project._id}&compose=1&type=Task`)
              }
            >
              <ClipboardList className="h-4 w-4" />
              Create Task
            </Button>

            {canManageProject ? (
              <Button
                className={actionButtonClass}
                disabled={Boolean(teamsErrorMessage) || !availableTeams.length}
                type="button"
                onClick={() => handleTeamDialogChange(true)}
              >
                <Link2 className="h-4 w-4" />
                Attach Team
              </Button>
            ) : null}

            <Button className={actionButtonClass} type="button" onClick={handleOpenTeams}>
              <Video className="h-4 w-4" />
              Open in Teams
            </Button>
          </div>

          {teamError && !isTeamDialogOpen ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {teamError}
            </div>
          ) : null}

          {teamsActionError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {teamsActionError}
            </div>
          ) : null}

          {teamsErrorMessage ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {teamsErrorMessage}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={isTeamDialogOpen} onOpenChange={handleTeamDialogChange}>
        <DialogContent className="max-w-xl border-white/70 bg-white/92 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.48)] backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle>Attach Team</DialogTitle>
            <DialogDescription>
              Link a workspace team to{" "}
              <span className="font-semibold text-slate-950">{project.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {teamsErrorMessage ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {teamsErrorMessage}
              </div>
            ) : !availableTeams.length ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                All workspace teams are already attached to this project.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Select team</span>
                  <Select
                    options={availableTeamOptions}
                    value={selectedTeamOption}
                    styles={memberSelectStyles}
                    formatOptionLabel={formatTeamOptionLabel}
                    placeholder="Search workspace teams"
                    noOptionsMessage={() => "No available teams to attach."}
                    onChange={(option) => setSelectedTeamId(option?.value || "")}
                  />
                </div>

                {selectedTeamOption ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {selectedTeamOption.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {selectedTeamOption.description ||
                            "No team description provided yet."}
                        </p>
                      </div>
                      <Badge className="border border-slate-200 bg-white text-slate-700 hover:bg-white">
                        {selectedTeamOption.memberCount} members
                      </Badge>
                    </div>
                  </div>
                ) : null}
              </>
            )}

            {teamError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {teamError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() => handleTeamDialogChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="interactive-button"
              disabled={
                isAttachingTeam ||
                Boolean(teamsErrorMessage) ||
                !availableTeams.length ||
                !selectedTeamId
              }
              type="button"
              onClick={handleAttachTeam}
            >
              {isAttachingTeam ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {isAttachingTeam ? "Attaching..." : "Attach Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
        <DialogContent className="max-w-lg border-white/70 bg-white/94 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.52)] backdrop-blur-2xl">
          <DialogHeader className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 shadow-sm">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <DialogTitle>Delete Project</DialogTitle>
              <DialogDescription>
                This action will permanently delete the project and all associated
                data.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-rose-200 bg-[linear-gradient(145deg,rgba(255,241,242,0.96),rgba(255,255,255,0.98))] p-4 text-sm text-rose-900 shadow-sm">
              <p className="font-semibold">This action cannot be undone.</p>
              <p className="mt-2 leading-6 text-rose-700">
                Type the project name exactly as shown to confirm the deletion.
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase text-slate-500">
                Project Name
              </p>
              <p className="mt-2 break-words text-lg font-semibold text-slate-950">
                {project.name}
              </p>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Confirmation
              </span>
              <Input
                autoComplete="off"
                className="rounded-[20px] border-slate-300"
                disabled={isDeletingProject}
                placeholder={`Type "${project.name}"`}
                value={deleteConfirmationValue}
                onChange={(event) => setDeleteConfirmationValue(event.target.value)}
              />
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() => handleDeleteDialogChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!isDeleteConfirmationValid || isDeletingProject}
              type="button"
              onClick={handleDeleteProject}
            >
              {isDeletingProject ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {isDeletingProject ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProjectCard;

