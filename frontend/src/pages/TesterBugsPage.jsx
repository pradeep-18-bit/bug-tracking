import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FolderKanban,
  History,
  LoaderCircle,
  RotateCcw,
  TimerReset,
  Trash2,
  UserCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  createIssue,
  deleteIssue,
  fetchIssues,
  fetchProjects,
  updateIssue,
  uploadIssueAttachment,
} from "@/lib/api";
import {
  ISSUE_STATUS,
  getIssueDisplayKey,
  getIssuePriorityVariant,
  getIssueStatusLabel,
  getIssueStatusVariant,
  normalizeBugStatusForIssue,
  resolveBugDetails,
  resolveIssueProjectId,
} from "@/lib/issues";
import {
  getProjectTeams,
  resolveUserId,
} from "@/lib/project-teams";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import IssueComposer from "@/components/issues/IssueComposer";
import IssueDetailsDialog from "@/components/issues/IssueDetailsDialog";
import EmptyState from "@/components/shared/EmptyState";
import ToastNotice from "@/components/shared/ToastNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const ATTACHMENT_ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.log,.csv,.json,.xml,.zip";

const BUG_PROGRESS = {
  [ISSUE_STATUS.NEW]: 10,
  [ISSUE_STATUS.OPEN]: 24,
  [ISSUE_STATUS.ASSIGNED]: 48,
  [ISSUE_STATUS.IN_PROGRESS]: 56,
  [ISSUE_STATUS.FIXED]: 78,
  [ISSUE_STATUS.QA]: 84,
  [ISSUE_STATUS.REOPEN]: 38,
  [ISSUE_STATUS.CLOSED]: 100,
  [ISSUE_STATUS.REJECTED]: 100,
};

const getReporterId = (issue) => resolveUserId(issue?.reporter);

const getTesterOwnerId = (issue) =>
  String(resolveBugDetails(issue)?.testerOwner?._id || resolveBugDetails(issue)?.testerOwner || "");

const isTesterTeam = (team, testerId) =>
  (team?.members || []).some((member) => resolveUserId(member) === testerId);

const getAssignedTeamsForTester = (project, testerId) =>
  getProjectTeams(project).filter((team) => isTesterTeam(team, testerId));

const buildTesterProject = (project, testerId) => {
  const assignedTeams = getAssignedTeamsForTester(project, testerId);

  if (!assignedTeams.length) {
    return null;
  }

  const teams = getProjectTeams(project);
  const uniqueMembers = new Map();

  teams.forEach((team) => {
    (team.members || []).forEach((member) => {
      const memberId = resolveUserId(member);

      if (memberId && !uniqueMembers.has(memberId)) {
        uniqueMembers.set(memberId, member);
      }
    });
  });

  return {
    ...project,
    teams,
    teamCount: teams.length,
    members: Array.from(uniqueMembers.values()),
    memberCount: uniqueMembers.size,
  };
};

const getProjectName = (issue, projects = []) => {
  const projectId = resolveIssueProjectId(issue);
  const project = projects.find((item) => String(item._id) === projectId);

  return issue?.projectId?.name || project?.name || "Assigned project";
};

const getDeveloperName = (issue) => {
  const bugDetails = resolveBugDetails(issue);

  return (
    bugDetails?.developerLead?.name ||
    issue?.assignee?.name ||
    "Unassigned"
  );
};

const getIssueSeverity = (issue) =>
  resolveBugDetails(issue)?.severity || "Not set";

const getIssueModule = (issue) =>
  resolveBugDetails(issue)?.moduleName || "Unmapped module";

const getBugReviewLabel = (issue) => {
  const status = normalizeBugStatusForIssue(issue);

  if (status === ISSUE_STATUS.FIXED) {
    return "Ready for QA";
  }

  if (status === ISSUE_STATUS.REOPEN) {
    return "Reopened";
  }

  return getIssueStatusLabel(status);
};

const getBugProgress = (issue) =>
  BUG_PROGRESS[normalizeBugStatusForIssue(issue)] ?? 10;

