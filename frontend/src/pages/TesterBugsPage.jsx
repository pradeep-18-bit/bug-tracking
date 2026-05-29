import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FolderKanban,
  History,
  TimerReset,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  createIssue,
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

const getIssueModule = (issue) =>
  resolveBugDetails(issue)?.moduleName || "Unmapped module";

const severityClassName = {
  Critical: "border-rose-200 bg-rose-50 text-rose-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
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
        .filter((issue) => getReporterId(issue) === testerId)
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
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(520px,0.95fr)] xl:items-start">
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
          <CardHeader className="border-b border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(239,246,255,0.92),rgba(238,242,255,0.88))] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">My Reported Bugs</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  Latest 7 bugs, newest first. Open any row for full details.
                </CardDescription>
              </div>
              <Badge className="border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50">
                {reportedIssues.length} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            {reportedIssues.length ? (
              <CompactBugList
                issues={latestReportedIssues}
                projects={assignedProjects}
                onOpen={setSelectedIssue}
                onViewAll={() => navigate("/tasks?tab=bugs")}
              />
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
