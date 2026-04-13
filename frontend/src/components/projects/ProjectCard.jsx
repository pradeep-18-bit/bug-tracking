import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import {
  Bug,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Link2,
  LoaderCircle,
  Plus,
  RotateCcw,
  Video,
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
import { fetchProjectMeetings } from "@/lib/api";
import { formatDate, getInitials } from "@/lib/utils";
import {
  getProjectMembers,
  getProjectTeams,
} from "@/lib/project-teams";
import {
  memberSelectStyles,
} from "@/components/projects/memberSelectTheme";

const MEETING_DURATION_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 hr", value: 60 },
  { label: "1 hr 30 min", value: 90 },
  { label: "2 hr", value: 120 },
];

const padDateSegment = (value) => String(value).padStart(2, "0");

const toDateInputValue = (date) =>
  `${date.getFullYear()}-${padDateSegment(date.getMonth() + 1)}-${padDateSegment(
    date.getDate()
  )}`;

const toTimeInputValue = (date) =>
  `${padDateSegment(date.getHours())}:${padDateSegment(date.getMinutes())}`;

const buildDefaultMeetingDateTime = () => {
  const now = new Date();
  const roundedMinutes = Math.ceil((now.getMinutes() + 1) / 15) * 15;
  now.setMinutes(roundedMinutes, 0, 0);

  return {
    date: toDateInputValue(now),
    time: toTimeInputValue(now),
  };
};

const formatMeetingDateTime = (value) => {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatMeetingDateLabel = (value) => {
  if (!value) {
    return "Select date";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Select date";
  }

  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const formatDateValue = (date) =>
  `${date.getFullYear()}-${padDateSegment(date.getMonth() + 1)}-${padDateSegment(
    date.getDate()
  )}`;

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getCalendarCells = (monthDate) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingSlots = firstDayOfMonth.getDay();
  const totalSlots = Math.ceil((leadingSlots + daysInMonth) / 7) * 7;

  return Array.from({ length: totalSlots }, (_, index) => {
    const dayNumber = index - leadingSlots + 1;

    if (dayNumber < 1 || dayNumber > daysInMonth) {
      return null;
    }

    return new Date(year, month, dayNumber);
  });
};

const buildTimeOptions = () => {
  const options = [];

  for (let minutes = 0; minutes < 24 * 60; minutes += 15) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const value = `${padDateSegment(hour)}:${padDateSegment(minute)}`;
    const label = new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    options.push({
      value,
      label,
    });
  }

  return options;
};

const TIME_OPTIONS = buildTimeOptions();
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

