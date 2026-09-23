"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ActivityListItem } from "@/lib/api-types";
import { History, Search, RefreshCw } from "lucide-react";

export default function ActivityLogPage() {
  const [activities, setActivities] = useState<ActivityListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadActivity() {
      try {
        const response = await fetch("/api/activity", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load activity.");
        }

        if (!cancelled) {
          setActivities(data.activities || []);
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

    loadActivity();

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

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-wellqc-panel/60 border border-wellqc-border p-5 rounded-2xl">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-blue-500/20 text-cyan-300 border border-cyan-500/40">
                Module 09 - Audit Trail & Security
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              Platform Activity & Audit Logs
            </h1>
            <p className="text-xs text-wellqc-muted font-mono mt-0.5">
              Real activity from database commits, LAS uploads, exports, and well-management actions.
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
                Commit a LAS file or create a well asset to populate the audit log.
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
