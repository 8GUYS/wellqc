"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ActivityListItem } from "@/lib/api-types";
import { safeReadJson } from "@/lib/http-client";
import { History, Search, RefreshCw, ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ActivityLogPage() {
  const [activities, setActivities] = useState<ActivityListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAuthAndLoad() {
      try {
        // Verify user role
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        if (meRes.ok) {
          const meData = await meRes.json();
          const role = (meData?.user?.role || "").toUpperCase();
          if (role !== "ADMIN") {
            if (!cancelled) {
              setIsAdmin(false);
              setIsLoading(false);
            }
            return;
          }
          if (!cancelled) setIsAdmin(true);
        } else {
          if (!cancelled) {
            setIsAdmin(false);
            setIsLoading(false);
          }
          return;
        }

        // Fetch audit logs for admin
        const response = await fetch("/api/activity", { cache: "no-store" });
        const res = await safeReadJson<{ activities: ActivityListItem[] }>(response, "Unable to load activity.");

        if (!res.ok || !res.data) {
          throw new Error(res.error || "Unable to load activity.");
        }

        if (!cancelled) {
          setActivities(res.data.activities || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load activity.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    checkAuthAndLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = activities.filter((activity) => {
    const needle = searchQuery.toLowerCase();
    return (
      activity.userName.toLowerCase().includes(needle) ||
      activity.action.toLowerCase().includes(needle) ||
      activity.details.toLowerCase().includes(needle) ||
      activity.target.toLowerCase().includes(needle)
    );
  });

  if (isAdmin === false) {
    return (
      <AppShell>
        <div className="p-12 bg-wellqc-panel border border-red-500/30 rounded-2xl text-center space-y-4 max-w-lg mx-auto mt-12 shadow-2xl font-mono">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Administrator Access Required</h2>
            <p className="text-xs text-slate-400 mt-1">
              The Platform Audit Trail and security event logs are restricted exclusively to administrators.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/upload"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Data Upload Workstation</span>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-wellqc-panel/60 border border-wellqc-border p-5 rounded-2xl">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                Admin Audit Trail &amp; Security Logs
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              Platform Activity &amp; Audit Logs
            </h1>
            <p className="text-xs text-wellqc-muted font-mono mt-0.5">
              Live enterprise telemetry from database commits, LAS uploads, quality repairs, and security actions across all accounts.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-xs font-mono">
            {error}
          </div>
        )}

        <div className="bg-wellqc-panel border border-wellqc-border p-4 rounded-xl flex items-center space-x-4">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit trail by user, action, target, or details..."
            className="w-full bg-wellqc-card border border-wellqc-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-8 text-center text-cyan-300 text-xs font-mono flex items-center justify-center">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Loading audit trail...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <History className="w-8 h-8 text-cyan-400 mx-auto" />
              <div className="text-sm font-bold text-white">No activity yet</div>
              <p className="text-xs text-wellqc-muted font-mono">
                Platform actions and user operations will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-wellqc-card border-b border-wellqc-border text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">User Name</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Target Asset</th>
                    <th className="p-4">Details</th>
                    <th className="p-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wellqc-border text-slate-200">
                  {filtered.map((activity) => (
                    <tr key={activity.id} className="hover:bg-wellqc-card/60 transition-colors">
                      <td className="p-4 text-wellqc-muted font-bold">{activity.timestamp}</td>
                      <td className="p-4 font-bold text-white">{activity.userName}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold">
                          {activity.userRole}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-cyan-400">{activity.action}</td>
                      <td className="p-4 text-slate-300">{activity.target}</td>
                      <td className="p-4 text-slate-400">{activity.details}</td>
                      <td className="p-4 text-wellqc-muted">{activity.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
