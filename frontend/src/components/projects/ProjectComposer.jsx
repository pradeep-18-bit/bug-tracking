import { useState } from "react";
import { Layers3, PlusCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const ProjectComposer = ({ onSubmit, isPending }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [error, setError] = useState("");

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
    <Card className="page-shell-enter relative min-w-0 overflow-hidden border-white/60 bg-white/78 shadow-[0_28px_70px_-36px_rgba(15,23,42,0.32)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_48%),radial-gradient(circle_at_top_right,_rgba(236,72,153,0.18),_transparent_44%)]" />
      <CardHeader className="relative space-y-3 border-b border-white/60 pb-5">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-200/70 bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-indigo-700 shadow-sm">
          <PlusCircle className="h-3.5 w-3.5" />
          New Project
        </div>
        <CardTitle className="text-[1.65rem] leading-tight text-slate-950">
          Create a project
        </CardTitle>
        <div className="rounded-[24px] border border-indigo-100/80 bg-[linear-gradient(135deg,rgba(99,102,241,0.08),rgba(236,72,153,0.08))] px-4 py-3 text-sm text-slate-600">
          Members come from attached teams only.
        </div>
      </CardHeader>
      <CardContent className="relative pt-5">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="name">
              Project name
            </label>
            <Input
              id="name"
              name="name"
              placeholder="Customer Platform"
              value={formData.name}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="description">
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              placeholder="Short product scope or delivery note."
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Layers3 className="h-4 w-4 text-indigo-600" />
                Team-based access
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Attach teams after creation to bring members into the project.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Sparkles className="h-4 w-4 text-pink-500" />
                Compact workflow
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Create the project first, then attach teams and start creating work.
              </p>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <Button
            className="interactive-button w-full bg-slate-950 text-white hover:bg-slate-900"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Creating project..." : "Create Project"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProjectComposer;
