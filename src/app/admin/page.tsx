"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { safeReadJson } from "@/lib/http-client";
import { ActivityListItem } from "@/lib/api-types";
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
  Eye,
  EyeOff,
  Check,
  Search,
  CheckSquare,
  X,
  Copy,
  Plus,
  Radio,
  History,
  Shield,
  Sparkles,
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

const ROLES = ["ADMIN", "USER"] as const;
type Role = (typeof ROLES)[number];

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  USER: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  PETROPHYSICIST: "bg-purple-500/10 text-purple-300 border-purple-500/30",
  DATA_ENGINEER: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  GEOSCIENTIST: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  VIEWER: "bg-slate-700/40 text-slate-400 border-slate-600/40",
};

interface PermissionDef {
  category: string;
  name: string;
  scope: "WORKSPACE" | "GLOBAL";
  description: string;
  roles: Record<Role, boolean>;
}

const CATEGORY_FILTERS = [
  "ALL",
  "Ingestion & Raw Logs",
  "Standardisation & Dictionaries",
  "Quality Engine & Repair",
  "Database & Asset Governance",
  "System & Administration",
] as const;

const PERMISSION_MATRIX: PermissionDef[] = [
  {
    category: "Ingestion & Raw Logs",
    name: "LAS Ingestion & Telemetry Parse (CWLS 2.0 / 3.0)",
    scope: "WORKSPACE",
    description: "Upload raw wireline/LWD log files, execute pre-check validation, and parse depth/time channels.",
    roles: { ADMIN: true, USER: true },
  },
  {
    category: "Ingestion & Raw Logs",
    name: "Header Metadata & Telemetry Overrides",
    scope: "WORKSPACE",
    description: "Modify well header metadata, API/UWI identifiers, operator name, surface coordinates, and KB elevation.",
    roles: { ADMIN: true, USER: true },
  },
  {
    category: "Ingestion & Raw Logs",
    name: "Batch Multi-Log Processing",
    scope: "WORKSPACE",
    description: "Queue and process multiple LAS log files concurrently with automated channel alignment.",
    roles: { ADMIN: true, USER: true },
  },
  {
    category: "Standardisation & Dictionaries",
    name: "Curve Standardisation (API RP 66)",
    scope: "WORKSPACE",
    description: "Map vendor mnemonics to standard families (GR, RES, DEN, NEU, SON, CALI) using deterministic rule chains.",
    roles: { ADMIN: true, USER: true },
  },
  {
    category: "Standardisation & Dictionaries",
    name: "Custom Mnemonic Aliases & Mapping",
    scope: "WORKSPACE",
    description: "Register and maintain custom vendor curve aliases for proprietary logging tools and service companies.",
    roles: { ADMIN: true, USER: true },
  },
  {
    category: "Quality Engine & Repair",
    name: "Automated Diagnostic Anomaly Auditing",
    scope: "WORKSPACE",
    description: "Execute QA anomaly detection routines: null intervals, sensor flatlines, spike sigma, and casing boundary jumps.",
    roles: { ADMIN: true, USER: true },
  },
  {
    category: "Quality Engine & Repair",
    name: "Algorithmic Repair & ML Imputation",
    scope: "WORKSPACE",
    description: "Execute KNN, Cubic Spline, Random Forest, and Gradient Boosting curve repair on degraded logging intervals.",
    roles: { ADMIN: true, USER: true },
  },
  {
    category: "Quality Engine & Repair",
    name: "QA Engine Rule & Threshold Tuning",
    scope: "WORKSPACE",
    description: "Configure null gap percentages, flatline depth limits, and standard deviation sensitivity parameters.",
    roles: { ADMIN: true, USER: true },
  },
  {
    category: "Quality Engine & Repair",
    name: "Cryptographic Audit Certificate Sign-Off",
    scope: "WORKSPACE",
    description: "Formally verify cleaned subsurface logs, append digital signatures, and export official QA compliance certificates.",
    roles: { ADMIN: true, USER: true },
  },
  {
    category: "Database & Asset Governance",
    name: "Personal Well Asset Management",
    scope: "WORKSPACE",
    description: "View, search, edit, and organize owned well master assets, curves, and attached logging runs.",
    roles: { ADMIN: true, USER: true },
  },
  {
    category: "Database & Asset Governance",
    name: "Commit Well to Production Database",
    scope: "WORKSPACE",
    description: "Write verified well logs and QC metadata to persistent PostgreSQL storage repository.",
    roles: { ADMIN: true, USER: true },
  },
  {
    category: "Database & Asset Governance",
    name: "Personal Well Asset Deletion",
    scope: "WORKSPACE",
    description: "Delete personally owned well assets, curves, reports, and associated LAS files.",
    roles: { ADMIN: true, USER: true },
  },
  {
    category: "Database & Asset Governance",
    name: "Global Cross-Tenant Well Governance",
    scope: "GLOBAL",
    description: "View, inspect, audit, and permanently delete well assets across all user and organization accounts.",
    roles: { ADMIN: true, USER: false },
  },
  {
    category: "System & Administration",
    name: "User Provisioning & Role Management",
    scope: "GLOBAL",
    description: "Manage user accounts, assign ADMIN or USER roles, promote/demote administrators, and suspend access.",
    roles: { ADMIN: true, USER: false },
  },
  {
    category: "System & Administration",
    name: "Real-Time System Audit Trail Streaming",
    scope: "GLOBAL",
    description: "Monitor live WebSocket audit feed of all security events, data modifications, and authentication attempts.",
    roles: { ADMIN: true, USER: false },
  },
  {
    category: "System & Administration",
    name: "Email & Transactional Dispatch Settings",
    scope: "GLOBAL",
    description: "Configure SMTP, Resend, and EmailJS credentials, and enforce or bypass email verification requirements.",
    roles: { ADMIN: true, USER: false },
  },
  {
    category: "System & Administration",
    name: "API Automation Tokens & Webhooks",
    scope: "GLOBAL",
    description: "Generate automated system integration tokens and configure outbound webhook HTTP triggers.",
    roles: { ADMIN: true, USER: false },
  },
];

