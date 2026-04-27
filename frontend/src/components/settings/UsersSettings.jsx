import { useMemo } from "react";
import {
  CheckCircle2,
  MailPlus,
  ShieldCheck,
  UserCircle2,
  Users2,
  X,
} from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import SettingsPanel from "@/components/settings/SettingsPanel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate, getInitials } from "@/lib/utils";

const USER_FILTER_KEY_ALL = "all";

const getRoleBadgeVariant = (role) => {
  if (role === "Admin") {
    return "default";
  }

  if (role === "Manager") {
    return "secondary";
  }

  return "outline";
};

const summaryIconMap = {
  [USER_FILTER_KEY_ALL]: Users2,
  Admin: ShieldCheck,
  Manager: UserCircle2,
  Developer: MailPlus,
  Tester: CheckCircle2,
};

const UsersSettings = ({
  activeFilter,
  isLoading,
  onActiveFilterChange,
  users = [],
}) => {
  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => (left.name || "").localeCompare(right.name || "")),
    [users]
  );

  const stats = useMemo(() => {
    const countByRole = (role) => users.filter((user) => user.role === role).length;

    return {
      total: users.length,
      adminCount: countByRole("Admin"),
      managerCount: countByRole("Manager"),
      developerCount: countByRole("Developer"),
      testerCount: countByRole("Tester"),
    };
  }, [users]);

  const summaryCards = useMemo(
    () => [
      {
        key: USER_FILTER_KEY_ALL,
        label: "Total Users",
        count: stats.total,
        description: "All workspace members",
      },
      {
        key: "Admin",
        label: "Admins",
        count: stats.adminCount,
        description: "Workspace administrators",
      },
      {
        key: "Manager",
        label: "Managers",
        count: stats.managerCount,
        description: "Delivery managers",
      },
      {
        key: "Developer",
        label: "Developers",
        count: stats.developerCount,
        description: "Implementation teammates",
      },
      {
        key: "Tester",
        label: "Testers",
        count: stats.testerCount,
        description: "QA and validation users",
      },
    ],
    [stats]
  );

  const visibleUsers = useMemo(() => {
    if (!activeFilter || activeFilter === USER_FILTER_KEY_ALL) {
      return sortedUsers;
    }

    return sortedUsers.filter((user) => user.role === activeFilter);
  }, [activeFilter, sortedUsers]);

  const activeCard =
    summaryCards.find((card) => card.key === activeFilter) || summaryCards[0];
  const activeLabel =
    !activeFilter || activeFilter === USER_FILTER_KEY_ALL
      ? "Workspace Users"
      : activeCard.label;

  return (
    <SettingsPanel
      title="Users"
      description="Review workspace membership, role distribution, and account creation dates."
      actions={
        activeFilter && activeFilter !== USER_FILTER_KEY_ALL ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => onActiveFilterChange(USER_FILTER_KEY_ALL)}
          >
            <X className="h-4 w-4" />
            Clear Filter
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-[16px]" />
            ))}
          </div>
          <Skeleton className="h-[360px] rounded-[16px]" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {summaryCards.map((card) => {
              const Icon = summaryIconMap[card.key] || Users2;
              const isActive =
                (!activeFilter && card.key === USER_FILTER_KEY_ALL) ||
                activeFilter === card.key;

              return (
                <button
                  key={card.key}
                  type="button"
                  className={cn(
                    "rounded-[16px] border p-4 text-left transition duration-200",
                    isActive
                      ? "border-blue-200 bg-blue-50 text-blue-900 shadow-sm"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                  )}
                  onClick={() => onActiveFilterChange(card.key)}
                  aria-pressed={isActive}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-[12px]",
                        isActive ? "bg-white text-blue-700" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-2xl font-semibold tracking-tight">
                      {card.count}
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-semibold">{card.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {card.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="rounded-[16px] border border-slate-200 bg-white">
            <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-950">
                  {activeLabel}
                </h3>
                <p className="text-sm text-slate-500">
                  {visibleUsers.length} user{visibleUsers.length === 1 ? "" : "s"} found
                </p>
              </div>
              <Badge variant="outline">
                {activeFilter && activeFilter !== USER_FILTER_KEY_ALL
                  ? `${activeCard.label} only`
                  : "All roles"}
              </Badge>
            </div>

            {visibleUsers.length ? (
              <div className="divide-y divide-slate-100">
                {visibleUsers.map((user) => (
                  <div
                    key={user._id}
                    className="flex flex-col gap-4 px-4 py-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-11 w-11 rounded-[14px]">
                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {user.name}
                        </p>
                        <p className="truncate text-sm text-slate-600">{user.email}</p>
                        {user.employeeId || user.designation ? (
                          <p className="truncate text-xs text-slate-500">
                            {[user.employeeId, user.designation].filter(Boolean).join(" | ")}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                      <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                      <span className="text-xs text-slate-500">
                        Added {formatDate(user.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8">
                <EmptyState
                  title={`No ${activeCard?.label?.toLowerCase() || "users"} found`}
                  description="Invite or import teammates to populate this category."
                  icon={<Users2 className="h-5 w-5" />}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </SettingsPanel>
  );
};

export default UsersSettings;
