import { ArrowRight, CalendarDays, Users2 } from "lucide-react";
import { Link } from "react-router-dom";
import TeamMemberStack from "@/components/teams/TeamMemberStack";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

const TeamCard = ({ team }) => (
  <Card className="group overflow-hidden border-white/60 bg-white/82 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.32)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_-38px_rgba(15,23,42,0.42)]">
    <CardContent className="relative p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),transparent_52%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),transparent_42%)]" />
      <div className="relative space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
              Workspace Team
            </div>
            <h3 className="mt-3 truncate text-xl font-semibold text-slate-950">
              {team.name}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {team.description || "No description provided for this team yet."}
            </p>
          </div>

          <Badge className="border border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-50">
            {team.memberCount || team.members?.length || 0} members
          </Badge>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Users2 className="h-4 w-4 text-emerald-600" />
              Team roster
            </div>
            <TeamMemberStack members={team.members || []} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            Created {formatDate(team.createdAt)}
          </div>

          <Button asChild variant="outline" size="sm">
            <Link to={`/teams/${team._id}`}>
              Open team
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default TeamCard;
