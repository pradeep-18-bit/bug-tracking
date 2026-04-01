import { useEffect, useMemo, useState } from "react";
import { Bug, ClipboardList, Flag, Sparkle, UserCircle2, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ISSUE_STATUS } from "@/lib/issues";
import {
  findProjectById,
  getProjectTeamMembers,
  getProjectTeams,
  resolveProjectId,
  resolveTeamId,
  resolveUserId,
} from "@/lib/project-teams";

const defaultTypeOptions = ["Bug", "Task", "Story"];

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

const resolveTeamSelection = (defaultTeamId, project) => {
  const teams = getProjectTeams(project);

  if (defaultTeamId && teams.some((team) => resolveTeamId(team) === String(defaultTeamId))) {
    return String(defaultTeamId);
  }

  return resolveTeamId(teams[0]);
};

const buildInitialState = ({
  projects,
  defaultProjectId,
  defaultTeamId,
  defaultType,
  defaultStatus,
  defaultAssigneeId,
}) => {
  const projectId = resolveProjectSelection(defaultProjectId, projects);
  const project = findProjectById(projects, projectId);
  const teamId = resolveTeamSelection(defaultTeamId, project);
  const teamMembers = getProjectTeamMembers(project, teamId);
  const defaultAssigneeKey = String(defaultAssigneeId || "");
  const assigneeId = teamMembers.some(
    (member) => resolveUserId(member) === defaultAssigneeKey
  )
    ? defaultAssigneeKey
    : "";

  return {
    title: "",
    description: "",
    type: defaultType,
    status: defaultStatus,
    priority: "Medium",
    projectId,
    teamId,
    assigneeId,
  };
};