const ProjectMembersPreview = ({ members = [], teams = [] }) => {
  const visibleMembers = members.slice(0, 4);
  const overflowCount = Math.max(members.length - visibleMembers.length, 0);
  const visibleTeams = teams.slice(0, 3);
  const overflowTeams = Math.max(teams.length - visibleTeams.length, 0);

  return (
    <div className="flex max-w-full flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-sm font-semibold text-white/90">Members:</span>
        <div className="flex items-center">
          {visibleMembers.map((member, index) => (
            <Avatar
              key={member._id}
              className={`avatar-pop-in h-9 w-9 rounded-xl border-2 border-white/80 bg-white/18 text-xs text-white shadow-lg backdrop-blur ${index === 0 ? "" : "-ml-2"}`}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <AvatarFallback className="bg-transparent text-white">
                {getInitials(member.name)}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        {overflowCount ? (
          <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-white/25 bg-white/12 px-2 text-xs font-semibold text-white shadow-sm backdrop-blur">
            +{overflowCount}
          </span>
        ) : null}
      </div>

      <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
        <span className="text-sm font-semibold text-white/90">Teams:</span>
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
  onOpenTeamsComposer,
  isAttachingTeam = false,
  isUpdatingStatus = false,
  teamsErrorMessage = "",
}) => {
  const navigate = useNavigate();
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamError, setTeamError] = useState("");
  const [statusError, setStatusError] = useState("");
  const defaultMeetingDateTime = useMemo(() => buildDefaultMeetingDateTime(), []);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(defaultMeetingDateTime.date);
  const [meetingTime, setMeetingTime] = useState(defaultMeetingDateTime.time);
  const [meetingDuration, setMeetingDuration] = useState(
    String(MEETING_DURATION_OPTIONS[0].value)
  );
  const [meetingError, setMeetingError] = useState("");
  const [meetingWarning, setMeetingWarning] = useState("");
  const [latestScheduledMeeting, setLatestScheduledMeeting] = useState(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const calendarPopoverRef = useRef(null);

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

  const {
    data: projectMeetings = [],
    isLoading: isMeetingsLoading,
    error: meetingsError,
  } = useQuery({
    queryKey: ["project-meetings", project?._id],
    queryFn: () => fetchProjectMeetings({ projectId: project._id }),
    enabled: Boolean(project?._id),
    staleTime: 45_000,
  });

  const upcomingMeetings = useMemo(
    () =>
      [...projectMeetings]
        .filter((meeting) => {
          const endDate = new Date(meeting?.endDateTime);
          return !Number.isNaN(endDate.getTime()) && endDate.getTime() >= Date.now();
        })
        .sort(
          (left, right) =>
            new Date(left?.startDateTime).getTime() -
            new Date(right?.startDateTime).getTime()
        ),
    [projectMeetings]
  );

  const highlightedMeeting = latestScheduledMeeting || upcomingMeetings[0] || null;
  const attendeePreview = useMemo(() => {
    const attendeesByEmail = new Map();

    attachedTeams.forEach((team) => {
      (team?.members || []).forEach((member) => {
        const email = String(member?.email || "").trim().toLowerCase();
        const userId = String(member?._id || "");

        if (!email || attendeesByEmail.has(email)) {
          return;
        }

        attendeesByEmail.set(email, {
          _id: userId,
          name: member?.name || email,
          email,
        });
      });
    });

    return Array.from(attendeesByEmail.values()).sort((left, right) =>
      left.name.localeCompare(right.name)
    );
  }, [attachedTeams]);
  const visibleAttendees = attendeePreview.slice(0, 4);
  const overflowAttendees = attendeePreview.slice(4);
  const selectedMeetingDate = useMemo(
    () => (meetingDate ? new Date(`${meetingDate}T00:00:00`) : null),
    [meetingDate]
  );
  const todayStart = useMemo(() => startOfDay(new Date()), []);
  const currentMonthStart = useMemo(
    () => new Date(todayStart.getFullYear(), todayStart.getMonth(), 1),
    [todayStart]
  );
  const canNavigateToPreviousMonth = calendarMonth.getTime() > currentMonthStart.getTime();
  const calendarCells = useMemo(() => getCalendarCells(calendarMonth), [calendarMonth]);
  const computedEndDateTime = useMemo(() => {
    if (!meetingDate || !meetingTime) {
      return null;
    }

    const parsedDuration = Number(meetingDuration);
    const startDate = new Date(`${meetingDate}T${meetingTime}`);

    if (Number.isNaN(startDate.getTime()) || !Number.isFinite(parsedDuration)) {
      return null;
    }

    return new Date(startDate.getTime() + parsedDuration * 60 * 1000);
  }, [meetingDate, meetingDuration, meetingTime]);
  const computedEndTimeLabel = useMemo(() => {
    if (!computedEndDateTime) {
      return "";
    }

    return computedEndDateTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }, [computedEndDateTime]);

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
    setMeetingError("");
    setMeetingWarning("");
    setLatestScheduledMeeting(null);
    setIsCalendarOpen(false);
  }, [project?._id]);

  useEffect(() => {
    if (!isCalendarOpen) {
      return undefined;
    }

    const handleOutsidePointer = (event) => {
      if (!calendarPopoverRef.current?.contains(event.target)) {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsidePointer);
    return () => document.removeEventListener("mousedown", handleOutsidePointer);
  }, [isCalendarOpen]);

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

  const handleScheduleMeeting = async (event) => {
    event.preventDefault();

    const subject = meetingTitle.trim() || `${project.name} Meeting`;
    const teamsMeetingUrl = `${TEAMS_NEW_MEETING_BASE_URL}?subject=${encodeURIComponent(subject)}`;
    const openedWindow = window.open(teamsMeetingUrl, "_blank", "noopener,noreferrer");

    if (!openedWindow) {
      setMeetingError("Unable to open Microsoft Teams. Please allow pop-ups and try again.");
      return;
    }

    if (typeof onOpenTeamsComposer === "function") {
      onOpenTeamsComposer();
    }

    setMeetingError("");
    setMeetingWarning("You'll complete scheduling in Microsoft Teams.");
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

              <ProjectMembersPreview members={members} teams={attachedTeams} />
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

          <div className="space-y-3">
            <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(155deg,rgba(238,242,255,0.92),rgba(255,255,255,0.98))] p-3 shadow-sm sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5] text-white shadow-[0_10px_20px_-12px_rgba(79,70,229,0.8)]">
                    <Video className="h-4 w-4" />
                    <span className="absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-[#0EA5E9] text-[9px] font-bold text-white">
                      T
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      Schedule Team Meeting
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Microsoft Teams
                    </p>
                  </div>
                </div>
              </div>

              <form className="mt-3 space-y-2.5" onSubmit={handleScheduleMeeting}>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Meeting Title
                  </span>
                  <input
                    className="field-select h-9 rounded-xl px-3 text-xs"
                    type="text"
                    placeholder="Sprint sync"
                    value={meetingTitle}
                    onChange={(event) => setMeetingTitle(event.target.value)}
                  />
                </label>

                <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="flex flex-col">
                    <span className="mb-1 text-[11px] uppercase text-gray-500">Date</span>
                    <div className="relative" ref={calendarPopoverRef}>
                      <button
                        type="button"
                        className="field-select block h-11 w-full rounded-xl px-3 text-left text-sm text-slate-700"
                        onClick={() => {
                          if (selectedMeetingDate && !Number.isNaN(selectedMeetingDate.getTime())) {
                            setCalendarMonth(
                              new Date(
                                selectedMeetingDate.getFullYear(),
                                selectedMeetingDate.getMonth(),
                                1
                              )
                            );
                          }

                          setIsCalendarOpen((current) => !current);
                        }}
                      >
                        {formatMeetingDateLabel(meetingDate)}
                      </button>

                      {isCalendarOpen ? (
                        <div className="absolute left-0 top-full z-30 mt-2 w-[280px] rounded-xl border border-slate-200 bg-white p-3 shadow-md">
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={!canNavigateToPreviousMonth}
                              onClick={() =>
                                setCalendarMonth(
                                  (current) =>
                                    new Date(
                                      current.getFullYear(),
                                      current.getMonth() - 1,
                                      1
                                    )
                                )
                              }
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>

                            <p className="text-sm font-semibold text-slate-900">
                              {calendarMonth.toLocaleDateString([], {
                                month: "long",
                                year: "numeric",
                              })}
                            </p>

                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              onClick={() =>
                                setCalendarMonth(
                                  (current) =>
                                    new Date(
                                      current.getFullYear(),
                                      current.getMonth() + 1,
                                      1
                                    )
                                )
                              }
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                              <span key={day}>{day}</span>
                            ))}
                          </div>

                          <div className="mt-1 grid grid-cols-7 gap-1">
                            {calendarCells.map((cellDate, cellIndex) => {
                              if (!cellDate) {
                                return <span key={`empty-${cellIndex}`} className="h-8 w-8" />;
                              }

                              const cellDateValue = formatDateValue(cellDate);
                              const isSelected = cellDateValue === meetingDate;
                              const isPastDate =
                                startOfDay(cellDate).getTime() < todayStart.getTime();

                              return (
                                <button
                                  key={cellDateValue}
                                  type="button"
                                  disabled={isPastDate}
                                  className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${
                                    isSelected
                                      ? "bg-indigo-600 text-white shadow-sm"
                                      : isPastDate
                                        ? "cursor-not-allowed text-slate-300"
                                        : "text-slate-700 hover:bg-slate-100"
                                  }`}
                                  onClick={() => {
                                    setMeetingDate(cellDateValue);
                                    setIsCalendarOpen(false);
                                  }}
                                >
                                  {cellDate.getDate()}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <span className="mb-1 text-[11px] uppercase text-gray-500">Start Time</span>
                    <select
                      className="field-select block h-11 rounded-xl px-3 text-sm"
                      value={meetingTime}
                      onChange={(event) => setMeetingTime(event.target.value)}
                    >
                      {TIME_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <span className="mb-1 text-[11px] uppercase text-gray-500">Duration</span>
                    <select
                      className="field-select block h-11 rounded-xl px-3 text-sm"
                      value={meetingDuration}
                      onChange={(event) => setMeetingDuration(event.target.value)}
                    >
                      {MEETING_DURATION_OPTIONS.map((option) => (
                        <option key={option.value} value={String(option.value)}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <span className="mb-1 text-[11px] uppercase text-gray-500">End Time</span>
                    <input
                      className="field-select block h-11 rounded-xl bg-gray-50 px-3 text-sm text-slate-600"
                      type="text"
                      value={computedEndTimeLabel}
                      readOnly
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Attendees
                    </p>
                    <span className="text-xs text-slate-500">
                      {attendeePreview.length} from attached teams
                    </span>
                  </div>
                  <div className="mt-2 flex items-center">
                    {visibleAttendees.length ? (
                      <>
                        {visibleAttendees.map((attendee, attendeeIndex) => (
                          <Avatar
                            key={`${attendee.email}-${attendeeIndex}`}
                            title={`${attendee.name} (${attendee.email})`}
                            className={`h-8 w-8 rounded-xl border-2 border-white bg-indigo-100 text-[11px] text-indigo-700 shadow-sm ${
                              attendeeIndex === 0 ? "" : "-ml-2"
                            }`}
                          >
                            <AvatarFallback className="bg-transparent text-[11px] font-semibold text-indigo-700">
                              {getInitials(attendee.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}

                        {overflowAttendees.length ? (
                          <span
                            className="-ml-2 inline-flex h-8 min-w-8 items-center justify-center rounded-xl border-2 border-white bg-slate-200 px-2 text-[11px] font-semibold text-slate-700 shadow-sm"
                            title={overflowAttendees
                              .map((attendee) => `${attendee.name} (${attendee.email})`)
                              .join("\n")}
                          >
                            +{overflowAttendees.length}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">
                        No attendee preview available yet.
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  className="interactive-button h-9 w-full rounded-xl border border-sky-300/20 bg-[linear-gradient(90deg,#2563EB_0%,#0EA5E9_100%)] px-3 text-xs font-semibold text-white shadow-[0_14px_30px_-20px_rgba(14,165,233,0.9)] hover:opacity-95"
                  type="submit"
                >
                  <Video className="h-3.5 w-3.5" />
                  Create in Teams
                </Button>
                <p className="text-center text-[11px] text-slate-500">
                  You'll complete scheduling in Microsoft Teams
                </p>
              </form>

              {meetingError ? (
                <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {meetingError}
                </div>
              ) : null}

              {meetingWarning ? (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {meetingWarning}
                </div>
              ) : null}

              {highlightedMeeting?.joinUrl ? (
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2.5">
                  <p className="text-xs font-semibold text-blue-900">
                    Latest Meeting Link
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <a
                      href={highlightedMeeting.joinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs font-medium text-blue-700 underline decoration-blue-300 underline-offset-2"
                    >
                      {highlightedMeeting.joinUrl}
                    </a>
                    <Button
                      className="h-7 rounded-lg border border-blue-200 bg-white px-2 text-xs font-semibold text-blue-700 hover:bg-white"
                      type="button"
                      onClick={() => window.open(highlightedMeeting.joinUrl, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Join Meeting
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Upcoming Meetings
                </p>
                <div className="mt-2 space-y-2">
                  {isMeetingsLoading ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                      Loading meetings...
                    </div>
                  ) : meetingsError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {meetingsError?.response?.data?.message ||
                        "Unable to load upcoming meetings."}
                    </div>
                  ) : upcomingMeetings.length ? (
                    upcomingMeetings.slice(0, 3).map((meeting) => (
                      <div
                        key={meeting._id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {meeting.subject}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {formatMeetingDateTime(meeting.startDateTime)}
                          </p>
                        </div>
                        {meeting.joinUrl ? (
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            onClick={() => window.open(meeting.joinUrl, "_blank")}
                          >
                            Join
                          </button>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-500">
                      No upcoming meetings yet.
                    </div>
                  )}
                </div>
              </div>
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

