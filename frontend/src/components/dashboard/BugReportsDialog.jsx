import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Ban,
  Bug,
  CheckCircle2,
  Clock3,
  GitPullRequestArrow,
  ShieldCheck,
  Users2,
} from "lucide-react";
import { fetchWorkspaceUsers } from "@/lib/api";
import {
  ISSUE_STATUS,
  isBugIssue,
  normalizeBugStatusForIssue,
  resolveIssueProjectId,
  resolveIssueTeamId,
} from "@/lib/issues";
import {
  getProjectTeams,
  resolveProjectId,
  resolveTeamId,
  resolveUserId,
  sortByName,
} from "@/lib/project-teams";
import { ROLE_TESTER } from "@/lib/roles";
import { cn, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const BUG_REPORT_BUCKETS = {
  open: [ISSUE_STATUS.NEW, ISSUE_STATUS.OPEN, ISSUE_STATUS.TODO],
  inProgress: [
    ISSUE_STATUS.ASSIGNED,
    ISSUE_STATUS.IN_PROGRESS,
    ISSUE_STATUS.BLOCKED,
    ISSUE_STATUS.FIXED,
    ISSUE_STATUS.QA,
    ISSUE_STATUS.REVIEW,
  ],
  closed: [ISSUE_STATUS.CLOSED, ISSUE_STATUS.DONE],
  reopened: [ISSUE_STATUS.REOPEN],
  rejected: [ISSUE_STATUS.REJECTED],
  deferred: [ISSUE_STATUS.DEFERRED],
  verified: [ISSUE_STATUS.FIXED, ISSUE_STATUS.QA, ISSUE_STATUS.REVIEW],
};

const METRIC_CARDS = [
  {
    key: "totalBugs",
    label: "Total Bugs",
    icon: Bug,
    tone: "blue",
  },
  {
    key: "openBugs",
    label: "Open Bugs",
    icon: Clock3,
    tone: "amber",
  },
  {
    key: "inProgressBugs",
    label: "In Progress Bugs",
    icon: GitPullRequestArrow,
    tone: "violet",
  },
  {
    key: "closedBugs",
    label: "Closed Bugs",
    icon: CheckCircle2,
    tone: "emerald",
  },
  {
    key: "reopenedBugs",
    label: "Reopened Bugs",
    icon: AlertCircle,
    tone: "rose",
  },
  {
    key: "rejectedBugs",
    label: "Rejected Bugs",
    icon: Ban,
    tone: "slate",
  },
  {
    key: "deferredBugs",
    label: "Deferred Bugs",
    icon: Clock3,
    tone: "cyan",
  },
  {
    key: "totalTesters",
    label: "Total Testers",
    icon: Users2,
    tone: "blue",
  },
  {
    key: "activeTesters",
    label: "Active Testers",
    icon: Users2,
    tone: "emerald",
  },
  {
    key: "bugsReportedToday",
    label: "Bugs Reported Today",
    icon: Bug,
    tone: "amber",
  },
  {
    key: "bugsClosedThisWeek",
    label: "Bugs Closed This Week",
    icon: ShieldCheck,
    tone: "violet",
  },
];

const toneClasses = {
  blue: "text-blue-600 bg-blue-50 border-blue-100",
  amber: "text-amber-600 bg-amber-50 border-amber-100",
  violet: "text-violet-600 bg-violet-50 border-violet-100",
  emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
  rose: "text-rose-600 bg-rose-50 border-rose-100",
  slate: "text-slate-600 bg-slate-100 border-slate-200",
  cyan: "text-cyan-600 bg-cyan-50 border-cyan-100",
};

const FilterField = ({ label, children }) => (
  <label className="space-y-2">
    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
      {label}
    </span>
    {children}
  </label>
);

const MetricCard = ({ icon: Icon, label, tone, value }) => (
  <Card className="overflow-hidden border-white/70 bg-white/88 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.32)] backdrop-blur-xl">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("rounded-2xl border p-3 shadow-sm", toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-600">{label}</p>
    </CardContent>
  </Card>
);

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
};

const formatAverageClosureTime = (durations = []) => {
  if (!durations.length) {
    return "--";
  }

  const averageMs = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  const averageDays = averageMs / DAY_IN_MS;

  if (averageDays >= 1) {
    return `${averageDays.toFixed(1)}d`;
  }

  const averageHours = averageMs / (60 * 60 * 1000);
  return `${Math.max(averageHours, 0.1).toFixed(1)}h`;
};

const getBugStatus = (issue) => normalizeBugStatusForIssue(issue);
const getReporterId = (issue) => resolveUserId(issue?.reporter);

const isTesterAssignedToProject = ({ project, teamFilter, testerId }) => {
  const projectTeams = getProjectTeams(project).filter((team) =>
    teamFilter === "all" ? true : resolveTeamId(team) === teamFilter
  );

  return projectTeams.some((team) =>
    (team.members || []).some((member) => resolveUserId(member) === testerId)
  );
};

const BugReportsDialog = ({
  issues = [],
  open,
  onOpenChange,
  projects = [],
  teams = [],
  workspaceScope,
}) => {
  const [filters, setFilters] = useState({
    projectId: "all",
    teamId: "all",
    testerId: "all",
    dateFrom: "",
    dateTo: "",
  });

  const {
    data: workspaceUsers = [],
    isLoading: isUsersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ["workspace-users", "bug-reports", workspaceScope],
    queryFn: () => fetchWorkspaceUsers(workspaceScope),
    enabled: open && Boolean(workspaceScope),
  });

  const testerUsers = useMemo(
    () =>
      sortByName(
        workspaceUsers.filter(
          (workspaceUser) => String(workspaceUser?.role || "").trim() === ROLE_TESTER
        )
      ),
    [workspaceUsers]
  );

  const bugIssues = useMemo(() => issues.filter((issue) => isBugIssue(issue)), [issues]);

  const filteredBugs = useMemo(() => {
    const dateFromValue = filters.dateFrom ? startOfDay(filters.dateFrom) : null;
    const dateToValue = filters.dateTo ? endOfDay(filters.dateTo) : null;

    return bugIssues.filter((issue) => {
      const createdAt = issue?.createdAt ? new Date(issue.createdAt).getTime() : 0;

      if (
        filters.projectId !== "all" &&
        resolveIssueProjectId(issue) !== String(filters.projectId)
      ) {
        return false;
      }

      if (
        filters.teamId !== "all" &&
        resolveIssueTeamId(issue) !== String(filters.teamId)
      ) {
        return false;
      }

      if (
        filters.testerId !== "all" &&
        getReporterId(issue) !== String(filters.testerId)
      ) {
        return false;
      }

      if (dateFromValue && createdAt < dateFromValue) {
        return false;
      }

      if (dateToValue && createdAt > dateToValue) {
        return false;
      }

      return true;
    });
  }, [bugIssues, filters]);

  const testerPerformance = useMemo(() => {
    const projectPool = projects.filter((project) => {
      if (
        filters.projectId !== "all" &&
        resolveProjectId(project) !== String(filters.projectId)
      ) {
        return false;
      }

      if (filters.teamId === "all") {
        return true;
      }

      return getProjectTeams(project).some(
        (team) => resolveTeamId(team) === String(filters.teamId)
      );
    });

    const relevantTesters = testerUsers.filter((testerUser) =>
      filters.testerId === "all"
        ? true
        : resolveUserId(testerUser) === String(filters.testerId)
    );

    return relevantTesters
      .map((testerUser) => {
        const testerId = resolveUserId(testerUser);
        const assignedProjects = projectPool.filter((project) =>
          isTesterAssignedToProject({
            project,
            teamFilter: String(filters.teamId),
            testerId,
          })
        );
        const reportedBugs = filteredBugs.filter(
          (issue) => getReporterId(issue) === testerId
        );
        const statusCounts = reportedBugs.reduce(
          (accumulator, issue) => {
            const status = getBugStatus(issue);

            if (BUG_REPORT_BUCKETS.verified.includes(status)) {
              accumulator.verified += 1;
            }

            if (BUG_REPORT_BUCKETS.closed.includes(status)) {
              accumulator.closed += 1;
            }

            if (BUG_REPORT_BUCKETS.reopened.includes(status)) {
              accumulator.reopened += 1;
            }

            if (
              !BUG_REPORT_BUCKETS.closed.includes(status) &&
              !BUG_REPORT_BUCKETS.rejected.includes(status) &&
              !BUG_REPORT_BUCKETS.deferred.includes(status)
            ) {
              accumulator.pending += 1;
            }

            return accumulator;
          },
          {
            verified: 0,
            closed: 0,
            reopened: 0,
            pending: 0,
          }
        );
        const closureDurations = reportedBugs
          .filter((issue) => BUG_REPORT_BUCKETS.closed.includes(getBugStatus(issue)))
          .map((issue) => {
            const createdAt = issue?.createdAt ? new Date(issue.createdAt).getTime() : 0;
            const closedAt = issue?.updatedAt ? new Date(issue.updatedAt).getTime() : 0;
            return createdAt && closedAt && closedAt >= createdAt ? closedAt - createdAt : 0;
          })
          .filter(Boolean);

        return {
          assignedProjectCount: assignedProjects.length,
          assignedProjectNames: assignedProjects.map((project) => project.name),
          averageClosureTime: formatAverageClosureTime(closureDurations),
          bugsClosed: statusCounts.closed,
          bugsReopened: statusCounts.reopened,
          bugsReported: reportedBugs.length,
          bugsVerified: statusCounts.verified,
          id: testerId,
          isActive:
            assignedProjects.length > 0 ||
            reportedBugs.length > 0 ||
            statusCounts.pending > 0,
          name: testerUser?.name || testerUser?.email || "Tester",
          pendingBugs: statusCounts.pending,
        };
      })
      .sort(
        (left, right) =>
          right.bugsReported - left.bugsReported ||
          right.pendingBugs - left.pendingBugs ||
          left.name.localeCompare(right.name)
      );
  }, [filteredBugs, filters.projectId, filters.teamId, filters.testerId, projects, testerUsers]);

  const summaryMetrics = useMemo(() => {
    const currentDayStart = startOfDay(Date.now());
    const weekStart = Date.now() - 7 * DAY_IN_MS;
    const counts = {
      activeTesters: testerPerformance.filter((row) => row.isActive).length,
      bugsClosedThisWeek: filteredBugs.filter((issue) => {
        const updatedAt = issue?.updatedAt ? new Date(issue.updatedAt).getTime() : 0;
        return BUG_REPORT_BUCKETS.closed.includes(getBugStatus(issue)) && updatedAt >= weekStart;
      }).length,
      bugsReportedToday: filteredBugs.filter((issue) => {
        const createdAt = issue?.createdAt ? new Date(issue.createdAt).getTime() : 0;
        return createdAt >= currentDayStart;
      }).length,
      closedBugs: 0,
      deferredBugs: 0,
      inProgressBugs: 0,
      openBugs: 0,
      rejectedBugs: 0,
      reopenedBugs: 0,
      totalBugs: filteredBugs.length,
      totalTesters: testerPerformance.length,
    };

    filteredBugs.forEach((issue) => {
      const status = getBugStatus(issue);

      if (BUG_REPORT_BUCKETS.open.includes(status)) {
        counts.openBugs += 1;
      }

      if (BUG_REPORT_BUCKETS.inProgress.includes(status)) {
        counts.inProgressBugs += 1;
      }

      if (BUG_REPORT_BUCKETS.closed.includes(status)) {
        counts.closedBugs += 1;
      }

      if (BUG_REPORT_BUCKETS.reopened.includes(status)) {
        counts.reopenedBugs += 1;
      }

      if (BUG_REPORT_BUCKETS.rejected.includes(status)) {
        counts.rejectedBugs += 1;
      }

      if (BUG_REPORT_BUCKETS.deferred.includes(status)) {
        counts.deferredBugs += 1;
      }
    });

    return counts;
  }, [filteredBugs, testerPerformance]);

  const projectOptions = useMemo(() => sortByName(projects), [projects]);
  const teamOptions = useMemo(() => sortByName(teams), [teams]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)] max-h-[90vh] w-[calc(100%-1rem)] max-w-[1380px] gap-0 overflow-hidden rounded-[28px] border-white/70 bg-white/94 p-0 shadow-[0_34px_90px_-52px_rgba(15,23,42,0.38)] backdrop-blur-2xl sm:w-[calc(100%-2rem)]">
        <DialogHeader className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] px-5 py-4 sm:px-6">
          <DialogTitle className="pr-10 text-xl tracking-tight text-slate-950">
            Bug Reports
          </DialogTitle>
          <DialogDescription className="max-w-3xl pr-10 text-sm leading-6 text-slate-600">
            Review bug lifecycle health, tester activity, and QA throughput across the
            workspace with live project, team, tester, and date filters.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-5">
            {usersError ? (
              <div className="rounded-[20px] border border-rose-200 bg-rose-50/85 px-4 py-3 text-sm text-rose-700">
                {usersError.response?.data?.message ||
                  "Unable to load workspace testers right now."}
              </div>
            ) : null}

            <Card className="overflow-hidden border-white/70 bg-white/86 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-5">
                <FilterField label="Project">
                  <select
                    className="h-11 w-full rounded-2xl border border-slate-200/90 bg-white/90 px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/25"
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        projectId: event.target.value,
                      }))
                    }
                    value={filters.projectId}
                  >
                    <option value="all">All projects</option>
                    {projectOptions.map((project) => (
                      <option key={project._id} value={String(project._id)}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </FilterField>

                <FilterField label="Team">
                  <select
                    className="h-11 w-full rounded-2xl border border-slate-200/90 bg-white/90 px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/25"
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        teamId: event.target.value,
                      }))
                    }
                    value={filters.teamId}
                  >
                    <option value="all">All teams</option>
                    {teamOptions.map((team) => (
                      <option key={team._id} value={String(team._id)}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </FilterField>

                <FilterField label="Tester">
                  <select
                    className="h-11 w-full rounded-2xl border border-slate-200/90 bg-white/90 px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/25"
                    disabled={isUsersLoading}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        testerId: event.target.value,
                      }))
                    }
                    value={filters.testerId}
                  >
                    <option value="all">All testers</option>
                    {testerUsers.map((tester) => (
                      <option key={resolveUserId(tester)} value={resolveUserId(tester)}>
                        {tester.name || tester.email}
                      </option>
                    ))}
                  </select>
                </FilterField>

                <FilterField label="Date From">
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        dateFrom: event.target.value,
                      }))
                    }
                  />
                </FilterField>

                <FilterField label="Date To">
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        dateTo: event.target.value,
                      }))
                    }
                  />
                </FilterField>
              </CardContent>
            </Card>

            {isUsersLoading ? (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton
                    key={`bug-report-metric-${index}`}
                    className="h-[132px] w-full rounded-[24px]"
                  />
                ))}
              </section>
            ) : (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {METRIC_CARDS.map((metric) => (
                  <MetricCard
                    key={metric.key}
                    icon={metric.icon}
                    label={metric.label}
                    tone={metric.tone}
                    value={summaryMetrics[metric.key]}
                  />
                ))}
              </section>
            )}

            <Card className="overflow-hidden border-white/70 bg-white/88 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <CardContent className="p-0">
                <div className="border-b border-slate-200/80 px-5 py-4">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                    Tester Performance
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Bugs are grouped by reporter. Verified counts reflect bugs that are
                    in fixed, review, or QA-ready states.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="bg-slate-50/90 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Tester</th>
                        <th className="px-4 py-3">Assigned Projects</th>
                        <th className="px-4 py-3">Bugs Reported</th>
                        <th className="px-4 py-3">Bugs Verified</th>
                        <th className="px-4 py-3">Bugs Closed</th>
                        <th className="px-4 py-3">Bugs Reopened</th>
                        <th className="px-4 py-3">Pending Bugs</th>
                        <th className="px-4 py-3">Average Closure Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80">
                      {testerPerformance.length ? (
                        testerPerformance.map((row) => (
                          <tr className="bg-white/62" key={row.id}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 rounded-2xl">
                                  <AvatarFallback>{getInitials(row.name)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-slate-950">
                                    {row.name}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {row.isActive ? "Active tester" : "No current activity"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="max-w-[280px] px-4 py-4">
                              <p className="font-semibold text-slate-900">
                                {row.assignedProjectCount}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {row.assignedProjectNames.length
                                  ? row.assignedProjectNames.join(", ")
                                  : "No assigned projects"}
                              </p>
                            </td>
                            <td className="px-4 py-4 font-semibold text-slate-900">
                              {row.bugsReported}
                            </td>
                            <td className="px-4 py-4 font-semibold text-slate-900">
                              {row.bugsVerified}
                            </td>
                            <td className="px-4 py-4 font-semibold text-slate-900">
                              {row.bugsClosed}
                            </td>
                            <td className="px-4 py-4 font-semibold text-slate-900">
                              {row.bugsReopened}
                            </td>
                            <td className="px-4 py-4 font-semibold text-slate-900">
                              {row.pendingBugs}
                            </td>
                            <td className="px-4 py-4 font-semibold text-slate-900">
                              {row.averageClosureTime}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            className="px-5 py-12 text-center text-sm text-slate-500"
                            colSpan={8}
                          >
                            No tester bug activity matches the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BugReportsDialog;
