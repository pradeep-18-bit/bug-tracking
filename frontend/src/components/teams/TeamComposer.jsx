import { useMemo, useState } from "react";
import Select from "react-select";
import { Layers3, Sparkles, Users2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/utils";
import {
  buildMemberOption,
  formatMemberOptionLabel,
  memberSelectStyles,
} from "@/components/projects/memberSelectTheme";

const TeamComposer = ({ users = [], workspaceId, onSubmit, isPending = false }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    members: [],
  });
  const [error, setError] = useState("");

  const memberOptions = useMemo(
    () =>
      [...users]
        .sort((left, right) => (left.name || "").localeCompare(right.name || ""))
        .map(buildMemberOption),
    [users]
  );

  const selectedMemberOptions = useMemo(
    () => memberOptions.filter((option) => formData.members.includes(option.value)),
    [formData.members, memberOptions]
  );

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleMemberSelectionChange = (selectedOptions) => {
    setFormData((current) => ({
      ...current,
      members: Array.from(
        new Set((selectedOptions || []).map((option) => option.value))
      ),
    }));
  };

  const handleRemoveMember = (userId) => {
    setFormData((current) => ({
      ...current,
      members: current.members.filter((memberId) => memberId !== userId),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      setError("A team name is required.");
      return;
    }

    if (!users.length) {
      setError("No workspace users are available to add to a team yet.");
      return;
    }

    try {
      setError("");
      await onSubmit({
        name: formData.name.trim(),
        description: formData.description.trim(),
        members: formData.members,
        workspaceId,
      });
    } catch (submitError) {
      setError(submitError.response?.data?.message || "Unable to create the team.");
    }
  };

  return (
    <Card className="relative overflow-hidden border-white/60 bg-white/82 shadow-[0_28px_70px_-34px_rgba(15,23,42,0.35)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_48%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_42%)]" />
      <CardHeader className="relative border-b border-white/60 pb-6">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200/80 bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-emerald-700 shadow-sm backdrop-blur-xl">
          <Users2 className="h-3.5 w-3.5" />
          Workspace Teams
        </div>
        <CardTitle className="text-2xl text-slate-950">Create a new team</CardTitle>
        <CardDescription className="max-w-2xl text-slate-600">
          Group workspace users into a shared squad for planning, delivery, and
          ownership. Only users from this workspace can be added.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative pt-6">
        <form className="space-y-5" onSubmit={handleSubmit}>
          {!users.length ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
              No workspace users are available right now. Invite teammates before
              creating a team.
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Team name</span>
              <Input
                id="name"
                name="name"
                placeholder="Platform Squad"
                value={formData.name}
                onChange={handleFieldChange}
              />
            </label>

            <div className="rounded-[24px] border border-sky-100 bg-gradient-to-br from-sky-50 to-cyan-50 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700">
                Workspace users
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{users.length}</p>
              <p className="mt-1 text-sm text-slate-600">
                Available to add to this team
              </p>
            </div>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Description</span>
            <Textarea
              id="description"
              name="description"
              placeholder="Explain what this team owns, how it collaborates, or where it fits in the workspace."
              value={formData.description}
              onChange={handleFieldChange}
            />
          </label>

          <div className="space-y-4 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Members</label>
                <p className="mt-1 text-xs text-slate-500">
                  Search by name, email, or role. Duplicate selections are prevented
                  automatically.
                </p>
              </div>
              <Badge className="border border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                {selectedMemberOptions.length} selected
              </Badge>
            </div>

            <div className="rounded-[24px] border border-slate-900/10 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-900 px-4 py-4 text-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.9)]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-sm font-semibold">
                  <Layers3 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Workspace-only membership</p>
                  <p className="mt-1 text-xs text-white/70">
                    Every selected member will be validated against this workspace
                    before the team is created.
                  </p>
                </div>
                <div className="ml-auto hidden items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/80 sm:inline-flex">
                  <Sparkles className="h-3.5 w-3.5" />
                  Secure scope
                </div>
              </div>
            </div>

            <Select
              isMulti
              isClearable={selectedMemberOptions.length > 0}
              isDisabled={!memberOptions.length || isPending}
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              options={memberOptions}
              value={selectedMemberOptions}
              styles={memberSelectStyles}
              formatOptionLabel={formatMemberOptionLabel}
              onChange={handleMemberSelectionChange}
              placeholder={
                memberOptions.length
                  ? "Select workspace users..."
                  : "No workspace users available right now"
              }
              noOptionsMessage={() =>
                memberOptions.length
                  ? "All workspace users are already selected."
                  : "No workspace users are available."
              }
            />

            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/85 p-3">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                Selected members
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedMemberOptions.length ? (
                  selectedMemberOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleRemoveMember(option.value)}
                      className="group inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-cyan-100 text-[11px] font-semibold text-slate-700">
                        {getInitials(option.label)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {option.label}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {option.email}
                        </span>
                      </span>
                      <span className="rounded-full bg-slate-100 p-1 text-slate-500 transition group-hover:bg-slate-200">
                        <X className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Selected members will appear here as quick-remove chips.
                  </p>
                )}
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <Button className="w-full" disabled={isPending || !users.length} type="submit">
            {isPending ? "Creating team..." : "Create Team"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default TeamComposer;
