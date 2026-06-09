import { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ChevronDown } from "lucide-react";
import { BUG_BOARD_PAGE_SIZE } from "@/components/bugs/bugBoardConfig";
import BugCard from "@/components/bugs/BugCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BugKanbanColumn = ({
  actionMode,
  activeIssueId = "",
  column,
  issues = [],
  onAction,
  canDeleteIssue,
  canEditIssue,
  onOpen,
  updatingId = "",
}) => {
  const [visibleCount, setVisibleCount] = useState(BUG_BOARD_PAGE_SIZE);
  const { isOver, setNodeRef } = useDroppable({
    id: column.key,
    data: { column },
  });

  const visibleIssues = useMemo(
    () => issues.slice(0, visibleCount),
    [issues, visibleCount]
  );
  const hasMore = visibleCount < issues.length;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-h-[560px] w-full min-w-0 flex-col rounded-lg border p-3 transition duration-200 ease-out",
        column.borderClassName,
        column.surfaceClassName,
        isOver && column.activeClassName
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", column.accentClassName)} />
            <h2 className="truncate text-sm font-semibold text-slate-950">{column.label}</h2>
          </div>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-500">{column.helper}</p>
        </div>
        <Badge className={cn("shrink-0 shadow-sm", column.badgeClassName)}>
          {issues.length}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {visibleIssues.length ? (
          visibleIssues.map((issue) => (
            <BugCard
              key={issue._id}
              actionMode={actionMode}
              columnKey={column.key}
              issue={issue}
              isUpdating={updatingId === issue._id}
              onAction={onAction}
              canDeleteIssue={canDeleteIssue}
              canEditIssue={canEditIssue}
              onOpen={onOpen}
            />
          ))
        ) : (
          <div
            className={cn(
              "flex min-h-[170px] flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/72 px-4 py-8 text-center text-sm font-medium text-slate-500 transition",
              isOver && "border-slate-300 bg-white text-slate-700"
            )}
          >
            {isOver ? `Move bug to ${column.label}` : `No bugs in ${column.label}`}
          </div>
        )}

        {hasMore ? (
          <Button
            className="h-9 rounded-lg"
            type="button"
            variant="outline"
            onClick={() => setVisibleCount((current) => current + BUG_BOARD_PAGE_SIZE)}
          >
            <ChevronDown className="h-4 w-4" />
            Load more
          </Button>
        ) : null}

        {activeIssueId && !visibleIssues.length ? null : (
          <div className={cn("min-h-1 rounded-full transition", isOver && "bg-slate-300/80")} />
        )}
      </div>
    </section>
  );
};

export default BugKanbanColumn;
