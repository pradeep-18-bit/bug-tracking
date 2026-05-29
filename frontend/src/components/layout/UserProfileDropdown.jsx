import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  LogOut,
  Settings,
  Lock,
  User,
  Sliders,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { getInitials } from "@/lib/utils";

const UserProfileDropdown = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    // Close on ESC key
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen]);

  const handleLogout = () => {
    setIsOpen(false);
    logout();
  };

  const handleNavigate = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  const menuItems = [
    {
      icon: User,
      label: "Profile",
      onClick: () => handleNavigate("/profile"),
    },
    {
      icon: User,
      label: "Account Settings",
      onClick: () => handleNavigate("/profile"),
    },
    {
      icon: Lock,
      label: "Change Password",
      onClick: () => handleNavigate("/settings?tab=password"),
    },
    {
      icon: Sliders,
      label: "Preferences",
      onClick: () => handleNavigate("/settings"),
    },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button - Compact Avatar with Dropdown Indicator */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-1.5 rounded-full border border-white/40 bg-white/35 px-1.5 py-1.5 transition-all duration-200 hover:border-blue-300/60 hover:bg-white/45 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2 focus:ring-offset-transparent"
        aria-label="User profile menu"
        aria-expanded={isOpen}
      >
        <Avatar className="h-8 w-8 ring-2 ring-white/70 group-hover:ring-blue-200 transition-all">
          <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            {getInitials(user?.name)}
          </AvatarFallback>
        </Avatar>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-700 shrink-0 transition-all duration-300 ${
            isOpen ? "rotate-180 text-blue-600" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="absolute right-0 top-full mt-2.5 w-72 rounded-lg border border-slate-200/80 bg-white shadow-xl backdrop-blur-sm z-50 overflow-hidden"
            role="menu"
          >
            {/* User Info Header */}
            <div className="border-b border-slate-100 px-4 py-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-blue-100 shrink-0">
                  <AvatarFallback className="text-sm font-bold bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 leading-tight">
                    {user?.name}
                  </p>
                  <p className="truncate text-xs text-slate-500 leading-tight mt-0.5">
                    {user?.email}
                  </p>
                  {user?.role && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-100/50">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                        {user.role}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <nav className="space-y-0.5 px-2 py-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    role="menuitem"
                    className="group/item flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-500 group-hover/item:text-blue-600 transition-colors" />
                    <span className="flex-1 text-left">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Divider */}
            <div className="my-1 h-px bg-slate-100" />

            {/* Logout Button */}
            <div className="px-2 py-2">
              <button
                onClick={handleLogout}
                role="menuitem"
                className="group/logout flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-red-600 transition-all duration-150 hover:bg-red-50 active:bg-red-100 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-red-400"
              >
                <LogOut className="h-4 w-4 shrink-0 transition-colors" />
                <span className="flex-1 text-left">Logout</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserProfileDropdown;
