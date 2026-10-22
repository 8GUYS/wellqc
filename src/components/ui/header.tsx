"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ActivityListItem } from "@/lib/api-types";
import { safeReadJson } from "@/lib/http-client";
import { Search, Bell, LogOut, Menu, Radio, User } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";

interface HeaderProps {
  currentRole?: string;
  onRoleChange?: (newRole: string) => void;
  currentUser: {
    name: string;
    email: string;
    department: string;
    role?: string;
    tier?: string;
    avatarUrl?: string;
    freeChecksUsed?: number;
  };
  onLogout: () => void;
  onToggleMobileNav?: () => void;
}

export function Header({
  currentUser,
  onLogout,
  onToggleMobileNav,
}: HeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activities, setActivities] = useState<ActivityListItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadActivities() {
      try {
        const response = await fetch("/api/activity", { cache: "no-store" });
        const res = await safeReadJson<{ activities: ActivityListItem[] }>(response);

        if (!cancelled && res.ok && res.data) {
          setActivities((res.data.activities || []).slice(0, 5));
        }
      } catch {
        if (!cancelled) {
          setActivities([]);
        }
      }
    }

    loadActivities();

    return () => {
      cancelled = true;
    };
  }, []);

  const avatarSrc = currentUser.avatarUrl || "";

  return (
    <header className="h-12 bg-wellqc-panel border-b border-wellqc-border px-3 md:px-4 flex items-center justify-between sticky top-0 z-20 select-none">
      {/* Left section: Mobile toggle + Compact Workstation Search */}
      <div className="flex items-center space-x-2.5 flex-1 max-w-xl">
        <button
          onClick={onToggleMobileNav}
          className="md:hidden p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 focus:outline-none"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="relative w-full max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search wells, API / UWI numbers, operators, curves..."
            className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-8 pr-16 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex items-center space-x-0.5 text-[9px] font-mono text-slate-500 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
            <span>Ctrl</span>
            <span>+</span>
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Right section: System telemetry + Notifications + User context */}
      <div className="flex items-center space-x-2 md:space-x-3">
        {/* Workstation Connection Status */}
        <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-900/60 border border-slate-800 text-[10px] font-mono text-slate-400 shadow-sm">
          <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span className="text-slate-300 font-semibold">QA CLUSTER</span>
          <span className="text-emerald-400 font-bold">ONLINE</span>
        </div>

        {/* Color Theme Switcher */}
        <ThemeSwitcher />

        {/* Audit / Activity Popover */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors relative"
            aria-label="Activity Feed"
          >
            <Bell className="w-3.5 h-3.5" />
            {activities.length > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-cyan-400" />
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-1.5 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 text-slate-200 font-mono">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-semibold">
                <span>Recent Audit Trail</span>
                <span className="text-[10px] text-cyan-400">{activities.length} Events</span>
              </div>
              <div className="py-2 space-y-2 text-xs max-h-64 overflow-y-auto">
                {activities.length === 0 ? (
                  <div className="p-2 text-center text-slate-500 text-[11px]">
                    No committed activities recorded.
                  </div>
                ) : (
                  activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 space-y-0.5"
                    >
                      <div className="font-semibold text-slate-300 text-[11px]">
                        {activity.action.replace(/_/g, " ")}
                      </div>
                      <div className="text-slate-500 text-[10px] truncate">{activity.details}</div>
                      <div className="text-[9px] text-slate-600">{activity.timestamp}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Context */}
        <div className="flex items-center space-x-2 pl-2 border-l border-wellqc-border">
          <Link
            href="/profile"
            className="flex items-center space-x-2.5 group hover:opacity-95 transition-opacity"
            title="User Profile & Settings"
          >
            <div className="relative">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-full object-cover ring-2 ring-cyan-500/30 group-hover:ring-cyan-400 transition-all shadow-sm"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center ring-1 ring-slate-700 group-hover:ring-cyan-400 group-hover:border-cyan-500/40 transition-all shadow-sm">
                  <User className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-300" />
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-slate-900" />
            </div>
            <div className="hidden sm:block text-left font-mono">
              <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 leading-none">
                {currentUser.name}
              </div>
              <div className="text-[9px] text-slate-500 leading-none mt-1">
                {currentUser.department}
              </div>
            </div>
          </Link>

          <button
            onClick={onLogout}
            title="Sign out of workstation"
            aria-label="Sign out"
            className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800/80 rounded transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
