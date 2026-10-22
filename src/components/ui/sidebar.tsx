"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  UploadCloud,
  Layers,
  ShieldCheck,
  BarChart3,
  Settings,
  History,
  User,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { WellQCIcon } from "./wellqc-logo";

interface SidebarProps {
  currentRole: string;
  mobileOpen?: boolean;
  onCloseMobileNav?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isLive?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function Sidebar({ currentRole, mobileOpen = false, onCloseMobileNav }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    name: string;
    department: string;
    role: string;
    avatarUrl: string;
  }>({
    name: "Petrophysicist",
    department: "Subsurface Analytics",
    role: currentRole || "PETROPHYSICIST",
    avatarUrl: "",
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wellqc_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {}

    // Load active profile details for sidebar card
    async function loadProfile() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const { user } = await res.json();
          if (user) {
            setUserProfile({
              name: user.name || "Petrophysicist",
              department: user.department || "Subsurface Analytics",
              role: user.role || currentRole || "PETROPHYSICIST",
              avatarUrl: user.avatarUrl || "",
            });
          }
        }
      } catch {}
    }

    loadProfile();

    const handleUserUpdate = () => loadProfile();
    window.addEventListener("wellqc_user_updated", handleUserUpdate);
    return () => window.removeEventListener("wellqc_user_updated", handleUserUpdate);
  }, [currentRole]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("wellqc_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Structured Categorized Navigation Sections
  const navSections: NavSection[] = [
    {
      title: "Workstation",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, isLive: true },
        { label: "Well Assets", href: "/wells", icon: Database },
        { label: "LAS Ingestion", href: "/upload", icon: UploadCloud, badge: "CWLS 2.0" },
      ],
    },
    {
      title: "Engines & ML",
      items: [
        { label: "Standardisation", href: "/standardisation", icon: Layers, badge: "RP 66" },
        { label: "Quality Engine", href: "/qa-engine", icon: ShieldCheck, isLive: true },
        { label: "Subsurface Analytics", href: "/analytics", icon: BarChart3 },
      ],
    },
    {
      title: "Governance & Audit",
      items: [
        { label: "Audit Trail", href: "/activity", icon: History },
        { label: "User Profile", href: "/profile", icon: User },
      ],
    },
  ];

  if (currentRole === "ADMIN") {
    navSections[2].items.push({
      label: "Admin Panel",
      href: "/admin",
      icon: Settings,
      badge: "ROOT",
    });
  }

  const sidebarContent = (
    <aside
      className={`${
        collapsed ? "w-16" : "w-64"
      } transition-[width] duration-300 ease-in-out bg-wellqc-panel border-r border-wellqc-border flex flex-col h-full select-none text-slate-300 relative shadow-xl`}
    >
      {/* Brand & Workstation Header */}
      <div
        className={`h-14 border-b border-wellqc-border flex items-center justify-between bg-slate-950/40 backdrop-blur-md ${
          collapsed ? "px-2 justify-center" : "px-4"
        }`}
      >
        <Link
          href="/dashboard"
          onClick={onCloseMobileNav}
          className="flex items-center space-x-3 group overflow-hidden"
          title="WellQC Enterprise Subsurface Workstation"
        >
          <div className="w-9 h-9 rounded-xl border border-slate-700/80 bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center group-hover:border-cyan-500/80 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.25)] transition-all shrink-0 shadow-md">
            <WellQCIcon size={22} />
          </div>

          {!collapsed && (
            <div className="flex flex-col">
              <div className="flex items-baseline space-x-1.5">
                <span className="text-base font-black tracking-tight text-white font-mono">
                  Well<span className="text-cyan-400">QC</span>
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold uppercase tracking-wider">
                  STUDIO
                </span>
              </div>
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                Subsurface QA/QC
              </span>
            </div>
          )}
        </Link>

        {onCloseMobileNav && (
          <button
            onClick={onCloseMobileNav}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Primary Dynamic CTA Button */}
      <div className={`p-3 border-b border-wellqc-border/60 ${collapsed ? "flex justify-center" : ""}`}>
        <Link
          href="/upload"
          onClick={onCloseMobileNav}
          title={collapsed ? "Ingest LAS Log File" : undefined}
          className={`flex items-center justify-center rounded-xl font-medium text-xs transition-all duration-200 shadow-sm ${
            collapsed
              ? "w-10 h-10 p-0 bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/20"
              : "w-full space-x-2 px-3.5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-md shadow-cyan-600/20 group hover:shadow-cyan-500/30 active:scale-[0.98]"
          }`}
        >
          <UploadCloud className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-y-0.5" />
          {!collapsed && (
            <span className="font-semibold tracking-wide flex items-center space-x-1.5">
              <span>Ingest LAS File</span>
              <Sparkles className="w-3 h-3 text-cyan-200 animate-pulse" />
            </span>
          )}
        </Link>
      </div>

      {/* Dynamic Categorized Navigation Sections */}
      <nav className={`flex-1 ${collapsed ? "px-1.5" : "px-3"} py-3 space-y-4 overflow-y-auto custom-scrollbar`}>
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">
                {section.title}
              </div>
            )}

            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobileNav}
                    title={collapsed ? item.label : undefined}
                    className={`group flex items-center rounded-xl text-xs font-medium transition-all duration-200 ${
                      collapsed ? "justify-center h-10 w-full" : "justify-between px-3 py-2"
                    } ${
                      isActive
                        ? "bg-cyan-500/15 text-cyan-300 dark:text-cyan-200 font-semibold shadow-sm border border-cyan-500/30"
                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 hover:translate-x-1"
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="relative">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive
                              ? "text-cyan-400 dark:text-cyan-300"
                              : "text-slate-400 group-hover:text-cyan-300"
                          }`}
                        />
                        {item.isLive && (
                          <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        )}
                      </div>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!collapsed && (
                      <div className="flex items-center space-x-1.5">
                        {item.badge && (
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                              isActive
                                ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30"
                                : "bg-slate-800 text-slate-400 border border-slate-700/60"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                        {item.isLive && !item.badge && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse Rail Toggle (Desktop Only) */}
      <div className="hidden md:flex border-t border-wellqc-border p-2 justify-center bg-slate-950/40">
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar (Ctrl + B)" : "Collapse to icon rail"}
          className="w-full py-1.5 px-2 rounded-xl hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center font-mono text-[11px] group"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          ) : (
            <div className="flex items-center space-x-2">
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Collapse Sidebar</span>
            </div>
          )}
        </button>
      </div>

      {/* User Profile Card & Telemetry Footer */}
      <div className="p-2.5 border-t border-wellqc-border bg-slate-950/60">
        {collapsed ? (
          <Link
            href="/profile"
            onClick={onCloseMobileNav}
            title={`${userProfile.name} • ${userProfile.department}`}
            className="flex justify-center group"
          >
            <div className="relative">
              {userProfile.avatarUrl ? (
                <img
                  src={userProfile.avatarUrl}
                  alt={userProfile.name}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-cyan-500/40 group-hover:ring-cyan-400 transition-all shadow-md"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center ring-1 ring-slate-700 group-hover:ring-cyan-400 group-hover:border-cyan-500/40 transition-all shadow-md">
                  <User className="w-4 h-4 text-slate-400 group-hover:text-cyan-300" />
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
            </div>
          </Link>
        ) : (
          <Link
            href="/profile"
            onClick={onCloseMobileNav}
            className="flex items-center space-x-3 p-2 rounded-xl hover:bg-slate-800/60 transition-all group"
          >
            <div className="relative shrink-0">
              {userProfile.avatarUrl ? (
                <img
                  src={userProfile.avatarUrl}
                  alt={userProfile.name}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-cyan-500/40 group-hover:ring-cyan-300 transition-all shadow-md"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center ring-1 ring-slate-700 group-hover:ring-cyan-400 group-hover:border-cyan-500/40 transition-all shadow-md">
                  <User className="w-4 h-4 text-slate-400 group-hover:text-cyan-300" />
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
            </div>

            <div className="flex-1 min-w-0 text-left">
              <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                {userProfile.name}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {userProfile.department}
              </div>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase">
                  Connected
                </span>
                <span className="text-[9px] font-mono text-slate-500">• v2.4</span>
              </div>
            </div>
          </Link>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:flex h-screen sticky top-0 z-30">
        {sidebarContent}
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            onClick={onCloseMobileNav}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
          />
          <div className="relative z-10 w-64 h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