const IssueComposer = ({
  projects = [],
  defaultProjectId,
  defaultTeamId = "",
  onSubmit,
  isPending,
  allowedTypes = defaultTypeOptions,
  defaultType = "Bug",
  defaultStatus = ISSUE_STATUS.TODO,
  defaultAssigneeId = "",
  lockType = false,
  showAssigneeField = true,
  showStatusField = true,
  submitLabel = "Create Issue",
  variant = "card",
}) => {
  const resolvedDefaultType = allowedTypes.includes(defaultType)
    ? defaultType
    : allowedTypes[0] || defaultTypeOptions[0];
  const [formData, setFormData] = useState(() =>
    buildInitialState({
      projects,
      defaultProjectId,
      defaultTeamId,
      defaultType: resolvedDefaultType,
      defaultStatus,
      defaultAssigneeId,
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
  const defaultAssigneeKey = String(defaultAssigneeId || "");
  const defaultAssigneeInTeam = useMemo(
    () =>
      !defaultAssigneeKey ||
      availableAssignees.some(
        (assignee) => resolveUserId(assignee) === defaultAssigneeKey
      ),
    [availableAssignees, defaultAssigneeKey]
  );

  useEffect(() => {
    const currentProject = findProjectById(projects, formData.projectId);

    if (currentProject) {
      return;
    }

    setFormData((current) => ({
      ...current,
      projectId: resolveProjectSelection(defaultProjectId, projects),
    }));
  }, [defaultProjectId, formData.projectId, projects]);

  useEffect(() => {
    const nextTeamId = availableTeams.some(
      (team) => resolveTeamId(team) === String(formData.teamId)
    )
      ? String(formData.teamId)
      : resolveTeamSelection(defaultTeamId, selectedProject);

    if (nextTeamId === String(formData.teamId || "")) {
      return;
    }

    setFormData((current) => ({
      ...current,
      teamId: nextTeamId,
    }));
  }, [availableTeams, defaultTeamId, formData.teamId, selectedProject]);

  useEffect(() => {
    const availableAssigneeIds = new Set(
      availableAssignees.map((assignee) => resolveUserId(assignee))
    );
    const nextAssigneeId = showAssigneeField
      ? availableAssigneeIds.has(String(formData.assigneeId || ""))
        ? String(formData.assigneeId || "")
        : ""
      : defaultAssigneeInTeam
        ? defaultAssigneeKey
        : "";

    if (nextAssigneeId === String(formData.assigneeId || "")) {
      return;
    }

    setFormData((current) => ({
      ...current,
      assigneeId: nextAssigneeId,
    }));
  }, [
    availableAssignees,
    defaultAssigneeInTeam,
    defaultAssigneeKey,
    formData.assigneeId,
    showAssigneeField,
  ]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => {
      if (name === "projectId") {
        const nextProject = findProjectById(projects, value);

        return {
          ...current,
          projectId: value,
          teamId: resolveTeamSelection("", nextProject),
          assigneeId: "",
        };
      }

      if (name === "teamId") {
        return {
          ...current,
          teamId: value,
          assigneeId: "",
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });
  };

  const submitBlockedMessage = useMemo(() => {
    if (!projects.length) {
      return "Create a project before tracking issues.";
    }

    if (!selectedProject) {
      return "Select a project to continue.";
    }

    if (!availableTeams.length) {
      return "Attach a team to this project before creating issues.";
    }

    if (!showAssigneeField && defaultAssigneeKey && !defaultAssigneeInTeam) {
      return "You can only create work in teams that include you as a member.";
    }

    return "";
  }, [
    availableTeams.length,
    defaultAssigneeInTeam,
    defaultAssigneeKey,
    projects.length,
    selectedProject,
    showAssigneeField,
  ]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.title.trim() || !formData.projectId || !formData.teamId) {
      setError("Title, project, and team are required.");
      return;
    }

    if (submitBlockedMessage) {
      setError(submitBlockedMessage);
      return;
    }

    try {
      setError("");

      await onSubmit({
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: formData.type,
        status: formData.status,
        priority: formData.priority,
        projectId: formData.projectId,
        teamId: formData.teamId,
        assigneeId: showAssigneeField
          ? formData.assigneeId || null
          : defaultAssigneeInTeam
            ? defaultAssigneeKey || null
            : null,
      });

      setFormData(
        buildInitialState({
          projects,
          defaultProjectId: formData.projectId,
          defaultTeamId: formData.teamId,
          defaultType: resolvedDefaultType,
          defaultStatus,
          defaultAssigneeId,
        })
      );
    } catch (submitError) {
      setError(
        submitError.response?.data?.message || "Unable to create the issue."
      );
    }
  };

  const formContent = (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {submitBlockedMessage ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {submitBlockedMessage}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700" htmlFor="title">
          Title
        </label>
        <Input
          id="title"
          name="title"
          placeholder="Payments retry job fails on expired tokens"
          value={formData.title}
          onChange={handleChange}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700" htmlFor="description">
          Description
        </label>
        <Textarea
          id="description"
          name="description"
          placeholder="Add the current behavior, expected result, and any reproduction notes."
          value={formData.description}
          onChange={handleChange}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2">
          <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <ClipboardList className="h-4 w-4 text-blue-600" />
            Project
          </span>
          <select
            className="field-select"
            name="projectId"
            value={formData.projectId}
            onChange={handleChange}
          >
            {projects.length ? (
              projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))
            ) : (
              <option value="">No projects available</option>
            )}
          </select>
        </label>

        <label className="space-y-2">
          <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Users2 className="h-4 w-4 text-blue-600" />
            Team
          </span>
          <select
            className="field-select"
            name="teamId"
            value={formData.teamId}
            onChange={handleChange}
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

        {showAssigneeField ? (
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <UserCircle2 className="h-4 w-4 text-blue-600" />
              Assignee
            </span>
            <select
              className="field-select"
              name="assigneeId"
              value={formData.assigneeId}
              onChange={handleChange}
              disabled={!formData.teamId}
            >
              <option value="">Unassigned</option>
              {availableAssignees.length ? (
                availableAssignees.map((assignee) => (
                  <option key={assignee._id} value={assignee._id}>
                    {assignee.name} ({assignee.role})
                  </option>
                ))
              ) : (
                <option disabled value="__empty">
                  No team members available
                </option>
              )}
            </select>
          </label>
        ) : null}
      </div>

      <div
        className={`grid gap-4 ${
          showStatusField ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-3"
        }`}
      >
        <label className="space-y-2">
          <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Bug className="h-4 w-4 text-blue-600" />
            Type
          </span>
          <select
            className="field-select"
            name="type"
            value={formData.type}
            disabled={lockType || allowedTypes.length === 1}
            onChange={handleChange}
          >
            {allowedTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Flag className="h-4 w-4 text-blue-600" />
            Priority
          </span>
          <select
            className="field-select"
            name="priority"
            value={formData.priority}
            onChange={handleChange}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </label>

        {showStatusField ? (
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Status</span>
            <select
              className="field-select"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value={ISSUE_STATUS.TODO}>To Do</option>
              <option value={ISSUE_STATUS.IN_PROGRESS}>In Progress</option>
              <option value={ISSUE_STATUS.DONE}>Done</option>
            </select>
          </label>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <Button
        className="w-full"
        disabled={isPending || Boolean(submitBlockedMessage)}
        type="submit"
      >
        {isPending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );

  if (variant === "plain") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-blue-600">
            <Sparkle className="h-3.5 w-3.5" />
            Create Issue
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            Add work to the selected project
          </h2>
          <p className="text-sm leading-6 text-slate-600">
            Teams come from the selected project, and assignees are limited to the
            members of the chosen team.
          </p>
        </div>
        {formContent}
      </div>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-blue-600">
          <Sparkle className="h-3.5 w-3.5" />
          New Issue
        </div>
        <CardTitle>Add work to the tracker</CardTitle>
        <CardDescription>
          Create project-scoped work with team ownership and assignees limited to
          the selected delivery team.
        </CardDescription>
      </CardHeader>

      <CardContent>{formContent}</CardContent>
    </Card>
  );
};

export default IssueComposer;
