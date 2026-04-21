import { FolderTree, PencilLine, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const EpicRow = ({ active = false, label, count, color, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex w-full items-center justify-between gap-3 rounded-[16px] border px-3 py-2.5 text-left shadow-sm transition",
      active
        ? "border-blue-200 bg-blue-50/90 text-blue-900 shadow-[0_16px_30px_-24px_rgba(59,130,246,0.32)]"
        : "border-white/70 bg-white/78 text-slate-700 hover:border-blue-100 hover:bg-white"
    )}
  >
    <span className="flex min-w-0 items-center gap-3">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: color || "#CBD5E1",
        }}
      />
      <span className="truncate text-sm font-medium">{label}</span>
    </span>
    <span className="rounded-full bg-slate-900/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-500">
      {count}
    </span>
  </button>
);

const EpicSidebar = ({
  epics = [],
  activeEpicId = "all",
  unassignedCount = 0,
  onSelectEpic,
  canManageEpics = false,
  selectedEpic = null,
  onCreateEpic,
  onEditEpic,
  onDeleteEpic,
}) => (
  <Card className="overflow-hidden border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur xl:h-full">
    <CardContent className="flex h-full min-h-0 flex-col p-0">
      <div className="border-b border-white/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/65 bg-white/68 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm backdrop-blur-xl">
              <FolderTree className="h-3.5 w-3.5" />
              <span>Epics</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-950">Group work by stream</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Keep planning compact while bigger initiatives stay easy to scan.
            </p>
          </div>

          {canManageEpics ? (
            <Button type="button" size="sm" onClick={onCreateEpic}>
              <Plus className="h-3.5 w-3.5" />
              Create Epic
            </Button>
          ) : null}
        </div>

        {selectedEpic && canManageEpics ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onEditEpic}>
              <PencilLine className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onDeleteEpic}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 overflow-y-auto p-3">
        <div className="space-y-2">
          <EpicRow
            active={activeEpicId === "all"}
            label="All epics"
            count={epics.reduce((sum, epic) => sum + Number(epic.issueCount || 0), 0) + unassignedCount}
            color="#CBD5E1"
            onClick={() => onSelectEpic("all")}
          />
          <EpicRow
            active={activeEpicId === "unassigned"}
            label="Unassigned epic"
            count={unassignedCount}
            color="#94A3B8"
            onClick={() => onSelectEpic("unassigned")}
          />

          {epics.length ? (
            epics.map((epic) => (
              <EpicRow
                key={epic._id}
                active={activeEpicId === epic._id}
                label={epic.name}
                count={epic.issueCount || 0}
                color={epic.color}
                onClick={() => onSelectEpic(epic._id)}
              />
            ))
          ) : (
            <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm leading-6 text-slate-500">
              No epics yet. Create one when the planning workspace starts forming larger workstreams.
            </div>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

export default EpicSidebar;
