import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import {
  Bug,
  CheckCircle2,
  ClipboardList,
  Link2,
  LoaderCircle,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { formatDate, getInitials } from "@/lib/utils";
import {
  getProjectMembers,
  getProjectTeams,
} from "@/lib/project-teams";
import {
  memberSelectStyles,
} from "@/components/projects/memberSelectTheme";

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

const ProjectMembersPreview = ({ members = [] }) => {
  const visibleMembers = members.slice(0, 4);
  const overflowCount = Math.max(members.length - visibleMembers.length, 0);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-sm font-semibold text-white/90">Members: {members.length}</span>
      <div className="flex items-center">
        {visibleMembers.map((member, index) => (
          <Avatar
            key={member._id}
            className={`avatar-pop-in h-10 w-10 rounded-2xl border-2 border-white/80 bg-white/18 text-xs text-white shadow-lg backdrop-blur ${index === 0 ? "" : "-ml-2.5"}`}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <AvatarFallback className="bg-transparent text-white">
              {getInitials(member.name)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      {overflowCount ? (
        <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-2 text-xs font-semibold text-white shadow-sm backdrop-blur">
          +{overflowCount}
        </span>
      ) : null}
    </div>
  );
};

const ProjectCard = ({
  project,
  index = 0,
  workspaceTeams = [],
  canManageProject = false,
  onAttachTeam,
  onDetachTeam,
  onUpdateStatus,
  isAttachingTeam = false,
  isUpdatingStatus = false,
  detachingTeamId = "",
  teamsErrorMessage = "",
}) => {
  const navigate = useNavigate();
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamError, setTeamError] = useState("");
  const [statusError, setStatusError] = useState("");

  const members = useMemo(() => getProjectMembers(project), [project]);
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

  const handleTeamDialogChange = (open) => {
    setIsTeamDialogOpen(open);

    if (!open) {
      setTeamError("");
      setSelectedTeamId("");
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

  const handleDetachTeam = async (teamId) => {
    try {
      setTeamError("");
      await onDetachTeam({
        projectId: project._id,
        teamId,
      });
    } catch (error) {
      setTeamError(
        error.response?.data?.message || "Unable to detach the selected team."
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

  const actionButtonClass =
    "interactive-button h-10 rounded-2xl border border-slate-200 bg-white/88 px-4 text-sm font-semibold text-slate-900 shadow-sm hover:border-slate-300 hover:bg-white";

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
              {project.description ? (
                <p className="mt-2 max-w-2xl line-clamp-2 text-sm leading-6 text-white/85">
                  {project.description}
                </p>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-col items-start gap-3 lg:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge isCompleted={Boolean(project.isCompleted)} />
                {canManageProject ? (
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
                ) : null}
              </div>

              <ProjectMembersPreview members={members} />
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
          </div>

          {teamError && !isTeamDialogOpen ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {teamError}
            </div>
          ) : null}

          {teamsErrorMessage ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {teamsErrorMessage}
            </div>
          ) : null}

          <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.82),rgba(255,255,255,0.98))] p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Attached Teams</p>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Team-based membership only
                </p>
              </div>

              {canManageProject ? (
                <Button
                  className="interactive-button h-9 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm hover:border-slate-300 hover:bg-white"
                  disabled={Boolean(teamsErrorMessage) || !availableTeams.length}
                  type="button"
                  onClick={() => handleTeamDialogChange(true)}
                >
                  <Plus className="h-4 w-4" />
                  + Attach Team
                </Button>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {attachedTeams.length ? (
                attachedTeams.map((team) => (
                  <div
                    key={team._id}
                    className="interactive-card inline-flex max-w-full items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-950">
                          {team.name}
                        </span>
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <span className="text-xs font-medium text-slate-500">
                          {team.memberCount || team.members?.length || 0} members
                        </span>
                      </div>
                    </div>

                    {canManageProject ? (
                      <button
                        type="button"
                        className="interactive-button inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          detachingTeamId === team._id || typeof onDetachTeam !== "function"
                        }
                        onClick={() => handleDetachTeam(team._id)}
                      >
                        {detachingTeamId === team._id ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="w-full rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  No teams attached yet.
                </div>
              )}
            </div>
          </div>
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
    </>
  );
};

export default ProjectCard;
