"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  UploadCloud,
  Layers,
  ShieldCheck,
  BarChart3,
  GitCompare,
  FileSpreadsheet,
  Settings,
  History,
  Activity,
  ChevronRight,
  Sparkles,
  CreditCard,
  User,
  X,
} from "lucide-react";

interface SidebarProps {
  currentRole: string;
  mobileOpen?: boolean;
  onCloseMobileNav?: () => void;
}

export function Sidebar({ currentRole, mobileOpen = false, onCloseMobileNav }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Well Management", href: "/wells", icon: Database },
    { label: "LAS Upload & QA", href: "/upload", icon: UploadCloud, highlight: true },
    { label: "Standardisation", href: "/standardisation", icon: Layers },
    { label: "Quality Engine", href: "/qa-engine", icon: ShieldCheck },
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
    { label: "Well Comparison", href: "/comparison", icon: GitCompare },
    { label: "Audit Reports", href: "/reports", icon: FileSpreadsheet },
    { label: "Activity Logs", href: "/activity", icon: History },
    { label: "User Profile & Billing", href: "/profile", icon: User },
    { label: "Pricing & Plans", href: "/pricing", icon: CreditCard },
  ];

  if (currentRole === "ADMIN") {
    navItems.push({ label: "Admin Panel", href: "/admin", icon: Settings });
  }

  const sidebarContent = (
    <aside className="w-64 bg-wellqc-panel border-r border-wellqc-border flex flex-col h-full select-none">
      {/* Brand & Logo */}
      <div className="p-4 border-b border-wellqc-border flex items-center justify-between">
        <Link href="/dashboard" onClick={onCloseMobileNav} className="flex items-center space-x-3 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 via-cyan-500 to-emerald-400 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-wellqc-dark rounded-[7px] flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400 animate-pulse-glow" />
            </div>
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
              WellQC<span className="text-cyan-400 font-black">+</span>
            </span>
            <span className="block text-[10px] uppercase font-mono tracking-widest text-wellqc-muted">
              Petrophysical QA
            </span>
          </div>
        </Link>

        {onCloseMobileNav && (
          <button
            onClick={onCloseMobileNav}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Quick Ingestion CTA Banner */}
      <div className="p-3">
        <Link
          href="/upload"
          onClick={onCloseMobileNav}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600/30 to-cyan-500/20 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 text-xs font-semibold shadow-md shadow-cyan-500/10 transition-all hover:translate-y-[-1px]"
        >
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Ingest & Validate LAS</span>
          </div>
          <ChevronRight className="w-4 h-4 text-cyan-400" />
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="px-3 pb-1 text-[10px] font-mono uppercase tracking-wider text-wellqc-muted font-bold">
          Platform Navigation
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobileNav}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-blue-600/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-100 hover:bg-wellqc-card/60"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </div>
              {item.highlight && !isActive && (
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-3 border-t border-wellqc-border bg-wellqc-dark/50">
        <div className="flex items-center justify-between text-xs text-wellqc-muted font-mono">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span>Engine Ready</span>
          </div>
          <span className="text-[10px] text-slate-500">v2.4.0-Enterprise</span>
        </div>
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
