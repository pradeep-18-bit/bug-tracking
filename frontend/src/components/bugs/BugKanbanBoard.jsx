import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { FolderKanban } from "lucide-react";
import {
  getBugColumnKey,
  getBugStatusForColumn,
  sortBugsForBoard,
} from "@/components/bugs/bugBoardConfig";
import BugCard from "@/components/bugs/BugCard";
import BugKanbanColumn from "@/components/bugs/BugKanbanColumn";
import EmptyState from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";

const BugKanbanBoard = ({
  actionMode = "tester",
  columns = [],
  currentUserId = "",
  issues = [],
  onAction,
  canDeleteIssue,
  canEditIssue,
  onOpen,
  onStatusChange,
  updatingId = "",
}) => {
  const [activeIssueId, setActiveIssueId] = useState("");
  const [pendingColumns, setPendingColumns] = useState({});
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeIssue = useMemo(
    () => issues.find((issue) => issue._id === activeIssueId) || null,
    [activeIssueId, issues]
  );
  const activeColumnKey = activeIssue ? getBugColumnKey(activeIssue, columns) : "";

  const columnModels = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        items: sortBugsForBoard(
          issues.filter(
            (issue) => (pendingColumns[issue._id] || getBugColumnKey(issue, columns)) === column.key
          )
        ),
      })),
    [columns, issues, pendingColumns]
  );
  const boardGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(260px, 1fr))`,
      minWidth: `${Math.max(columns.length, 1) * 292}px`,
    }),
    [columns.length]
  );

  const handleDragStart = (event) => {
    setActiveIssueId(String(event.active.id || ""));
  };

  const handleDragEnd = (event) => {
    const issueId = String(event.active?.id || "");
    const nextColumnKey = String(event.over?.id || "");
    const currentIssue = issues.find((issue) => issue._id === issueId);

    setActiveIssueId("");

    if (!currentIssue || !nextColumnKey || typeof onStatusChange !== "function") {
      return;
    }

    const currentColumnKey = getBugColumnKey(currentIssue, columns);

    if (currentColumnKey === nextColumnKey) {
      return;
    }

    const nextStatus = getBugStatusForColumn(nextColumnKey, actionMode);

    if (!nextStatus) {
      return;
    }

    setPendingColumns((current) => ({
      ...current,
      [issueId]: nextColumnKey,
    }));

    Promise.resolve(onStatusChange(currentIssue, nextStatus, nextColumnKey))
      .catch(() => {})
      .finally(() => {
        setPendingColumns((current) => {
          const next = { ...current };
          delete next[issueId];
          return next;
        });
      });
  };

  if (!issues.length) {
    return (
      <Card className="overflow-hidden border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
        <CardContent className="p-8">
          <EmptyState
            title="No bugs match this board"
            description="Adjust search or filters to review another set of bugs."
            icon={<FolderKanban className="h-5 w-5" />}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveIssueId("")}
    >
      <div className="-mx-1 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-gutter:stable]">
        <div
          className="grid gap-3 px-1"
          style={boardGridStyle}
        >
          {columnModels.map((column) => (
            <BugKanbanColumn
              key={column.key}
              actionMode={actionMode}
              activeIssueId={activeIssueId}
              column={column}
              currentUserId={currentUserId}
              issues={column.items}
              onAction={onAction}
              canDeleteIssue={canDeleteIssue}
              canEditIssue={canEditIssue}
              onOpen={onOpen}
              updatingId={updatingId}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
        {activeIssue ? (
          <BugCard
            actionMode={actionMode}
            columnKey={activeColumnKey}
            currentUserId={currentUserId}
            issue={activeIssue}
            isOverlay
            onAction={onAction}
            canDeleteIssue={canDeleteIssue}
            canEditIssue={canEditIssue}
            onOpen={onOpen}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default BugKanbanBoard;
