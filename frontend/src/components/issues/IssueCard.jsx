import {
  CalendarDays,
  GripVertical,
  MoreHorizontal,
  PencilLine,
  UserCircle2,
} from "lucide-react";
import {
  getIssuePriorityVariant,
  getIssueDisplayKey,
  getIssueStatusLabel,
  ISSUE_WORKFLOW_STATUS_OPTIONS,
  getIssueStatusVariant,
  getIssueTypeVariant,
  normalizeIssueStatus,
  resolveIssueAssignee,
} from "@/lib/issues";
import { formatDateTime, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const formatDueAt = (value) => (value ? formatDateTime(value) : "No due date");

const IssueCard = ({
  issue,
  isUpdating = false,
  canEditIssue = false,
  canChangeStatus = false,
  onSelectIssue,
  onStatusChange,
  onDragStart,
  onDragEnd,
}) => {
  const assignee = resolveIssueAssignee(issue);
  const issueKey = getIssueDisplayKey(issue);

  return (
    <article
      className="group rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-blue-200 hover:shadow-[0_18px_40px_-30px_rgba(37,99,235,0.3)]"
      role="button"
      tabIndex={0}
      draggable={canChangeStatus && !isUpdating}
      onClick={() => onSelectIssue(issue)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectIssue(issue);
        }
      }}
      onDragStart={(event) => {
        if (!canChangeStatus || isUpdating) {
          return;
        }

        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", issue._id);
        onDragStart(issue._id);
      }}
      onDragEnd={() => onDragEnd()}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900 transition group-hover:text-blue-700">
                {issue.title}
              </p>
            </div>

            {canChangeStatus ? (
              <select
                className="field-select h-8 min-w-[124px] rounded-xl px-2.5 py-1 text-[11px]"
                value={normalizeIssueStatus(issue.status)}
                disabled={isUpdating}
                onChange={async (event) => {
                  event.stopPropagation();

                  try {
                    await onStatusChange(issue._id, event.target.value);
                  } catch (error) {
                    // The query refetch restores the current state when the update fails.
                  }
                }}
                onClick={(event) => event.stopPropagation()}
              >
                {ISSUE_WORKFLOW_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <Badge
                variant={getIssueStatusVariant(issue.status)}
                className="shrink-0 px-2.5 py-1 text-[11px]"
              >
                {getIssueStatusLabel(issue.status)}
              </Badge>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {issue.teamId?.name ? (
              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                {issue.teamId.name}
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
              {issueKey}
            </span>
            <Badge className="px-2.5 py-0.5 text-[11px]" variant={getIssuePriorityVariant(issue.priority)}>
              {issue.priority}
            </Badge>
            {issue.type ? (
              <Badge className="px-2.5 py-0.5 text-[11px]" variant={getIssueTypeVariant(issue.type)}>
                {issue.type}
              </Badge>
            ) : null}
            <Badge className="px-2.5 py-0.5 text-[11px]" variant={getIssueStatusVariant(issue.status)}>
              {getIssueStatusLabel(issue.status)}
            </Badge>
            {issue.epicId?.name ? (
              <span className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700">
                {issue.epicId.name}
              </span>
            ) : null}
            {issue.sprintId?.name ? (
              <span className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-700">
                {issue.sprintId.name}
              </span>
            ) : (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                Backlog
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectIssue(issue);
            }}
            aria-label={canEditIssue ? "Edit issue" : "Open issue"}
          >
            {canEditIssue ? (
              <PencilLine className="h-3.5 w-3.5" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>

          {canChangeStatus ? (
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 p-1.5 text-slate-400 lg:flex">
            <GripVertical className="h-4 w-4" />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        <div className="flex items-center gap-2.5">
          {assignee ? (
            <Avatar className="h-9 w-9 rounded-xl">
              <AvatarFallback>{getInitials(assignee.name)}</AvatarFallback>
            </Avatar>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <UserCircle2 className="h-4 w-4" />
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">
              {assignee?.name || "Unassigned"}
            </p>
            <p className="truncate text-xs text-slate-500">
              {assignee?.role || "No assignee role available"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <span>{formatDueAt(issue.dueAt)}</span>
        </div>

        <p className="truncate text-xs text-slate-500">
          {[issue.projectId?.name || "Unknown project", issue.teamId?.name || "No team context"]
            .filter(Boolean)
            .join(" • ")}
        </p>
      </div>
    </article>
  );
};

export default IssueCard;
