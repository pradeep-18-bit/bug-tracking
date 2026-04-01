import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const ISSUE_TYPES = ["Bug", "Task", "Story"];
const ISSUE_PRIORITIES = ["Low", "Medium", "High"];

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
  const [error, setError] = useState("");

  const selectedProject = useMemo(
    () => findProjectById(projects, formData.projectId),
    [formData.projectId, projects]
  );
  const availableTeams = useMemo(
    () => getProjectTeams(selectedProject),
    [selectedProject]
  );
  const availableAssignees = useMemo(
    () => getProjectTeamMembers(selectedProject, formData.teamId),
    [formData.teamId, selectedProject]
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
        ),
    [availableIssues, formData.projectId]
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
        (issue) => String(issue._id) === String(formData.dependsOnIssueId)
      )
    ) {
      return;
    }

    setFormData((current) => ({
      ...current,
      dependsOnIssueId: "",
    }));
  }, [dependencyOptions, formData.dependsOnIssueId]);

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
        (issue) => String(issue._id) === String(formData.dependsOnIssueId)
      )
    ) {
      setError("Choose a dependency from the selected project.");
      return;
    }

    try {
      setError("");
      await onSubmit({
        title: formData.title.trim(),
        description: formData.description.trim(),
        projectId: formData.projectId,
        teamId: formData.teamId,
        assigneeId: formData.assigneeId || null,
        priority: formData.priority,
        type: formData.type,
        dueAt: formData.dueAt || null,
        dependsOnIssueId: formData.dependsOnIssueId || null,
        status: ISSUE_STATUS.TODO,
      });
    } catch (submitError) {
      setError(
        submitError.response?.data?.message || "Unable to create the issue."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create Issue</DialogTitle>
          <DialogDescription>
            Add work to the selected project with team ownership, a due date, and
            an optional dependency.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {blockedMessage ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {blockedMessage}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Title
              </span>
              <Input
                name="title"
                value={formData.title}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Add a concise summary"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Project
              </span>
              <select
                className="field-select"
                value={formData.projectId}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    projectId: event.target.value,
                    teamId: "",
                    assigneeId: "",
                    dependsOnIssueId: "",
                  }))
                }
              >
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Description
            </span>
            <Textarea
              value={formData.description}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Add context, acceptance notes, or implementation detail."
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Team
              </span>
              <select
                className="field-select"
                value={formData.teamId}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    teamId: event.target.value,
                    assigneeId: "",
                  }))
                }
                disabled={!availableTeams.length}
              >
                {availableTeams.length ? (
                  availableTeams.map((team) => (
                    <option key={team._id} value={team._id}>
                      {team.name}
                    </option>
                  ))
                ) : (
                  <option value="">No attached teams</option>
                )}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Assignee
              </span>
              <select
                className="field-select"
                value={formData.assigneeId}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    assigneeId: event.target.value,
                  }))
                }
                disabled={!formData.teamId}
              >
                <option value="">Unassigned</option>
                {availableAssignees.map((assignee) => (
                  <option key={assignee._id} value={assignee._id}>
                    {assignee.name} ({assignee.role})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Priority
              </span>
              <select
                className="field-select"
                value={formData.priority}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    priority: event.target.value,
                  }))
                }
              >
                {ISSUE_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Type
              </span>
              <select
                className="field-select"
                value={formData.type}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    type: event.target.value,
                  }))
                }
                disabled={lockType}
              >
                {ISSUE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Due Date & Time
              </span>
              <Input
                type="datetime-local"
                value={formData.dueAt}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    dueAt: event.target.value,
                  }))
                }
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Depends On
              </span>
              <select
                className="field-select"
                value={formData.dependsOnIssueId}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    dependsOnIssueId: event.target.value,
                  }))
                }
                disabled={!formData.projectId}
              >
                <option value="">No dependency</option>
                {dependencyOptions.map((issue) => (
                  <option key={issue._id} value={issue._id}>
                    {formatDependencyOption(issue)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || Boolean(blockedMessage)}
            >
              {isPending ? "Creating..." : "Create Issue"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default IssueCreateDialog;
