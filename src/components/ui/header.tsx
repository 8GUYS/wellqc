"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ActivityListItem } from "@/lib/api-types";
import { Search, Bell, Shield, ChevronDown, Check, Globe, LogOut, Menu } from "lucide-react";
// import { PaymentModal } from "@/components/pricing/payment-modal";

interface HeaderProps {
  currentRole: string;
  onRoleChange: (newRole: string) => void;
  currentUser: {
    name: string;
    email: string;
    department: string;
    role?: string;
    tier?: string;
    freeChecksUsed?: number;
  };
  onLogout: () => void;
  onToggleMobileNav?: () => void;
}

export function Header({
  currentRole,
  onRoleChange,
  currentUser,
  onLogout,
  onToggleMobileNav,
}: HeaderProps) {
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activities, setActivities] = useState<ActivityListItem[]>([]);

  const userTier = currentUser.tier || "FREE";
  const checksUsed = currentUser.freeChecksUsed ?? 0;
  const isFreeLimitReached = userTier === "FREE" && checksUsed >= 2;

  useEffect(() => {
    let cancelled = false;

    async function loadActivities() {
      try {
        const response = await fetch("/api/activity", { cache: "no-store" });
        const data = await response.json();

        if (!cancelled && response.ok) {
          setActivities((data.activities || []).slice(0, 3));
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

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const allRoles = [
    { id: "ADMIN", name: "Administrator", color: "text-purple-400 border-purple-500/40 bg-purple-500/10" },
    { id: "PETROPHYSICIST", name: "Petrophysicist", color: "text-cyan-400 border-cyan-500/40 bg-cyan-500/10" },
    { id: "DATA_ENGINEER", name: "Data Engineer", color: "text-blue-400 border-blue-500/40 bg-blue-500/10" },
    { id: "GEOSCIENTIST", name: "Geoscientist", color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
    { id: "VIEWER", name: "Viewer / Auditor", color: "text-slate-400 border-slate-500/40 bg-slate-500/10" },
  ];

  // Filter roles: Only show Administrator if user's actual account role is ADMIN
  const availableRoles = allRoles.filter(
    (r) => r.id !== "ADMIN" || currentUser.role === "ADMIN"
  );

  const activeRoleObj = availableRoles.find((r) => r.id === currentRole) || availableRoles[0] || allRoles[1];

  return (
    <header className="h-16 bg-wellqc-panel/80 backdrop-blur-md border-b border-wellqc-border px-4 md:px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Payment Portal Modal */}
      {/* <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        defaultPlan="pro_monthly"
      /> */}

      {/* Left section with Mobile Menu Toggle & Global Search Bar */}
      <div className="flex items-center space-x-3 flex-1 max-w-xl">
        {/* Mobile Hamburger Button */}
        <button
          onClick={onToggleMobileNav}
          className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-wellqc-card border border-wellqc-border focus:outline-none"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search wells, API/UWI numbers, operators..."
            className="w-full bg-wellqc-card border border-wellqc-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
          />
        </div>
      </div>

      {/* Right Toolbar Controls */}
      <div className="flex items-center space-x-2 md:space-x-3">
        {/* Subscription Plan & Usage Badge */}
        <div className="flex items-center space-x-2">
          {userTier === "PRO" ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold">
              <span>PRO PLAN (UNLIMITED)</span>
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-semibold ${
                isFreeLimitReached
                  ? "bg-rose-500/20 border-rose-500/50 text-rose-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300"
              }`}>
                <span>FREE: {checksUsed}/2 Checks</span>
              </span>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 text-[11px] font-bold shadow-md transition-all whitespace-nowrap cursor-pointer"
              >
                Upgrade (Paystack)
              </button>
            </div>
          )}
        </div>

        {/* RBAC Role Switcher */}
        <div className="relative">
          <button
            onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
            className={`flex items-center space-x-1.5 md:space-x-2 px-2.5 md:px-3 py-1.5 rounded-lg border text-[11px] md:text-xs font-semibold font-mono transition-all ${activeRoleObj.color}`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Role: {activeRoleObj.name}</span>
            <span className="sm:hidden">{activeRoleObj.id}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>

          {roleDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-wellqc-card border border-wellqc-border rounded-xl shadow-2xl p-1.5 z-50">
              <div className="px-3 py-2 text-[10px] font-mono text-slate-400 border-b border-wellqc-border uppercase tracking-wider">
                Simulate Role Access (RBAC)
              </div>
              <div className="py-1 space-y-0.5">
                {availableRoles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      onRoleChange(r.id);
                      setRoleDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                      currentRole === r.id
                        ? "bg-blue-600/20 text-cyan-300 font-semibold"
                        : "text-slate-300 hover:bg-wellqc-panel hover:text-white"
                    }`}
                  >
                    <span>{r.name}</span>
                    {currentRole === r.id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-wellqc-card rounded-lg transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {activities.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-wellqc-card border border-wellqc-border rounded-xl shadow-2xl p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-wellqc-border text-xs font-semibold text-white">
                <span>Recent Database Activity</span>
                <span className="text-[10px] font-mono text-cyan-400">{activities.length} New</span>
              </div>
              <div className="py-2 space-y-2 text-xs">
                {activities.length === 0 ? (
                  <div className="p-2 rounded-lg bg-wellqc-panel/60 border border-wellqc-border">
                    <div className="font-semibold text-slate-300">No activity yet</div>
                    <div className="text-slate-400 text-[11px]">Committed uploads will appear here.</div>
                  </div>
                ) : (
                  activities.map((activity) => (
                    <div key={activity.id} className="p-2 rounded-lg bg-wellqc-panel/60 border border-cyan-500/30">
                      <div className="font-semibold text-cyan-300">{activity.action.replace(/_/g, " ")}</div>
                      <div className="text-slate-400 text-[11px]">{activity.details}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="flex items-center space-x-2 md:space-x-3 pl-2 border-l border-wellqc-border">
          <Link
            href="/profile"
            className="flex items-center space-x-2.5 group hover:opacity-90 transition-opacity"
            title="View User Profile & Billing Settings"
          >
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md group-hover:scale-105 transition-transform border border-cyan-400/30">
              {currentUser.name.charAt(0)}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-wellqc-muted font-mono">{currentUser.department}</div>
            </div>
          </Link>
          <button
            onClick={onLogout}
            title="Sign out"
            aria-label="Sign out"
            className="p-1.5 md:p-2 text-slate-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
