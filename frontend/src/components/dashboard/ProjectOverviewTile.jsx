import {
  ArrowRight,
  CalendarDays,
  FolderKanban,
  Sparkles,
  Users2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

const projectColors = [
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)",
  "linear-gradient(135deg, #30cfd0, #330867)",
];

const projectShadows = [
  "0 30px 80px -34px rgba(95, 92, 194, 0.72)",
  "0 30px 80px -34px rgba(226, 90, 127, 0.72)",
  "0 30px 80px -34px rgba(19, 159, 144, 0.66)",
  "0 30px 80px -34px rgba(231, 128, 117, 0.68)",
  "0 30px 80px -34px rgba(45, 44, 128, 0.78)",
];

const ProjectOverviewTile = ({ project, index = 0, onOpen }) => {
  const themeIndex = index % projectColors.length;

  return (
    <button
      className="group relative overflow-hidden rounded-[30px] p-0 text-left transition duration-300 hover:-translate-y-1 hover:scale-[1.01]"
      style={{
        background: projectColors[themeIndex],
        color: "#fff",
        boxShadow: projectShadows[themeIndex],
      }}
      type="button"
      onClick={() => onOpen(project)}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.26),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.18),_transparent_34%)]" />
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/20 blur-3xl transition duration-300 group-hover:scale-110" />

      <div className="relative flex h-full flex-col gap-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/90 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Project
            </div>
            <h3 className="mt-4 text-xl font-semibold leading-tight text-white">
              {project.name}
            </h3>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/80">
              {project.description || "No project description added yet."}
            </p>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-white/90 backdrop-blur transition duration-300 group-hover:bg-white/15">
            <ArrowRight className="h-5 w-5 transition duration-300 group-hover:translate-x-1" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-white/20 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-sm text-white/75">
              <Users2 className="h-4 w-4" />
              <span>Members</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">
              {project.memberCount || 0}
            </p>
          </div>

          <div className="rounded-[22px] border border-white/20 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-sm text-white/75">
              <FolderKanban className="h-4 w-4" />
              <span>Issues</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">
              {project.issueCount || 0}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-[22px] border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/80 backdrop-blur">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span>Created {formatDate(project.createdAt)}</span>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/90">
            {project.isCompleted ? "Completed" : "Active"}
          </span>
        </div>
      </div>
    </button>
  );
};

export default ProjectOverviewTile;
