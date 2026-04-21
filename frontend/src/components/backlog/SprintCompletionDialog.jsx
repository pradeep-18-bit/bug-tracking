import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SprintCompletionDialog = ({
  open,
  onOpenChange,
  sprint = null,
  plannedSprints = [],
  isPending = false,
  onSubmit,
}) => {
  const [carryOverMode, setCarryOverMode] = useState("BACKLOG");
  const [targetSprintId, setTargetSprintId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setCarryOverMode("BACKLOG");
    setTargetSprintId("");
    setError("");
  }, [open, sprint]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Sprint</DialogTitle>
          <DialogDescription>
            Decide what should happen to unfinished work before closing this sprint.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();

            if (carryOverMode === "SPRINT" && !targetSprintId) {
              setError("Choose the next planned sprint for carried work.");
              return;
            }

            try {
              setError("");
              await onSubmit({
                carryOverMode,
                targetSprintId: carryOverMode === "SPRINT" ? targetSprintId : undefined,
              });
              onOpenChange(false);
            } catch (submitError) {
              setError(
                submitError.response?.data?.message || "Unable to complete the sprint."
              );
            }
          }}
        >
          <div className="rounded-[22px] border border-white/65 bg-slate-50/85 px-4 py-4">
            <p className="text-sm font-semibold text-slate-950">{sprint?.name}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {sprint?.goal || "No sprint goal was added."}
            </p>
          </div>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Incomplete Work
            </span>
            <select
              className="field-select"
              value={carryOverMode}
              onChange={(event) => setCarryOverMode(event.target.value)}
            >
              <option value="BACKLOG">Move back to backlog</option>
              <option value="SPRINT">Move into another planned sprint</option>
            </select>
          </label>

          {carryOverMode === "SPRINT" ? (
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Target Sprint
              </span>
              <select
                className="field-select"
                value={targetSprintId}
                onChange={(event) => setTargetSprintId(event.target.value)}
              >
                <option value="">Select sprint</option>
                {plannedSprints.map((plannedSprint) => (
                  <option key={plannedSprint._id} value={plannedSprint._id}>
                    {plannedSprint.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

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
              {isPending ? "Completing..." : "Complete Sprint"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SprintCompletionDialog;
