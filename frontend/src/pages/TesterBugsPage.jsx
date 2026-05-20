import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bug,
  CalendarDays,
  FileText,
  FolderKanban,
  TimerReset,
} from "lucide-react";
import {
  createIssue,
  fetchIssueAttachments,
  fetchIssues,
  fetchProjects,
  updateIssue,
  uploadIssueAttachment,
} from "@/lib/api";
import {
  ISSUE_STATUS,
  getIssueDisplayKey,
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
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import IssueComposer from "@/components/issues/IssueComposer";
import IssueDetailsDialog from "@/components/issues/IssueDetailsDialog";
import EmptyState from "@/components/shared/EmptyState";
import ToastNotice from "@/components/shared/ToastNotice";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ATTACHMENT_ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.log,.csv,.json,.xml,.zip";

const MAIN_BUG_FLOW = [
  ISSUE_STATUS.NEW,
  ISSUE_STATUS.OPEN,
  ISSUE_STATUS.ASSIGNED,
  ISSUE_STATUS.FIXED,
  ISSUE_STATUS.CLOSED,
];

const ALTERNATE_BUG_FLOW = [
  ISSUE_STATUS.REOPEN,
  ISSUE_STATUS.REJECTED,
  ISSUE_STATUS.DEFERRED,
];

const getReporterId = (issue) => resolveUserId(issue?.reporter);

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

const AttachmentIndicator = ({ issueId }) => {
  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["issue", issueId, "attachments"],
    queryFn: () => fetchIssueAttachments(issueId),
    enabled: Boolean(issueId),
  });

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
      <FileText className="h-3.5 w-3.5 text-blue-600" />
      {isLoading ? "..." : attachments.length}
    </span>
  );
};

const StatusFlow = ({ issue }) => {
  const currentStatus = normalizeBugStatusForIssue(issue);
  const currentIndex = MAIN_BUG_FLOW.indexOf(currentStatus);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-1">
        {MAIN_BUG_FLOW.map((status, index) => {
          const isCurrent = currentStatus === status;
          const isReached = currentIndex >= index;

          return (
            <div key={status} className="min-w-0">
              <div
                className={`h-2 rounded-full ${
                  isReached
                    ? "bg-[linear-gradient(90deg,#2563EB_0%,#10B981_100%)]"
                    : "bg-slate-200"
                }`}
              />
              <p
                className={`mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.12em] ${
                  isCurrent ? "text-slate-950" : "text-slate-500"
                }`}
              >
                {getIssueStatusLabel(status)}
              </p>
            </div>
          );
        })}
      </div>

      {ALTERNATE_BUG_FLOW.includes(currentStatus) ? (
        <div className="flex flex-wrap gap-1.5">
          {ALTERNATE_BUG_FLOW.map((status) => (
            <span
              key={status}
              className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                status === currentStatus
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              {getIssueStatusLabel(status)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const BugCard = ({ issue, projects, onOpen }) => {
  const createdDate = issue?.createdAt ? formatDate(issue.createdAt) : "Unknown";
  const updatedDate = issue?.updatedAt || issue?.lastUpdatedAt || issue?.createdAt;

  return (
    <button
      className="block w-full rounded-[28px] border border-white/70 bg-white/86 p-4 text-left shadow-[0_20px_55px_-36px_rgba(15,23,42,0.38)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-[0_24px_70px_-38px_rgba(15,23,42,0.44)]"
      type="button"
      onClick={() => onOpen(issue)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            {getIssueDisplayKey(issue)}
          </p>
          <h3 className="mt-2 line-clamp-2 text-lg font-semibold tracking-tight text-slate-950">
            {issue.title}
          </h3>
          <p className="mt-1 truncate text-sm text-slate-500">
            {getProjectName(issue, projects)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AttachmentIndicator issueId={issue._id} />
          <Badge variant={getIssueStatusVariant(issue.status)}>
            {getIssueStatusLabel(issue.status)}
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Severity
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {getIssueSeverity(issue)}
          </p>
        </div>
        <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Priority
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {issue.priority || "Not set"}
          </p>
        </div>
        <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Developer
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
            {getDeveloperName(issue)}
          </p>
        </div>
        <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Dates
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
            {createdDate}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Updated {updatedDate ? formatDate(updatedDate) : "Unknown"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <StatusFlow issue={issue} />
      </div>
    </button>
  );
};

const TesterBugsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
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
    () => issues.filter((issue) => getReporterId(issue) === testerId),
    [issues, testerId]
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
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-[760px] w-full rounded-[32px]" />
        <Skeleton className="h-[760px] w-full rounded-[32px]" />
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
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/70 bg-white/90 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.36)] backdrop-blur-xl">
        <CardContent className="relative p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.16),transparent_30%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-blue-700 shadow-sm">
                <Bug className="h-3.5 w-3.5" />
                Bugs
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                Bug reporting and tracking workspace
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Report bugs for your assigned projects and track developer progress,
                comments, attachments, and status history in one place.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Reported
                </p>
                <p className="mt-1 text-3xl font-semibold text-slate-950">
                  {reportedIssues.length}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Assigned
                </p>
                <p className="mt-1 text-3xl font-semibold text-slate-950">
                  {assignedProjects.length}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <div className="min-w-0">
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
        </div>

        <Card className="min-w-0 overflow-hidden border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
          <CardHeader className="border-b border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(239,246,255,0.92),rgba(238,242,255,0.88))]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>My Reported Bugs</CardTitle>
                <CardDescription>
                  Open details to view comments, attachments, status timeline, and
                  developer progress.
                </CardDescription>
              </div>
              <Badge className="border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50">
                {reportedIssues.length} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-5">
            {reportedIssues.length ? (
              reportedIssues.map((issue) => (
                <BugCard
                  key={issue._id}
                  issue={issue}
                  projects={assignedProjects}
                  onOpen={setSelectedIssue}
                />
              ))
            ) : (
              <EmptyState
                title="No reported bugs yet"
                description="Bugs you report from the assigned project form will appear here with their status and developer progress."
                icon={<TimerReset className="h-5 w-5" />}
              />
            )}
          </CardContent>
        </Card>
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