const severityClassName = {
  Critical: "border-rose-200 bg-rose-50 text-rose-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const ReviewMetric = ({ label, value, children }) => (
  <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
      {label}
    </p>
    {children || (
      <p className="mt-1 truncate text-sm font-semibold text-slate-950">
        {value}
      </p>
    )}
  </div>
);

const BugReviewCard = ({
  issue,
  isUpdating,
  isDeleting = false,
  onApproveFix,
  onDelete,
  onOpen,
  onReopen,
  projects,
}) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const currentStatus = normalizeBugStatusForIssue(issue);
  const canQaAct = currentStatus === ISSUE_STATUS.FIXED;
  const progress = getBugProgress(issue);

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await onDelete(issue);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting bug:", error);
    }
  };

  return (
    <>
      <article className="rounded-[24px] border border-white/70 bg-white/88 p-4 shadow-[0_18px_44px_-32px_rgba(15,23,42,0.38)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-[0_24px_62px_-36px_rgba(15,23,42,0.44)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {getIssueDisplayKey(issue)}
            </p>
            <h3 className="mt-1 line-clamp-2 text-base font-semibold text-slate-950">
              {issue.title || "Untitled bug"}
            </h3>
            <p className="mt-1 truncate text-sm text-slate-500">
              {getProjectName(issue, projects)}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant={getIssuePriorityVariant(issue.priority)}>
              {issue.priority || "Medium"}
            </Badge>
            <Badge variant={getIssueStatusVariant(currentStatus)}>
              {getBugReviewLabel(issue)}
            </Badge>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <ReviewMetric label="Severity" value={getIssueSeverity(issue)} />
          <ReviewMetric label="Priority" value={issue.priority || "Medium"} />
          <ReviewMetric label="Developer">
            <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-slate-950">
              <UserCircle2 className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">{getDeveloperName(issue)}</span>
            </p>
          </ReviewMetric>
          <ReviewMetric label="Current Status" value={getBugReviewLabel(issue)} />
          <ReviewMetric
            label="Last Updated"
            value={formatDateTime(issue.updatedAt || issue.createdAt)}
          />
          <ReviewMetric label="QA Stage">
            <p className="mt-1 truncate text-sm font-semibold text-slate-950">
              {canQaAct ? "Awaiting verification" : "Monitoring"}
            </p>
          </ReviewMetric>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
            <span>Resolution progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#2563EB,#06B6D4,#10B981)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpen(issue)}
          >
            <Eye className="h-4 w-4" />
            Verify
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canQaAct || isUpdating || isDeleting}
            onClick={() => onReopen(issue)}
          >
            <RotateCcw className="h-4 w-4" />
            Reopen
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canQaAct || isUpdating || isDeleting}
            onClick={() => onApproveFix(issue)}
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve Fix
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={isUpdating || isDeleting}
            onClick={handleDeleteClick}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </article>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="rounded-[24px]">
          <DialogHeader className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <DialogTitle>Delete Bug?</DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete this bug report? This action cannot be undone.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="rounded-[18px] border border-red-200 bg-red-50/50 p-3 text-sm text-red-900">
            <p className="font-semibold">All related attachments and comments will also be deleted.</p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Bug
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const CompactBugRow = ({ issue, projects, onOpen }) => {
  const createdDate = issue?.createdAt ? formatDate(issue.createdAt) : "Unknown";
  const severity = getIssueSeverity(issue);

  return (
    <button
      className="grid w-full min-w-[920px] grid-cols-[110px_minmax(220px,1.35fr)_150px_110px_110px_120px_150px_118px] items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left text-sm transition hover:bg-blue-50/70 focus:bg-blue-50 focus:outline-none"
      type="button"
      onClick={() => onOpen(issue)}
    >
      <span className="font-mono text-xs font-semibold text-slate-500">
        {getIssueDisplayKey(issue)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-slate-950">
          {issue.title || "Untitled bug"}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {getProjectName(issue, projects)}
        </span>
      </span>
      <span className="truncate text-slate-600">{getIssueModule(issue)}</span>
      <span
        className={`inline-flex w-fit max-w-full items-center rounded-full border px-2 py-1 text-xs font-semibold ${
          severityClassName[severity] || "border-slate-200 bg-slate-50 text-slate-600"
        }`}
      >
        <span className="truncate">{severity}</span>
      </span>
      <Badge className="w-fit" variant={getIssuePriorityVariant(issue.priority)}>
        {issue.priority || "Medium"}
      </Badge>
      <Badge className="w-fit" variant={getIssueStatusVariant(issue.status)}>
        {getIssueStatusLabel(issue.status)}
      </Badge>
      <span className="truncate text-slate-600">{getDeveloperName(issue)}</span>
      <span className="whitespace-nowrap text-xs font-medium text-slate-500">
        {createdDate}
      </span>
    </button>
  );
};

const CompactBugList = ({ issues, projects, onOpen, onViewAll }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
    <div className="overflow-x-auto">
      <div className="grid min-w-[920px] grid-cols-[110px_minmax(220px,1.35fr)_150px_110px_110px_120px_150px_118px] gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        <span>Bug ID</span>
        <span>Title</span>
        <span>Module</span>
        <span>Severity</span>
        <span>Priority</span>
        <span>Status</span>
        <span>Developer</span>
        <span>Created</span>
      </div>
      {issues.map((issue) => (
        <CompactBugRow
          key={issue._id}
          issue={issue}
          projects={projects}
          onOpen={onOpen}
        />
      ))}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">
        Showing latest {issues.length} reported bugs.
      </p>
      <button
        type="button"
        onClick={onViewAll}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
      >
        <History className="h-4 w-4" />
        View All Reported Bugs
      </button>
    </div>
  </div>
);

const TesterBugsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [toast, setToast] = useState(null);
  const testerId = String(user?._id || user?.id || "");

  const showToast = (type, message) => {
    setToast({
      id: Date.now(),
      type,
      message,
    });
  };

  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    error: projectsError,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const {
    data: issues = [],
    isLoading: isIssuesLoading,
    error: issuesError,
  } = useQuery({
    queryKey: ["issues", "tester-bugs", testerId],
    queryFn: () => fetchIssues({ type: "Bug" }),
    enabled: Boolean(testerId),
  });

  useEffect(() => {
    if (!selectedIssue) {
      return;
    }

    const nextIssue = issues.find((issue) => issue._id === selectedIssue._id);

    if (nextIssue) {
      setSelectedIssue(nextIssue);
    }
  }, [issues, selectedIssue]);

  useEffect(() => {
    if (!toast?.id) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 5000);

    return () => window.clearTimeout(timeoutId);
  }, [toast?.id]);

  const assignedProjects = useMemo(
    () =>
      projects
        .map((project) => buildTesterProject(project, testerId))
        .filter(Boolean),
    [projects, testerId]
  );

  const reportedIssues = useMemo(
    () =>
      issues
        .filter((issue) => getReporterId(issue) === testerId || getTesterOwnerId(issue) === testerId)
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.updatedAt || 0).getTime() -
            new Date(a.createdAt || a.updatedAt || 0).getTime()
        ),
    [issues, testerId]
  );

  const latestReportedIssues = useMemo(
    () => reportedIssues.slice(0, 7),
    [reportedIssues]
  );

  const createIssueMutation = useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: uploadIssueAttachment,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["issue", variables?.issueId, "attachments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["issue", variables?.issueId, "history"],
      });
    },
  });

  const updateIssueMutation = useMutation({
    mutationFn: updateIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  const deleteBugMutation = useMutation({
    mutationFn: deleteIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      showToast("success", "Bug deleted successfully");
    },
    onError: (error) => {
      showToast("error", error.response?.data?.message || "Failed to delete bug");
    },
  });

  const handleApproveFix = (issue) =>
    updateIssueMutation.mutateAsync({
      id: issue._id,
      payload: {
        status: ISSUE_STATUS.CLOSED,
        statusChangeComment: "QA approved the fixed bug.",
      },
    });

  const handleReopenBug = (issue) => {
    const reason = window.prompt("Add a brief reason for reopening this bug:");

    if (!reason?.trim()) {
      return Promise.resolve();
    }

    return updateIssueMutation.mutateAsync({
      id: issue._id,
      payload: {
        status: ISSUE_STATUS.REOPEN,
        reopenReason: reason.trim(),
      },
    });
  };

  const handleDeleteBug = (issue) => {
    return deleteBugMutation.mutateAsync(issue._id);
  };

  const error = projectsError || issuesError;
  const isLoading = isProjectsLoading || isIssuesLoading;

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-rose-700">
          {error.response?.data?.message || "Unable to load tester bugs data."}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-[620px] w-full rounded-[24px]" />
      </div>
    );
  }

  if (!assignedProjects.length) {
    return (
      <EmptyState
        title="No assigned projects yet"
        description="Once an admin adds you to a project team, you can report and track bugs from this page."
        icon={<FolderKanban className="h-5 w-5" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      {reportedIssues.length > 0 && (
        <section className="min-w-0">
          <Card className="overflow-hidden border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
            <CardHeader className="border-b border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(239,246,255,0.92),rgba(238,242,255,0.88))]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Bug Review Progress</CardTitle>
                  <CardDescription>
                    Track bugs you reported, developer status, QA verification, and resolution flow.
                  </CardDescription>
                </div>
                <Badge className="border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50">
                  {reportedIssues.length} reported
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <div className="grid gap-4 xl:grid-cols-2">
                {reportedIssues.map((issue) => (
                  <BugReviewCard
                    key={issue._id}
                    issue={issue}
                    isUpdating={
                      updateIssueMutation.isPending &&
                      updateIssueMutation.variables?.id === issue._id
                    }
                    isDeleting={
                      deleteBugMutation.isPending &&
                      deleteBugMutation.variables === issue._id
                    }
                    onApproveFix={handleApproveFix}
                    onDelete={handleDeleteBug}
                    onOpen={setSelectedIssue}
                    onReopen={handleReopenBug}
                    projects={projects}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="min-w-0">
        <IssueComposer
          defaultAssigneeId={testerId}
          defaultStatus={ISSUE_STATUS.TODO}
          defaultType="Bug"
          isPending={
            createIssueMutation.isPending || uploadAttachmentMutation.isPending
          }
          lockType
          onSubmit={async (payload) => {
            const createdIssue = await createIssueMutation.mutateAsync(payload);
            const hasAssignedDeveloper = Boolean(
              payload?.bugDetails?.developerLeadId
            );

            if (hasAssignedDeveloper) {
              showToast(
                createdIssue?.emailNotification?.status === "sent"
                  ? "success"
                  : "warning",
                createdIssue?.emailNotification?.status === "sent"
                  ? "Bug created and email sent to developer."
                  : "Bug created, but email notification failed."
              );
            }

            return createdIssue;
          }}
          onUploadAttachment={(payload) =>
            uploadAttachmentMutation.mutateAsync(payload)
          }
          projects={assignedProjects}
          allowedTypes={["Bug"]}
          showAssigneeField={false}
          showStatusField={false}
          submitLabel="Report Assigned Project Bug / Issue"
          headerLabel="Bug / Issue Reporting Form"
          cardTitle="Report assigned project bug / issue"
          cardDescription="Choose one of your assigned projects, describe the issue clearly, and attach screenshots, documents, PDFs, or logs."
          projectLabel="Assigned Project"
          titleLabel="Issue title"
          titlePlaceholder="Describe the assigned project issue"
          descriptionPlaceholder="Summarize the behavior, impacted area, and testing context."
          includeAttachments
          attachmentAccept={ATTACHMENT_ACCEPT}
          isTesterBugReport
          reporterName={user?.name || user?.email || "Tester"}
        />
      </section>

      <IssueDetailsDialog
        deletingId=""
        issue={selectedIssue}
        onDeleteIssue={async () => {}}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedIssue(null);
          }
        }}
        onUpdateIssue={(id, payload) =>
          updateIssueMutation.mutateAsync({ id, payload })
        }
        open={Boolean(selectedIssue)}
        projects={assignedProjects}
        updatingId={updateIssueMutation.isPending ? updateIssueMutation.variables?.id : ""}
        canEditPriority={false}
        canEditAssignee={false}
        canDeleteIssue={false}
      />
      <ToastNotice toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
};

export default TesterBugsPage;
