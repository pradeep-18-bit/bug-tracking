import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";

const sizeClasses = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
};

const TeamMemberStack = ({
  members = [],
  max = 4,
  size = "md",
  className,
}) => {
  const visibleMembers = members.slice(0, max);
  const overflowCount = Math.max(members.length - visibleMembers.length, 0);

  if (!members.length) {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-full border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500",
          className
        )}
      >
        No members yet
      </div>
    );
  }

  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex items-center">
        {visibleMembers.map((member, index) => (
          <Avatar
            key={member._id}
            className={cn(
              "rounded-2xl border-2 border-white bg-gradient-to-br from-sky-100 to-cyan-100 text-slate-700 shadow-sm",
              sizeClasses[size] || sizeClasses.md,
              index === 0 ? "" : "-ml-3"
            )}
          >
            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
          </Avatar>
        ))}
      </div>

      {overflowCount ? (
        <span className="ml-2 inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 shadow-sm">
          +{overflowCount}
        </span>
      ) : null}
    </div>
  );
};

export default TeamMemberStack;
