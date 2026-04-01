import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Layers3,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchReports } from "@/lib/api";
import { ISSUE_STATUS } from "@/lib/issues";
import EmptyState from "@/components/shared/EmptyState";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors = ["#3b82f6", "#f59e0b", "#10b981"];
const priorityColors = ["#a5b4fc", "#60a5fa", "#2563eb"];

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-lg">
      <p className="font-semibold text-gray-900">{entry.payload.label || entry.name}</p>
      <p className="mt-1">{entry.value} issues</p>
    </div>
  );
};

const ReportsPage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports"],
    queryFn: fetchReports,
  });

  const issuesByStatus = data?.issuesByStatus || [];
  const issuesByPriority = data?.issuesByPriority || [];
  const issuesPerProject = data?.issuesPerProject || [];

  const summary = useMemo(() => {
    const totalIssues = data?.totalIssues || 0;
    const closedIssues =
      issuesByStatus.find((bucket) => bucket.key === ISSUE_STATUS.DONE)?.count || 0;
    const inProgressIssues =
      issuesByStatus.find((bucket) => bucket.key === ISSUE_STATUS.IN_PROGRESS)?.count || 0;

    return {
      totalIssues,
      openIssues: totalIssues - closedIssues,
      inProgressIssues,
      closedIssues,
    };
  }, [data?.totalIssues, issuesByStatus]);

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-rose-700">
          {error.response?.data?.message || "Unable to load report analytics right now."}
        </CardContent>
      </Card>
    );
  }

  if (!isLoading && !summary.totalIssues) {
    return (
      <EmptyState
        title="No report data yet"
        description="Issue analytics will appear here once work items exist in the workspace."
        icon={<BarChart3 className="h-5 w-5" />}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : (
          <>
            <Card className="stats-tile">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 text-gray-600">
                  <Layers3 className="h-5 w-5 text-blue-600" />
                  <span>Total Issues</span>
                </div>
                <p className="mt-4 text-4xl font-semibold text-gray-900">
                  {summary.totalIssues}
                </p>
              </CardContent>
            </Card>
            <Card className="stats-tile">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 text-gray-600">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span>Open Issues</span>
                </div>
                <p className="mt-4 text-4xl font-semibold text-gray-900">
                  {summary.openIssues}
                </p>
              </CardContent>
            </Card>
            <Card className="stats-tile">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 text-gray-600">
                  <BarChart3 className="h-5 w-5 text-violet-500" />
                  <span>In Progress</span>
                </div>
                <p className="mt-4 text-4xl font-semibold text-gray-900">
                  {summary.inProgressIssues}
                </p>
              </CardContent>
            </Card>
            <Card className="stats-tile">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 text-gray-600">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span>Closed</span>
                </div>
                <p className="mt-4 text-4xl font-semibold text-gray-900">
                  {summary.closedIssues}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Issues by status</CardTitle>
            <CardDescription>
              Distribution of open and completed work across the current report scope.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[360px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={issuesByStatus} barCategoryGap={32}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(219, 234, 254, 0.3)" }} />
                  <Bar dataKey="count" radius={[18, 18, 0, 0]}>
                    {issuesByStatus.map((entry, index) => (
                      <Cell
                        key={entry.key}
                        fill={statusColors[index % statusColors.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issues by priority</CardTitle>
            <CardDescription>
              Priority mix for the same set of issues, visualized as a quick balance check.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[360px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<ChartTooltip />} />
                  <Pie
                    data={issuesByPriority}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={72}
                    outerRadius={112}
                    paddingAngle={4}
                  >
                    {issuesByPriority.map((entry, index) => (
                      <Cell
                        key={entry.key}
                        fill={priorityColors[index % priorityColors.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Issues per project</CardTitle>
          <CardDescription>
            Project-level issue volume so teams can spot concentration and rebalance work.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[380px]">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : issuesPerProject.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={issuesPerProject} layout="vertical" margin={{ left: 28 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  width={132}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(219, 234, 254, 0.3)" }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 18, 18, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-gray-200 bg-gray-50 px-6 text-center text-sm leading-6 text-gray-500">
              No project distribution is available yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
