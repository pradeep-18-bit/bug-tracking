import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarRange,
  Filter,
  Layers3,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const SummaryPill = ({ label, value }) => (
  <div className="rounded-full border border-white/70 bg-white/76 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-xl">
    {label}: {value}
  </div>
);

const buildEpicLabel = (filters, selectedEpic) => {
  if (filters.epicId === "unassigned") {
    return "Unassigned epic";
  }

  if (selectedEpic?.name) {
    return selectedEpic.name;
  }

  return "All epics";
};

const BacklogToolbar = ({
  filters,
  projects = [],
  teams = [],
  members = [],
  summary = null,
  permissions = {},
  selectedEpic = null,
  onChange,
  onResetFilters,
  onCreateSprint,
  onCreateEpic,
}) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedRef = useRef(null);
  const epicLabel = useMemo(
    () => buildEpicLabel(filters, selectedEpic),
    [filters, selectedEpic]
  );
  const hasSecondaryFilters = Boolean(filters.dateFrom || filters.dateTo);
  const advancedFilterCount = [filters.dateFrom, filters.dateTo].filter(Boolean).length;
  const hasActiveFilters =
    filters.teamId !== "all" ||
    filters.assigneeId !== "all" ||
    filters.search.trim() ||
    filters.epicId !== "all" ||
    filters.includeCompletedSprints ||
    hasSecondaryFilters;

  useEffect(() => {
    if (!advancedOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!advancedRef.current?.contains(event.target)) {
        setAdvancedOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setAdvancedOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [advancedOpen]);

  return (
    <Card className="overflow-visible border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/65 bg-white/68 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm backdrop-blur-xl">
              <Filter className="h-3.5 w-3.5" />
              <span>Planning Workspace</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/85 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
              <Layers3 className="h-3.5 w-3.5" />
              <span>{epicLabel}</span>
            </div>
            {hasSecondaryFilters ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/90 px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm">
                <CalendarRange className="h-3.5 w-3.5" />
                <span>Date filtered</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SummaryPill label="Issues in View" value={summary?.totalVisibleIssues || 0} />
            <SummaryPill label="Backlog" value={summary?.backlogIssueCount || 0} />
            <SummaryPill label="Active" value={summary?.activeSprintCount || 0} />
            <SummaryPill label="Planned" value={summary?.plannedSprintCount || 0} />
            {permissions.canManageEpics ? (
              <Button type="button" variant="outline" size="sm" onClick={onCreateEpic}>
                <Plus className="h-4 w-4" />
                Create Epic
              </Button>
            ) : null}
            {permissions.canManageSprints ? (
              <Button type="button" size="sm" onClick={onCreateSprint}>
                <Plus className="h-4 w-4" />
                Create Sprint
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 xl:grid-cols-[minmax(180px,0.95fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(260px,1.25fr)_auto_auto]">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Project
            </span>
            <select
              className="field-select h-10 rounded-[18px] px-3.5 py-2"
              value={filters.projectId}
              onChange={(event) => onChange("projectId", event.target.value)}
            >
              <option value="">Choose project</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Team
            </span>
            <select
              className="field-select h-10 rounded-[18px] px-3.5 py-2"
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

          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Assignee
            </span>
            <select
              className="field-select h-10 rounded-[18px] px-3.5 py-2"
              value={filters.assigneeId}
              onChange={(event) => onChange("assigneeId", event.target.value)}
            >
              <option value="all">All members</option>
              {members.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Sprint Scope
            </span>
            <select
              className="field-select h-10 rounded-[18px] px-3.5 py-2"
              value={filters.includeCompletedSprints ? "all" : "active"}
              onChange={(event) =>
                onChange("includeCompletedSprints", event.target.value === "all")
              }
            >
              <option value="active">Planned + active</option>
              <option value="all">Include completed</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Search
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-10 rounded-[18px] border-slate-200 pl-10 shadow-sm"
                placeholder="Search backlog items"
                value={filters.search}
                onChange={(event) => onChange("search", event.target.value)}
              />
            </div>
          </label>

          <div className="relative" ref={advancedRef}>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Advanced
            </span>
            <Button
              type="button"
              variant="outline"
              className="mt-1 h-10 w-full rounded-[18px] px-3.5 xl:w-auto"
              onClick={() => setAdvancedOpen((current) => !current)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {advancedFilterCount ? (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                  {advancedFilterCount}
                </span>
              ) : null}
            </Button>

            {advancedOpen ? (
              <div className="absolute right-0 top-full z-30 mt-2 w-full min-w-[280px] rounded-[22px] border border-white/75 bg-white/96 p-4 shadow-[0_26px_52px_-28px_rgba(15,23,42,0.34)] backdrop-blur-xl xl:w-[320px]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Advanced Filters</p>
                    <p className="text-xs text-slate-500">
                      Keep the main toolbar lean and pull in date filters only when needed.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl"
                    onClick={() => setAdvancedOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Created From
                    </span>
                    <Input
                      type="date"
                      className="h-10 rounded-[18px] border-slate-200"
                      value={filters.dateFrom}
                      onChange={(event) => onChange("dateFrom", event.target.value)}
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Created To
                    </span>
                    <Input
                      type="date"
                      className="h-10 rounded-[18px] border-slate-200"
                      value={filters.dateTo}
                      onChange={(event) => onChange("dateTo", event.target.value)}
                    />
                  </label>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onChange("dateFrom", "");
                      onChange("dateTo", "");
                    }}
                  >
                    Clear Dates
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full rounded-[18px] border border-transparent px-3.5 text-slate-600 hover:border-slate-200 hover:bg-white xl:w-auto"
              disabled={!hasActiveFilters}
              onClick={onResetFilters}
            >
              Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BacklogToolbar;
