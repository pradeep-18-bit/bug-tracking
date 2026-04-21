import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  LoaderCircle,
  MessageSquareText,
  PencilLine,
  Trash2,
  UserCircle2,
  Users2,
} from "lucide-react";
import { createComment, fetchComments } from "@/lib/api";
import {
  getIssueDisplayKey,
  getIssuePriorityVariant,
  ISSUE_STATUS,
  ISSUE_TYPE_OPTIONS,
  ISSUE_WORKFLOW_STATUS_OPTIONS,
  normalizeIssueStatus,
  resolveIssueAssignee,
  resolveIssueAssigneeId,
  resolveIssueDependency,
  resolveIssueDependencyId,
  getIssueStatusLabel,
  getIssueStatusVariant,
  getIssueTypeVariant,
} from "@/lib/issues";
import {
  findProjectById,
  getProjectTeamMembers,
  getProjectTeams,
  resolveUserId,
} from "@/lib/project-teams";
import { formatDate, formatDateTime, formatTime, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const toDateTimeLocalValue = (value) => {
  if (!value) {
    return "";
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return "";
  }

  return new Date(parsedValue.getTime() - parsedValue.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const formatDueAt = (value) => (value ? formatDateTime(value) : "No due date");

const formatDependencyLabel = (issue) =>
  issue ? `${getIssueDisplayKey(issue)} ${issue.title}` : "No dependency";

const buildDetailDraft = (issue) => ({
  title: issue?.title || "",
  description: issue?.description || "",
  type: issue?.type || "Task",
  projectId: issue?.projectId?._id || issue?.projectId || "",
  teamId: issue?.teamId?._id || issue?.teamId || "",
  assigneeId: resolveIssueAssigneeId(issue),
  priority: issue?.priority || "Medium",
  status: normalizeIssueStatus(issue?.status),
  dueAt: toDateTimeLocalValue(issue?.dueAt),
  dependsOnIssueId: resolveIssueDependencyId(issue),
});

const IssueDetailsDialog = ({
  issue,
  open,
  onOpenChange,
  projects = [],
  availableIssues = [],
  onUpdateIssue,
  onDeleteIssue,
  updatingId,
  deletingId,
  canEditCoreDetails = false,
  canEditStatus = true,
  canEditPriority = true,
  canEditAssignee = true,
  canDeleteIssue = true,
}) => {
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [detailDraft, setDetailDraft] = useState(buildDetailDraft(issue));
  const [detailsError, setDetailsError] = useState("");

  const selectedProject = useMemo(
    () => findProjectById(projects, detailDraft.projectId),
    [detailDraft.projectId, projects]
  );
  const availableTeams = useMemo(
    () => getProjectTeams(selectedProject),
    [selectedProject]
  );
  const availableAssignees = useMemo(
    () => getProjectTeamMembers(selectedProject, detailDraft.teamId),
    [detailDraft.teamId, selectedProject]
  );
  const dependencyOptions = useMemo(
    () =>
      availableIssues
        .filter(
          (candidateIssue) =>
            String(candidateIssue._id) !== String(issue?._id) &&
            String(candidateIssue?.projectId?._id || candidateIssue?.projectId || "") ===
              String(detailDraft.projectId)
        )
        .sort(
          (left, right) =>
            new Date(right.createdAt || 0) - new Date(left.createdAt || 0)
        ),
    [availableIssues, detailDraft.projectId, issue?._id]
  );

  useEffect(() => {
    if (!issue) {
      return;
    }

    setDetailDraft(buildDetailDraft(issue));
    setDetailsError("");
  }, [issue]);

  useEffect(() => {
    if (!availableTeams.length) {
      if (!detailDraft.teamId) {
        return;
      }

      setDetailDraft((current) => ({
        ...current,
        teamId: "",
        assigneeId: "",
      }));
      return;
    }

    if (
      availableTeams.some((team) => String(team._id) === String(detailDraft.teamId))
    ) {
      return;
    }

    setDetailDraft((current) => ({
      ...current,
      teamId: availableTeams[0]._id,
      assigneeId: "",
    }));
  }, [availableTeams, detailDraft.teamId]);

  useEffect(() => {
    const assigneeIds = new Set(
      availableAssignees.map((assignee) => resolveUserId(assignee))
    );

    if (!detailDraft.assigneeId || assigneeIds.has(String(detailDraft.assigneeId))) {
      return;
    }

    setDetailDraft((current) => ({
      ...current,
      assigneeId: "",
    }));
  }, [availableAssignees, detailDraft.assigneeId]);

  useEffect(() => {
    if (
      !detailDraft.dependsOnIssueId ||
      dependencyOptions.some(
        (candidateIssue) =>
          String(candidateIssue._id) === String(detailDraft.dependsOnIssueId)
      )
    ) {
      return;
    }

    setDetailDraft((current) => ({
      ...current,
      dependsOnIssueId: "",
    }));
  }, [dependencyOptions, detailDraft.dependsOnIssueId]);

  const { data: comments = [], isLoading: isCommentsLoading } = useQuery({
    queryKey: ["comments", issue?._id],
    queryFn: () => fetchComments(issue._id),
    enabled: open && Boolean(issue?._id),
  });

  const createCommentMutation = useMutation({
    mutationFn: createComment,
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({
        queryKey: ["comments", issue?._id],
      });
    },
  });

  const handleSubmitComment = async (event) => {
    event.preventDefault();

    if (!commentText.trim()) {
      return;
    }

    await createCommentMutation.mutateAsync({
      issueId: issue._id,
      text: commentText.trim(),
    });
  };

  if (!issue) {
    return null;
  }

  const isUpdatingCurrentIssue = updatingId === issue._id;
  const issueAssignee = resolveIssueAssignee(issue);
  const issueAssigneeId = resolveIssueAssigneeId(issue);
  const issueDependency = resolveIssueDependency(issue);
  const issueDependencyId = resolveIssueDependencyId(issue);
  const issueTeamName = issue.teamId?.name || "No team assigned";
  const issueKey = getIssueDisplayKey(issue);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={getIssuePriorityVariant(issue.priority)}>{issue.priority}</Badge>
            <Badge variant={getIssueTypeVariant(issue.type)}>{issue.type}</Badge>
            <Badge variant={getIssueStatusVariant(issue.status)}>
              {getIssueStatusLabel(issue.status)}
            </Badge>
            {issue.teamId?.name ? (
              <Badge className="border border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                {issue.teamId.name}
              </Badge>
            ) : null}
          </div>
          <DialogTitle className="pr-10">
            <span className="mr-3 font-mono text-sm uppercase tracking-[0.22em] text-slate-400">
              {issueKey}
            </span>
            {issue.title}
          </DialogTitle>
          <DialogDescription>
            {issue.description || "No detailed description has been added yet."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
          <section className="space-y-6">
            {canEditCoreDetails ? (
              <form
                className="space-y-4 rounded-[28px] border border-slate-200 bg-slate-50 p-5"
                onSubmit={async (event) => {
                  event.preventDefault();

                  if (!detailDraft.title.trim() || !detailDraft.projectId || !detailDraft.teamId) {
                    setDetailsError("Title, project, and team are required.");
                    return;
                  }

                  setDetailsError("");

                  try {
                    await onUpdateIssue(issue._id, {
                      title: detailDraft.title.trim(),
                      description: detailDraft.description.trim(),
                      type: detailDraft.type,
                      projectId: detailDraft.projectId,
                      teamId: detailDraft.teamId,
                      assigneeId: detailDraft.assigneeId || null,
                      priority: detailDraft.priority,
                      status: detailDraft.status,
                      dueAt: detailDraft.dueAt || null,
                      dependsOnIssueId: detailDraft.dependsOnIssueId || null,
                    });
                  } catch (error) {
                    setDetailsError(
                      error.response?.data?.message || "Unable to save work item details."
                    );
                  }
                }}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <PencilLine className="h-4 w-4 text-blue-600" />
                  <span>Edit work item details</span>
                </div>

                <div className="space-y-2">
                  <label
                    className="text-xs uppercase tracking-[0.22em] text-gray-500"
                    htmlFor="issue-title"
                  >
                    Title
                  </label>
                  <Input
                    id="issue-title"
                    value={detailDraft.title}
                    onChange={(event) =>
                      setDetailDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-xs uppercase tracking-[0.22em] text-gray-500"
                    htmlFor="issue-description"
                  >
                    Description
                  </label>
                  <Textarea
                    id="issue-description"
                    value={detailDraft.description}
                    onChange={(event) =>
                      setDetailDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                      Project
                    </span>
                    <select
                      className="field-select"
                      value={detailDraft.projectId}
                      onChange={(event) =>
                        setDetailDraft((current) => ({
                          ...current,
                          projectId: event.target.value,
                          teamId: "",
                          assigneeId: "",
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

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                      Team
                    </span>
                    <select
                      className="field-select"
                      value={detailDraft.teamId}
                      onChange={(event) =>
                        setDetailDraft((current) => ({
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
                    <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                      Assignee
                    </span>
                    <select
                      className="field-select"
                      value={detailDraft.assigneeId}
                      onChange={(event) =>
                        setDetailDraft((current) => ({
                          ...current,
                          assigneeId: event.target.value,
                        }))
                      }
                      disabled={!detailDraft.teamId}
                    >
                      <option value="">Unassigned</option>
                      {availableAssignees.map((assignee) => (
                        <option key={assignee._id} value={assignee._id}>
                          {assignee.name} ({assignee.role})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                      Type
                    </span>
                    <select
                      className="field-select"
                      value={detailDraft.type}
                      onChange={(event) =>
                        setDetailDraft((current) => ({
                          ...current,
                          type: event.target.value,
                        }))
                      }
                    >
                      {ISSUE_TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                      Priority
                    </span>
                    <select
                      className="field-select"
                      value={detailDraft.priority}
                      onChange={(event) =>
                        setDetailDraft((current) => ({
                          ...current,
                          priority: event.target.value,
                        }))
                      }
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                      Status
                    </span>
                    <select
                      className="field-select"
                      value={detailDraft.status}
                      onChange={(event) =>
                        setDetailDraft((current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                    >
                      {ISSUE_WORKFLOW_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                      Due Date & Time
                    </span>
                    <Input
                      type="datetime-local"
                      value={detailDraft.dueAt}
                      onChange={(event) =>
                        setDetailDraft((current) => ({
                          ...current,
                          dueAt: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                      Depends On
                    </span>
                    <select
                      className="field-select"
                      value={detailDraft.dependsOnIssueId}
                      onChange={(event) =>
                        setDetailDraft((current) => ({
                          ...current,
                          dependsOnIssueId: event.target.value,
                        }))
                      }
                    >
                      <option value="">No dependency</option>
                      {dependencyOptions.map((candidateIssue) => (
                        <option key={candidateIssue._id} value={candidateIssue._id}>
                          {formatDependencyLabel(candidateIssue)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {!availableTeams.length ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Attach a team to this project before assigning or moving this work item.
                  </div>
                ) : null}

                {detailsError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {detailsError}
                  </div>
                ) : null}

                <Button
                  className="w-full sm:w-auto"
                  disabled={isUpdatingCurrentIssue || !availableTeams.length}
                  type="submit"
                >
                  {isUpdatingCurrentIssue ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-gray-500">Project</p>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {issue.projectId?.name || "Unknown project"}
                </p>
              </div>

              <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-gray-500">
                  <Users2 className="h-3.5 w-3.5" />
                  Team
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-900">{issueTeamName}</p>
              </div>

              <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-gray-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Created
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {formatDateTime(issue.createdAt)}
                </p>
              </div>

              <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-gray-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Started
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {formatDateTime(issue.startedAt)}
                </p>
              </div>

              <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-gray-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Due
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {formatDueAt(issue.dueAt)}
                </p>
              </div>

              <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-gray-500">
                  Depends On
                </p>
                {issueDependency ? (
                  <>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {formatDependencyLabel(issueDependency)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {getIssueStatusLabel(issueDependency.status)}
                    </p>
                  </>
                ) : issueDependencyId ? (
                  <p className="mt-2 text-sm font-semibold text-gray-900">Linked work item</p>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-gray-900">No dependency</p>
                )}
              </div>
            </div>

            {!canEditCoreDetails ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                    Status
                  </span>
                  <select
                    className="field-select"
                    value={normalizeIssueStatus(issue.status)}
                    onChange={(event) =>
                      onUpdateIssue(issue._id, { status: event.target.value })
                    }
                    disabled={!canEditStatus || isUpdatingCurrentIssue}
                  >
                    {ISSUE_WORKFLOW_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                    Priority
                  </span>
                  <select
                    className="field-select"
                    value={issue.priority}
                    onChange={(event) =>
                      onUpdateIssue(issue._id, { priority: event.target.value })
                    }
                    disabled={!canEditPriority || isUpdatingCurrentIssue}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                    Assignee
                  </span>
                  <select
                    className="field-select"
                    value={issueAssigneeId}
                    onChange={(event) =>
                      onUpdateIssue(issue._id, {
                        assigneeId: event.target.value || null,
                      })
                    }
                    disabled={!canEditAssignee || isUpdatingCurrentIssue || !issue.teamId?._id}
                  >
                    <option value="">Unassigned</option>
                    {availableAssignees.map((assignee) => (
                      <option key={assignee._id} value={assignee._id}>
                        {assignee.name} ({assignee.role})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-gray-500">Reporter</p>
                <div className="mt-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{getInitials(issue.reporter?.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {issue.reporter?.name}
                    </p>
                    <p className="text-xs text-gray-500">{issue.reporter?.role}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-gray-500">
                  Current owner
                </p>
                {issueAssignee ? (
                  <div className="mt-3 flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{getInitials(issueAssignee.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {issueAssignee.name}
                      </p>
                      <p className="text-xs text-gray-500">{issueAssignee.role}</p>
                    </div>
                  </div>
                ) : issueAssigneeId ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                    <UserCircle2 className="h-4 w-4" />
                    <span>Assigned user</span>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                    <UserCircle2 className="h-4 w-4" />
                    <span>No one is assigned yet.</span>
                  </div>
                )}
              </div>
            </div>

            {canDeleteIssue ? (
              <Button
                className="w-full sm:w-auto"
                variant="destructive"
                type="button"
                disabled={deletingId === issue._id}
                onClick={async () => {
                  await onDeleteIssue(issue._id);
                  onOpenChange(false);
                }}
              >
                {deletingId === issue._id ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete Issue
              </Button>
            ) : null}
          </section>

          <section className="rounded-[28px] border border-gray-200 bg-gray-50 p-5">
            <div className="mb-4 flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-blue-600" />
              <p className="font-semibold text-gray-900">Discussion</p>
            </div>

            <form className="space-y-3" onSubmit={handleSubmitComment}>
              <Input
                placeholder="Add a status update or implementation note"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
              />
              <Button
                className="w-full"
                disabled={createCommentMutation.isPending}
                type="submit"
              >
                {createCommentMutation.isPending ? "Posting..." : "Add Comment"}
              </Button>
            </form>

            <Separator className="my-5" />

            <div className="space-y-4">
              {isCommentsLoading ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : comments.length ? (
                comments.map((comment) => (
                  <div
                    key={comment._id}
                    className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {getInitials(comment.userId?.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {comment.userId?.name}
                          </p>
                          <span className="text-xs text-gray-500">
                            {formatDate(comment.createdAt)} at {formatTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                          {comment.comment || comment.text}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm leading-6 text-gray-500">
                  No comments yet. Add the first delivery note for this issue.
                </div>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IssueDetailsDialog;
