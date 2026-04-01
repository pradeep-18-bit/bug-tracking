import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Users2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createTeam, fetchWorkspaceUsers } from "@/lib/api";
import TeamComposer from "@/components/teams/TeamComposer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { getWorkspaceScope } from "@/lib/workspace";

const TeamCreatePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const workspaceScope = getWorkspaceScope(user);

  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["workspace-users", workspaceScope],
    queryFn: () => fetchWorkspaceUsers(workspaceScope),
  });

  const createTeamMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      navigate("/teams");
    },
  });

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-rose-700">
          {error.response?.data?.message || "Unable to load workspace users."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link to="/teams">
            <ArrowLeft className="h-4 w-4" />
            Back to Teams
          </Link>
        </Button>

        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/80 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-emerald-700">
          <Users2 className="h-3.5 w-3.5" />
          Workspace Teams
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-[760px] w-full rounded-[32px]" />
      ) : (
        <TeamComposer
          users={users}
          workspaceId={workspaceScope}
          isPending={createTeamMutation.isPending}
          onSubmit={(payload) => createTeamMutation.mutateAsync(payload)}
        />
      )}
    </div>
  );
};

export default TeamCreatePage;
