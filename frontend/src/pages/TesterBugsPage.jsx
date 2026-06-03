import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Eye,
  FolderKanban,
  LoaderCircle,
  RotateCcw,
  Search,
  Trash2,
  UserCircle2,
} from "lucide-react";
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
import { formatDateTime } from "@/lib/utils";
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
  [ISSUE_STATUS.TESTING]: 88,
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
  isFocused = false,
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
  const canQaAct = [ISSUE_STATUS.FIXED, ISSUE_STATUS.TESTING].includes(currentStatus);
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
      <article
        id={`bug-overview-${issue._id}`}
        className={`scroll-mt-20 rounded-[24px] border bg-white/88 p-4 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-[0_24px_62px_-36px_rgba(15,23,42,0.44)] ${
          isFocused
            ? "border-blue-400 shadow-[0_20px_58px_-26px_rgba(37,99,235,0.56)] ring-2 ring-blue-500/30"
            : "border-white/70 shadow-[0_18px_44px_-32px_rgba(15,23,42,0.38)]"
        }`}
      >
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

const TesterBugsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [toast, setToast] = useState(null);
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);
  const [overviewSearch, setOverviewSearch] = useState("");
  const [overviewStatus, setOverviewStatus] = useState("all");
  const testerId = String(user?._id || user?.id || "");
  const focusedBugId = searchParams.get("bug") || "";

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

  useEffect(() => {
    if (!focusedBugId || !issues.some((issue) => String(issue._id) === focusedBugId)) {
      return;
    }

    setOverviewSearch("");
    setOverviewStatus("all");
    setIsOverviewOpen(true);
  }, [focusedBugId, issues]);

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

  const filteredOverviewIssues = useMemo(() => {
    const search = overviewSearch.trim().toLowerCase();

    return reportedIssues
      .filter((issue) => getReporterId(issue) === testerId || getTesterOwnerId(issue) === testerId)
      .filter((issue) => {
        const status = normalizeBugStatusForIssue(issue);

        if (overviewStatus !== "all" && status !== overviewStatus) {
          return false;
        }

        if (!search) {
          return true;
        }

        return [
          getIssueDisplayKey(issue),
          issue.title,
          getProjectName(issue, projects),
          getIssueSeverity(issue),
          getDeveloperName(issue),
          getBugReviewLabel(issue),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
  }, [overviewSearch, overviewStatus, projects, reportedIssues, testerId]);

  useEffect(() => {
    if (!focusedBugId || !isOverviewOpen) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      document
        .getElementById(`bug-overview-${focusedBugId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [filteredOverviewIssues, focusedBugId, isOverviewOpen]);

  const reviewStats = useMemo(
    () => ({
      total: reportedIssues.length,
      active: reportedIssues.filter(
        (issue) => ![ISSUE_STATUS.CLOSED, ISSUE_STATUS.REJECTED].includes(normalizeBugStatusForIssue(issue))
      ).length,
      qa: reportedIssues.filter(
        (issue) => normalizeBugStatusForIssue(issue) === ISSUE_STATUS.FIXED
      ).length,
      closed: reportedIssues.filter(
        (issue) => normalizeBugStatusForIssue(issue) === ISSUE_STATUS.CLOSED
      ).length,
    }),
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
    onSuccess: (_, deletedId) => {
      queryClient.setQueriesData({ queryKey: ["issues"] }, (current) =>
        Array.isArray(current)
          ? current.filter((issue) => issue._id !== deletedId)
          : current
      );
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
    if (deleteBugMutation.isPending) {
      return Promise.resolve();
    }

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
      <section className="min-w-0">
        <Card className="overflow-hidden border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
          <CardHeader className="border-b border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(239,246,255,0.92),rgba(238,242,255,0.88))]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Reported Bug Overview</CardTitle>
                <CardDescription>
                  Keep the workspace compact, then open QA review details when you need them.
                </CardDescription>
              </div>
              <Button
                type="button"
                disabled={!reportedIssues.length}
                onClick={() => setIsOverviewOpen((current) => !current)}
              >
                <Eye className="h-4 w-4" />
                {isOverviewOpen
                  ? "Hide Bug Overview"
                  : `View Bug Overview (${reportedIssues.length})`}
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${
                    isOverviewOpen ? "rotate-180" : ""
                  }`}
                />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Search bug overview"
                  value={overviewSearch}
                  onChange={(event) => setOverviewSearch(event.target.value)}
                />
              </label>
              <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20"
                value={overviewStatus}
                onChange={(event) => setOverviewStatus(event.target.value)}
              >
                <option value="all">All statuses</option>
                {Object.values(ISSUE_STATUS).map((status) => (
                  <option key={status} value={status}>{getIssueStatusLabel(status)}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Reported", reviewStats.total],
                ["Active", reviewStats.active],
                ["Ready for QA", reviewStats.qa],
                ["Closed", reviewStats.closed],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
                </div>
              ))}
            </div>
            {!reportedIssues.length ? (
              <p className="text-center text-xs font-medium text-slate-400">
                No reported bugs yet
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section
        className={`grid min-w-0 transition-[grid-template-rows,opacity] duration-300 ease-out ${
          isOverviewOpen
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <Card className="overflow-hidden rounded-2xl border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
            <CardHeader className="border-b border-slate-200/80 bg-white/94 px-4 py-4 sm:px-5">
              <CardTitle>Bug Review Progress</CardTitle>
              <CardDescription>
                Verify fixes, reopen issues, approve resolutions, or delete bugs you own.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[680px] overflow-y-auto bg-slate-50/80 p-3 sm:p-5">
              {isOverviewOpen ? (
                filteredOverviewIssues.length ? (
                  <div className="grid gap-3">
                    {filteredOverviewIssues.map((issue) => (
                      <BugReviewCard
                        key={issue._id}
                        issue={issue}
                        isFocused={String(issue._id) === focusedBugId}
                        isUpdating={updateIssueMutation.isPending && updateIssueMutation.variables?.id === issue._id}
                        isDeleting={deleteBugMutation.isPending && deleteBugMutation.variables === issue._id}
                        onApproveFix={handleApproveFix}
                        onDelete={handleDeleteBug}
                        onOpen={setSelectedIssue}
                        onReopen={handleReopenBug}
                        projects={projects}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-xs font-medium text-slate-400">
                    No reported bugs yet
                  </p>
                )
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

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
