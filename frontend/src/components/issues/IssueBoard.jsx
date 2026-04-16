import { useMemo, useState } from "react";
import { FolderKanban } from "lucide-react";
import { ISSUE_STATUS, normalizeIssueStatus } from "@/lib/issues";
import EmptyState from "@/components/shared/EmptyState";
import IssueColumn from "@/components/issues/IssueColumn";
import { Card, CardContent } from "@/components/ui/card";

const BOARD_COLUMNS = [
  {
    key: ISSUE_STATUS.TODO,
    label: "To Do",
    helper: "Planned work that is ready to be picked up.",
    accentClassName: "bg-slate-400",
  },
  {
    key: ISSUE_STATUS.IN_PROGRESS,
    label: "In Progress",
    helper: "Work that is actively moving through delivery.",
    accentClassName: "bg-amber-500",
  },
  {
    key: ISSUE_STATUS.DONE,
    label: "Done",
    helper: "Completed issues that are already wrapped up.",
    accentClassName: "bg-emerald-500",
  },
];

const IssueBoard = ({
  issues = [],
  updatingId = "",
  canEditIssue = false,
  canChangeStatus = false,
  onSelectIssue,
  onStatusChange,
  emptyStateTitle = "No issues found",
  emptyStateDescription = "Adjust the filters or create a new issue to populate the board.",
}) => {
  const [draggedIssueId, setDraggedIssueId] = useState("");
  const [activeColumnKey, setActiveColumnKey] = useState("");

  const columns = useMemo(
    () =>
      BOARD_COLUMNS.map((column) => ({
        ...column,
        items: issues.filter(
          (issue) => normalizeIssueStatus(issue.status) === column.key
        ),
      })),
    [issues]
  );

  const handleStatusChange = async (issueId, nextStatus) => {
    if (!issueId || !nextStatus || typeof onStatusChange !== "function") {
      return;
    }

    const currentIssue = issues.find((issue) => issue._id === issueId);

    if (!currentIssue || normalizeIssueStatus(currentIssue.status) === nextStatus) {
      return;
    }

    try {
      await onStatusChange(issueId, nextStatus);
    } catch (error) {
      // The query refetch keeps the board state authoritative after failed updates.
    } finally {
      setDraggedIssueId("");
      setActiveColumnKey("");
    }
  };

  if (!issues.length) {
    return (
      <Card className="overflow-hidden border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
        <CardContent className="p-8">
          <EmptyState
            title={emptyStateTitle}
            description={emptyStateDescription}
            icon={<FolderKanban className="h-5 w-5" />}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
      <CardContent className="p-4">
        <div className="grid gap-4 xl:grid-cols-3">
          {columns.map((column) => (
            <IssueColumn
              key={column.key}
              column={column}
              issues={column.items}
              updatingId={updatingId}
              canEditIssue={canEditIssue}
              canChangeStatus={canChangeStatus}
              isDropTarget={activeColumnKey === column.key}
              onSelectIssue={onSelectIssue}
              onStatusChange={handleStatusChange}
              onDragStartIssue={setDraggedIssueId}
              onDragEndIssue={() => {
                setDraggedIssueId("");
                setActiveColumnKey("");
              }}
              onDragOverColumn={() => {
                if (!canChangeStatus || !draggedIssueId) {
                  return;
                }

                setActiveColumnKey(column.key);
              }}
              onDropColumn={() => handleStatusChange(draggedIssueId, column.key)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default IssueBoard;
