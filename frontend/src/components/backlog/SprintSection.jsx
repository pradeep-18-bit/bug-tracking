import { Flag, PencilLine, Play, Trash2 } from "lucide-react";
import IssuePlanningCard from "@/components/backlog/IssuePlanningCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";

const stateMeta = {
  ACTIVE: {
    label: "Active Sprint",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    shellClass:
      "border-emerald-100/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(236,253,245,0.76))]",
  },
  PLANNED: {
    label: "Planned Sprint",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50",
    shellClass:
      "border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(239,246,255,0.76))]",
  },
  COMPLETED: {
    label: "Completed Sprint",
    badgeClass:
      "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100",
    shellClass:
      "border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(241,245,249,0.78))]",
  },
};

const SprintSection = ({
  sprint,
  issues = [],
  availableSprints = [],
  canManageSprints = false,
  canManagePlanning = false,
  canReorderIssues = false,
  planningUpdatingIssueId = "",
  onSelectIssue,
  onDragStartIssue,
  onDragEndIssue,
  onDropIssueBefore,
  onDropToContainer,
  onMoveIssue,
  onEditSprint,
  onDeleteSprint,
  onStartSprint,
  onCompleteSprint,
}) => {
  const meta = stateMeta[sprint.state] || stateMeta.PLANNED;

  return (
    <section
      className={cn(
        "rounded-[24px] border p-3 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.32)] backdrop-blur-xl",
        meta.shellClass
      )}
      onDragOver={(event) => {
        if (!canReorderIssues || sprint.state === "COMPLETED") {
          return;
        }

        event.preventDefault();
      }}
      onDrop={(event) => {
        if (!canReorderIssues || sprint.state === "COMPLETED") {
          return;
        }

        event.preventDefault();
        onDropToContainer?.(sprint._id);
      }}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={meta.badgeClass}>{meta.label}</Badge>
            {sprint.teamId?.name ? (
              <Badge className="border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50">
                {sprint.teamId.name}
              </Badge>
            ) : (
              <Badge className="border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100">
                Project-wide
              </Badge>
            )}
            <span className="rounded-full border border-white/70 bg-white/76 px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
              {issues.length} issues
            </span>
            <span className="rounded-full border border-white/70 bg-white/76 px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
              {sprint.completedCount || 0} done
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <p className="text-base font-semibold text-slate-950">{sprint.name}</p>
            {sprint.goal ? (
              <p className="truncate text-sm text-slate-500">{sprint.goal}</p>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            {sprint.startDate ? <span>Starts {formatDate(sprint.startDate)}</span> : null}
            {sprint.endDate ? <span>Ends {formatDate(sprint.endDate)}</span> : null}
            {!sprint.goal ? <span>Add a sprint goal when scope is clear.</span> : null}
          </div>
        </div>

        {canManageSprints ? (
          <div className="flex flex-wrap gap-2">
            {sprint.state === "PLANNED" ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={onEditSprint}>
                  <PencilLine className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onDeleteSprint}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
                <Button type="button" size="sm" onClick={onStartSprint}>
                  <Play className="h-3.5 w-3.5" />
                  Start
                </Button>
              </>
            ) : null}
            {sprint.state === "ACTIVE" ? (
              <Button type="button" size="sm" onClick={onCompleteSprint}>
                <Flag className="h-3.5 w-3.5" />
                Complete
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {issues.length ? (
          issues.map((issue) => (
            <IssuePlanningCard
              key={issue._id}
              issue={issue}
              canDrag={canReorderIssues && sprint.state !== "COMPLETED"}
              canManagePlanning={canManagePlanning && sprint.state !== "COMPLETED"}
              isUpdating={planningUpdatingIssueId === issue._id}
              availableSprints={availableSprints}
              onDragStart={onDragStartIssue}
              onDragEnd={onDragEndIssue}
              onDropBefore={() => onDropIssueBefore?.(sprint._id, issue._id)}
              onSelectIssue={onSelectIssue}
              onMoveIssue={onMoveIssue}
            />
          ))
        ) : (
          <div className="rounded-[20px] border border-dashed border-slate-200 bg-white/74 px-4 py-6 text-center text-sm text-slate-500">
            {sprint.state === "COMPLETED"
              ? "This completed sprint has no issues in the current planning view."
              : "Drop issues here or move them in with the sprint picker."}
          </div>
        )}
      </div>
    </section>
  );
};

export default SprintSection;
