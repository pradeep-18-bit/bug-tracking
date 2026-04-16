import { useMemo, useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const MANAGER_ROLES = ["Admin", "Manager"];
const TEAM_LEAD_ROLES = ["Admin", "Manager", "Developer"];

const ProjectComposer = ({
  onSubmit,
  isPending,
  onCancel,
  users = [],
  usersErrorMessage = "",
}) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    epics: [],
    manager: "",
    teamLead: "",
  });
  const [epicInput, setEpicInput] = useState("");
  const [error, setError] = useState("");

  const inputClassName =
    "h-10 rounded-xl border-slate-200 bg-white text-sm shadow-none focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500/20";
  const textAreaClassName =
    "min-h-[88px] rounded-xl border-slate-200 bg-white text-sm shadow-none focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500/20";
  const selectClassName =
    "field-select h-10 rounded-xl border-slate-200 bg-white px-3 text-sm shadow-none focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500/20";
  const labelClassName = "text-sm font-medium text-slate-700";
  const hintClassName = "text-[12px] leading-5 text-slate-500";

  const managerOptions = useMemo(
    () =>
      [...users]
        .filter((user) => MANAGER_ROLES.includes(user.role))
        .sort((left, right) => (left.name || "").localeCompare(right.name || "")),
    [users]
  );

  const teamLeadOptions = useMemo(
    () =>
      [...users]
        .filter((user) => TEAM_LEAD_ROLES.includes(user.role))
        .sort((left, right) => (left.name || "").localeCompare(right.name || "")),
    [users]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const appendEpicsFromInput = () => {
    const nextEpics = epicInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!nextEpics.length) {
      return;
    }

    setFormData((current) => {
      const existingEpics = new Map(
        current.epics.map((epic) => [epic.toLowerCase(), epic])
      );

      nextEpics.forEach((epic) => {
        const dedupeKey = epic.toLowerCase();

        if (!existingEpics.has(dedupeKey)) {
          existingEpics.set(dedupeKey, epic);
        }
      });

      return {
        ...current,
        epics: Array.from(existingEpics.values()),
      };
    });

    setEpicInput("");
  };

  const handleRemoveEpic = (epicToRemove) => {
    setFormData((current) => ({
      ...current,
      epics: current.epics.filter((epic) => epic !== epicToRemove),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      setError("A project name is required.");
      return;
    }

    try {
      setError("");
      await onSubmit({
        name: formData.name.trim(),
        description: formData.description.trim(),
        epics: formData.epics,
        manager: formData.manager || null,
        teamLead: formData.teamLead || null,
      });
      setFormData({
        name: "",
        description: "",
        epics: [],
        manager: "",
        teamLead: "",
      });
      setEpicInput("");
    } catch (submitError) {
      setError(
        submitError.response?.data?.message || "Unable to create the project."
      );
    }
  };

  return (
    <form className="space-y-3.5" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <label className={labelClassName} htmlFor="name">
          Project Name
        </label>
        <Input
          id="name"
          name="name"
          className={inputClassName}
          placeholder="Customer Platform"
          value={formData.name}
          onChange={handleChange}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <label className={labelClassName} htmlFor="description">
            Description
          </label>
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
            Optional
          </span>
        </div>
        <Textarea
          id="description"
          name="description"
          className={textAreaClassName}
          placeholder="Summarize the scope, goals, or context for this project."
          value={formData.description}
          onChange={handleChange}
        />
        <p className={hintClassName}>
          Give the team enough context to understand what this project is for.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelClassName} htmlFor="manager">
            Manager
          </label>
          <select
            id="manager"
            name="manager"
            className={selectClassName}
            value={formData.manager}
            onChange={handleChange}
            disabled={!managerOptions.length}
          >
            <option value="">Unassigned</option>
            {managerOptions.map((user) => (
              <option key={user._id} value={user._id}>
                {user.name} ({user.role})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className={labelClassName} htmlFor="teamLead">
            Team Lead
          </label>
          <select
            id="teamLead"
            name="teamLead"
            className={selectClassName}
            value={formData.teamLead}
            onChange={handleChange}
            disabled={!teamLeadOptions.length}
          >
            <option value="">Unassigned</option>
            {teamLeadOptions.map((user) => (
              <option key={user._id} value={user._id}>
                {user.name} ({user.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-slate-700">
              Epics
            </p>
            <p className={hintClassName}>
              Add one or more workstreams, separated by commas if needed.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
            {formData.epics.length}
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            className={`${inputClassName} flex-1`}
            placeholder="Billing, Onboarding, Reporting"
            value={epicInput}
            onChange={(event) => setEpicInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                appendEpicsFromInput();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl px-4"
            onClick={appendEpicsFromInput}
            disabled={!epicInput.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Epic
          </Button>
        </div>

        <div className="flex min-h-[28px] flex-wrap gap-1.5">
          {formData.epics.length ? (
            formData.epics.map((epic) => (
              <button
                key={epic}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/60"
                onClick={() => handleRemoveEpic(epic)}
              >
                <span>{epic}</span>
                <X className="h-3.5 w-3.5 text-slate-400" />
              </button>
            ))
          ) : (
            <p className={hintClassName}>
              Added epics will appear here as removable chips.
            </p>
          )}
        </div>
      </div>

      {usersErrorMessage ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {usersErrorMessage} You can still create the project without assigning
            a manager or team lead.
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200/80 pt-3 sm:flex-row sm:items-center sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            className="h-10 min-w-[92px] rounded-xl px-4"
          >
            Cancel
          </Button>
        ) : null}
        <Button
          className="h-10 min-w-[132px] rounded-xl border border-blue-500/20 bg-[linear-gradient(90deg,#2563EB_0%,#3B82F6_100%)] px-4 text-white shadow-[0_14px_28px_-20px_rgba(37,99,235,0.72)] hover:brightness-105"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Creating project..." : "Create Project"}
        </Button>
      </div>
    </form>
  );
};

export default ProjectComposer;
