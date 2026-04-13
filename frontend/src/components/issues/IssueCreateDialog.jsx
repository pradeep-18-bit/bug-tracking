import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ISSUE_STATUS, resolveIssueProjectId } from "@/lib/issues";
import {
  findProjectById,
  getProjectTeamMembers,
  getProjectTeams,
  resolveProjectId,
  resolveTeamId,
  resolveUserId,
} from "@/lib/project-teams";
import { getInitials } from "@/lib/utils";

const ISSUE_TYPES = ["Bug", "Task", "Story"];
const ISSUE_PRIORITIES = ["Low", "Medium", "High"];
const SELECT_MENU_MAX_HEIGHT = 220;
const PROJECT_COLOR_PALETTE = [
  { accent: "#2563eb", soft: "#dbeafe", border: "#bfdbfe" },
  { accent: "#7c3aed", soft: "#ede9fe", border: "#ddd6fe" },
  { accent: "#0891b2", soft: "#cffafe", border: "#a5f3fc" },
  { accent: "#ea580c", soft: "#ffedd5", border: "#fed7aa" },
  { accent: "#16a34a", soft: "#dcfce7", border: "#bbf7d0" },
  { accent: "#db2777", soft: "#fce7f3", border: "#fbcfe8" },
];

const resolveProjectSelection = (defaultProjectId, projects = []) => {
  if (
    defaultProjectId &&
    defaultProjectId !== "all" &&
    findProjectById(projects, defaultProjectId)
  ) {
    return String(defaultProjectId);
  }

  return resolveProjectId(projects[0]);
};

const resolveTeamSelection = (project, defaultTeamId = "") => {
  const teams = getProjectTeams(project);

  if (
    defaultTeamId &&
    defaultTeamId !== "all" &&
    teams.some((team) => resolveTeamId(team) === String(defaultTeamId))
  ) {
    return String(defaultTeamId);
  }

  return resolveTeamId(teams[0]);
};

const buildInitialState = ({
  projects,
  defaultProjectId,
  defaultTeamId,
  defaultType,
}) => {
  const projectId = resolveProjectSelection(defaultProjectId, projects);
  const project = findProjectById(projects, projectId);

  return {
    title: "",
    description: "",
    projectId,
    teamId: resolveTeamSelection(project, defaultTeamId),
    assigneeId: "",
    priority: "Medium",
    type: defaultType,
    dueAt: "",
    dependsOnIssueId: "",
  };
};

const formatDependencyOption = (issue) => `#${issue._id.slice(-6)} ${issue.title}`;

const hashValue = (value = "") =>
  String(value)
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);

const getProjectTheme = (project) =>
  PROJECT_COLOR_PALETTE[
    hashValue(project?._id || project?.name || "project") % PROJECT_COLOR_PALETTE.length
  ];

const buildProjectOption = (project) => ({
  value: resolveProjectId(project),
  label: project?.name || "Untitled project",
  project,
  theme: getProjectTheme(project),
});

const buildTeamOption = (team) => ({
  value: resolveTeamId(team),
  label: team?.name || "Unnamed team",
  team,
});

const buildAssigneeOption = (assignee) => ({
  value: resolveUserId(assignee),
  label: assignee?.name || "Unnamed teammate",
  email: assignee?.email || "",
  role: assignee?.role || "",
});

const buildDependencyOption = (issue) => ({
  value: String(issue?._id || ""),
  label: formatDependencyOption(issue),
  issue,
});

