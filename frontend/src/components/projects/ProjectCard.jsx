import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ClipboardList,
  Link2,
  LoaderCircle,
  Plus,
  RotateCcw,
  Trash2,
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
        ? "inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-50 backdrop-blur"
        : "inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm font-semibold text-white backdrop-blur"
    }
  >
    <span
      className={
        isCompleted
          ? "h-2.5 w-2.5 rounded-full bg-emerald-300"
          : "h-2.5 w-2.5 rounded-full bg-white"
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

const ProjectAssignmentChip = ({ label, value }) => (
  <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-[12px] leading-5 text-white/85 backdrop-blur">
    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
      {label}
    </span>
    <span className="truncate font-medium text-white/95">{value}</span>
  </div>
);

const ProjectTeamsPreview = ({ teams = [] }) => {
  const visibleTeams = teams.slice(0, 3);
  const overflowTeams = Math.max(teams.length - visibleTeams.length, 0);

  return (
    <div className="flex max-w-full flex-col items-start gap-2 rounded-[24px] border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-lg lg:items-end">
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/70">
        <span>Attached Teams</span>
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-white/25 bg-white/14 px-2 text-[10px] font-semibold text-white">
          {teams.length}
        </span>
      </div>

      <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
        {visibleTeams.length ? (
          visibleTeams.map((team) => (
            <span
              key={team._id}
              className="inline-flex max-w-full items-center rounded-full border border-white/35 bg-white/16 px-2.5 py-1 text-xs font-medium text-white backdrop-blur"
            >
              <span className="truncate">
                {team.name} ({team.memberCount || team.members?.length || 0})
              </span>
            </span>
          ))
        ) : (
          <span className="text-xs text-white/75">No teams attached</span>
        )}
        {overflowTeams ? (
          <span className="inline-flex items-center rounded-full border border-white/35 bg-white/16 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
            +{overflowTeams}
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
    "interactive-button h-10 rounded-2xl border border-slate-200 bg-white/88 px-4 text-sm font-semibold text-slate-900 shadow-sm hover:border-slate-300 hover:bg-white";
  const isDeleteConfirmationValid =
    deleteConfirmationValue.trim() === String(project.name || "").trim();

  return (
    <>
      <Card
        className="page-shell-enter interactive-card min-w-0 overflow-hidden border-white/60 bg-white/76 shadow-[0_28px_70px_-38px_rgba(15,23,42,0.34)] backdrop-blur-xl"
        style={{ animationDelay: `${index * 45}ms` }}
      >
        <div
          className="relative overflow-hidden px-5 py-5 text-white backdrop-blur-xl sm:px-6"
          style={{ backgroundImage: "linear-gradient(135deg, #6366f1, #ec4899)" }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.16),transparent_38%)]" />
          <div className="pointer-events-none absolute -right-16 top-0 h-36 w-36 rounded-full bg-white/18 blur-3xl" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/70">
                <span>Project</span>
                <span className="h-1 w-1 rounded-full bg-white/70" />
                <span>Created {formatDate(project.createdAt)}</span>
              </div>
              <h3 className="mt-2 break-words text-2xl font-semibold leading-tight text-white">
                {project.name}
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <ProjectAssignmentChip label="Manager" value={managerName} />
                <ProjectAssignmentChip label="Team Lead" value={teamLeadName} />
              </div>
              {project.description ? (
                <p className="mt-3 max-w-2xl line-clamp-2 text-sm leading-6 text-white/85">
                  {project.description}
                </p>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-col items-start gap-3 lg:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge isCompleted={Boolean(project.isCompleted)} />
                {canManageProject ? (
                  <>
                    <Button
                      className="interactive-button h-10 rounded-2xl border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-white/18"
                      disabled={isUpdatingStatus}
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
                      {project.isCompleted ? "Reopen Project" : "Mark as Completed"}
                    </Button>
                    <Button
                      className="interactive-button h-10 w-10 rounded-2xl border border-rose-300/45 bg-rose-500/18 p-0 text-rose-50 shadow-[0_18px_36px_-24px_rgba(244,63,94,0.95)] backdrop-blur hover:bg-rose-500/28"
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
                  </>
                ) : null}
              </div>

              <ProjectTeamsPreview teams={attachedTeams} />
            </div>
          </div>
        </div>

        <CardContent className="space-y-4 p-5 sm:p-6">
          {statusError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {statusError}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Issues", value: project.issueCount || 0 },
              { label: "Members", value: project.memberCount || 0 },
              { label: "Teams", value: project.teamCount || 0 },
            ].map((item) => (
              <div
                key={item.label}
                className="interactive-card rounded-[22px] border border-slate-200 bg-white/88 px-4 py-3 shadow-sm"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className={actionButtonClass}
              type="button"
              onClick={() => navigate(`/issues?projectId=${project._id}&compose=1`)}
            >
              <Bug className="h-4 w-4" />
              + Create Issue
            </Button>

            <Button
              className={actionButtonClass}
              type="button"
              onClick={() =>
                navigate(`/issues?projectId=${project._id}&compose=1&type=Task`)
              }
            >
              <ClipboardList className="h-4 w-4" />
              + Create Task
            </Button>

            {canManageProject ? (
              <Button
                className={actionButtonClass}
                disabled={Boolean(teamsErrorMessage) || !availableTeams.length}
                type="button"
                onClick={() => handleTeamDialogChange(true)}
              >
                <Link2 className="h-4 w-4" />
                + Attach Team
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
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

