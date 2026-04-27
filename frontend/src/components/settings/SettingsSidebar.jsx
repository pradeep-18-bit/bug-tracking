import {
  FileUp,
  MailCheck,
  MailPlus,
  ServerCog,
  ShieldCheck,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  users: Users2,
  invite: MailPlus,
  roles: ShieldCheck,
  sender: MailCheck,
  smtp: ServerCog,
  import: FileUp,
};

const SettingsSidebar = ({ activeItem, items = [], onItemChange }) => (
  <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
    <nav
      className="flex gap-2 overflow-x-auto rounded-[16px] border border-slate-200/90 bg-white p-2 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.28)] lg:flex-col lg:overflow-visible"
      aria-label="Admin settings"
    >
      {items.map((item) => {
        const Icon = item.icon || iconMap[item.id] || Users2;
        const isActive = activeItem === item.id;

        return (
          <button
            key={item.id}
            type="button"
            className={cn(
              "group flex min-w-max items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-sm font-medium transition duration-200 lg:min-w-0",
              isActive
                ? "bg-blue-50 text-blue-700 shadow-sm"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            )}
            onClick={() => onItemChange(item.id)}
            aria-current={isActive ? "page" : undefined}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] transition",
                isActive
                  ? "bg-white text-blue-700"
                  : "bg-slate-50 text-slate-500 group-hover:bg-white group-hover:text-slate-700"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  </aside>
);

export default SettingsSidebar;
