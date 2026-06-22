import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw, Users2 } from "lucide-react";
import { fetchTeamActivity } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const statusMeta = {
  active: {
    label: "Active",
    variant: "success",
    dotClassName: "bg-emerald-500",
  },
  idle: {
    label: "Idle",
    variant: "warning",
    dotClassName: "bg-amber-500",
  },
  offline: {
    label: "Offline",
    variant: "secondary",
    dotClassName: "bg-slate-400",
  },
};

const TeamActivityPage = () => {
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["team-activity", "today"],
    queryFn: () => fetchTeamActivity({ range: "today" }),
    refetchInterval: 60 * 1000,
  });
  const users = useMemo(() => (Array.isArray(data?.users) ? data.users : []), [data]);
  const summary = data?.summary || { active: 0, idle: 0, offline: 0 };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-[420px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="rounded-xl border-white/60 bg-white/45 shadow-sm backdrop-blur-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/60 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-700">
                <Activity className="h-3.5 w-3.5" />
                Team Activity
              </div>
              <h1 className="mt-2 text-xl font-bold text-slate-950">Presence Overview</h1>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {["active", "idle", "offline"].map((status) => {
              const meta = statusMeta[status];

              return (
                <div
                  key={status}
                  className="rounded-lg border border-white/60 bg-white/55 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <span className={cn("h-2.5 w-2.5 rounded-full", meta.dotClassName)} />
                    {meta.label}
                  </div>
                  <p className="mt-1 text-2xl font-bold text-slate-950">
                    {summary[status] || 0}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-white/60 bg-white/45 shadow-sm backdrop-blur-2xl">
        <CardHeader className="flex-row items-center justify-between gap-3 p-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users2 className="h-4 w-4 text-blue-600" />
            Users
          </CardTitle>
          <Badge variant="outline">{users.length} members</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-4 text-sm text-rose-700">
              {error.response?.data?.message || "Unable to load team activity."}
            </div>
          ) : users.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-y border-slate-200/70 bg-slate-50/70 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">User Name</th>
                    <th className="px-4 py-3 font-bold">Role</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Last Active Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((row) => {
                    const user = row.user || {};
                    const status = row.status || "offline";
                    const meta = statusMeta[status] || statusMeta.offline;

                    return (
                      <tr key={user._id} className="bg-white/35">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">
                            {user.name || user.email || "Unknown user"}
                          </div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{user.role || "Member"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={meta.variant} className="gap-2">
                            <span className={cn("h-2 w-2 rounded-full", meta.dotClassName)} />
                            {meta.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.lastSeen ? formatDateTime(row.lastSeen) : "No activity yet"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-500">
              No users found for this workspace.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamActivityPage;
