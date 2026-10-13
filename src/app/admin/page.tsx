"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { safeReadJson } from "@/lib/http-client";
import {
  Users,
  Key,
  Webhook,
  RefreshCw,
  ChevronDown,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Mail,
  Send,
  Eye,
  EyeOff,
  Sparkles,
  Check,
  Server,
  HelpCircle,
  Search,
  CheckSquare,
  X,
  Copy,
  Plus,
} from "lucide-react";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
  createdAt: string;
}

interface TokenItem {
  id: string;
  name: string;
  maskedToken: string;
  userId: string;
  userName: string;
  userEmail: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  maskedSecret: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

const ROLES = ["ADMIN", "PETROPHYSICIST", "DATA_ENGINEER", "GEOSCIENTIST", "VIEWER"] as const;
type Role = (typeof ROLES)[number];

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: "bg-red-500/15 text-red-300 border-red-500/30",
  PETROPHYSICIST: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  DATA_ENGINEER: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  GEOSCIENTIST: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  VIEWER: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export default function AdminPanelPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"USERS" | "TOKENS" | "WEBHOOKS" | "EMAIL">("USERS");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Bulk User Management State
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Email & Notifications Settings State
  const [emailConfig, setEmailConfig] = useState<{
    provider: "EMAILJS" | "RESEND" | "DEV_LOGGER";
    emailjs_service_id: string;
    emailjs_template_id: string;
    emailjs_reset_template_id: string;
    emailjs_public_key: string;
    emailjs_private_key: string;
    emailjs_private_key_configured?: boolean;
    emailjs_private_key_masked?: string;
    resend_api_key: string;
    resend_api_key_configured?: boolean;
    resend_api_key_masked?: string;
    resend_from_email: string;
  }>({
    provider: "EMAILJS",
    emailjs_service_id: "",
    emailjs_template_id: "",
    emailjs_reset_template_id: "",
    emailjs_public_key: "",
    emailjs_private_key: "",
    resend_api_key: "",
    resend_from_email: "WellQC <onboarding@resend.dev>",
  });
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showEmailJsSecret, setShowEmailJsSecret] = useState(false);
  const [showResendSecret, setShowResendSecret] = useState(false);

  // Token Management State
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [showCreateTokenModal, setShowCreateTokenModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenUserId, setNewTokenUserId] = useState("");
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [revealedRawToken, setRevealedRawToken] = useState<string | null>(null);

  // Webhook Management State
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [isLoadingWebhooks, setIsLoadingWebhooks] = useState(false);
  const [showCreateWebhookModal, setShowCreateWebhookModal] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([
    "WELL_INGESTED",
    "QA_REPORT_GENERATED",
  ]);
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  async function handleCopy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeyId(id);
      setTimeout(() => setCopiedKeyId(null), 2000);
      showToast("Copied to clipboard!");
    } catch {
      showToast("Failed to copy to clipboard.", false);
    }
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadTokens() {
    setIsLoadingTokens(true);
    try {
      const res = await fetch("/api/admin/tokens", { cache: "no-store" });
      const result = await safeReadJson<{ tokens?: TokenItem[] }>(res);
      if (result.ok && result.data?.tokens) {
        setTokens(result.data.tokens);
      }
    } catch (err) {
      console.error("Failed to load tokens:", err);
    } finally {
      setIsLoadingTokens(false);
    }
  }

  async function handleCreateToken(e: React.FormEvent) {
    e.preventDefault();
    if (!newTokenName.trim()) {
      showToast("Token name is required.", false);
      return;
    }
    setIsCreatingToken(true);
    try {
      const res = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTokenName.trim(),
          userId: newTokenUserId || undefined,
        }),
      });
      const result = await safeReadJson<{ success?: boolean; token?: { rawToken: string } }>(res);
      if (!result.ok) throw new Error(result.error || "Failed to create API token.");
      setShowCreateTokenModal(false);
      if (result.data?.token?.rawToken) {
        setRevealedRawToken(result.data.token.rawToken);
      }
      setNewTokenName("");
      showToast("API token created successfully!");
      loadTokens();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create token.", false);
    } finally {
      setIsCreatingToken(false);
    }
  }

  async function handleRevokeToken(tokenId: string, tokenName: string) {
    try {
      const res = await fetch(`/api/admin/tokens/${tokenId}`, { method: "DELETE" });
      const result = await safeReadJson<{ success?: boolean; message?: string }>(res);
      if (!result.ok) throw new Error(result.error || "Failed to revoke token.");
      setTokens((prev) => prev.filter((t) => t.id !== tokenId));
      showToast(result.data?.message || `API token '${tokenName}' revoked.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to revoke token.", false);
    }
  }

  async function loadWebhooks() {
    setIsLoadingWebhooks(true);
    try {
      const res = await fetch("/api/admin/webhooks", { cache: "no-store" });
      const result = await safeReadJson<{ webhooks?: WebhookItem[] }>(res);
      if (result.ok && result.data?.webhooks) {
        setWebhooks(result.data.webhooks);
      }
    } catch (err) {
      console.error("Failed to load webhooks:", err);
    } finally {
      setIsLoadingWebhooks(false);
    }
  }

  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!newWebhookName.trim() || !newWebhookUrl.trim()) {
      showToast("Name and destination URL are required.", false);
      return;
    }
    if (newWebhookEvents.length === 0) {
      showToast("Select at least one event trigger.", false);
      return;
    }
    setIsCreatingWebhook(true);
    try {
      const res = await fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWebhookName.trim(),
          url: newWebhookUrl.trim(),
          events: newWebhookEvents,
        }),
      });
      const result = await safeReadJson<{ success?: boolean }>(res);
      if (!result.ok) throw new Error(result.error || "Failed to register webhook.");
      setShowCreateWebhookModal(false);
      setNewWebhookName("");
      setNewWebhookUrl("");
      showToast("Webhook registered successfully!");
      loadWebhooks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to register webhook.", false);
    } finally {
      setIsCreatingWebhook(false);
    }
  }

  async function handleDeleteWebhook(webhookId: string, webhookName: string) {
    try {
      const res = await fetch(`/api/admin/webhooks/${webhookId}`, { method: "DELETE" });
      const result = await safeReadJson<{ success?: boolean; message?: string }>(res);
      if (!result.ok) throw new Error(result.error || "Failed to delete webhook.");
      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
      showToast(result.data?.message || `Webhook '${webhookName}' removed.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete webhook.", false);
    }
  }

  async function handleTestWebhook(webhookId: string) {
    setTestingWebhookId(webhookId);
    try {
      const res = await fetch(`/api/admin/webhooks/${webhookId}/test`, { method: "POST" });
      const result = await safeReadJson<{ success?: boolean; message?: string }>(res);
      if (!result.ok) throw new Error(result.error || "Test ping failed.");
      showToast(result.data?.message || "Test ping successful!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Test ping failed.", false);
    } finally {
      setTestingWebhookId(null);
    }
  }

  async function loadEmailSettings() {
    setIsLoadingEmail(true);
    try {
      const res = await fetch("/api/admin/email-settings", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setEmailConfig({
          provider: data.provider || "EMAILJS",
          emailjs_service_id: data.emailjs_service_id || "",
          emailjs_template_id: data.emailjs_template_id || "",
          emailjs_reset_template_id: data.emailjs_reset_template_id || "",
          emailjs_public_key: data.emailjs_public_key || "",
          emailjs_private_key: "",
          emailjs_private_key_configured: data.emailjs_private_key_configured,
          emailjs_private_key_masked: data.emailjs_private_key_masked,
          resend_api_key: "",
          resend_api_key_configured: data.resend_api_key_configured,
          resend_api_key_masked: data.resend_api_key_masked,
          resend_from_email: data.resend_from_email || "WellQC <onboarding@resend.dev>",
        });
      }
    } catch (err) {
      console.error("Failed to load email settings:", err);
    } finally {
      setIsLoadingEmail(false);
    }
  }

  async function handleSaveEmailSettings(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingEmail(true);
    try {
      const res = await fetch("/api/admin/email-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailConfig),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Failed to update email settings.");
      showToast(data.message || "Email settings saved successfully!");
      loadEmailSettings();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save email settings.", false);
    } finally {
      setIsSavingEmail(false);
    }
  }

  async function handleSendTestEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!testRecipient || !testRecipient.includes("@")) {
      showToast("Please enter a valid test recipient email address.", false);
      return;
    }
    setIsTestingEmail(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/email-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...emailConfig,
          targetEmail: testRecipient,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({ ok: false, msg: data.detail || data.error || "Test dispatch failed." });
      } else {
        setTestResult({ ok: true, msg: data.message || "Test email dispatched successfully!" });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        msg: err instanceof Error ? err.message : "Test dispatch failed due to a network error.",
      });
    } finally {
      setIsTestingEmail(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      try {
        const [usersRes, meRes] = await Promise.all([
          fetch("/api/admin/users", { cache: "no-store" }),
          fetch("/api/auth/me", { cache: "no-store" }),
        ]);

        const usersResult = await safeReadJson<{ users?: UserRecord[] }>(usersRes);
        if (!usersResult.ok) throw new Error(usersResult.error || "Unable to load users.");
        if (!cancelled) setUsers(usersResult.data?.users || []);

        if (meRes.ok) {
          const meResult = await safeReadJson<{ user?: { id: string } }>(meRes);
          if (!cancelled && meResult.data?.user?.id) {
            setCurrentUserId(meResult.data.user.id);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load users.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadUsers();
    return () => { cancelled = true; };
  }, []);

  // Filtered users based on optional search query
  const filteredUsers = users.filter((u) => {
    if (!userSearchQuery) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q)
    );
  });

  const deletableUsers = filteredUsers.filter((u) => u.id !== currentUserId);
  const isAllSelected = deletableUsers.length > 0 && deletableUsers.every((u) => selectedUserIds.includes(u.id));
  const isSomeSelected = selectedUserIds.length > 0 && !isAllSelected;

  function handleToggleSelectAll() {
    if (isAllSelected) {
      // Unselect all currently filtered deletable users
      const deletableIdSet = new Set(deletableUsers.map((u) => u.id));
      setSelectedUserIds((prev) => prev.filter((id) => !deletableIdSet.has(id)));
    } else {
      // Select all currently filtered deletable users
      const newIds = new Set([...selectedUserIds, ...deletableUsers.map((u) => u.id)]);
      setSelectedUserIds(Array.from(newIds));
    }
  }

  function handleToggleSelectUser(userId: string) {
    if (userId === currentUserId) return;
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleBulkDelete() {
    if (selectedUserIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const res = await fetch("/api/admin/users/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedUserIds }),
      });
      const result = await safeReadJson<{ success?: boolean; deletedCount?: number; message?: string }>(res);
      if (!result.ok) throw new Error(result.error || "Failed to bulk delete users.");
      const count = result.data?.deletedCount || selectedUserIds.length;
      setUsers((prev) => prev.filter((u) => !selectedUserIds.includes(u.id)));
      setSelectedUserIds([]);
      setShowBulkDeleteModal(false);
      showToast(result.data?.message || `Successfully removed ${count} user(s).`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to bulk delete users.", false);
    } finally {
      setIsBulkDeleting(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setSavingId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const result = await safeReadJson<{ user?: { role: string } }>(res);
      if (!result.ok) throw new Error(result.error || "Failed to update role.");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
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
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: deleteTarget.id }),
      });
      const result = await safeReadJson<{ success?: boolean; message?: string }>(res);
      if (!result.ok) throw new Error(result.error || "Failed to delete user.");
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setSelectedUserIds((prev) => prev.filter((id) => id !== deleteTarget.id));
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
          <TabButton active={activeTab === "EMAIL"} onClick={() => { setActiveTab("EMAIL"); loadEmailSettings(); }} icon={<Mail className="w-4 h-4" />} label="Email & Notifications" />
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
          <div className="space-y-4">
            {/* Top Toolbar: Search & Quick Counts */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-wellqc-panel/60 border border-wellqc-border p-4 rounded-2xl">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter by name, email, department or role..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-wellqc-card border border-wellqc-border rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                />
                {userSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setUserSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                    title="Clear filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-wellqc-muted">
                <span>Showing <strong className="text-white">{filteredUsers.length}</strong> of {users.length} accounts</span>
              </div>
            </div>

            {/* Bulk Action Bar (Visible when one or more users are selected) */}
            {selectedUserIds.length > 0 && (
              <div className="bg-cyan-950/40 border border-cyan-500/40 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-cyan-500/5 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-mono font-bold text-white">
                      {selectedUserIds.length} user{selectedUserIds.length === 1 ? "" : "s"} selected
                    </span>
                    <p className="text-[11px] text-cyan-300/80 font-mono">
                      Bulk select unwanted or test accounts for removal
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUserIds([])}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700 transition-colors cursor-pointer"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    id="bulk-delete-users-btn"
                    onClick={() => setShowBulkDeleteModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold shadow-md shadow-red-600/30 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Selected ({selectedUserIds.length})
                  </button>
                </div>
              </div>
            )}

            {/* Users Table */}
            <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-xl">
              {isLoading ? (
                <div className="p-8 text-center text-cyan-300 text-xs font-mono flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Loading users from database...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-xs text-wellqc-muted font-mono">
                  {userSearchQuery ? "No accounts match the current search filter." : "No database users found yet."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-wellqc-card border-b border-wellqc-border text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="p-4 w-12 text-center">
                          <input
                            type="checkbox"
                            id="select-all-users-checkbox"
                            checked={isAllSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = isSomeSelected;
                            }}
                            onChange={handleToggleSelectAll}
                            disabled={deletableUsers.length === 0}
                            aria-label="Select all deletable users"
                            className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-500/40 accent-cyan-400 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </th>
                        <th className="p-4">User Name</th>
                        <th className="p-4">Email Address</th>
                        <th className="p-4">Department</th>
                        <th className="p-4">Assigned Role</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-wellqc-border text-slate-200">
                      {filteredUsers.map((user) => {
                        const isSelected = selectedUserIds.includes(user.id);
                        const isSelf = user.id === currentUserId;

                        return (
                          <tr
                            key={user.id}
                            className={`hover:bg-wellqc-card/60 transition-colors group ${isSelected ? "bg-cyan-950/20" : ""
                              }`}
                          >
                            {/* Checkbox column */}
                            <td className="p-4 text-center">
                              <input
                                type="checkbox"
                                id={`select-user-${user.id}`}
                                checked={isSelected}
                                disabled={isSelf}
                                onChange={() => handleToggleSelectUser(user.id)}
                                aria-label={`Select user ${user.name}`}
                                title={isSelf ? "You cannot select or delete your own account" : undefined}
                                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-500/40 accent-cyan-400 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              />
                            </td>

                            {/* Name */}
                            <td className="p-4 font-bold text-white">
                              <div className="flex items-center gap-2">
                                {user.role === "ADMIN" && <ShieldCheck className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                                <span>{user.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    You
                                  </span>
                                )}
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
                                disabled={isSelf}
                                title={isSelf ? "Cannot delete yourself" : "Delete user"}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-wellqc-card hover:bg-red-500/20 text-slate-400 hover:text-red-300 text-xs border border-wellqc-border hover:border-red-500/30 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Email & Notifications tab */}
        {activeTab === "EMAIL" && (
          <div className="space-y-6">
            <div className="bg-wellqc-panel border border-wellqc-border p-6 rounded-2xl shadow-xl space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wellqc-border pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      Module 10.4
                    </span>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      Transactional Email &amp; Verification Dispatch
                    </h2>
                  </div>
                  <p className="text-xs text-wellqc-muted font-mono mt-1">
                    Configure your delivery provider for user verification links, password resets, and regulatory alerts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadEmailSettings}
                  disabled={isLoadingEmail}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-wellqc-card hover:bg-slate-800 text-slate-300 text-xs font-mono border border-wellqc-border transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEmail ? "animate-spin" : ""}`} />
                  Refresh Settings
                </button>
              </div>

              {isLoadingEmail ? (
                <div className="p-12 text-center text-cyan-300 text-xs font-mono flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Loading email configuration...
                </div>
              ) : (
                <form onSubmit={handleSaveEmailSettings} className="space-y-6">
                  {/* Provider Selection Cards */}
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-3">
                      Select Active Email Dispatch Provider
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* EmailJS Card */}
                      <div
                        onClick={() => setEmailConfig((prev) => ({ ...prev, provider: "EMAILJS" }))}
                        className={`cursor-pointer p-4 rounded-xl border transition-all relative overflow-hidden ${emailConfig.provider === "EMAILJS"
                            ? "bg-cyan-950/30 border-cyan-500/60 ring-1 ring-cyan-500/40 shadow-lg shadow-cyan-500/5"
                            : "bg-wellqc-card/40 border-wellqc-border hover:border-slate-700"
                          }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                              <Sparkles className="w-4 h-4 text-cyan-300" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white">EmailJS</h4>
                              <span className="text-[10px] font-mono text-cyan-400 font-bold">Recommended</span>
                            </div>
                          </div>
                          {emailConfig.provider === "EMAILJS" && (
                            <div className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-3 leading-relaxed">
                          Routes via your connected Gmail, Outlook, or SMTP account. Delivers to <strong>any recipient email</strong> without custom domain DNS verification.
                        </p>
                      </div>

                      {/* Resend Card */}
                      <div
                        onClick={() => setEmailConfig((prev) => ({ ...prev, provider: "RESEND" }))}
                        className={`cursor-pointer p-4 rounded-xl border transition-all relative overflow-hidden ${emailConfig.provider === "RESEND"
                            ? "bg-purple-950/30 border-purple-500/60 ring-1 ring-purple-500/40 shadow-lg shadow-purple-500/5"
                            : "bg-wellqc-card/40 border-wellqc-border hover:border-slate-700"
                          }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                              <Mail className="w-4 h-4 text-purple-300" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white">Resend</h4>
                              <span className="text-[10px] font-mono text-purple-400">REST API</span>
                            </div>
                          </div>
                          {emailConfig.provider === "RESEND" && (
                            <div className="w-5 h-5 rounded-full bg-purple-500 text-slate-950 flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-3 leading-relaxed">
                          Direct dispatch via Resend REST API. Note: Free onboarding domain only delivers to the owner's account; requires verified domain for all public recipients.
                        </p>
                      </div>

                      {/* Terminal Dev Logger */}
                      <div
                        onClick={() => setEmailConfig((prev) => ({ ...prev, provider: "DEV_LOGGER" }))}
                        className={`cursor-pointer p-4 rounded-xl border transition-all relative overflow-hidden ${emailConfig.provider === "DEV_LOGGER"
                            ? "bg-emerald-950/30 border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-lg shadow-emerald-500/5"
                            : "bg-wellqc-card/40 border-wellqc-border hover:border-slate-700"
                          }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                              <Server className="w-4 h-4 text-emerald-300" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white">Dev Logger</h4>
                              <span className="text-[10px] font-mono text-emerald-400">Offline / Testing</span>
                            </div>
                          </div>
                          {emailConfig.provider === "DEV_LOGGER" && (
                            <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-3 leading-relaxed">
                          Simulates email dispatch by outputting prominent highlighted verification links directly to the local backend terminal console.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Provider Detailed Fields */}
                  {emailConfig.provider === "EMAILJS" && (
                    <div className="space-y-4 bg-wellqc-card/30 border border-cyan-500/30 p-5 rounded-2xl">
                      <div className="flex items-center justify-between border-b border-wellqc-border pb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-cyan-400" />
                          <h3 className="text-sm font-bold text-white">EmailJS API Credentials</h3>
                        </div>
                        <a
                          href="https://dashboard.emailjs.com/admin/account"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono underline flex items-center gap-1"
                        >
                          Find keys on EmailJS Dashboard &rarr;
                        </a>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                        {/* Service ID */}
                        <div>
                          <label className="block text-slate-300 mb-1 font-bold">
                            Service ID <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={emailConfig.emailjs_service_id}
                            onChange={(e) => setEmailConfig((prev) => ({ ...prev, emailjs_service_id: e.target.value }))}
                            placeholder="e.g. service_xyz123"
                            className="w-full bg-slate-900 border border-wellqc-border focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-slate-200 placeholder-slate-500 outline-none transition-all"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Found under EmailJS &gt; Email Services.</p>
                        </div>

                        {/* Primary Template ID */}
                        <div>
                          <label className="block text-slate-300 mb-1 font-bold">
                            Primary / Universal Template ID <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={emailConfig.emailjs_template_id}
                            onChange={(e) => setEmailConfig((prev) => ({ ...prev, emailjs_template_id: e.target.value }))}
                            placeholder="e.g. template_abc456"
                            className="w-full bg-slate-900 border border-wellqc-border focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-slate-200 placeholder-slate-500 outline-none transition-all"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Universal template for verification, welcome &amp; system alerts.</p>
                        </div>

                        {/* Password Reset Template ID (Optional) */}
                        <div>
                          <label className="block text-slate-300 mb-1 font-bold">
                            Password Reset Template ID <span className="text-slate-500 font-normal">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            value={emailConfig.emailjs_reset_template_id}
                            onChange={(e) => setEmailConfig((prev) => ({ ...prev, emailjs_reset_template_id: e.target.value }))}
                            placeholder="e.g. template_reset789 (leave blank for universal)"
                            className="w-full bg-slate-900 border border-wellqc-border focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-slate-200 placeholder-slate-500 outline-none transition-all"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Leave empty if using our Universal Dynamic Template with {"{{{email_html}}}"}.</p>
                        </div>

                        {/* Public Key */}
                        <div>
                          <label className="block text-slate-300 mb-1 font-bold">
                            Public Key (User ID) <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={emailConfig.emailjs_public_key}
                            onChange={(e) => setEmailConfig((prev) => ({ ...prev, emailjs_public_key: e.target.value }))}
                            placeholder="e.g. user_abcdef123456"
                            className="w-full bg-slate-900 border border-wellqc-border focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-slate-200 placeholder-slate-500 outline-none transition-all"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Account &gt; API Keys &gt; Public Key.</p>
                        </div>

                        {/* Private Key / Access Token */}
                        <div>
                          <label className="block text-slate-300 mb-1 font-bold">
                            Private Key (Access Token)
                            {emailConfig.emailjs_private_key_configured && (
                              <span className="ml-2 text-[10px] text-emerald-400 font-normal">
                                (Configured: {emailConfig.emailjs_private_key_masked})
                              </span>
                            )}
                          </label>
                          <div className="relative">
                            <input
                              type={showEmailJsSecret ? "text" : "password"}
                              value={emailConfig.emailjs_private_key}
                              onChange={(e) => setEmailConfig((prev) => ({ ...prev, emailjs_private_key: e.target.value }))}
                              placeholder={emailConfig.emailjs_private_key_configured ? "Leave blank to keep current key" : "Optional or from API Keys"}
                              className="w-full bg-slate-900 border border-wellqc-border focus:border-cyan-500 rounded-xl px-3.5 py-2.5 pr-10 text-slate-200 placeholder-slate-500 outline-none transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowEmailJsSecret(!showEmailJsSecret)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                              {showEmailJsSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Optional. Required if "Strict mode" is enabled in EmailJS Account Security.</p>
                        </div>
                      </div>

                      {/* Security Warning Box for Non-Browser API Access */}
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-1 text-[11px] font-mono text-amber-200">
                        <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Mandatory EmailJS Account Setting
                        </div>
                        <p className="text-amber-200/90 leading-relaxed">
                          In your EmailJS Dashboard under{" "}
                          <a
                            href="https://dashboard.emailjs.com/admin/account/security"
                            target="_blank"
                            rel="noreferrer"
                            className="underline font-bold text-amber-300 hover:text-white"
                          >
                            Account &gt; Security
                          </a>
                          , you must enable <strong>&ldquo;Allow EmailJS API for non-browser applications&rdquo;</strong>. Otherwise, EmailJS blocks backend server API requests with HTTP 403.
                        </p>
                      </div>

                      {/* Template Variables Reference Box */}
                      <div className="bg-slate-900/80 border border-cyan-500/20 rounded-xl p-3.5 space-y-2 text-[11px] font-mono text-slate-300">
                        <div className="flex items-center justify-between text-cyan-300 font-bold">
                          <div className="flex items-center gap-1.5">
                            <HelpCircle className="w-3.5 h-3.5" />
                            Universal Dynamic Template Setup (Recommended)
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            Renders Exact Code HTML
                          </span>
                        </div>
                        <p className="text-slate-400 leading-relaxed">
                          In your EmailJS template editor, set <strong>To Email</strong> to <code className="text-cyan-300 font-bold">{"{{to_email}}"}</code> and <strong>Subject</strong> to <code className="text-cyan-300 font-bold">{"{{subject}}"}</code>.
                          In the template content, place <code className="text-emerald-400 font-bold">{"{{{email_html}}}"}</code> (triple braces). The backend will automatically inject the exact tailored HTML for Verification, Password Reset, and Test emails!
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400 font-bold">{"{{{email_html}}}"}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">{"{{title}}"}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">{"{{email_message}}"}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">{"{{button_text}}"}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">{"{{action_url}}"}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">{"{{footer_note}}"}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {emailConfig.provider === "RESEND" && (
                    <div className="space-y-4 bg-wellqc-card/30 border border-purple-500/30 p-5 rounded-2xl">
                      <div className="flex items-center justify-between border-b border-wellqc-border pb-3">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-purple-400" />
                          <h3 className="text-sm font-bold text-white">Resend API Credentials</h3>
                        </div>
                        <a
                          href="https://resend.com/api-keys"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-purple-400 hover:text-purple-300 font-mono underline flex items-center gap-1"
                        >
                          Find keys on Resend Dashboard &rarr;
                        </a>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                        {/* API Key */}
                        <div>
                          <label className="block text-slate-300 mb-1 font-bold">
                            Resend API Key <span className="text-red-400">*</span>
                            {emailConfig.resend_api_key_configured && (
                              <span className="ml-2 text-[10px] text-emerald-400 font-normal">
                                (Configured: {emailConfig.resend_api_key_masked})
                              </span>
                            )}
                          </label>
                          <div className="relative">
                            <input
                              type={showResendSecret ? "text" : "password"}
                              value={emailConfig.resend_api_key}
                              onChange={(e) => setEmailConfig((prev) => ({ ...prev, resend_api_key: e.target.value }))}
                              placeholder={emailConfig.resend_api_key_configured ? "Leave blank to retain current key" : "re_..."}
                              className="w-full bg-slate-900 border border-wellqc-border focus:border-purple-500 rounded-xl px-3.5 py-2.5 pr-10 text-slate-200 placeholder-slate-500 outline-none transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowResendSecret(!showResendSecret)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                              {showResendSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Starts with re_</p>
                        </div>

                        {/* From Email */}
                        <div>
                          <label className="block text-slate-300 mb-1 font-bold">
                            Sender From Email Address
                          </label>
                          <input
                            type="text"
                            value={emailConfig.resend_from_email}
                            onChange={(e) => setEmailConfig((prev) => ({ ...prev, resend_from_email: e.target.value }))}
                            placeholder="WellQC <onboarding@resend.dev>"
                            className="w-full bg-slate-900 border border-wellqc-border focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-slate-200 placeholder-slate-500 outline-none transition-all"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Requires verified domain in Resend for public recipients.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Live Dispatch Test Card */}
                  <div className="bg-slate-900/60 border border-wellqc-border p-5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-cyan-400" />
                        <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                          Test Email Delivery
                        </h4>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        Sends a test verification email using the keys entered above
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <input
                        type="email"
                        value={testRecipient}
                        onChange={(e) => setTestRecipient(e.target.value)}
                        placeholder="Enter your email to test (e.g. you@company.com)"
                        className="flex-1 bg-wellqc-panel border border-wellqc-border focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-200 placeholder-slate-500 outline-none w-full"
                      />
                      <button
                        type="button"
                        onClick={handleSendTestEmail}
                        disabled={isTestingEmail || !testRecipient}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-300 font-mono text-xs font-bold border border-cyan-500/30 transition-all"
                      >
                        {isTestingEmail ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        {isTestingEmail ? "Sending Test…" : "Send Test Email"}
                      </button>
                    </div>

                    {testResult && (
                      <div
                        className={`p-3 rounded-xl border text-xs font-mono flex items-start gap-2.5 ${testResult.ok
                            ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                            : "bg-red-950/40 border-red-500/40 text-red-200"
                          }`}
                      >
                        {testResult.ok ? (
                          <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-bold">{testResult.ok ? "Success" : "Delivery Error"}</div>
                          <div className="text-[11px] opacity-90 mt-0.5">{testResult.msg}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Submit / Save Bar */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSavingEmail}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-60 text-slate-950 font-bold font-mono text-xs shadow-lg shadow-cyan-500/20 transition-all"
                    >
                      {isSavingEmail ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      {isSavingEmail ? "Saving Configuration…" : "Save Email Configuration"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {activeTab === "TOKENS" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl shadow-xl">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-cyan-400" />
                  Enterprise API Authentication Tokens
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Manage cryptographically signed bearer tokens for automated LAS ingestion pipelines, Python SDK clients, and CI/CD workflows.
                </p>
              </div>
              <button
                type="button"
                id="generate-api-token-btn"
                onClick={() => setShowCreateTokenModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold font-mono text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Generate API Token
              </button>
            </div>

            <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-xl">
              {isLoadingTokens ? (
                <div className="p-8 text-center text-cyan-300 text-xs font-mono flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Loading API tokens from database...
                </div>
              ) : tokens.length === 0 ? (
                <div className="p-12 text-center space-y-3 font-mono">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Key className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">No API Tokens Generated</h4>
                  <p className="text-xs text-wellqc-muted max-w-md mx-auto">
                    Create an enterprise API token to allow headless petrophysical analytics scripts and automated batch tools to access WellQC.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateTokenModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold border border-cyan-500/30 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Generate First Token
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-wellqc-card border-b border-wellqc-border text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="p-4">Token Name</th>
                        <th className="p-4">Masked Key Identifier</th>
                        <th className="p-4">Assigned User</th>
                        <th className="p-4">Last Used</th>
                        <th className="p-4">Created</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-wellqc-border text-slate-200">
                      {tokens.map((t) => (
                        <tr key={t.id} className="hover:bg-wellqc-card/60 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Key className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <span className="font-bold text-white">{t.name}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300">
                              <span>{t.maskedToken}</span>
                              <button
                                type="button"
                                title="Copy masked identifier"
                                onClick={() => handleCopy(t.maskedToken, t.id)}
                                className="text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                              >
                                {copiedKeyId === t.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="p-4">
                            <div>
                              <div className="font-bold text-white">{t.userName}</div>
                              <div className="text-[11px] text-slate-400">{t.userEmail}</div>
                            </div>
                          </td>
                          <td className="p-4 text-slate-400">
                            {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : "Never"}
                          </td>
                          <td className="p-4 text-slate-400">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleRevokeToken(t.id, t.name)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
                              title="Revoke Token"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "WEBHOOKS" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl shadow-xl">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Webhook className="w-4 h-4 text-purple-400" />
                  Configured Webhook Endpoints
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  WellQC dispatches HTTP POST events signed with HMAC-SHA256 headers whenever pipeline actions or anomalies occur.
                </p>
              </div>
              <button
                type="button"
                id="register-webhook-btn"
                onClick={() => setShowCreateWebhookModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold font-mono text-xs shadow-lg shadow-purple-500/20 transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Register Webhook
              </button>
            </div>

            <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-xl">
              {isLoadingWebhooks ? (
                <div className="p-8 text-center text-purple-300 text-xs font-mono flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Loading webhooks from database...
                </div>
              ) : webhooks.length === 0 ? (
                <div className="p-12 text-center space-y-3 font-mono">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Webhook className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">No Webhooks Configured</h4>
                  <p className="text-xs text-wellqc-muted max-w-md mx-auto">
                    Register a webhook endpoint to trigger automated Slack notifications, cloud functions, or custom logging pipelines.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateWebhookModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-bold border border-purple-500/30 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Register First Webhook
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-wellqc-card border-b border-wellqc-border text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="p-4">Webhook Name & Target URL</th>
                        <th className="p-4">Subscribed Events</th>
                        <th className="p-4">HMAC Secret</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-wellqc-border text-slate-200">
                      {webhooks.map((w) => (
                        <tr key={w.id} className="hover:bg-wellqc-card/60 transition-colors">
                          <td className="p-4">
                            <div className="space-y-1 max-w-md">
                              <div className="font-bold text-white flex items-center gap-2">
                                <Webhook className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                {w.name}
                              </div>
                              <div className="text-[11px] text-cyan-400 font-mono truncate" title={w.url}>
                                {w.url}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1.5">
                              {w.events.map((ev) => (
                                <span
                                  key={ev}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono"
                                >
                                  {ev}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-slate-400">
                            <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px]">
                              {w.maskedSecret}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleTestWebhook(w.id)}
                                disabled={testingWebhookId === w.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                              >
                                {testingWebhookId === w.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                                {testingWebhookId === w.id ? "Testing..." : "Test Ping"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteWebhook(w.id, w.name)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
                                title="Delete Webhook"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
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

      {/* ── Bulk Delete Confirmation Modal ─────────────────────────────── */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Bulk Delete {selectedUserIds.length} User Account{selectedUserIds.length === 1 ? "" : "s"}?
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  This will permanently remove the <span className="font-bold text-white">{selectedUserIds.length}</span> selected user accounts and revoke all associated workspace access. This action is irreversible.
                </p>
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 max-h-52 overflow-y-auto space-y-2 font-mono text-xs">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold px-1">
                Accounts queued for removal:
              </div>
              {users
                .filter((u) => selectedUserIds.includes(u.id))
                .map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800"
                  >
                    <div>
                      <span className="font-bold text-white text-xs">{u.name}</span>
                      <span className="text-slate-400 text-[11px] block">{u.email}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${ROLE_COLORS[u.role as Role] || "bg-slate-700 text-slate-300 border-slate-600"}`}
                    >
                      {u.role}
                    </span>
                  </div>
                ))}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                id="confirm-bulk-delete-users"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold text-sm transition-all shadow-lg shadow-red-600/30 cursor-pointer"
              >
                {isBulkDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {isBulkDeleting ? "Deleting Selected Users…" : `Yes, Delete ${selectedUserIds.length} Users`}
              </button>
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isBulkDeleting}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm border border-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generate Token Modal ─────────────────────────────────────────── */}
      {showCreateTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                Generate Enterprise API Token
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateTokenModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateToken} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  Token Name / Description *
                </label>
                <input
                  type="text"
                  required
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="e.g. Ingestion Pipeline Runner"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  Assign to User (Optional)
                </label>
                <select
                  value={newTokenUserId}
                  onChange={(e) => setNewTokenUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="">Current Administrator</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  API calls with this token inherit the permissions of the assigned user.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isCreatingToken}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                >
                  {isCreatingToken ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  {isCreatingToken ? "Generating..." : "Generate Token"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateTokenModal(false)}
                  disabled={isCreatingToken}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Revealed Raw Token Modal ─────────────────────────────────────── */}
      {revealedRawToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Save Your API Token</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Please copy this token immediately. For security reasons, <span className="font-bold text-cyan-300">it will not be shown again</span>.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-4 space-y-3 font-mono text-xs">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                Bearer API Token:
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-cyan-300 break-all select-all font-mono text-xs font-bold">
                {revealedRawToken}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(revealedRawToken, "revealed-token")}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold border border-cyan-500/30 transition-all cursor-pointer"
              >
                {copiedKeyId === "revealed-token" ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedKeyId === "revealed-token" ? "Copied to Clipboard!" : "Copy Token"}
              </button>
            </div>

            <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-200 font-mono">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Authenticate HTTP requests with header: <code className="text-white font-bold">Authorization: Bearer {revealedRawToken.slice(0, 12)}...</code></span>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setRevealedRawToken(null)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                I Have Copied & Saved My Token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Register Webhook Modal ───────────────────────────────────────── */}
      {showCreateWebhookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Webhook className="w-4 h-4 text-purple-400" />
                Register Webhook Endpoint
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateWebhookModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWebhook} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  Webhook Name *
                </label>
                <input
                  type="text"
                  required
                  value={newWebhookName}
                  onChange={(e) => setNewWebhookName(e.target.value)}
                  placeholder="e.g. Enterprise Slack Alerts"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  Target Endpoint URL (HTTPS) *
                </label>
                <input
                  type="url"
                  required
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder="https://hooks.example.com/services/..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-2">
                  Event Subscriptions *
                </label>
                <div className="space-y-2">
                  {[
                    { id: "WELL_INGESTED", label: "WELL_INGESTED (New LAS uploaded and ingested)" },
                    { id: "QA_REPORT_GENERATED", label: "QA_REPORT_GENERATED (Quality audit report signed)" },
                    { id: "ANOMALY_DETECTED", label: "ANOMALY_DETECTED (Curve null spike or depth gap detected)" },
                    { id: "USER_REGISTERED", label: "USER_REGISTERED (New user registered or onboarded)" },
                  ].map((ev) => {
                    const checked = newWebhookEvents.includes(ev.id);
                    return (
                      <label
                        key={ev.id}
                        className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewWebhookEvents((prev) => [...prev, ev.id]);
                            } else {
                              setNewWebhookEvents((prev) => prev.filter((x) => x !== ev.id));
                            }
                          }}
                          className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-purple-500/40 accent-purple-400 cursor-pointer"
                        />
                        <span className="text-slate-300 text-[11px] font-mono">{ev.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isCreatingWebhook}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-purple-500/20 disabled:opacity-50"
                >
                  {isCreatingWebhook ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Webhook className="w-4 h-4" />}
                  {isCreatingWebhook ? "Registering..." : "Register Webhook"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateWebhookModal(false)}
                  disabled={isCreatingWebhook}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
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
