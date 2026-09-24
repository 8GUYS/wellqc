"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  User,
  Mail,
  Building2,
  Shield,
  CheckCircle2,
  Lock,
  Key,
  FileText,
  AlertCircle,
  ArrowUpRight,
  Download,
  RefreshCw,
  Calendar,
  Layers,
  Award,
} from "lucide-react";

interface UserProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  tier: string;
  freeChecksUsed: number;
  maxFreeChecks: number;
  totalFilesUploaded: number;
  ndaAcceptedAt: string | null;
  createdAt: string;
}

export default function UserProfilePage() {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "compliance" | "security">("profile");
  
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: "",
    department: "",
    role: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      setLoading(true);
      const res = await fetch("/api/user/profile");
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();

      if (data.user) {
        setProfile(data.user);
        setFormData((prev) => ({
          ...prev,
          name: data.user.name || "",
          department: data.user.department || "Subsurface Analytics",
          role: data.user.role || "PETROPHYSICIST",
        }));
      }
    } catch (err) {
      console.error("Failed to load profile", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (formData.newPassword) {
      if (formData.newPassword !== formData.confirmPassword) {
        setFeedback({ type: "error", message: "New password and confirmation do not match." });
        return;
      }
      if (formData.newPassword.length < 6) {
        setFeedback({ type: "error", message: "New password must be at least 6 characters long." });
        return;
      }
    }

    try {
      setUpdating(true);
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          department: formData.department,
          role: formData.role,
          currentPassword: formData.currentPassword || undefined,
          newPassword: formData.newPassword || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", message: data.error || "Failed to update profile." });
      } else {
        setFeedback({ type: "success", message: "Profile & credentials updated successfully!" });
        setFormData((prev) => ({ ...prev, currentPassword: "", newPassword: "", confirmPassword: "" }));
        window.dispatchEvent(new Event("wellqc_user_updated"));
        fetchProfile();
      }
    } catch (err) {
      setFeedback({ type: "error", message: "An error occurred while updating profile." });
    } finally {
      setUpdating(false);
    }
  }

  return (
    <AppShell>

      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Profile Header Summary Banner */}
        <div className="bg-gradient-to-r from-wellqc-panel via-wellqc-card to-blue-950/40 border border-wellqc-border rounded-2xl p-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center space-x-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-3xl shadow-xl shadow-cyan-500/20 border-2 border-cyan-400/30">
                  {profile?.name ? profile.name.charAt(0).toUpperCase() : "U"}
                </div>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-wellqc-dark flex items-center justify-center text-[10px] bg-emerald-500 text-white" title="Active Workspace">
                  ✓
                </span>
              </div>

              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    {profile?.name || "Loading User Profile..."}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold tracking-wide uppercase border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                    WORKSPACE ACTIVE
                  </span>
                </div>
                
                <p className="text-xs text-wellqc-muted mt-1 flex items-center space-x-4">
                  <span className="flex items-center space-x-1">
                    <Mail className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{profile?.email || "user@wellqc.com"}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center space-x-1">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{profile?.department || "Subsurface Analytics"}</span>
                  </span>
                </p>

                <div className="mt-2.5 flex items-center space-x-2">
                  <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                    ROLE: {profile?.role || "PETROPHYSICIST"}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 bg-wellqc-panel border border-wellqc-border px-2 py-0.5 rounded-md flex items-center space-x-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Joined {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-GB") : "Recently"}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Workspace Status Badge */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="font-bold">Subsurface Workspace Active</div>
                  <div className="text-[11px] text-emerald-400/80">Full Petrophysical Suite Enabled</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 border-b border-wellqc-border pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === "profile"
                ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-wellqc-card"
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile Credentials</span>
          </button>

          <button
            onClick={() => setActiveTab("compliance")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === "compliance"
                ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-wellqc-card"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Compliance & NDA</span>
          </button>

          {/* <button
            onClick={() => setActiveTab("security")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === "security"
                ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-wellqc-card"
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Security & API Tokens</span>
          </button> */}
        </div>

        {/* Feedback Alert Banner */}
        {feedback && (
          <div className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}>
            <div className="flex items-center space-x-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white text-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* Tab 1: Profile Information */}
        {activeTab === "profile" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-wellqc-card border border-wellqc-border rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-wellqc-border pb-4">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                    <User className="w-4 h-4 text-cyan-400" />
                    <span>Personal Details & Role Configuration</span>
                  </h2>
                  <p className="text-xs text-wellqc-muted mt-0.5">
                    Update your account details and petrophysical team department.
                  </p>
                </div>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full bg-wellqc-panel border border-wellqc-border rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Email Address (Read-only)
                    </label>
                    <input
                      type="email"
                      value={profile?.email || ""}
                      disabled
                      className="w-full bg-wellqc-panel/50 border border-wellqc-border/60 rounded-xl px-3.5 py-2 text-xs text-slate-400 cursor-not-allowed font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Department / Organization Unit
                    </label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="e.g. Subsurface Analytics, Petrophysics, Exploration"
                      className="w-full bg-wellqc-panel border border-wellqc-border rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                    />
                  </div>

                  {/* <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Platform Access Role
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full bg-wellqc-panel border border-wellqc-border rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                    >
                      <option value="PETROPHYSICIST">Petrophysicist (Default)</option>
                      <option value="DATA_ENGINEER">Data Engineer</option>
                      <option value="GEOSCIENTIST">Geoscientist</option>
                      <option value="VIEWER">Auditor / Viewer</option>
                      {profile?.role === "ADMIN" && (
                        <option value="ADMIN">System Administrator (ADMIN)</option>
                      )}
                    </select>
                    {profile?.role !== "ADMIN" && (
                      <p className="text-[10px] text-wellqc-muted mt-1 font-mono">
                        * Note: Self-assignment of Administrator (ADMIN) role is restricted.
                      </p>
                    )}
                  </div> */}
                </div>

                <div className="border-t border-wellqc-border pt-4 mt-6">
                  <h3 className="text-xs font-bold text-white mb-3 flex items-center space-x-2">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Change Account Password (Optional)</span>
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Current Password</label>
                      <input
                        type="password"
                        value={formData.currentPassword}
                        onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-wellqc-panel border border-wellqc-border rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">New Password</label>
                        <input
                          type="password"
                          value={formData.newPassword}
                          onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                          placeholder="At least 6 characters"
                          className="w-full bg-wellqc-panel border border-wellqc-border rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Confirm New Password</label>
                        <input
                          type="password"
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                          placeholder="Re-enter new password"
                          className="w-full bg-wellqc-panel border border-wellqc-border rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center space-x-2 transition-all disabled:opacity-50"
                  >
                    {updating ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>{updating ? "Saving Changes..." : "Save Profile Credentials"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Quick Stats Sidebar */}
            <div className="space-y-6">
              <div className="bg-wellqc-card border border-wellqc-border rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center space-x-2">
                  <Award className="w-4 h-4 text-cyan-400" />
                  <span>Platform Usage Telemetry</span>
                </h3>

                <div className="p-3.5 rounded-xl bg-wellqc-panel border border-wellqc-border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total LAS Uploads Committed</span>
                    <span className="font-mono font-bold text-cyan-400">{profile?.totalFilesUploaded ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Current Plan Tier</span>
                    <span className="font-mono font-bold text-white">{profile?.tier || "FREE"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Organization Role</span>
                    <span className="font-mono font-bold text-cyan-300">{profile?.role || "PETROPHYSICIST"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Subsurface License</span>
                    <span className="font-mono font-bold text-emerald-400">ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Compliance & NDA */}
        {activeTab === "compliance" && (
          <div className="bg-wellqc-card border border-wellqc-border rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-wellqc-border pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>Petrophysical Data Processing & NDA Compliance</span>
                </h3>
                <p className="text-xs text-wellqc-muted mt-0.5">
                  WellQC+ maintains strict multi-tenant data confidentiality standards under International E&P data protection regulations.
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>NDA ACCEPTED</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-wellqc-panel border border-wellqc-border space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Subsurface Data Confidentiality Terms</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  All LAS well log curves, headers (`~W`, `~C`), depth coordinates, and petrophysical anomalies processed by WellQC+ are strictly isolated within your organization workspace via encrypted multi-tenant filtering.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-wellqc-panel border border-wellqc-border space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-cyan-400" />
                  <span>Encryption & Storage Security</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Database queries enforce tenant validation (`ownerId`). Raw LAS files are processed in-memory, parsed with zero persistence of unauthorized intermediate files, and protected by SSL/TLS encryption.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Security & API Tokens */}
        {/* {activeTab === "security" && (
          <div className="bg-wellqc-card border border-wellqc-border rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-wellqc-border pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Key className="w-4 h-4 text-cyan-400" />
                  <span>Developer API Tokens & Programmatic Ingestion</span>
                </h3>
                <p className="text-xs text-wellqc-muted mt-0.5">
                  Use API keys to authenticate automated script ingestion pipelines or FastAPI microservices.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-wellqc-panel border border-wellqc-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs text-cyan-300 font-bold">wellqc_live_tok_984f10a2b8...</div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Created for automated LAS ingestion microservice pipeline.
              </p>
            </div>
          </div>
        )} */}
      </div>
    </AppShell>
  );
}
