import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  LogOut,
  Settings,
  Lock,
  User,
  Mail,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getInitials } from "@/lib/utils";

const UserProfileDropdown = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
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
      icon: Mail,
      label: "Account",
      onClick: () => handleNavigate("/profile"),
    },
    {
      icon: Lock,
      label: "Change Password",
      onClick: () => handleNavigate("/settings?tab=password"),
    },
    {
      icon: Settings,
      label: "Settings",
      onClick: () => handleNavigate("/settings"),
    },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button - Compact Avatar with Dropdown Indicator */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 rounded-[24px] border border-white/40 bg-white/40 px-2 py-1.5 transition-all duration-300 hover:border-white/60 hover:bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
        aria-label="User profile menu"
      >
        <Avatar className="h-9 w-9 ring-2 ring-white/60 group-hover:ring-blue-300/80 transition-all">
          <AvatarFallback className="text-xs font-bold">
            {getInitials(user?.name)}
          </AvatarFallback>
        </Avatar>
        <ChevronDown
          className={`h-4 w-4 text-slate-700 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.15)] backdrop-blur-sm z-50"
          >
            {/* User Info Header */}
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="font-bold">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {user?.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {user?.email}
                  </p>
                  {user?.role && (
                    <p className="mt-0.5 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {user.role}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="space-y-1 px-2 py-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className="group/item flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Icon className="h-4 w-4 transition-transform group-hover/item:scale-110" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="my-1 h-px bg-slate-100" />

            {/* Logout Button */}
            <div className="px-2 py-2">
              <button
                onClick={handleLogout}
                className="group/logout flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-all duration-200 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 transition-transform group-hover/logout:scale-110" />
                <span>Logout</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserProfileDropdown;
