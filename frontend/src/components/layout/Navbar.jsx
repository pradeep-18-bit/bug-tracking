import { useEffect, useState } from "react";
import {
  BarChart3,
  Bug,
  FolderKanban,
  KanbanSquare,
  LayoutDashboard,
  Layers3,
  ListTodo,
  LogOut,
  Menu,
  MessageCircle,
  Settings2,
  Users2,
  X,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import pirnavLogo from "@/assets/pirnav-logo.png";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useChatStore } from "@/lib/chatStore";
import { getRoleNavigation } from "@/lib/roles";
import { cn, getInitials } from "@/lib/utils";

const iconMap = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  teams: Users2,
  backlog: Layers3,
  issues: KanbanSquare,
  bugs: Bug,
  tasks: ListTodo,
  reports: BarChart3,
  chat: MessageCircle,
  settings: Settings2,
};

const navItemClassName =
  "group inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition duration-300 ease-out";

const Navbar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigation = getRoleNavigation(user?.role);
  const chatUnreadCount = useChatStore((state) => state.getTotalUnread());
  const hasLoadedConversations = useChatStore(
    (state) => state.hasLoadedConversations
  );
  const loadConversations = useChatStore((state) => state.loadConversations);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user || hasLoadedConversations) {
      return;
    }

    loadConversations();
  }, [hasLoadedConversations, loadConversations, user]);

  return (
    <header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-white/45 bg-gradient-to-r from-white/78 via-blue-50/74 to-sky-100/70 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-2xl sm:h-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.16),transparent_32%),radial-gradient(circle_at_top_right,_rgba(186,230,253,0.22),transparent_40%)]" />

      <div className="relative z-10 mx-auto h-full w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-full items-center gap-3 lg:gap-6">
          <NavLink
            to={navigation[0]?.href || "/"}
            className="flex min-w-0 items-center gap-3"
          >
            <img
              src={pirnavLogo}
              alt="Pirnav Software Solutions Pvt. Ltd."
              className="h-auto max-h-9 w-auto max-w-[132px] object-contain sm:max-h-10 sm:max-w-[190px]"
            />
          </NavLink>

          <nav className="hidden items-center gap-2 lg:flex">
            {navigation.map((item) => {
              const Icon = iconMap[item.icon] || LayoutDashboard;

              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      navItemClassName,
                      isActive
                        ? "border-blue-200/80 bg-gradient-to-r from-blue-500/85 via-sky-400/80 to-cyan-300/75 font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.3)]"
                        : "border-white/35 bg-white/35 text-slate-700 hover:-translate-y-0.5 hover:border-blue-200/70 hover:bg-white/55 hover:text-slate-950"
                    )
                  }
                >
                  <Icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-105" />
                  <span>{item.label}</span>
                  {item.icon === "chat" && chatUnreadCount ? (
                    <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-extrabold text-blue-600 shadow-sm">
                      {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto hidden min-w-0 items-center gap-3 lg:flex">
            <div className="flex min-w-0 items-center gap-3 rounded-[24px] border border-white/40 bg-white/40 px-3 py-2.5 shadow-[0_12px_30px_rgba(148,163,184,0.14)] backdrop-blur-xl">
              <Avatar className="h-11 w-11">
                <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {user?.name}
                </p>
                <p className="truncate text-xs text-slate-600">{user?.email}</p>
              </div>
            </div>

            <Button type="button" variant="outline" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>

          <Button
            className="ml-auto shrink-0 lg:hidden"
            variant="outline"
            size="icon"
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="absolute inset-x-0 top-full max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-white/45 bg-gradient-to-r from-white/82 via-blue-50/78 to-sky-100/74 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-2xl sm:max-h-[calc(100vh-5rem)] lg:hidden">
          <div className="mx-auto w-full max-w-screen-2xl space-y-4 px-4 py-4 sm:px-6 lg:px-8">
            <nav className="grid gap-2">
              {navigation.map((item) => {
                const Icon = iconMap[item.icon] || LayoutDashboard;

                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className={({ isActive }) =>
                      cn(
                        navItemClassName,
                        "w-full justify-between bg-white/38",
                        isActive
                          ? "border-blue-200/80 bg-gradient-to-r from-blue-500/85 via-sky-400/80 to-cyan-300/75 font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.3)]"
                          : "border-white/35 text-slate-700 hover:border-blue-200/70 hover:bg-white/55 hover:text-slate-950"
                      )
                    }
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {item.label}
                      {item.icon === "chat" && chatUnreadCount ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-extrabold text-white shadow-sm">
                          {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                        </span>
                      ) : null}
                    </span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="flex items-center gap-3 rounded-[24px] border border-white/40 bg-white/40 px-4 py-3 shadow-[0_12px_30px_rgba(148,163,184,0.14)] backdrop-blur-xl">
              <Avatar className="h-11 w-11">
                <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {user?.name}
                </p>
                <p className="truncate text-xs text-slate-600">{user?.email}</p>
              </div>
            </div>

            <Button className="w-full" type="button" variant="outline" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Navbar;
