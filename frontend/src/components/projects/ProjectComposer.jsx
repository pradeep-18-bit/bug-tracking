import { useState } from "react";
import { AlertTriangle, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const ProjectComposer = ({ onSubmit, isPending }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [error, setError] = useState("");

  const inputClassName =
    "h-10 rounded-lg border-slate-200 bg-white shadow-none focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500/30";
  const textAreaClassName =
    "min-h-[108px] rounded-lg border-slate-200 bg-white shadow-none focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500/30";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
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
      });
      setFormData({
        name: "",
        description: "",
      });
    } catch (submitError) {
      setError(
        submitError.response?.data?.message || "Unable to create the project."
      );
    }
  };

  return (
    <section className="flex h-full flex-col bg-white px-4 py-4">
      <header className="rounded-t-2xl border border-slate-200/80 bg-[linear-gradient(135deg,#6366F1_0%,#EC4899_100%)] px-4 py-4 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/35 bg-white/20">
            <FolderPlus className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[1.05rem] font-semibold leading-6">Create Project</h2>
            <p className="mt-0.5 text-xs text-white/85">Set up a new workspace</p>
          </div>
        </div>
      </header>

      <div className="border-x border-slate-200/80 bg-white px-4 py-3">
        <div className="h-px bg-slate-200/90" />
      </div>

      <div className="flex min-h-0 flex-1 items-center border-x border-b border-slate-200/80 bg-white px-4 pb-4 pt-3 rounded-b-2xl">
        <form
          className="w-full space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="name">
              Project Name
            </label>
            <Input
              id="name"
              name="name"
              className={inputClassName}
              placeholder="Customer Platform"
              value={formData.name}
              onChange={handleChange}
            />
            <p className="text-xs text-slate-400">Choose a concise, recognizable name.</p>
          </div>

          <div className="space-y-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
              htmlFor="description"
            >
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              className={textAreaClassName}
              placeholder="Short product scope or delivery note."
              value={formData.description}
              onChange={handleChange}
            />
            <p className="text-xs text-slate-400">Add goals, scope, or key delivery notes.</p>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <Button
            className="interactive-button h-10 w-full rounded-xl border border-indigo-300/30 bg-[linear-gradient(90deg,#2563EB_0%,#6366F1_55%,#8B5CF6_100%)] text-white shadow-[0_14px_28px_-18px_rgba(99,102,241,0.82)] hover:brightness-105"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Creating project..." : "Create Project"}
          </Button>
        </form>
      </div>
    </section>
  );
};

export default ProjectComposer;
