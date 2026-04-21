import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const toInputDate = (value) => {
  if (!value) {
    return "";
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return "";
  }

  return parsedValue.toISOString().slice(0, 10);
};

const createDraft = (sprint) => ({
  name: sprint?.name || "",
  goal: sprint?.goal || "",
  teamId: sprint?.teamId?._id || sprint?.teamId || "",
  startDate: toInputDate(sprint?.startDate),
  endDate: toInputDate(sprint?.endDate),
});

const SprintDialog = ({
  open,
  onOpenChange,
  initialSprint = null,
  teams = [],
  isPending = false,
  onSubmit,
}) => {
  const [draft, setDraft] = useState(createDraft(initialSprint));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraft(createDraft(initialSprint));
    setError("");
  }, [initialSprint, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialSprint ? "Edit Sprint" : "Create Sprint"}</DialogTitle>
          <DialogDescription>
            Keep sprint setup lightweight so the team can move from planning into
            execution quickly.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();

            if (!draft.name.trim()) {
              setError("Sprint name is required.");
              return;
            }

            try {
              setError("");
              await onSubmit({
                name: draft.name.trim(),
                goal: draft.goal.trim(),
                teamId: draft.teamId || null,
                startDate: draft.startDate || null,
                endDate: draft.endDate || null,
              });
              onOpenChange(false);
            } catch (submitError) {
              setError(
                submitError.response?.data?.message || "Unable to save this sprint."
              );
            }
          }}
        >
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Sprint Name
            </span>
            <Input
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Goal
            </span>
            <Textarea
              value={draft.goal}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  goal: event.target.value,
                }))
              }
              placeholder="Summarize the sprint focus."
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Team Scope
            </span>
            <select
              className="field-select"
              value={draft.teamId}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  teamId: event.target.value,
                }))
              }
            >
              <option value="">Project-wide sprint</option>
              {teams.map((team) => (
                <option key={team._id} value={team._id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Start Date
              </span>
              <Input
                type="date"
                value={draft.startDate}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                End Date
              </span>
              <Input
                type="date"
                value={draft.endDate}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : initialSprint ? "Save Sprint" : "Create Sprint"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SprintDialog;
