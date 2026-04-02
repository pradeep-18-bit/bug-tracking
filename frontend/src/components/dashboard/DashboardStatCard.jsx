import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

const toneClasses = {
  blue: {
    surface:
      "border-white/10 bg-[linear-gradient(135deg,#1d4ed8_0%,#2563eb_42%,#38bdf8_100%)] text-white shadow-[0_22px_55px_-24px_rgba(37,99,235,0.72)] hover:shadow-[0_30px_75px_-24px_rgba(37,99,235,0.82)]",
    glow:
      "bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.26),transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.14),transparent_40%)]",
  },
  amber: {
    surface:
      "border-white/10 bg-[linear-gradient(135deg,#f59e0b_0%,#f97316_48%,#fb7185_100%)] text-white shadow-[0_22px_55px_-24px_rgba(249,115,22,0.62)] hover:shadow-[0_30px_75px_-24px_rgba(249,115,22,0.75)]",
    glow:
      "bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.24),transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.12),transparent_42%)]",
  },
  violet: {
    surface:
      "border-white/10 bg-[linear-gradient(135deg,#7c3aed_0%,#8b5cf6_46%,#d946ef_100%)] text-white shadow-[0_22px_55px_-24px_rgba(139,92,246,0.66)] hover:shadow-[0_30px_75px_-24px_rgba(139,92,246,0.8)]",
    glow:
      "bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.24),transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.12),transparent_42%)]",
  },
  emerald: {
    surface:
      "border-white/10 bg-[linear-gradient(135deg,#059669_0%,#10b981_44%,#34d399_100%)] text-white shadow-[0_22px_55px_-24px_rgba(16,185,129,0.66)] hover:shadow-[0_30px_75px_-24px_rgba(16,185,129,0.8)]",
    glow:
      "bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.24),transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.12),transparent_42%)]",
  },
  cyan: {
    surface:
      "border-white/10 bg-[linear-gradient(135deg,#0891b2_0%,#06b6d4_44%,#3b82f6_100%)] text-white shadow-[0_22px_55px_-24px_rgba(6,182,212,0.66)] hover:shadow-[0_30px_75px_-24px_rgba(6,182,212,0.78)]",
    glow:
      "bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.24),transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.12),transparent_42%)]",
  },
};

const DashboardStatCard = ({
  title,
  value,
  icon: Icon,
  tone = "blue",
  trendLabel,
  trendDirection = "flat",
  helperText,
  compact = false,
  onClick,
  className,
}) => {
  const palette = toneClasses[tone] || toneClasses.blue;
  const TrendIcon =
    trendDirection === "up"
      ? ArrowUpRight
      : trendDirection === "down"
        ? ArrowDownRight
        : Minus;
  const isInteractive = typeof onClick === "function";

  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-[16px] border backdrop-blur-xl transition-all duration-200 ease-out hover:-translate-y-1",
        palette.surface,
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
      <div className={cn("pointer-events-none absolute inset-0", palette.glow)} />
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/18 blur-2xl transition-transform duration-200 group-hover:scale-110" />

      <CardContent className={cn("relative p-4", compact ? "p-4" : "p-5")}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-medium text-white/76",
                compact ? "text-[13px]" : ""
              )}
            >
              {title}
            </p>
            <p
              className={cn(
                "mt-3 text-4xl font-semibold tracking-tight text-white",
                compact ? "mt-2 text-3xl" : ""
              )}
            >
              {value}
            </p>
          </div>

          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/18 bg-white/14 text-white shadow-[0_10px_30px_-16px_rgba(15,23,42,0.65)] backdrop-blur-xl transition-all duration-200 group-hover:scale-[1.03] group-hover:bg-white/18",
              compact ? "h-10 w-10" : ""
            )}
          >
            <Icon className={cn("h-5 w-5", compact ? "h-[18px] w-[18px]" : "")} />
          </div>
        </div>

        <div
          className={cn(
            "mt-4 flex flex-wrap items-center justify-between gap-3",
            compact ? "mt-3" : ""
          )}
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/14 px-3 py-1 text-[11px] font-semibold text-white/94 backdrop-blur-xl">
            <TrendIcon className={cn("h-3.5 w-3.5", compact ? "h-3 w-3" : "")} />
            <span>{trendLabel}</span>
          </div>

          <p
            className={cn(
              "text-[10px] uppercase tracking-[0.22em] text-white/68",
              compact ? "" : "text-[11px]"
            )}
          >
            {helperText}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardStatCard;
