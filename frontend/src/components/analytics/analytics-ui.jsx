import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const ANALYTICS_PANEL_CLASS =
  "overflow-hidden rounded-[16px] border border-white/55 bg-white/60 shadow-[0_22px_55px_-32px_rgba(15,23,42,0.38)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/62 dark:text-slate-100";

export const ANALYTICS_SUBPANEL_CLASS =
  "rounded-[16px] border border-white/55 bg-white/54 shadow-[0_16px_36px_-26px_rgba(15,23,42,0.34)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_42px_-24px_rgba(15,23,42,0.38)] dark:border-white/10 dark:bg-slate-900/58";

export const ANALYTICS_FIELD_CLASS =
  "h-11 rounded-2xl border-white/60 bg-white/78 text-slate-800 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.3)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100";

export const ANALYTICS_SELECT_CLASS =
  "h-11 w-full rounded-2xl border border-white/60 bg-white/78 px-4 text-sm font-semibold text-slate-700 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.3)] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/25 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100";

export const CHART_GRID_COLOR = "rgba(148, 163, 184, 0.24)";

export const chartTooltipStyle = {
  background: "rgba(255,255,255,0.94)",
  border: "1px solid rgba(226,232,240,0.9)",
  borderRadius: 16,
  boxShadow: "0 18px 48px -30px rgba(15,23,42,0.38)",
  color: "#0f172a",
};

const toneClasses = {
  blue: "border-white/10 bg-[linear-gradient(135deg,#1d4ed8_0%,#2563eb_44%,#38bdf8_100%)] text-white shadow-[0_22px_55px_-24px_rgba(37,99,235,0.72)]",
  amber:
    "border-white/10 bg-[linear-gradient(135deg,#f59e0b_0%,#f97316_50%,#fb7185_100%)] text-white shadow-[0_22px_55px_-24px_rgba(249,115,22,0.62)]",
  emerald:
    "border-white/10 bg-[linear-gradient(135deg,#059669_0%,#10b981_46%,#34d399_100%)] text-white shadow-[0_22px_55px_-24px_rgba(16,185,129,0.66)]",
  rose:
    "border-white/10 bg-[linear-gradient(135deg,#be123c_0%,#e11d48_46%,#fb7185_100%)] text-white shadow-[0_22px_55px_-24px_rgba(225,29,72,0.58)]",
  violet:
    "border-white/10 bg-[linear-gradient(135deg,#7c3aed_0%,#8b5cf6_46%,#d946ef_100%)] text-white shadow-[0_22px_55px_-24px_rgba(139,92,246,0.66)]",
  cyan: "border-white/10 bg-[linear-gradient(135deg,#0891b2_0%,#06b6d4_44%,#3b82f6_100%)] text-white shadow-[0_22px_55px_-24px_rgba(6,182,212,0.66)]",
};

export const formatCompactNumber = (value) =>
  new Intl.NumberFormat("en-US", {
    notation: Number(value || 0) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value || 0);

export const formatDuration = (milliseconds) => {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return "--";
  }

  const days = milliseconds / (24 * 60 * 60 * 1000);

  if (days >= 1) {
    return `${days.toFixed(days >= 10 ? 0 : 1)}d`;
  }

  const hours = milliseconds / (60 * 60 * 1000);

  if (hours >= 1) {
    return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
  }

  return `${Math.max(Math.round(milliseconds / (60 * 1000)), 1)}m`;
};

export const AnalyticsPanel = ({ title, description, action, children, className }) => (
  <Card className={cn(ANALYTICS_PANEL_CLASS, className)}>
    {(title || description || action) ? (
      <div className="flex flex-col gap-3 border-b border-white/45 p-4 sm:flex-row sm:items-start sm:justify-between dark:border-white/10">
        <div>
          {title ? (
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    ) : null}
    <CardContent className="p-4">{children}</CardContent>
  </Card>
);

export const AnalyticsKpiCard = ({
  className,
  helper,
  icon: Icon,
  onClick,
  title,
  tone = "blue",
  trend,
  value,
}) => {
  const TrendIcon =
    trend?.direction === "up"
      ? ArrowUpRight
      : trend?.direction === "down"
        ? ArrowDownRight
        : Minus;
  const isInteractive = typeof onClick === "function";

  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-[16px] border backdrop-blur-xl transition-all duration-200 hover:-translate-y-1",
        toneClasses[tone] || toneClasses.blue,
        isInteractive ? "cursor-pointer" : "",
        className
      )}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!isInteractive) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.24),transparent_42%,rgba(255,255,255,0.1))]" />
      <CardContent className="relative p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/78">{title}</p>
            <p className="mt-2 break-words text-3xl font-semibold text-white">
              {value}
            </p>
          </div>
          {Icon ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/18 bg-white/16 shadow-[0_10px_30px_-16px_rgba(15,23,42,0.65)] backdrop-blur-xl transition-all duration-200 group-hover:scale-[1.03]">
              <Icon className="h-[18px] w-[18px]" />
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          {trend ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/14 px-3 py-1 text-[11px] font-semibold text-white/94 backdrop-blur-xl">
              <TrendIcon className="h-3.5 w-3.5" />
              {trend.label}
            </span>
          ) : null}
          {helper ? (
            <span className="text-[10px] font-semibold uppercase text-white/68">
              {helper}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

export const AnalyticsEmptyState = ({ className, description, icon: Icon, title }) => (
  <div
    className={cn(
      "flex min-h-[220px] items-center justify-center rounded-[16px] border border-dashed border-white/65 bg-white/34 px-6 py-10 text-center backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/34",
      className
    )}
  >
    <div className="max-w-sm">
      {Icon ? (
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/60 bg-white/74 text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <p className="mt-4 text-sm font-semibold text-slate-950 dark:text-slate-100">
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  </div>
);

export const AnalyticsSkeletonGrid = ({ count = 6, className }) => (
  <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-6", className)}>
    {Array.from({ length: count }).map((_, index) => (
      <Skeleton
        className="h-[150px] rounded-[16px] bg-gradient-to-r from-slate-200/70 via-white/80 to-slate-200/70"
        key={`analytics-skeleton-${index}`}
      />
    ))}
  </div>
);
