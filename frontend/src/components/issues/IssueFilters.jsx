import { ArrowUpDown, RotateCcw, Search } from "lucide-react";
import { ISSUE_SORT_OPTIONS, ISSUE_STATUS_OPTIONS } from "@/lib/issues";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const ViewToggle = ({ viewMode, onChange }) => (
  <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
    {[
      { value: "list", label: "List" },
      { value: "board", label: "Board" },
    ].map((option) => (
      <button
        key={option.value}
        type="button"
        className={cn(
          "rounded-xl px-3 py-2 text-sm font-medium transition",
          viewMode === option.value
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        )}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const IssueFilters = ({
  title = "Issue tracker",
  description = "Search the tracker and narrow work by project, team, priority, or assignee.",
  filters,
  projects = [],
  teams = [],
  assignees = [],
  isAssigneesLoading = false,
  onChange,
  onReset,
  total,
  statusCounts,
  showAssigneeFilter = true,
  showTeamFilter = false,
  showPriorityFilter = true,
  showSortFilter = true,
  showSearchFilter = true,
  showHeading = true,
  showViewToggle = false,
  viewMode = "list",
  onViewModeChange,
  actions = null,
}) => (
  <Card className="overflow-hidden border-white/70 bg-white/90 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
    <CardContent className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          {showHeading ? (
            <>
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <p className="text-sm leading-6 text-slate-600">{description}</p>
            </>
          ) : (
            <p className="text-sm font-medium text-slate-600">
              <span className="font-semibold text-slate-900">{total}</span> issues in
              view
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showViewToggle && typeof onViewModeChange === "function" ? (
            <ViewToggle viewMode={viewMode} onChange={onViewModeChange} />
          ) : null}
          {actions}
          <Button variant="outline" size="sm" type="button" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-3",
          showAssigneeFilter
            ? "xl:grid-cols-[220px_220px_minmax(0,1fr)_180px_180px_220px]"
            : showPriorityFilter && showSortFilter
              ? "xl:grid-cols-[220px_220px_minmax(0,1fr)_180px_180px]"
              : showTeamFilter
                ? "xl:grid-cols-[220px_220px_minmax(0,1fr)]"
                : "xl:grid-cols-[220px_minmax(0,1fr)]"
        )}
      >
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
            Project
          </span>
          <select
            className="field-select"
            value={filters.projectId}
            onChange={(event) => onChange("projectId", event.target.value)}
          >
            <option value="all">All projects</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        {showTeamFilter ? (
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
              Team
            </span>
            <select
              className="field-select"
              value={filters.teamId}
              onChange={(event) => onChange("teamId", event.target.value)}
            >
              <option value="all">All teams</option>
              {teams.map((team) => (
                <option key={team._id} value={team._id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {showSearchFilter ? (
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
              Search
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-11"
                placeholder="Search by title or description"
                value={filters.search}
                onChange={(event) => onChange("search", event.target.value)}
              />
            </div>
          </label>
        ) : null}

        {showPriorityFilter ? (
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
              Priority
            </span>
            <select
              className="field-select"
              value={filters.priority}
              onChange={(event) => onChange("priority", event.target.value)}
            >
              <option value="all">All priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </label>
        ) : null}

        {showSortFilter ? (
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
              Sort
            </span>
            <div className="relative">
              <ArrowUpDown className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                className="field-select pl-11"
                value={filters.sortBy}
                onChange={(event) => onChange("sortBy", event.target.value)}
              >
                {ISSUE_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </label>
        ) : null}

        {showAssigneeFilter ? (
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
              Assignee
            </span>
            <select
              className="field-select"
              value={filters.assigneeId ?? filters.assignee ?? "all"}
              onChange={(event) => onChange("assigneeId", event.target.value)}
            >
              <option value="all">All assignees</option>
              {assignees.length ? (
                assignees.map((assignee) => (
                  <option key={assignee._id} value={assignee._id}>
                    {assignee.name} ({assignee.role})
                  </option>
                ))
              ) : (
                <option disabled value="__empty">
                  {isAssigneesLoading ? "Loading assignees..." : "No assignees available"}
                </option>
              )}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {ISSUE_STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-medium transition",
              filters.status === option.value
                ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            )}
            type="button"
            onClick={() => onChange("status", option.value)}
          >
            <span>{option.label}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                filters.status === option.value
                  ? "bg-white text-blue-700"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              {statusCounts?.[option.value] ?? 0}
            </span>
          </button>
        ))}
      </div>
    </CardContent>
  </Card>
);

export default IssueFilters;
