import { cn } from "@/lib/utils";
import { usePresence } from "@/context/PresenceContext";

const statusClassName = {
  active: "bg-emerald-500",
  idle: "bg-yellow-400",
  offline: "bg-slate-400",
};

const statusLabel = {
  active: "Active",
  idle: "Idle",
  offline: "Offline",
};

const StatusIndicator = ({
  userId,
  className = "",
  showLabel = false,
  status: statusOverride = "",
}) => {
  const { getPresence } = usePresence();
  const presence = userId ? getPresence(userId) : null;
  const status = statusOverride || presence?.status || "offline";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={statusLabel[status] || "Offline"}>
      <span
        className={cn(
          "inline-flex h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white",
          statusClassName[status] || statusClassName.offline
        )}
      />
      {showLabel ? (
        <span className="text-xs font-semibold text-slate-600">
          {statusLabel[status] || "Offline"}
        </span>
      ) : null}
    </span>
  );
};

export default StatusIndicator;