export default function AdminPanelPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"USERS" | "MATRIX" | "AUDIT" | "EMAIL" | "TOKENS" | "WEBHOOKS">("USERS");
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

  // Capability Matrix Tab State
  const [matrixFilter, setMatrixFilter] = useState<string>("ALL");
  const [matrixSearchQuery, setMatrixSearchQuery] = useState("");

  // Audit Streaming State
  const [activities, setActivities] = useState<ActivityListItem[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState<string>("ALL");
  const [auditSearchQuery, setAuditSearchQuery] = useState("");

  // Email & Notifications Settings State
  const [emailConfig, setEmailConfig] = useState<{
    provider: "EMAILJS" | "RESEND" | "DEV_LOGGER";
    frontend_url: string;
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
    frontend_url: "https://wellqc.vercel.app",
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

  const loadAuditStream = useCallback(async () => {
    setIsLoadingAudit(true);
    try {
      const res = await fetch("/api/activity", { cache: "no-store" });
      const result = await safeReadJson<{ activities?: ActivityListItem[] }>(res);
      if (result.ok && result.data?.activities) {
        setActivities(result.data.activities);
      }
    } catch (err) {
      console.error("Failed to load audit stream:", err);
    } finally {
      setIsLoadingAudit(false);
    }
  }, []);

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
          frontend_url: data.frontend_url || "https://wellqc.vercel.app",
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

  const filteredAuditActivities = activities.filter((act) => {
    if (auditFilter !== "ALL") {
      const actionUpper = act.action.toUpperCase();
      if (auditFilter === "WELL" && !actionUpper.includes("WELL")) return false;
      if (auditFilter === "QA" && !actionUpper.includes("QA") && !actionUpper.includes("ANOMALY")) return false;
      if (auditFilter === "INGEST" && !actionUpper.includes("INGEST") && !actionUpper.includes("LAS")) return false;
      if (auditFilter === "USER" && !actionUpper.includes("USER") && !actionUpper.includes("AUTH")) return false;
      if (auditFilter === "SECURITY" && !actionUpper.includes("TOKEN") && !actionUpper.includes("WEBHOOK")) return false;
    }
    if (!auditSearchQuery) return true;
    const q = auditSearchQuery.toLowerCase();
    return (
      act.userName.toLowerCase().includes(q) ||
      act.userRole.toLowerCase().includes(q) ||
      act.action.toLowerCase().includes(q) ||
      act.target.toLowerCase().includes(q) ||
      act.details.toLowerCase().includes(q)
    );
  });

  const deletableUsers = filteredUsers.filter((u) => u.id !== currentUserId);
  const isAllSelected = deletableUsers.length > 0 && deletableUsers.every((u) => selectedUserIds.includes(u.id));
  const isSomeSelected = selectedUserIds.length > 0 && !isAllSelected;

  function handleToggleSelectAll() {
    if (isAllSelected) {
      const deletableIdSet = new Set(deletableUsers.map((u) => u.id));
      setSelectedUserIds((prev) => prev.filter((id) => !deletableIdSet.has(id)));
    } else {
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
      <div className="space-y-4 max-w-[1600px] mx-auto font-sans">
        {/* Workstation Admin Control Header */}
        <div className="bg-wellqc-panel border border-wellqc-border p-4 rounded flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-950/80 text-rose-300 border border-rose-800/60">
                System Oversight &amp; Governance
              </span>
              <span className="text-slate-600 text-xs">•</span>
              <span className="text-xs text-slate-400">PostgreSQL Central DB</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Workstation Administration Console
            </h1>
            <p className="text-xs text-slate-400">
              Role-based access matrix, database tenancy, audit streaming, and automation tokens.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>RBAC ACTIVE</span>
            </span>
          </div>
        </div>

        {/* Compact Workstation Navigation Tabs */}
        <div className="flex items-center space-x-1 border-b border-wellqc-border pb-2 overflow-x-auto font-mono text-xs">
          <WorkstationTabButton
            active={activeTab === "USERS"}
            onClick={() => setActiveTab("USERS")}
            icon={<Users className="w-3.5 h-3.5" />}
            label={`Users (${users.length})`}
          />
          <WorkstationTabButton
            active={activeTab === "MATRIX"}
            onClick={() => setActiveTab("MATRIX")}
            icon={<Shield className="w-3.5 h-3.5" />}
            label="Permission Matrix"
          />
          <WorkstationTabButton
            active={activeTab === "AUDIT"}
            onClick={() => {
              setActiveTab("AUDIT");
              loadAuditStream();
            }}
            icon={<History className="w-3.5 h-3.5" />}
            label="Audit Streaming"
          />
          <WorkstationTabButton
            active={activeTab === "EMAIL"}
            onClick={() => {
              setActiveTab("EMAIL");
              loadEmailSettings();
            }}
            icon={<Mail className="w-3.5 h-3.5" />}
            label="Email Dispatch"
          />
          <WorkstationTabButton
            active={activeTab === "TOKENS"}
            onClick={() => {
              setActiveTab("TOKENS");
              loadTokens();
            }}
            icon={<Key className="w-3.5 h-3.5" />}
            label="API Tokens"
          />
          <WorkstationTabButton
            active={activeTab === "WEBHOOKS"}
            onClick={() => {
              setActiveTab("WEBHOOKS");
              loadWebhooks();
            }}
            icon={<Webhook className="w-3.5 h-3.5" />}
            label="Webhooks"
          />
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-rose-950/30 border border-rose-800/60 text-rose-300 px-3 py-2 rounded text-xs font-mono">
            {error}
          </div>
        )}

        {/* ── TAB 1: USERS ─────────────────────────────────────────────────── */}
        {activeTab === "USERS" && (
          <div className="space-y-3 font-mono">
            {/* Filter & Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-wellqc-panel border border-wellqc-border p-3 rounded">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter users by name, email, department or role..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-950/80 border border-slate-800 rounded text-xs text-white placeholder-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
                />
                {userSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setUserSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5"
                    title="Clear filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>
                  Showing <strong className="text-white">{filteredUsers.length}</strong> of {users.length} accounts
                </span>
              </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedUserIds.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 px-3.5 py-2 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-white">
                    {selectedUserIds.length} user{selectedUserIds.length === 1 ? "" : "s"} selected
                  </span>
                  <span className="text-slate-500 text-[11px]">| Queued for batch administrative action</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUserIds([])}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    id="bulk-delete-users-btn"
                    onClick={() => setShowBulkDeleteModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Selected ({selectedUserIds.length})
                  </button>
                </div>
              </div>
            )}

            {/* High-Density Users Table */}
            <div className="bg-wellqc-panel border border-wellqc-border rounded overflow-hidden">
              {isLoading ? (
                <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2 text-cyan-400" />
                  Loading accounts from database...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  {userSearchQuery ? "No accounts match the current search filter." : "No accounts registered in database."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/70 border-b border-wellqc-border text-slate-500 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-2.5 w-10 text-center">
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
                            className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 accent-cyan-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </th>
                        <th className="p-2.5">User Name</th>
                        <th className="p-2.5">Email Address</th>
                        <th className="p-2.5">Department</th>
                        <th className="p-2.5">Assigned RBAC Role</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-wellqc-border text-slate-300">
                      {filteredUsers.map((user) => {
                        const isSelected = selectedUserIds.includes(user.id);
                        const isSelf = user.id === currentUserId;

                        return (
                          <tr
                            key={user.id}
                            className={`hover:bg-slate-900/40 transition-colors group ${
                              isSelected ? "bg-slate-900/60" : ""
                            }`}
                          >
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                id={`select-user-${user.id}`}
                                checked={isSelected}
                                disabled={isSelf}
                                onChange={() => handleToggleSelectUser(user.id)}
                                aria-label={`Select user ${user.name}`}
                                className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 accent-cyan-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              />
                            </td>

                            <td className="p-2.5 font-bold text-white">
                              <div className="flex items-center gap-1.5">
                                {user.role === "ADMIN" && <ShieldCheck className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                                <span>{user.name}</span>
                                {isSelf && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                                    Current
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-2.5 text-slate-400">{user.email}</td>
                            <td className="p-2.5 text-slate-300">{user.department}</td>

                            <td className="p-2.5">
                              {editingId === user.id ? (
                                <div className="relative inline-block">
                                  <select
                                    id={`role-select-${user.id}`}
                                    autoFocus
                                    defaultValue={user.role}
                                    disabled={savingId === user.id}
                                    onBlur={() => setEditingId(null)}
                                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                    className="appearance-none bg-slate-900 border border-purple-500/60 text-purple-200 text-xs rounded px-2.5 py-1 pr-6 focus:outline-none cursor-pointer"
                                  >
                                    {ROLES.map((r) => (
                                      <option key={r} value={r}>
                                        {r}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className="w-3 h-3 text-purple-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                              ) : (
                                <button
                                  id={`role-badge-${user.id}`}
                                  onClick={() => setEditingId(user.id)}
                                  title="Click to modify role"
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-bold transition-colors ${
                                    ROLE_COLORS[user.role as Role] ?? "bg-slate-800 text-slate-300 border-slate-700"
                                  }`}
                                >
                                  {savingId === user.id ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <>
                                      <span>{user.role}</span>
                                      <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                                    </>
                                  )}
                                </button>
                              )}
                            </td>

                            <td className="p-2.5">
                              <span className="text-emerald-400 font-bold text-[10px] uppercase">
                                {user.status}
                              </span>
                            </td>

                            <td className="p-2.5 text-right">
                              <button
                                id={`delete-user-${user.id}`}
                                onClick={() => setDeleteTarget(user)}
                                disabled={isSelf}
                                title={isSelf ? "Cannot delete active administrator" : "Delete user"}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-xs border border-slate-800 hover:border-rose-800/60 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
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

        {/* ── TAB 2: ROLE PERMISSION MATRIX ─────────────────────────────────── */}
        {activeTab === "MATRIX" && (() => {
          const filteredMatrix = PERMISSION_MATRIX.filter((perm) => {
            const matchesCategory = matrixFilter === "ALL" || perm.category === matrixFilter;
            const q = matrixSearchQuery.trim().toLowerCase();
            const matchesSearch =
              !q ||
              perm.name.toLowerCase().includes(q) ||
              perm.description.toLowerCase().includes(q) ||
              perm.category.toLowerCase().includes(q) ||
              perm.scope.toLowerCase().includes(q);
            return matchesCategory && matchesSearch;
          });

          return (
            <div className="space-y-4 font-mono">
              {/* Executive Architecture Banner */}
              <div className="bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl relative overflow-hidden space-y-4 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-purple-400" />
                        <span>Security &amp; Authorization Model</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                        Binary RBAC (ADMIN | USER)
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white tracking-tight">
                      Authoritative Capability &amp; Entitlement Matrix
                    </h3>
                    <p className="text-xs text-slate-400 max-w-3xl">
                      Separation of concerns between security boundaries (Roles) and professional disciplines (Departments/Titles).
                      Enforced across FastAPI route dependencies, Next.js proxy route guards, and PostgreSQL row-level tenancy.
                    </p>
                  </div>
                </div>

                {/* Separation of Concerns Callout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-wellqc-border/60">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                    <div className="flex items-center space-x-2 text-xs font-bold text-white">
                      <ShieldCheck className="w-4 h-4 text-rose-400" />
                      <span>Security Roles (Authorization)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      <strong className="text-slate-200">ADMIN:</strong> Global governance, tenant user provisioning, cross-account inspection, email config, webhooks, and system audit trails.<br/>
                      <strong className="text-slate-200">USER:</strong> Full subsurface workstation autonomy—ingestion, standardisation, QA anomaly repair, and personal well asset management.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                    <div className="flex items-center space-x-2 text-xs font-bold text-white">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>Professional Identity (Domain Titles)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Subsurface domain professions (<span className="text-cyan-300 font-semibold">Lead Petrophysicist</span>, <span className="text-cyan-300 font-semibold">Subsurface Geoscientist</span>, <span className="text-cyan-300 font-semibold">Petroleum Data Engineer</span>) are preserved in the user profile <code className="text-slate-200">department</code> field, displaying on certificates and signatures without creating security silos.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-wellqc-panel border border-wellqc-border p-3.5 rounded-xl space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Total Platform Capabilities</div>
                  <div className="text-xl font-black text-white">{PERMISSION_MATRIX.length}</div>
                  <div className="text-[10px] text-slate-400">Across 5 subsurface domains</div>
                </div>
                <div className="bg-wellqc-panel border border-wellqc-border p-3.5 rounded-xl space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Standard User (USER)</div>
                  <div className="text-xl font-black text-cyan-400">
                    {PERMISSION_MATRIX.filter((p) => p.roles.USER).length} / {PERMISSION_MATRIX.length}
                  </div>
                  <div className="text-[10px] text-emerald-400">Full subsurface autonomy</div>
                </div>
                <div className="bg-wellqc-panel border border-wellqc-border p-3.5 rounded-xl space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Admin Governance (ADMIN)</div>
                  <div className="text-xl font-black text-rose-400">
                    {PERMISSION_MATRIX.filter((p) => p.roles.ADMIN).length} / {PERMISSION_MATRIX.length}
                  </div>
                  <div className="text-[10px] text-rose-300">Global custodian access</div>
                </div>
                <div className="bg-wellqc-panel border border-wellqc-border p-3.5 rounded-xl space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Restricted to Admin</div>
                  <div className="text-xl font-black text-amber-400">
                    {PERMISSION_MATRIX.filter((p) => !p.roles.USER).length}
                  </div>
                  <div className="text-[10px] text-amber-400/80">Security &amp; provisioning</div>
                </div>
              </div>

              {/* Filter & Search Toolbar */}
              <div className="bg-wellqc-panel border border-wellqc-border p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-500 mr-1 text-[11px] font-bold">Domain:</span>
                  {CATEGORY_FILTERS.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setMatrixFilter(cat)}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                        matrixFilter === cat
                          ? "bg-purple-950/80 text-purple-300 border-purple-500/60"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[240px]">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search capabilities or scope..."
                    value={matrixSearchQuery}
                    onChange={(e) => setMatrixSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 pl-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  {matrixSearchQuery && (
                    <button
                      onClick={() => setMatrixSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Matrix Table */}
              <div className="bg-wellqc-panel border border-wellqc-border rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/90 border-b border-wellqc-border text-slate-400 text-[10px] uppercase">
                      <tr>
                        <th className="p-3.5 w-72">Capability &amp; Domain</th>
                        <th className="p-3.5 w-28 text-center">Scope</th>
                        <th className="p-3.5">Enforcement &amp; Description</th>
                        <th className="p-3.5 text-center w-36">
                          <div className="flex flex-col items-center">
                            <span className="px-2 py-0.5 rounded border text-[9px] font-bold bg-rose-500/10 text-rose-300 border-rose-500/30">
                              ADMIN
                            </span>
                            <span className="text-[9px] text-slate-500 font-normal mt-0.5">Global Admin</span>
                          </div>
                        </th>
                        <th className="p-3.5 text-center w-36">
                          <div className="flex flex-col items-center">
                            <span className="px-2 py-0.5 rounded border text-[9px] font-bold bg-cyan-500/10 text-cyan-300 border-cyan-500/30">
                              USER
                            </span>
                            <span className="text-[9px] text-slate-500 font-normal mt-0.5">Subsurface Specialist</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-wellqc-border text-slate-300">
                      {filteredMatrix.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500">
                            No capabilities match &quot;{matrixSearchQuery}&quot; under &quot;{matrixFilter}&quot;.
                            <div className="mt-2">
                              <button
                                onClick={() => {
                                  setMatrixFilter("ALL");
                                  setMatrixSearchQuery("");
                                }}
                                className="text-cyan-400 hover:underline text-xs"
                              >
                                Reset filters
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredMatrix.map((perm, idx) => {
                          const adminAllowed = perm.roles.ADMIN;
                          const userAllowed = perm.roles.USER;
                          return (
                            <tr key={idx} className="hover:bg-slate-900/50 transition-colors group">
                              <td className="p-3.5 align-top">
                                <div className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                                  {perm.name}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                                  {perm.category}
                                </div>
                              </td>
                              <td className="p-3.5 align-top text-center">
                                {perm.scope === "GLOBAL" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                    GLOBAL
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                                    WORKSPACE
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 align-top text-slate-400 text-[11px] leading-relaxed">
                                {perm.description}
                              </td>
                              <td className="p-3.5 align-top text-center">
                                {adminAllowed ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold shadow-sm">
                                    <Check className="w-3 h-3" />
                                    <span>Granted</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-600 text-[11px]">
                                    –
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 align-top text-center">
                                {userAllowed ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold shadow-sm">
                                    <Check className="w-3 h-3" />
                                    <span>Granted</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-900/90 border border-slate-800/80 text-slate-500 text-[10px]">
                                    <span>Restricted</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── TAB 3: REAL-TIME AUDIT STREAMING ───────────────────────────────── */}
        {activeTab === "AUDIT" && (
          <div className="space-y-3 font-mono">
            {/* Filter bar */}
            <div className="bg-wellqc-panel border border-wellqc-border p-3 rounded flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-500 mr-1 text-[11px]">Filter Action:</span>
                {["ALL", "WELL", "QA", "INGEST", "USER", "SECURITY"].map((category) => (
                  <button
                    key={category}
                    onClick={() => setAuditFilter(category)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                      auditFilter === category
                        ? "bg-cyan-950 text-cyan-300 border-cyan-500/60"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search audit trail..."
                    value={auditSearchQuery}
                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white placeholder-slate-600 outline-none w-48"
                  />
                </div>
                <button
                  onClick={loadAuditStream}
                  disabled={isLoadingAudit}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingAudit ? "animate-spin text-cyan-400" : ""}`} />
                  <span>Stream Refresh</span>
                </button>
              </div>
            </div>

            {/* Audit Log Stream */}
            <div className="bg-wellqc-panel border border-wellqc-border rounded overflow-hidden">
              <div className="p-2.5 bg-slate-950/70 border-b border-wellqc-border flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center space-x-2">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span className="font-bold text-white">Live Audit Stream</span>
                  <span>({filteredAuditActivities.length} events logged)</span>
                </div>
                <span>Repository: wellqc_activity_log</span>
              </div>

              <div className="max-h-[500px] overflow-y-auto divide-y divide-wellqc-border">
                {isLoadingAudit ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-cyan-400" />
                    Connecting to audit stream...
                  </div>
                ) : filteredAuditActivities.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No matching audit stream records located.
                  </div>
                ) : (
                  filteredAuditActivities.map((event) => (
                    <div
                      key={event.id}
                      className="p-2.5 hover:bg-slate-900/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-[11px]">{event.userName}</span>
                          <span className="px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[9px]">
                            {event.userRole}
                          </span>
                          <span className="text-[10px] text-cyan-400 font-semibold uppercase">
                            {event.action.replace(/_/g, " ")}
                          </span>
                          {event.target && (
                            <span className="text-[10px] text-slate-500">[{event.target}]</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-300 truncate">{event.details}</div>
                      </div>

                      <div className="text-right shrink-0 text-[10px] text-slate-500">
                        <div>{event.timestamp}</div>
                        {event.ip && <div className="text-[9px] text-slate-600">IP: {event.ip}</div>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: EMAIL SETTINGS ────────────────────────────────────────── */}
        {activeTab === "EMAIL" && (
          <div className="space-y-4 font-mono text-xs">
            <div className="bg-wellqc-panel border border-wellqc-border p-4 rounded space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-wellqc-border pb-3">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Transactional Email &amp; Verification Dispatch
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure your delivery provider for user verification links, password resets, and regulatory alerts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadEmailSettings}
                  disabled={isLoadingEmail}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEmail ? "animate-spin" : ""}`} />
                  <span>Refresh Settings</span>
                </button>
              </div>

              {isLoadingEmail ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-cyan-400" />
                  Loading email configuration...
                </div>
              ) : (
                <form onSubmit={handleSaveEmailSettings} className="space-y-4">
                  {/* Provider Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* EmailJS */}
                    <div
                      onClick={() => setEmailConfig((prev) => ({ ...prev, provider: "EMAILJS" }))}
                      className={`cursor-pointer p-3 rounded border transition-colors ${
                        emailConfig.provider === "EMAILJS"
                          ? "bg-slate-900 border-cyan-500/80 ring-1 ring-cyan-500/30"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">EmailJS</span>
                        <span className="text-[10px] text-cyan-400 font-bold">Recommended</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Connects directly to Gmail, Outlook, or SMTP with no custom domain DNS setup required.
                      </p>
                    </div>

                    {/* Resend */}
                    <div
                      onClick={() => setEmailConfig((prev) => ({ ...prev, provider: "RESEND" }))}
                      className={`cursor-pointer p-3 rounded border transition-colors ${
                        emailConfig.provider === "RESEND"
                          ? "bg-slate-900 border-purple-500/80 ring-1 ring-purple-500/30"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">Resend</span>
                        <span className="text-[10px] text-purple-400 font-bold">REST API</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Direct dispatch via Resend REST API. Requires verified domain for public recipients.
                      </p>
                    </div>

                    {/* Dev Logger */}
                    <div
                      onClick={() => setEmailConfig((prev) => ({ ...prev, provider: "DEV_LOGGER" }))}
                      className={`cursor-pointer p-3 rounded border transition-colors ${
                        emailConfig.provider === "DEV_LOGGER"
                          ? "bg-slate-900 border-emerald-500/80 ring-1 ring-emerald-500/30"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">Dev Logger</span>
                        <span className="text-[10px] text-emerald-400 font-bold">Offline / Local</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Outputs verification links directly to the local backend console.
                      </p>
                    </div>
                  </div>

                  {/* Base URL */}
                  <div className="space-y-1 bg-slate-950/60 border border-slate-800 p-3 rounded">
                    <label className="block text-slate-300 font-bold">
                      Canonical Base URL for Links
                    </label>
                    <input
                      type="url"
                      value={emailConfig.frontend_url}
                      onChange={(e) => setEmailConfig((prev) => ({ ...prev, frontend_url: e.target.value }))}
                      placeholder="https://wellqc.vercel.app"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* EmailJS Credentials */}
                  {emailConfig.provider === "EMAILJS" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/60 border border-cyan-900/40 p-3.5 rounded">
                      <div>
                        <label className="block text-slate-300 mb-1 font-bold">Service ID *</label>
                        <input
                          type="text"
                          value={emailConfig.emailjs_service_id}
                          onChange={(e) => setEmailConfig((prev) => ({ ...prev, emailjs_service_id: e.target.value }))}
                          placeholder="service_xyz123"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1 font-bold">Template ID *</label>
                        <input
                          type="text"
                          value={emailConfig.emailjs_template_id}
                          onChange={(e) => setEmailConfig((prev) => ({ ...prev, emailjs_template_id: e.target.value }))}
                          placeholder="template_abc456"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1 font-bold">Public Key (User ID) *</label>
                        <input
                          type="text"
                          value={emailConfig.emailjs_public_key}
                          onChange={(e) => setEmailConfig((prev) => ({ ...prev, emailjs_public_key: e.target.value }))}
                          placeholder="user_abcdef123456"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                        />
                      </div>
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
                            placeholder={emailConfig.emailjs_private_key_configured ? "Leave blank to keep current key" : "Optional secret key"}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 pr-8 text-xs text-white outline-none focus:border-cyan-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowEmailJsSecret(!showEmailJsSecret)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          >
                            {showEmailJsSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Resend Credentials */}
                  {emailConfig.provider === "RESEND" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/60 border border-purple-900/40 p-3.5 rounded">
                      <div>
                        <label className="block text-slate-300 mb-1 font-bold">Resend API Key *</label>
                        <input
                          type="password"
                          value={emailConfig.resend_api_key}
                          onChange={(e) => setEmailConfig((prev) => ({ ...prev, resend_api_key: e.target.value }))}
                          placeholder="re_..."
                          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1 font-bold">From Address</label>
                        <input
                          type="text"
                          value={emailConfig.resend_from_email}
                          onChange={(e) => setEmailConfig((prev) => ({ ...prev, resend_from_email: e.target.value }))}
                          placeholder="WellQC <onboarding@resend.dev>"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Test Delivery Strip */}
                  <div className="bg-slate-950/60 border border-slate-800 p-3 rounded flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="email"
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                      placeholder="Enter recipient email for test dispatch..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white outline-none w-full"
                    />
                    <button
                      type="button"
                      onClick={handleSendTestEmail}
                      disabled={isTestingEmail || !testRecipient}
                      className="w-full sm:w-auto px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-300 font-bold border border-slate-700 transition-colors"
                    >
                      {isTestingEmail ? "Testing..." : "Send Test Ping"}
                    </button>
                  </div>

                  {testResult && (
                    <div
                      className={`p-2 rounded border text-xs ${
                        testResult.ok ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200" : "bg-rose-950/60 border-rose-500/40 text-rose-200"
                      }`}
                    >
                      {testResult.msg}
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSavingEmail}
                      className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs transition-colors"
                    >
                      {isSavingEmail ? "Saving..." : "Save Email Settings"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 5: API ACCESS TOKENS ─────────────────────────────────────── */}
        {activeTab === "TOKENS" && (
          <div className="space-y-3 font-mono text-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-wellqc-panel border border-wellqc-border p-3.5 rounded">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-cyan-400" />
                  Enterprise API Authentication Tokens
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Cryptographically signed bearer tokens for automated batch pipelines and Python SDK runners.
                </p>
              </div>
              <button
                type="button"
                id="generate-api-token-btn"
                onClick={() => setShowCreateTokenModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Generate Token</span>
              </button>
            </div>

            <div className="bg-wellqc-panel border border-wellqc-border rounded overflow-hidden">
              {isLoadingTokens ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-cyan-400" />
                  Loading API tokens...
                </div>
              ) : tokens.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No enterprise API tokens created.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/70 border-b border-wellqc-border text-slate-500 uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Token Name</th>
                        <th className="p-2.5">Masked Key Identifier</th>
                        <th className="p-2.5">Assigned User</th>
                        <th className="p-2.5">Last Used</th>
                        <th className="p-2.5">Created</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-wellqc-border text-slate-300">
                      {tokens.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-2.5 font-bold text-white">{t.name}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                              {t.maskedToken}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-400">{t.userName} ({t.userEmail})</td>
                          <td className="p-2.5 text-slate-500">{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : "Never"}</td>
                          <td className="p-2.5 text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRevokeToken(t.id, t.name)}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 text-xs font-bold transition-colors"
                            >
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

        {/* ── TAB 6: WEBHOOKS ──────────────────────────────────────────────── */}
        {activeTab === "WEBHOOKS" && (
          <div className="space-y-3 font-mono text-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-wellqc-panel border border-wellqc-border p-3.5 rounded">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Webhook className="w-3.5 h-3.5 text-purple-400" />
                  System Webhook Endpoints
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  WellQC dispatches HTTP POST events signed with HMAC-SHA256 headers upon pipeline events.
                </p>
              </div>
              <button
                type="button"
                id="register-webhook-btn"
                onClick={() => setShowCreateWebhookModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register Webhook</span>
              </button>
            </div>

            <div className="bg-wellqc-panel border border-wellqc-border rounded overflow-hidden">
              {isLoadingWebhooks ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-purple-400" />
                  Loading webhooks...
                </div>
              ) : webhooks.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No webhooks configured.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/70 border-b border-wellqc-border text-slate-500 uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Webhook Name &amp; URL</th>
                        <th className="p-2.5">Events</th>
                        <th className="p-2.5">HMAC Secret</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-wellqc-border text-slate-300">
                      {webhooks.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-2.5">
                            <div className="font-bold text-white">{w.name}</div>
                            <div className="text-[10px] text-slate-500 truncate max-w-xs">{w.url}</div>
                          </td>
                          <td className="p-2.5">
                            <div className="flex flex-wrap gap-1">
                              {w.events.map((ev) => (
                                <span key={ev} className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-[9px] text-purple-300">
                                  {ev}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-2.5 text-slate-400 font-mono text-[11px]">{w.maskedSecret}</td>
                          <td className="p-2.5">
                            <span className="text-emerald-400 font-bold text-[10px]">ACTIVE</span>
                          </td>
                          <td className="p-2.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleTestWebhook(w.id)}
                                disabled={testingWebhookId === w.id}
                                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 text-xs font-bold transition-colors"
                              >
                                {testingWebhookId === w.id ? "Pinging..." : "Test Ping"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteWebhook(w.id, w.name)}
                                className="px-2 py-1 rounded bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 text-xs font-bold transition-colors"
                              >
                                Delete
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

      {/* ── Single Delete Modal ─────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono text-xs">
          <div className="bg-slate-900 border border-rose-800/80 rounded shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white">Delete User Account</h3>
                <p className="text-slate-400 text-xs mt-1">
                  Permanently remove <strong className="text-white">{deleteTarget.name}</strong> ({deleteTarget.email}) and revoke all workstation sessions.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                id="confirm-delete-user"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-3 py-2 rounded bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white font-bold text-xs transition-colors"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Modal ───────────────────────────────────────────── */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono text-xs">
          <div className="bg-slate-900 border border-rose-800/80 rounded shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Trash2 className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white">
                  Bulk Delete {selectedUserIds.length} Accounts?
                </h3>
                <p className="text-slate-400 text-xs mt-1">
                  Permanently delete {selectedUserIds.length} selected user account records.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                id="confirm-bulk-delete-users"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex-1 px-3 py-2 rounded bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white font-bold text-xs transition-colors"
              >
                {isBulkDeleting ? "Deleting..." : `Delete ${selectedUserIds.length} Users`}
              </button>
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isBulkDeleting}
                className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Token Modal ─────────────────────────────────────────── */}
      {showCreateTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono text-xs">
          <div className="bg-slate-900 border border-cyan-800/80 rounded shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                Generate Enterprise API Token
              </h3>
              <button onClick={() => setShowCreateTokenModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateToken} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Token Name *</label>
                <input
                  type="text"
                  required
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="e.g. Automated Pipeline Runner"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Assign User (Optional)</label>
                <select
                  value={newTokenUserId}
                  onChange={(e) => setNewTokenUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                >
                  <option value="">Current Administrator</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isCreatingToken}
                  className="flex-1 px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors"
                >
                  {isCreatingToken ? "Generating..." : "Generate Token"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateTokenModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Revealed Token Modal ───────────────────────────────────────── */}
      {revealedRawToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono text-xs">
          <div className="bg-slate-900 border border-cyan-500/80 rounded shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white">Save API Token</h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Copy this token now. It will not be shown again.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded text-cyan-300 break-all select-all font-bold">
              {revealedRawToken}
            </div>

            <button
              type="button"
              onClick={() => handleCopy(revealedRawToken, "revealed-token")}
              className="w-full py-2 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedKeyId === "revealed-token" ? "Copied!" : "Copy Token"}</span>
            </button>

            <button
              type="button"
              onClick={() => setRevealedRawToken(null)}
              className="w-full py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── Create Webhook Modal ───────────────────────────────────────── */}
      {showCreateWebhookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono text-xs">
          <div className="bg-slate-900 border border-purple-800/80 rounded shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Webhook className="w-4 h-4 text-purple-400" />
                Register Webhook Endpoint
              </h3>
              <button onClick={() => setShowCreateWebhookModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWebhook} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Webhook Name *</label>
                <input
                  type="text"
                  required
                  value={newWebhookName}
                  onChange={(e) => setNewWebhookName(e.target.value)}
                  placeholder="e.g. Ingestion Pipeline Hook"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Target HTTPS URL *</label>
                <input
                  type="url"
                  required
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isCreatingWebhook}
                  className="flex-1 px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors"
                >
                  {isCreatingWebhook ? "Registering..." : "Register"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateWebhookModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-3.5 py-2.5 rounded shadow-xl text-xs font-mono border flex items-center gap-2 ${
            toast.ok ? "bg-emerald-950 border-emerald-500/50 text-emerald-200" : "bg-rose-950 border-rose-500/50 text-rose-200"
          }`}
        >
          {toast.ok ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
          <span>{toast.msg}</span>
        </div>
      )}
    </AppShell>
  );
}

function WorkstationTabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors whitespace-nowrap ${
        active
          ? "bg-slate-800 text-white border border-slate-700 font-bold"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
