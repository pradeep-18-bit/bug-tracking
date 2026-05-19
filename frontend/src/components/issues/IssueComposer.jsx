import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  FileText,
  Flag,
  Sparkle,
  UserCircle2,
  Users2,
} from "lucide-react";
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
import {
  BUG_PRIORITY_OPTIONS,
  BUG_SEVERITY_OPTIONS,
  BUG_STATUS_OPTIONS,
  ISSUE_STATUS,
  ISSUE_TYPE_OPTIONS,
  ISSUE_WORKFLOW_STATUS_OPTIONS,
} from "@/lib/issues";
import { fetchProjectTeams, logTeamSelectionDebug } from "@/lib/api";
import {
  findProjectById,
  getProjectMembers,
  getProjectTeamMembers,
  getProjectTeams,
  resolveProjectId,
  resolveTeamId,
  resolveUserId,
} from "@/lib/project-teams";

const defaultTypeOptions = ISSUE_TYPE_OPTIONS;
const DEFAULT_ATTACHMENT_ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.log,.csv,.json,.xml,.zip";

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

const hasTeamMember = (team, userId = "") =>
  Boolean(userId) &&
  (team?.members || []).some((member) => resolveUserId(member) === String(userId));

const resolveTeamSelection = (defaultTeamId, teams = [], preferredMemberId = "") => {
  const projectTeams = getProjectTeams({ teams });

  if (
    defaultTeamId &&
    projectTeams.some((team) => resolveTeamId(team) === String(defaultTeamId))
  ) {
    return String(defaultTeamId);
  }

  const preferredTeam = projectTeams.find((team) =>
    hasTeamMember(team, preferredMemberId)
  );

  return resolveTeamId(preferredTeam || projectTeams[0]);
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
  const projectTeams = getProjectTeams(project);
  const teamId = resolveTeamSelection(defaultTeamId, projectTeams, defaultAssigneeId);
  const teamMembers = getProjectTeamMembers(project, teamId);
  const defaultAssigneeKey = String(defaultAssigneeId || "");
  const assigneeId = teamMembers.some(
    (member) => resolveUserId(member) === defaultAssigneeKey
  )
    ? defaultAssigneeKey
    : "";
  const isBug = defaultType === "Bug";

  return {
    title: "",
    description: "",
    type: defaultType,
    status: isBug ? ISSUE_STATUS.NEW : defaultStatus,
    priority: isBug ? "High" : "Medium",
    projectId,
    teamId,
    assigneeId,
    bugDetails: {
      severity: "",
      testerOwnerId: defaultAssigneeKey,
      developerLeadId: "",
      stepsToReproduce: "",
      expectedResult: "",
      actualResult: "",
    },
  };
};

