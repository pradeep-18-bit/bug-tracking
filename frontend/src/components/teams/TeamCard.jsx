import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, LoaderCircle, Trash2, Users2 } from "lucide-react";
import { Link } from "react-router-dom";
import TeamMemberStack from "@/components/teams/TeamMemberStack";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

const TeamCard = ({ canManageTeam = false, isDeleting = false, onDeleteTeam, team }) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    setDeleteError("");
    setIsDeleteDialogOpen(false);
  }, [team?._id]);

  const handleDeleteTeam = async () => {
    try {
      setDeleteError("");
      await onDeleteTeam?.(team._id);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      setDeleteError(
        error.response?.data?.message || "Unable to delete this team right now."
      );
    }
  };

  return (
  <>
  <Card className="team-card group overflow-hidden border-white/70 bg-white/86 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.34)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-emerald-100 hover:shadow-[0_22px_56px_-34px_rgba(15,23,42,0.42)]">
    <CardContent className="relative p-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.13),transparent_50%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),transparent_42%)]" />
      <div className="relative">
        <div className="team-card-header min-w-0 space-y-1.5 border-b border-slate-100/80 px-4 py-3">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              Workspace Team
            </div>
            {canManageTeam ? (
              <Button
                aria-label="Delete Team"
                className="h-7 w-7 shrink-0 rounded-lg border border-rose-100 bg-white p-0 text-rose-500 shadow-sm hover:border-rose-200 hover:bg-rose-50"
                disabled={isDeleting}
                size="icon"
                title="Delete Team"
                type="button"
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                {isDeleting ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            ) : null}
          </div>
          <h3 className="truncate text-lg font-semibold leading-6 text-slate-950">
            {team.name}
          </h3>
          <p className="truncate text-xs font-medium leading-5 text-slate-500">
            {team.description || "No description provided for this team yet."}
          </p>
        </div>

        <div className="team-card-body px-4 py-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Users2 className="h-4 w-4 text-emerald-600" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">Team roster</p>
                <Badge className="mt-0.5 border border-sky-100 bg-sky-50 px-1.5 py-0 text-[10px] leading-4 text-sky-700 hover:bg-sky-50">
                  {team.memberCount || team.members?.length || 0} members
                </Badge>
              </div>
            </div>
            <TeamMemberStack members={team.members || []} max={4} size="sm" />
          </div>
        </div>

        <div className="team-card-footer flex items-center justify-between gap-3 border-t border-slate-100/90 px-4 py-3 text-xs font-medium text-slate-500">
          <div className="flex min-w-0 items-center gap-1.5 truncate">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            Created {formatDate(team.createdAt)}
          </div>

          <Button asChild className="h-8 shrink-0 rounded-lg px-3 text-xs" variant="outline" size="sm">
            <Link to={`/teams/${team._id}`}>
              Open Team
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
  <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => !isDeleting && setIsDeleteDialogOpen(open)}>
    <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-[24px]">
      <DialogHeader>
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <DialogTitle>Delete Team</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete this team? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      {deleteError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {deleteError}
        </div>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>
          Cancel
        </Button>
        <Button type="button" variant="destructive" disabled={isDeleting} onClick={handleDeleteTeam}>
          {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {isDeleting ? "Deleting..." : "Delete Team"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </>
  );
};

export default TeamCard;
