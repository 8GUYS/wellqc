"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PaymentModal } from "@/components/pricing/payment-modal";
import {
  User,
  Mail,
  Building2,
  Shield,
  CreditCard,
  CheckCircle2,
  Lock,
  Key,
  Receipt,
  Sparkles,
  Clock,
  FileText,
  AlertCircle,
  ArrowUpRight,
  Download,
  RefreshCw,
  Sliders,
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

interface PaymentRecord {
  id: string;
  reference: string;
  planName: string;
  amount: string;
  channel: string;
  status: string;
  date: string;
}

export default function UserProfilePage() {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "billing" | "compliance" | "security">("profile");
  
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  
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
      const data = await res.json();

      if (res.ok && data.user) {
        setProfile(data.user);
        setPayments(data.paymentRecords || []);
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

  const isFree = (profile?.tier || "FREE") === "FREE";
  const checksUsed = profile?.freeChecksUsed ?? 0;
  const maxChecks = profile?.maxFreeChecks ?? 2;
  const checksRemaining = isFree ? Math.max(0, maxChecks - checksUsed) : "Unlimited";

  return (
    <AppShell>
      {/* Paystack Payment Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          fetchProfile();
        }}
        defaultPlan="pro_monthly"
      />

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
                <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-wellqc-dark flex items-center justify-center text-[10px] ${
                  isFree ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
                }`} title={isFree ? "Free Account" : "Pro License Active"}>
                  ✓
                </span>
              </div>

              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    {profile?.name || "Loading User Profile..."}
                  </h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold tracking-wide uppercase border ${
                    isFree
                      ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  }`}>
                    {profile?.tier || "FREE"} TIER
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

            {/* Quick Plan CTA */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              {isFree ? (
                <button
                  onClick={() => setPaymentModalOpen(true)}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4 text-cyan-200 animate-pulse" />
                  <span>Upgrade to Pro (₦75k / $49)</span>
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="font-bold">Pro Subsurface License Active</div>
                    <div className="text-[11px] text-emerald-400/80">Unlimited LAS Audits & Exports</div>
                  </div>
                </div>
              )}
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
            onClick={() => setActiveTab("billing")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === "billing"
                ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-wellqc-card"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Billing & Payment History</span>
            {payments.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-cyan-500/30 text-cyan-300 text-[10px] font-mono flex items-center justify-center">
                {payments.length}
              </span>
            )}
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

          <button
            onClick={() => setActiveTab("security")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === "security"
                ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-wellqc-card"
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Security & API Tokens</span>
          </button>
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

                  <div>
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
                  </div>
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
                    <span className="text-slate-400">Free LAS Checks Quota</span>
                    <span className="font-mono font-bold text-amber-400">
                      {isFree ? `${checksUsed} / ${maxChecks}` : "Unlimited"}
                    </span>
                  </div>
                </div>

                {isFree && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Quota Used</span>
                      <span className="text-amber-400">{Math.min(100, (checksUsed / maxChecks) * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-wellqc-panel rounded-full overflow-hidden border border-wellqc-border">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-red-500 transition-all"
                        style={{ width: `${Math.min(100, (checksUsed / maxChecks) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Billing & Paystack Payment History */}
        {activeTab === "billing" && (
          <div className="space-y-6">
            {/* Current Active Plan Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-wellqc-card border border-wellqc-border rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Current Plan</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                    isFree ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  }`}>
                    {profile?.tier || "FREE"}
                  </span>
                </div>

                <div className="text-2xl font-black text-white">
                  {isFree ? "Starter Free Plan" : "Pro Petrophysicist Plan"}
                </div>

                <p className="text-xs text-wellqc-muted">
                  {isFree
                    ? "Limited to 2 free LAS quality checks. Upgrade for unlimited file ingestion, KNN imputation, and PDF certificates."
                    : "Unlimited LAS audits, KNN imputation engine, multi-well log track rendering, and executive PDF audit certificates."}
                </p>

                <div className="pt-2">
                  {isFree ? (
                    <button
                      onClick={() => setPaymentModalOpen(true)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center justify-center space-x-2"
                    >
                      <Sparkles className="w-4 h-4 text-cyan-200" />
                      <span>Upgrade Subscription (₦75k / $49)</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setPaymentModalOpen(true)}
                      className="w-full py-2.5 rounded-xl bg-wellqc-panel border border-cyan-500/40 text-cyan-300 font-bold text-xs hover:bg-cyan-500/10 transition-all flex items-center justify-center space-x-2"
                    >
                      <Sliders className="w-4 h-4 text-cyan-400" />
                      <span>Manage or Change Plan</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Usage Quota Card */}
              <div className="bg-wellqc-card border border-wellqc-border rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Usage Counter</span>
                  <Clock className="w-4 h-4 text-cyan-400" />
                </div>

                <div className="text-2xl font-black text-white font-mono">
                  {isFree ? `${checksUsed} / ${maxChecks} Used` : "Unlimited Audits"}
                </div>

                <p className="text-xs text-wellqc-muted">
                  {isFree
                    ? `You have ${checksRemaining} free log check remaining before subscription upgrade is required.`
                    : "Your active Pro license allows unlimited LAS file uploads and data cleaning."}
                </p>

                <div className="pt-2">
                  <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                    <span>Remaining Quota:</span>
                    <span className="font-bold text-cyan-300">{checksRemaining}</span>
                  </div>
                </div>
              </div>

              {/* Payment Gateway Card */}
              <div className="bg-wellqc-card border border-wellqc-border rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Payment Provider</span>
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                </div>

                <div className="text-2xl font-black text-white">
                  Paystack Gateway
                </div>

                <p className="text-xs text-wellqc-muted">
                  Supports Nigerian Naira (₦ NGN) and US Dollars ($ USD) via Verve, Mastercard, Visa, Direct Bank Transfers, and USSD.
                </p>

                <div className="pt-2 flex items-center space-x-2 text-[10px] font-mono text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-wellqc-panel border border-wellqc-border">₦ NGN</span>
                  <span className="px-2 py-0.5 rounded bg-wellqc-panel border border-wellqc-border">$ USD</span>
                  <span className="px-2 py-0.5 rounded bg-wellqc-panel border border-wellqc-border">Card / Bank / USSD</span>
                </div>
              </div>
            </div>

            {/* Paystack Payment & Receipt History Table */}
            <div className="bg-wellqc-card border border-wellqc-border rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-wellqc-border pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Receipt className="w-4 h-4 text-cyan-400" />
                    <span>Paystack Subscription & Payment Records</span>
                  </h3>
                  <p className="text-xs text-wellqc-muted mt-0.5">
                    Immutable history of all completed transactions and subscription upgrades.
                  </p>
                </div>
              </div>

              {payments.length === 0 ? (
                <div className="p-8 text-center bg-wellqc-panel/60 border border-wellqc-border rounded-xl space-y-3">
                  <Receipt className="w-8 h-8 text-slate-500 mx-auto" />
                  <div className="text-xs font-semibold text-slate-300">No payment transactions recorded yet</div>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                    When you upgrade your subscription via Paystack, your payment receipts, transaction references, and invoices will be listed here.
                  </p>
                  <button
                    onClick={() => setPaymentModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold hover:bg-cyan-500/30 transition-all inline-flex items-center space-x-2"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>View Subscription Plans</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-wellqc-border text-slate-400 font-mono text-[11px] uppercase">
                        <th className="pb-3 font-semibold">Transaction Reference</th>
                        <th className="pb-3 font-semibold">Plan Name</th>
                        <th className="pb-3 font-semibold">Amount Paid</th>
                        <th className="pb-3 font-semibold">Payment Channel</th>
                        <th className="pb-3 font-semibold">Date</th>
                        <th className="pb-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-wellqc-border/60">
                      {payments.map((tx) => (
                        <tr key={tx.id} className="hover:bg-wellqc-panel/40 transition-colors">
                          <td className="py-3.5 font-mono text-cyan-300 font-semibold">{tx.reference}</td>
                          <td className="py-3.5 text-white font-medium">{tx.planName}</td>
                          <td className="py-3.5 font-mono text-emerald-400 font-bold">{tx.amount}</td>
                          <td className="py-3.5 text-slate-300">{tx.channel}</td>
                          <td className="py-3.5 text-slate-400 font-mono">
                            {new Date(tx.date).toLocaleDateString("en-GB")}
                          </td>
                          <td className="py-3.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 inline-flex items-center space-x-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>{tx.status}</span>
                            </span>
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
        {activeTab === "security" && (
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
        )}
      </div>
    </AppShell>
  );
}
