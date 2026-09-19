"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Users, Key, Webhook, RefreshCw, ChevronDown, Trash2, ShieldCheck, AlertTriangle } from "lucide-react";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
  createdAt: string;
}

const ROLES = ["ADMIN", "PETROPHYSICIST", "DATA_ENGINEER", "GEOSCIENTIST", "VIEWER"] as const;
type Role = (typeof ROLES)[number];

const ROLE_COLORS: Record<Role, string> = {
  ADMIN:          "bg-red-500/15 text-red-300 border-red-500/30",
  PETROPHYSICIST: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  DATA_ENGINEER:  "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  GEOSCIENTIST:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  VIEWER:         "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export default function AdminPanelPage() {
  const [users, setUsers]           = useState<UserRecord[]>([]);
  const [activeTab, setActiveTab]   = useState<"USERS" | "TOKENS" | "WEBHOOKS">("USERS");
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState("");
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [savingId, setSavingId]     = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      try {
        const res  = await fetch("/api/admin/users", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load users.");
        if (!cancelled) setUsers(data.users || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load users.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadUsers();
    return () => { cancelled = true; };
  }, []);

  async function handleRoleChange(userId: string, newRole: string) {
    setSavingId(userId);
    try {
      const res  = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update role.");
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
      showToast(`Role updated to ${newRole}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update role.", false);
    } finally {
      setSavingId(null);
      setEditingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res  = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: deleteTarget.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user.");
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      showToast(`${deleteTarget.name} has been deleted.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete user.", false);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-wellqc-panel/60 border border-wellqc-border p-5 rounded-2xl">
          <div>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
              Module 10 - Enterprise Administration
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              Admin &amp; System Access Control Center
            </h1>
            <p className="text-xs text-wellqc-muted font-mono mt-0.5">
              Database-backed user, token, and webhook administration.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center space-x-2 border-b border-wellqc-border pb-3 overflow-x-auto">
          <TabButton active={activeTab === "USERS"} onClick={() => setActiveTab("USERS")} icon={<Users className="w-4 h-4" />} label={`Users & RBAC Roles (${users.length})`} />
          <TabButton active={activeTab === "TOKENS"} onClick={() => setActiveTab("TOKENS")} icon={<Key className="w-4 h-4" />} label="API Access Tokens" />
          <TabButton active={activeTab === "WEBHOOKS"} onClick={() => setActiveTab("WEBHOOKS")} icon={<Webhook className="w-4 h-4" />} label="System Webhook Dispatches" />
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Users tab */}
        {activeTab === "USERS" && (
          <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-xl">
            {isLoading ? (
              <div className="p-8 text-center text-cyan-300 text-xs font-mono flex items-center justify-center">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Loading users from database...
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-xs text-wellqc-muted font-mono">
                No database users found yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-wellqc-card border-b border-wellqc-border text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="p-4">User Name</th>
                      <th className="p-4">Email Address</th>
                      <th className="p-4">Department</th>
                      <th className="p-4">Assigned Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-wellqc-border text-slate-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-wellqc-card/60 transition-colors group">
                        {/* Name */}
                        <td className="p-4 font-bold text-white">
                          <div className="flex items-center gap-2">
                            {user.role === "ADMIN" && <ShieldCheck className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                            {user.name}
                          </div>
                        </td>

                        {/* Email */}
                        <td className="p-4 text-slate-400">{user.email}</td>

                        {/* Department */}
                        <td className="p-4 text-slate-300">{user.department}</td>

                        {/* Role — inline dropdown */}
                        <td className="p-4">
                          {editingId === user.id ? (
                            <div className="relative">
                              <select
                                id={`role-select-${user.id}`}
                                autoFocus
                                defaultValue={user.role}
                                disabled={savingId === user.id}
                                onBlur={() => setEditingId(null)}
                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                className="appearance-none bg-slate-800 border border-purple-500/50 text-purple-200 text-xs font-mono rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                              >
                                {ROLES.map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                              <ChevronDown className="w-3 h-3 text-purple-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          ) : (
                            <button
                              id={`role-badge-${user.id}`}
                              onClick={() => setEditingId(user.id)}
                              title="Click to change role"
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-bold transition-all hover:brightness-125 ${ROLE_COLORS[user.role as Role] ?? "bg-slate-700 text-slate-300 border-slate-600"}`}
                            >
                              {savingId === user.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  {user.role}
                                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                                </>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Status */}
                        <td className="p-4">
                          <span className="text-emerald-400 font-bold text-[11px]">{user.status}</span>
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-right">
                          <button
                            id={`delete-user-${user.id}`}
                            onClick={() => setDeleteTarget(user)}
                            title="Delete user"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-wellqc-card hover:bg-red-500/20 text-slate-400 hover:text-red-300 text-xs border border-wellqc-border hover:border-red-500/30 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "TOKENS" && (
          <AdminEmptyPanel title="Active Enterprise API Authentication Tokens" action="+ Generate API Token" message="API token records will appear here after token creation is connected." />
        )}
        {activeTab === "WEBHOOKS" && (
          <AdminEmptyPanel title="Configured Webhook Endpoints" action="+ Register Webhook" message="Webhook endpoint records will appear here after webhook registration is connected." />
        )}
      </div>

      {/* ── Delete Confirmation Modal ─────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete User Account</h3>
                <p className="text-xs text-slate-400 mt-1">
                  This will permanently remove <span className="font-bold text-white">{deleteTarget.name}</span> and all associated data from the platform. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-xs font-mono space-y-1">
              <div className="flex justify-between"><span className="text-slate-400">Email</span><span className="text-white">{deleteTarget.email}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Role</span><span className={`px-1.5 rounded font-bold ${ROLE_COLORS[deleteTarget.role as Role]}`}>{deleteTarget.role}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Department</span><span className="text-white">{deleteTarget.department}</span></div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                id="confirm-delete-user"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold text-sm transition-all"
              >
                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {isDeleting ? "Deleting…" : "Yes, Delete User"}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm border border-slate-700 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-mono border transition-all ${toast.ok ? "bg-emerald-900/80 border-emerald-500/40 text-emerald-200" : "bg-red-900/80 border-red-500/40 text-red-200"}`}>
          {toast.ok ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
          {toast.msg}
        </div>
      )}
    </AppShell>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap ${active ? "bg-purple-600/20 text-purple-300 border border-purple-500/40" : "text-slate-400 hover:text-white"}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function AdminEmptyPanel({ title, action, message }: { title: string; action: string; message: string }) {
  return (
    <div className="bg-wellqc-panel border border-wellqc-border p-6 rounded-2xl space-y-4 font-mono text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-wellqc-border">
        <h3 className="text-base font-bold text-white">{title}</h3>
        <button className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold">{action}</button>
      </div>
      <div className="p-4 bg-wellqc-card border border-wellqc-border rounded-xl text-wellqc-muted">{message}</div>
    </div>
  );
}