const issueSelectStyles = {
  container: (base) => ({
    ...base,
    position: "relative",
    overflow: "visible",
  }),
  control: (base, state) => ({
    ...base,
    minHeight: 48,
    borderRadius: 18,
    borderColor: state.isFocused ? "rgba(59, 130, 246, 0.48)" : "#dbe2ea",
    backgroundColor: state.isDisabled ? "rgba(248, 250, 252, 0.96)" : "#ffffff",
    boxShadow: state.isFocused
      ? "0 0 0 4px rgba(59, 130, 246, 0.12)"
      : "0 1px 2px rgba(15, 23, 42, 0.04)",
    transition: "all 180ms ease",
    "&:hover": {
      borderColor: state.isFocused ? "rgba(59, 130, 246, 0.48)" : "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "4px 14px",
  }),
  input: (base) => ({
    ...base,
    color: "#0f172a",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#94a3b8",
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "#2563eb" : "#64748b",
    "&:hover": {
      color: "#2563eb",
    },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "#94a3b8",
    "&:hover": {
      color: "#475569",
    },
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
    pointerEvents: "auto",
  }),
  menu: (base) => ({
    ...base,
    overflow: "auto",
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    boxShadow: "0 20px 40px -24px rgba(15, 23, 42, 0.28)",
    zIndex: 9999,
    marginTop: 8,
    scrollBehavior: "smooth",
  }),
  menuList: (base) => ({
    ...base,
    padding: 8,
    maxHeight: SELECT_MENU_MAX_HEIGHT,
    overflowY: "auto",
    overflowX: "hidden",
    scrollBehavior: "smooth",
    WebkitOverflowScrolling: "touch",
  }),
  option: (base, state) => ({
    ...base,
    borderRadius: 14,
    padding: "10px 12px",
    backgroundColor: state.isSelected
      ? "rgba(219, 234, 254, 0.92)"
      : state.isFocused
        ? "rgba(248, 250, 252, 0.96)"
        : "transparent",
    color: "#0f172a",
    cursor: "pointer",
  }),
  singleValue: (base) => ({
    ...base,
    color: "#0f172a",
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: "#64748b",
    padding: "12px 16px",
  }),
};

const formatProjectOptionLabel = (option) => (
  <div className="flex min-w-0 items-center gap-3">
    <span
      className="h-4 w-4 shrink-0 rounded-[5px] border"
      style={{
        backgroundColor: option.theme.soft,
        borderColor: option.theme.border,
        boxShadow: `inset 0 0 0 6px ${option.theme.accent}`,
      }}
    />
    <span className="truncate text-sm font-medium text-slate-900">{option.label}</span>
  </div>
);

const formatTeamOptionLabel = (option) => (
  <div className="min-w-0">
    <p className="truncate text-sm font-medium text-slate-900">{option.label}</p>
  </div>
);

const formatAssigneeOptionLabel = (option) => (
  <div className="flex min-w-0 items-center gap-3">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
      {getInitials(option.label)}
    </div>
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-slate-900">{option.label}</p>
      <p className="truncate text-xs text-slate-500">
        {[option.role, option.email].filter(Boolean).join(" • ")}
      </p>
    </div>
  </div>
);

const formatDependencyLabel = (option) => (
  <div className="min-w-0">
    <p className="truncate text-sm font-medium text-slate-900">{option.label}</p>
  </div>
);

const SectionLabel = ({ title, description }) => (
  <div className="space-y-0.5">
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    {description ? <p className="text-sm text-slate-500">{description}</p> : null}
  </div>
);

const baseSelectProps = {
  menuPlacement: "bottom",
  menuPosition: "absolute",
  menuShouldScrollIntoView: false,
  maxMenuHeight: SELECT_MENU_MAX_HEIGHT,
};

const IssueCreateDialog = ({
  open,
  onOpenChange,
  projects = [],
  availableIssues = [],
  defaultProjectId = "",
  defaultTeamId = "",
  defaultType = "Task",
  lockType = false,
  isPending = false,
  onSubmit,
}) => {
  const resolvedDefaultType = ISSUE_TYPES.includes(defaultType)
    ? defaultType
    : ISSUE_TYPES[1];
  const [formData, setFormData] = useState(() =>
    buildInitialState({
      projects,
      defaultProjectId,
      defaultTeamId,
      defaultType: resolvedDefaultType,
    })
  );
  const [assignEntireTeam, setAssignEntireTeam] = useState(false);
  const [isSequenceSubmitting, setIsSequenceSubmitting] = useState(false);
  const [error, setError] = useState("");

  const menuPortalTarget =
    typeof document !== "undefined" ? document.body : undefined;

  const projectOptions = useMemo(
    () => projects.map(buildProjectOption),
    [projects]
  );

  const selectedProject = useMemo(
    () => findProjectById(projects, formData.projectId),
    [formData.projectId, projects]
  );
  const selectedProjectOption = useMemo(
    () =>
      projectOptions.find((project) => project.value === String(formData.projectId)) || null,
    [formData.projectId, projectOptions]
  );

  const availableTeams = useMemo(
    () => getProjectTeams(selectedProject),
    [selectedProject]
  );
  const teamOptions = useMemo(
    () => availableTeams.map(buildTeamOption),
    [availableTeams]
  );
  const selectedTeamOption = useMemo(
    () => teamOptions.find((team) => team.value === String(formData.teamId)) || null,
    [formData.teamId, teamOptions]
  );

  const availableAssignees = useMemo(
    () => getProjectTeamMembers(selectedProject, formData.teamId),
    [formData.teamId, selectedProject]
  );
  const assigneeOptions = useMemo(
    () => availableAssignees.map(buildAssigneeOption),
    [availableAssignees]
  );
  const selectedAssigneeOption = useMemo(
    () =>
      assigneeOptions.find(
        (assignee) => assignee.value === String(formData.assigneeId)
      ) || null,
    [assigneeOptions, formData.assigneeId]
  );

  const dependencyOptions = useMemo(
    () =>
      availableIssues
        .filter(
          (issue) => resolveIssueProjectId(issue) === String(formData.projectId)
        )
        .sort(
          (left, right) =>
            new Date(right.createdAt || 0) - new Date(left.createdAt || 0)
        )
        .map(buildDependencyOption),
    [availableIssues, formData.projectId]
  );
  const selectedDependencyOption = useMemo(
    () =>
      dependencyOptions.find(
        (issue) => issue.value === String(formData.dependsOnIssueId)
      ) || null,
    [dependencyOptions, formData.dependsOnIssueId]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormData(
      buildInitialState({
        projects,
        defaultProjectId,
        defaultTeamId,
        defaultType: resolvedDefaultType,
      })
    );
    setAssignEntireTeam(false);
    setIsSequenceSubmitting(false);
    setError("");
  }, [defaultProjectId, defaultTeamId, open, projects, resolvedDefaultType]);

  useEffect(() => {
    const nextTeamId = availableTeams.some(
      (team) => resolveTeamId(team) === String(formData.teamId)
    )
      ? String(formData.teamId)
      : resolveTeamSelection(selectedProject, defaultTeamId);

    if (nextTeamId === String(formData.teamId || "")) {
      return;
    }

    setFormData((current) => ({
      ...current,
      teamId: nextTeamId,
      assigneeId: "",
    }));
  }, [availableTeams, defaultTeamId, formData.teamId, selectedProject]);

  useEffect(() => {
    const assigneeIds = new Set(
      availableAssignees.map((assignee) => resolveUserId(assignee))
    );

    if (!formData.assigneeId || assigneeIds.has(String(formData.assigneeId))) {
      return;
    }

    setFormData((current) => ({
      ...current,
      assigneeId: "",
    }));
  }, [availableAssignees, formData.assigneeId]);

  useEffect(() => {
    if (
      !formData.dependsOnIssueId ||
      dependencyOptions.some(
        (issue) => issue.value === String(formData.dependsOnIssueId)
      )
    ) {
      return;
    }

    setFormData((current) => ({
      ...current,
      dependsOnIssueId: "",
    }));
  }, [dependencyOptions, formData.dependsOnIssueId]);

  useEffect(() => {
    if (!assignEntireTeam) {
      return;
    }

    setFormData((current) => ({
      ...current,
      assigneeId: "",
    }));
  }, [assignEntireTeam]);

  const blockedMessage = useMemo(() => {
    if (!projects.length) {
      return "Create a project before adding issues.";
    }

    if (!selectedProject) {
      return "Select a project to continue.";
    }

    if (!availableTeams.length) {
      return "Attach a team to this project before creating issues.";
    }

    return "";
  }, [availableTeams.length, projects.length, selectedProject]);

  const isSubmitPending = isPending || isSequenceSubmitting;

  const handleProjectChange = (option) => {
    setFormData((current) => ({
      ...current,
      projectId: option?.value || "",
      teamId: "",
      assigneeId: "",
      dependsOnIssueId: "",
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.title.trim() || !formData.projectId || !formData.teamId) {
      setError("Title, project, and team are required.");
      return;
    }

    if (blockedMessage) {
      setError(blockedMessage);
      return;
    }

    if (
      !assignEntireTeam &&
      formData.assigneeId &&
      !availableAssignees.some(
        (assignee) => resolveUserId(assignee) === String(formData.assigneeId)
      )
    ) {
      setError("Choose an assignee from the selected team.");
      return;
    }

    if (
      formData.dependsOnIssueId &&
      !dependencyOptions.some(
        (issue) => issue.value === String(formData.dependsOnIssueId)
      )
    ) {
      setError("Choose a dependency from the selected project.");
      return;
    }

    if (assignEntireTeam && !availableAssignees.length) {
      setError("The selected team does not have any members to assign.");
      return;
    }

    const basePayload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      projectId: formData.projectId,
      teamId: formData.teamId,
      priority: formData.priority,
      type: formData.type,
      dueAt: formData.dueAt || null,
      dependsOnIssueId: formData.dependsOnIssueId || null,
      status: ISSUE_STATUS.TODO,
    };

    const payloads = assignEntireTeam
      ? availableAssignees.map((assignee) => ({
          ...basePayload,
          assigneeId: resolveUserId(assignee),
        }))
      : [
          {
            ...basePayload,
            assigneeId: formData.assigneeId || null,
          },
        ];

    let createdCount = 0;

    try {
      setError("");
      setIsSequenceSubmitting(payloads.length > 1);

      for (const payload of payloads) {
        await onSubmit(payload);
        createdCount += 1;
      }

      onOpenChange(false);
    } catch (submitError) {
      const message =
        submitError.response?.data?.message || "Unable to create the issue.";

      setError(
        createdCount > 0
          ? `Created ${createdCount} issue${createdCount === 1 ? "" : "s"} before the next assignment failed. ${message}`
          : message
      );
    } finally {
      setIsSequenceSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-0 overflow-visible border border-slate-200/80 bg-white p-0 shadow-[0_36px_90px_-50px_rgba(15,23,42,0.35)]">
        <div className="max-h-[90vh] overflow-y-auto overflow-x-visible">
          <DialogHeader className="sticky top-0 z-20 border-b border-slate-200/80 bg-white px-5 py-3.5 sm:px-6">
            <DialogTitle className="text-2xl tracking-tight text-slate-950">
              Create Issue
            </DialogTitle>
          </DialogHeader>

          <form className="space-y-3.5 px-5 py-4 sm:px-6" onSubmit={handleSubmit}>
            {blockedMessage ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
                {blockedMessage}
              </div>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.3fr)_minmax(0,0.7fr)]">
              <div className="space-y-1.5">
                <SectionLabel title="Project" />
                <Select
                  options={projectOptions}
                  value={selectedProjectOption}
                  onChange={handleProjectChange}
                  styles={issueSelectStyles}
                  formatOptionLabel={formatProjectOptionLabel}
                  isSearchable={false}
                  isDisabled={!projectOptions.length || isSubmitPending}
                  menuPortalTarget={menuPortalTarget}
                  {...baseSelectProps}
                  placeholder="Select a project"
                />
              </div>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-900">Issue Title</span>
                <Input
                  className="h-12 rounded-2xl border-slate-200 text-base shadow-none focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-500/10"
                  name="title"
                  value={formData.title}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Add a concise summary"
                  disabled={isSubmitPending}
                />
              </label>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-3 sm:p-3.5 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)]">
              <div className="space-y-3">
                <SectionLabel
                  title="Assign"
                  description="Quickly assign this issue"
                />

                <div className="grid items-start gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Team
                    </span>
                    <Select
                      options={teamOptions}
                      value={selectedTeamOption}
                      onChange={(option) =>
                        setFormData((current) => ({
                          ...current,
                          teamId: option?.value || "",
                          assigneeId: "",
                        }))
                      }
                      styles={issueSelectStyles}
                      formatOptionLabel={formatTeamOptionLabel}
                      isSearchable={false}
                      isDisabled={!teamOptions.length || isSubmitPending}
                      menuPortalTarget={menuPortalTarget}
                      {...baseSelectProps}
                      placeholder="Select team"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Assignee
                    </span>
                    <div className="space-y-2.5">
                      <div
                        className={
                          assignEntireTeam
                            ? "cursor-not-allowed rounded-[20px] opacity-65 transition-opacity"
                            : "rounded-[20px] transition-opacity"
                        }
                      >
                        <Select
                          options={assigneeOptions}
                          value={selectedAssigneeOption}
                          onChange={(option) =>
                            setFormData((current) => ({
                              ...current,
                              assigneeId: option?.value || "",
                            }))
                          }
                          styles={issueSelectStyles}
                          formatOptionLabel={formatAssigneeOptionLabel}
                          isClearable
                          isDisabled={
                            !formData.teamId || assignEntireTeam || isSubmitPending
                          }
                          menuPortalTarget={menuPortalTarget}
                          {...baseSelectProps}
                          placeholder={
                            assignEntireTeam
                              ? "Disabled while team-wide assignment is enabled"
                              : "Select assignee"
                          }
                          noOptionsMessage={() =>
                            formData.teamId
                              ? "No teammates available in this team."
                              : "Select a team first."
                          }
                        />
                      </div>

                      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                          checked={assignEntireTeam}
                          disabled={!formData.teamId || isSubmitPending}
                          onChange={(event) => setAssignEntireTeam(event.target.checked)}
                        />
                        <span className="space-y-1">
                          <span className="block font-medium text-slate-800">
                            Assign to entire team
                          </span>
                          <span className="block text-slate-500">
                            When enabled, this creates one issue for each teammate.
                          </span>
                        </span>
                      </label>

                      {assignEntireTeam ? (
                        <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-3 py-2.5 text-sm text-blue-900">
                          {availableAssignees.length
                            ? `This issue will be created for ${availableAssignees.length} team member${availableAssignees.length === 1 ? "" : "s"}.`
                            : "This team does not have any members available yet."}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <SectionLabel title="Description" />
              <Textarea
                className="min-h-[112px] rounded-[22px] border-slate-200 shadow-none focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-500/10"
                value={formData.description}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Add context, acceptance notes, or implementation details."
                disabled={isSubmitPending}
              />
            </div>

            <div className="border-t border-slate-200/80 pt-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Priority
                  </span>
                  <select
                    className="field-select rounded-2xl"
                    value={formData.priority}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        priority: event.target.value,
                      }))
                    }
                    disabled={isSubmitPending}
                  >
                    {ISSUE_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Type
                  </span>
                  <select
                    className="field-select rounded-2xl"
                    value={formData.type}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        type: event.target.value,
                      }))
                    }
                    disabled={lockType || isSubmitPending}
                  >
                    {ISSUE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Due Date
                </span>
                <Input
                  type="datetime-local"
                  className="h-12 rounded-2xl border-slate-200 shadow-none focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-500/10"
                  value={formData.dueAt}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      dueAt: event.target.value,
                    }))
                  }
                  disabled={isSubmitPending}
                />
              </label>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Dependency
                </span>
                <Select
                  options={dependencyOptions}
                  value={selectedDependencyOption}
                  onChange={(option) =>
                    setFormData((current) => ({
                      ...current,
                      dependsOnIssueId: option?.value || "",
                    }))
                  }
                  styles={issueSelectStyles}
                  formatOptionLabel={formatDependencyLabel}
                  isClearable
                  isDisabled={!formData.projectId || isSubmitPending}
                  menuPortalTarget={menuPortalTarget}
                  {...baseSelectProps}
                  placeholder="No dependency"
                  noOptionsMessage={() =>
                    formData.projectId
                      ? "No issues available in this project."
                      : "Select a project first."
                  }
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="sticky bottom-0 -mx-5 flex justify-end gap-3 border-t border-slate-200/80 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitPending || Boolean(blockedMessage)}
              >
                {isSubmitPending ? "Creating..." : "Create Issue"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IssueCreateDialog;
