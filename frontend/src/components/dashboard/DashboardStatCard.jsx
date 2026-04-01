import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

const toneClasses = {
  blue: {
    iconWrap: "bg-blue-100 text-blue-700",
    trendUp: "bg-blue-50 text-blue-700",
    trendDown: "bg-blue-50 text-blue-500",
  },
  emerald: {
    iconWrap: "bg-emerald-100 text-emerald-700",
    trendUp: "bg-emerald-50 text-emerald-700",
    trendDown: "bg-emerald-50 text-emerald-500",
  },
  amber: {
    iconWrap: "bg-amber-100 text-amber-700",
    trendUp: "bg-amber-50 text-amber-700",
    trendDown: "bg-amber-50 text-amber-500",
  },
  rose: {
    iconWrap: "bg-rose-100 text-rose-700",
    trendUp: "bg-rose-50 text-rose-700",
    trendDown: "bg-emerald-50 text-emerald-600",
  },
  violet: {
    iconWrap: "bg-violet-100 text-violet-700",
    trendUp: "bg-violet-50 text-violet-700",
    trendDown: "bg-violet-50 text-violet-500",
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
        "group relative overflow-hidden border-white/60 bg-white/80 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.34)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_-38px_rgba(15,23,42,0.45)]",
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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.85),_transparent_70%)]" />
      <CardContent className={cn("relative p-5", compact ? "p-4" : "")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={cn("text-sm font-medium text-slate-600", compact ? "text-xs" : "")}>
              {title}
            </p>
            <p
              className={cn(
                "mt-3 text-4xl font-semibold tracking-tight text-slate-950",
                compact ? "mt-2 text-3xl" : ""
              )}
            >
              {value}
            </p>
          </div>

          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition duration-300 group-hover:scale-105",
              compact ? "h-10 w-10 rounded-xl" : "",
              palette.iconWrap
            )}
          >
            <Icon className={cn("h-5 w-5", compact ? "h-4 w-4" : "")} />
          </div>
        </div>

        <div className={cn("mt-5 flex flex-wrap items-center justify-between gap-3", compact ? "mt-4" : "")}>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              compact ? "px-2.5 py-1 text-[11px]" : "",
              trendDirection === "down"
                ? palette.trendDown
                : trendDirection === "up"
                  ? palette.trendUp
                  : "bg-slate-100 text-slate-600"
            )}
          >
            <TrendIcon className={cn("h-3.5 w-3.5", compact ? "h-3 w-3" : "")} />
            <span>{trendLabel}</span>
          </div>
          <p className={cn("text-xs uppercase tracking-[0.24em] text-slate-400", compact ? "text-[10px]" : "")}>
            {helperText}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardStatCard;