const IssueComposer = ({
  projects = [],
  defaultProjectId,
  defaultTeamId = "",
  onSubmit,
  isPending,
  allowedTypes = defaultTypeOptions,
  defaultType = "Task",
  defaultStatus = ISSUE_STATUS.TODO,
  defaultAssigneeId = "",
  lockType = false,
  showAssigneeField = true,
  showStatusField = true,
  submitLabel = "Create Work Item",
  variant = "card",
  headerLabel = "Create Work Item",
  cardTitle = "Add work to the planning workspace",
  cardDescription = "Create project-scoped work with team ownership and assignees limited to the selected delivery team.",
  projectLabel = "Project",
  titleLabel = "Title",
  titlePlaceholder = "Payments retry job fails on expired tokens",
  descriptionPlaceholder = "Add the current behavior, expected result, and any reproduction notes.",
  includeAttachments = false,
  attachmentAccept = DEFAULT_ATTACHMENT_ACCEPT,
  onUploadAttachment,
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
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);

  const selectedProject = useMemo(
    () => findProjectById(projects, formData.projectId),
    [formData.projectId, projects]
  );
  const selectedProjectId = String(formData.projectId || "");
  const { data: projectTeamsData } = useQuery({
    queryKey: ["project-teams", selectedProjectId],
    queryFn: () => fetchProjectTeams(selectedProjectId),
    enabled: Boolean(selectedProjectId),
    refetchOnMount: "always",
  });
  const projectTeamsSource = Array.isArray(projectTeamsData)
    ? "project-teams-api"
    : "projects-api";
  const availableTeams = useMemo(
    () =>
      getProjectTeams({
        teams: Array.isArray(projectTeamsData)
          ? projectTeamsData
          : selectedProject?.teams || [],
      }),
    [projectTeamsData, selectedProject]
  );
  const selectedProjectWithTeams = useMemo(
    () =>
      selectedProject
        ? {
            ...selectedProject,
            teams: availableTeams,
          }
        : {
            teams: availableTeams,
          },
    [availableTeams, selectedProject]
  );
  const projectMembers = useMemo(
    () => getProjectMembers(selectedProjectWithTeams),
    [selectedProjectWithTeams]
  );
  const availableAssignees = useMemo(
    () => getProjectTeamMembers(selectedProjectWithTeams, formData.teamId),
    [formData.teamId, selectedProjectWithTeams]
  );
  const isBugType = formData.type === "Bug";
  const testerOptions = useMemo(
    () =>
      projectMembers.filter((assignee) => assignee.role === "Tester").length
        ? projectMembers.filter((assignee) => assignee.role === "Tester")
        : projectMembers,
    [projectMembers]
  );
  const developerOptions = useMemo(
    () =>
      availableAssignees.filter((assignee) => assignee.role === "Developer").length
        ? availableAssignees.filter((assignee) => assignee.role === "Developer")
        : availableAssignees,
    [availableAssignees]
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
  const defaultAssigneeInProject = useMemo(
    () =>
      !defaultAssigneeKey ||
      projectMembers.some(
        (member) => resolveUserId(member) === defaultAssigneeKey
      ),
    [defaultAssigneeKey, projectMembers]
  );

  useEffect(() => {
    logTeamSelectionDebug("Selected project", {
      component: "IssueComposer",
      projectId: selectedProjectId,
      projectName: selectedProject?.name || "",
    });
  }, [selectedProject?.name, selectedProjectId]);

  useEffect(() => {
    logTeamSelectionDebug("Filtered teams", {
      component: "IssueComposer",
      projectId: selectedProjectId,
      source: projectTeamsSource,
      teams: availableTeams.map((team) => ({
        id: resolveTeamId(team),
        name: team?.name || "",
        memberCount: team?.memberCount || team?.members?.length || 0,
      })),
    });
  }, [availableTeams, projectTeamsSource, selectedProjectId]);

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
      : resolveTeamSelection(defaultTeamId, availableTeams, defaultAssigneeKey);

    if (nextTeamId === String(formData.teamId || "")) {
      return;
    }

    setFormData((current) => ({
      ...current,
      teamId: nextTeamId,
    }));
  }, [availableTeams, defaultAssigneeKey, defaultTeamId, formData.teamId]);

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

  useEffect(() => {
    const availableAssigneeIds = new Set(
      availableAssignees.map((assignee) => resolveUserId(assignee))
    );
    const projectMemberIds = new Set(
      projectMembers.map((member) => resolveUserId(member))
    );
    const testerOwnerId =
      formData.bugDetails.testerOwnerId &&
      projectMemberIds.has(String(formData.bugDetails.testerOwnerId))
        ? formData.bugDetails.testerOwnerId
        : defaultAssigneeInProject
          ? defaultAssigneeKey
          : "";
    const developerLeadId =
      formData.bugDetails.developerLeadId &&
      availableAssigneeIds.has(String(formData.bugDetails.developerLeadId))
        ? formData.bugDetails.developerLeadId
        : "";

    if (
      testerOwnerId === formData.bugDetails.testerOwnerId &&
      developerLeadId === formData.bugDetails.developerLeadId
    ) {
      return;
    }

    setFormData((current) => ({
      ...current,
      bugDetails: {
        ...current.bugDetails,
        testerOwnerId,
        developerLeadId,
      },
    }));
  }, [
    availableAssignees,
    defaultAssigneeInProject,
    defaultAssigneeKey,
    formData.bugDetails.developerLeadId,
    formData.bugDetails.testerOwnerId,
    projectMembers,
  ]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => {
      if (name === "projectId") {
        const nextProject = findProjectById(projects, value);

        return {
          ...current,
          projectId: value,
          teamId: resolveTeamSelection(
            "",
            getProjectTeams(nextProject),
            defaultAssigneeKey
          ),
          assigneeId: "",
          bugDetails: {
            ...current.bugDetails,
            testerOwnerId: defaultAssigneeKey,
            developerLeadId: "",
          },
        };
      }

      if (name === "teamId") {
        return {
          ...current,
          teamId: value,
          assigneeId: "",
          bugDetails: {
            ...current.bugDetails,
            testerOwnerId: defaultAssigneeKey,
            developerLeadId: "",
          },
        };
      }

      if (name === "type") {
        return {
          ...current,
          type: value,
          status: value === "Bug" ? ISSUE_STATUS.NEW : defaultStatus,
          priority: value === "Bug" && current.priority === "Low" ? "High" : current.priority,
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
      return "Create a project before planning work.";
    }

    if (!selectedProject) {
      return "Select a project to continue.";
    }

    if (!availableTeams.length) {
      return "No teams were returned for this project. Attach a team or ask an admin to verify the project-team links.";
    }

    return "";
  }, [
    availableTeams.length,
    projects.length,
    selectedProject,
  ]);
  const isSubmitPending = isPending || isUploadingAttachments;

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

    if (isBugType) {
      if (!formData.bugDetails.severity || !formData.priority) {
        setError("Severity and priority are required for bugs.");
        return;
      }

      if (
        !formData.bugDetails.stepsToReproduce.trim() ||
        !formData.bugDetails.expectedResult.trim() ||
        !formData.bugDetails.actualResult.trim()
      ) {
        setError(
          "Steps to Reproduce, Expected Result, and Actual Result are required for bugs."
        );
        return;
      }
    }

    try {
      setError("");

      const createdIssue = await onSubmit({
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: formData.type,
        status: isBugType ? ISSUE_STATUS.NEW : formData.status,
        priority: formData.priority,
        projectId: formData.projectId,
        teamId: formData.teamId,
        assigneeId: showAssigneeField
          ? formData.assigneeId || null
          : defaultAssigneeInTeam
            ? defaultAssigneeKey || null
            : null,
        ...(isBugType
          ? {
              bugDetails: {
                severity: formData.bugDetails.severity,
                testerOwnerId: formData.bugDetails.testerOwnerId || null,
                developerLeadId: formData.bugDetails.developerLeadId || null,
                stepsToReproduce: formData.bugDetails.stepsToReproduce.trim(),
                expectedResult: formData.bugDetails.expectedResult.trim(),
                actualResult: formData.bugDetails.actualResult.trim(),
              },
            }
          : {}),
      });

      if (
        includeAttachments &&
        attachmentFiles.length &&
        createdIssue?._id &&
        typeof onUploadAttachment === "function"
      ) {
        setIsUploadingAttachments(true);

        for (const file of attachmentFiles) {
          await onUploadAttachment({
            issueId: createdIssue._id,
            file,
          });
        }
      }

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
      setAttachmentFiles([]);
    } catch (submitError) {
      setError(
        submitError.response?.data?.message || "Unable to create the work item."
      );
    } finally {
      setIsUploadingAttachments(false);
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
          {titleLabel}
        </label>
        <Input
          id="title"
          name="title"
          placeholder={titlePlaceholder}
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
          placeholder={descriptionPlaceholder}
          value={formData.description}
          onChange={handleChange}
        />
      </div>

      {isBugType ? (
        <div className="rounded-[24px] border border-rose-100 bg-rose-50/60 p-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Severity</span>
              <select
                className="field-select"
                value={formData.bugDetails.severity}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    bugDetails: {
                      ...current.bugDetails,
                      severity: event.target.value,
                    },
                  }))
                }
              >
                <option value="">Select severity</option>
                {BUG_SEVERITY_OPTIONS.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Priority</span>
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
                {BUG_PRIORITY_OPTIONS.map((priorityOption) => (
                  <option key={priorityOption} value={priorityOption}>
                    {priorityOption}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Status</span>
              <select className="field-select" value={ISSUE_STATUS.NEW} disabled>
                {BUG_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">
                Tester / QA Owner
              </span>
              <select
                className="field-select"
                value={formData.bugDetails.testerOwnerId}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    bugDetails: {
                      ...current.bugDetails,
                      testerOwnerId: event.target.value,
                    },
                  }))
                }
              >
                <option value="">Unassigned</option>
                {testerOptions.map((assignee) => (
                  <option key={assignee._id} value={assignee._id}>
                    {assignee.name} ({assignee.role})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">
                Developer / Dev Lead
              </span>
              <select
                className="field-select"
                value={formData.bugDetails.developerLeadId}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    bugDetails: {
                      ...current.bugDetails,
                      developerLeadId: event.target.value,
                    },
                  }))
                }
              >
                <option value="">Unassigned</option>
                {developerOptions.map((assignee) => (
                  <option key={assignee._id} value={assignee._id}>
                    {assignee.name} ({assignee.role})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">
                Steps to Reproduce
              </span>
              <Textarea
                value={formData.bugDetails.stepsToReproduce}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    bugDetails: {
                      ...current.bugDetails,
                      stepsToReproduce: event.target.value,
                    },
                  }))
                }
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">
                  Expected Result
                </span>
                <Textarea
                  value={formData.bugDetails.expectedResult}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      bugDetails: {
                        ...current.bugDetails,
                        expectedResult: event.target.value,
                      },
                    }))
                  }
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">
                  Actual Result
                </span>
                <Textarea
                  value={formData.bugDetails.actualResult}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      bugDetails: {
                        ...current.bugDetails,
                        actualResult: event.target.value,
                      },
                    }))
                  }
                />
              </label>
            </div>

            {includeAttachments ? (
              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Attachments
                </span>
                <Input
                  type="file"
                  multiple
                  accept={attachmentAccept}
                  className="h-12 rounded-2xl border-slate-200 bg-white shadow-none file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
                  onChange={(event) =>
                    setAttachmentFiles(Array.from(event.target.files || []))
                  }
                  disabled={isSubmitPending}
                />
                {attachmentFiles.length ? (
                  <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs leading-5 text-slate-600">
                    {attachmentFiles.map((file) => file.name).join(", ")}
                  </div>
                ) : null}
              </label>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2">
          <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <ClipboardList className="h-4 w-4 text-blue-600" />
            {projectLabel}
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
            <ClipboardList className="h-4 w-4 text-blue-600" />
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

        {!isBugType ? (
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
        ) : null}

        {showStatusField && !isBugType ? (
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Status</span>
            <select
              className="field-select"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              {ISSUE_WORKFLOW_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
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
        disabled={isSubmitPending || Boolean(submitBlockedMessage)}
        type="submit"
      >
        {isSubmitPending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );

  if (variant === "plain") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-blue-600">
            <Sparkle className="h-3.5 w-3.5" />
            {headerLabel}
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {cardTitle}
          </h2>
          <p className="text-sm leading-6 text-slate-600">
            {cardDescription}
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
          {headerLabel}
        </div>
        <CardTitle>{cardTitle}</CardTitle>
        <CardDescription>{cardDescription}</CardDescription>
      </CardHeader>

      <CardContent>{formContent}</CardContent>
    </Card>
  );
};

export default IssueComposer;
