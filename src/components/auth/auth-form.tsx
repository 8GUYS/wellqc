"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, SyntheticEvent } from "react";
import {
  Mail,
  Lock,
  UserRound,
  LoaderCircle,
  Home,
  Eye,
  EyeOff,
  FileText,
  MessageSquare,
  Sparkles,
  FileCheck,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { safeReadJson } from "@/lib/http-client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedNda, setAcceptedNda] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState("");

  const isRegister = mode === "register";

  // Corporate Gated Invitation State
  const [inviteData, setInviteData] = useState<{
    valid: boolean;
    token: string;
    email: string;
    company: string;
    contactName?: string;
    planTier: string;
    expiresAt: string;
  } | null>(null);
  const [isVerifyingInvite, setIsVerifyingInvite] = useState(isRegister);
  const [inviteGateError, setInviteGateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRegister) {
      setIsVerifyingInvite(false);
      return;
    }

    if (!inviteToken) {
      setInviteGateError("NO_INVITE");
      setIsVerifyingInvite(false);
      return;
    }

    async function verifyInvite() {
      setIsVerifyingInvite(true);
      setInviteGateError(null);
      try {
        const res = await fetch(`/api/auth/invite/verify?token=${encodeURIComponent(inviteToken!)}`);
        const result = await safeReadJson<{
          valid?: boolean;
          token?: string;
          email?: string;
          company?: string;
          contactName?: string;
          planTier?: string;
          expiresAt?: string;
        }>(res, "Unable to verify invitation link.");

        if (!result.ok || !result.data?.valid) {
          throw new Error(result.error || "The invitation link provided is invalid or has expired.");
        }

        const data = result.data;
        setInviteData({
          valid: true,
          token: data.token || inviteToken!,
          email: data.email || "",
          company: data.company || "",
          contactName: data.contactName || "",
          planTier: data.planTier || "PRO",
          expiresAt: data.expiresAt || "",
        });
        if (data.email) setEmail(data.email);
        if (data.contactName) setName(data.contactName);
      } catch (err) {
        setInviteGateError(err instanceof Error ? err.message : "Invalid invitation.");
      } finally {
        setIsVerifyingInvite(false);
      }
    }

    verifyInvite();
  }, [isRegister, inviteToken]);

  async function handleResendVerification() {
    if (!email) return;
    setResending(true);
    setResendStatus("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const parsed = await safeReadJson<{ message?: string }>(res, "Failed to send verification link.");
      if (!parsed.ok) {
        throw new Error(parsed.error || "Failed to send verification link.");
      }
      setResendStatus(parsed.data?.message || "Fresh verification link sent! Please check your inbox.");
    } catch (err) {
      setResendStatus(err instanceof Error ? err.message : "Failed to send verification link. Please try again.");
    } finally {
      setResending(false);
    }
  }

  async function submit(event: SyntheticEvent) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setResendStatus("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (isRegister && (!cleanName || cleanName.length > 100)) {
      setError("Please enter a valid full name (max 100 characters).");
      setSaving(false);
      return;
    }
    if (!cleanEmail || cleanEmail.length > 255 || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password,
          role: "USER",
          acceptedNda,
          inviteToken: inviteToken || undefined,
        }),
      });
      const res = await safeReadJson<{
        user?: unknown;
        token?: string;
        requiresVerification?: boolean;
        detail?: string;
        error?: string;
      }>(response, "Unable to communicate with the authentication server. Please ensure the backend is running.");

      if (!res.ok) {
        throw new Error(res.error || "Unable to continue.");
      }

      const result = res.data;
      if (!result) {
        throw new Error("Empty response received from authentication server.");
      }

      // If registered account requires email verification, redirect to instructions screen
      if (isRegister && result.requiresVerification) {
        router.push(`/verify-email-pending?email=${encodeURIComponent(email)}`);
        return;
      }

      // Clear any previous user's workspace session from this device
      try {
        localStorage.removeItem("wellqc_upload_workspace");
        localStorage.removeItem("wellqc_latest_committed_well");
        localStorage.removeItem("wellqc_active_user_id");
      } catch { }

      router.replace("/upload");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue.");
    } finally {
      setSaving(false);
    }
  }

  const isUnverifiedError =
    error.toLowerCase().includes("not been verified") ||
    error.toLowerCase().includes("verify your email");

  return (
    <main className="min-h-screen bg-[#e7eef4] dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden transition-colors duration-200">
      {/* Subtle organic background ambient glow matching the reference design */}
      <div className="absolute top-[-10%] left-[-5%] w-[550px] h-[550px] bg-cyan-200/50 dark:bg-cyan-950/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-emerald-200/40 dark:bg-emerald-950/20 rounded-full blur-[160px] pointer-events-none" />

      {/* Main Dual-Column Modal / Card Container */}
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden grid grid-cols-1 md:grid-cols-12 relative z-10">

        {/* ── LEFT PANE: BRANDING & PRODUCT INTELLIGENCE (DARK PETROL NAVY) ── */}
        <div className="md:col-span-6 bg-[#0f2137] text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle geometric light accent */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-[90px] pointer-events-none" />

          {/* Top Logo */}
          <div className="flex items-center justify-between z-10">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-inner group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5 text-cyan-300" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white text-xl tracking-tight">WellQC<span className="text-emerald-400 font-extrabold">+</span></span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 uppercase">
                  AI
                </span>
              </div>
            </Link>

            <Link
              href="/"
              title="Return to homepage"
              className="md:hidden flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </Link>
          </div>

          {/* Main Hero Value Proposition */}
          <div className="my-10 z-10 space-y-6">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight">
              Intelligent Well Log Analysis for Engineering Data
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed max-w-md font-sans">
              Upload technical LAS well logs, extract critical curve telemetry, and query petrophysical anomalies across files with context-aware AI assistance. WellQC enables faster interpretation, better decisions, and seamless collaboration.
            </p>

            {/* Feature Capability Badges */}
            <div className="flex flex-wrap gap-2.5 pt-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-slate-200 text-xs font-medium backdrop-blur-sm shadow-sm">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                <span>Smart Log &amp; Anomaly Chat</span>
              </div>

              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-slate-200 text-xs font-medium backdrop-blur-sm shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Petrophysical Intelligence</span>
              </div>

              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-slate-200 text-xs font-medium backdrop-blur-sm shadow-sm">
                <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Automated Data Extraction</span>
              </div>
            </div>
          </div>

          {/* Bottom Trust & Attribution Bar */}
          <div className="pt-6 border-t border-white/10 flex items-center gap-3 z-10">
            <div className="flex -space-x-1.5 shrink-0">
              <div className="w-6 h-6 rounded-full bg-cyan-600 border-2 border-[#0f2137] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                W
              </div>
              <div className="w-6 h-6 rounded-full bg-teal-600 border-2 border-[#0f2137] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                Q
              </div>
              <div className="w-6 h-6 rounded-full bg-emerald-600 border-2 border-[#0f2137] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                C
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-snug">
              Trusted by engineering professionals to accelerate data-driven decisions.
            </p>
          </div>
        </div>

        {/* ── RIGHT PANE: MODERN AUTHENTICATION FORM (CRISP WHITE / LIGHT) ── */}
        <div className="md:col-span-6 bg-white dark:bg-slate-900 p-8 sm:p-12 flex flex-col justify-between">
          <div>
            {/* Top Desktop Navigation */}
            <div className="hidden md:flex justify-end mb-4">
              <Link
                href="/"
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Back to Home</span>
              </Link>
            </div>

            {/* Form Header */}
            {isRegister ? (
              isVerifyingInvite ? (
                <div className="py-16 text-center space-y-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                  <LoaderCircle className="w-8 h-8 animate-spin mx-auto text-purple-600 dark:text-purple-400" />
                  <p className="font-bold text-slate-700 dark:text-slate-200">Verifying corporate invitation token...</p>
                  <p className="text-[11px]">Connecting to corporate access controller.</p>
                </div>
              ) : inviteGateError === "NO_INVITE" ? (
                <div className="space-y-6 py-2">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-300">
                    <ShieldCheck className="w-6 h-6" />
                  </div>

                  <div>
                    <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      Corporate Invitation Required
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
                      WellQCPlus Workstation Access
                    </h2>
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Registration to WellQCPlus Workstation is by corporate invitation only. If your organization has completed onboarding or booked an enterprise demo, please use your dedicated invitation link.
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-3 text-xs">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>How to obtain workstation credentials:</span>
                    </div>
                    <ul className="space-y-2 text-slate-600 dark:text-slate-400 pl-1">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                        <span><strong>Book a Technical Demo:</strong> Our engineering team will review your fleet portfolio and issue an encrypted onboarding token.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                        <span><strong>Team Invitation:</strong> Contact your company administrator to dispatch an invite to your corporate address.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <Link
                      href="/#demo"
                      className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 text-center"
                    >
                      <span>Request Enterprise Demo &amp; Access</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    <Link
                      href="/login"
                      className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors flex items-center justify-center text-center"
                    >
                      Already have an account? Sign in &rarr;
                    </Link>
                  </div>
                </div>
              ) : inviteGateError ? (
                <div className="space-y-6 py-2">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="w-6 h-6" />
                  </div>

                  <div>
                    <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      Invitation Notice
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
                      Invitation Expired or Invalid
                    </h2>
                    <p className="mt-2 text-xs sm:text-sm text-rose-600 dark:text-rose-300 leading-relaxed font-medium">
                      {inviteGateError}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Invitation links expire after their allotted validity period or once consumed. Contact your administrator or sales representative to generate a fresh invitation.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <Link
                      href="/#demo"
                      className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 text-center"
                    >
                      <span>Request Fresh Invitation Link</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    <Link
                      href="/login"
                      className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors flex items-center justify-center text-center"
                    >
                      Return to Sign In &rarr;
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mb-6">
                  {inviteData && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 text-[11px] font-mono font-bold mb-3">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{inviteData.company}</span>
                      <span>•</span>
                      <span className="uppercase">{inviteData.planTier} TIER</span>
                    </div>
                  )}
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Welcome, {inviteData?.company || "Corporate"} Team
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                    Activate your workstation credentials to access your organization&apos;s well repository.
                  </p>
                </div>
              )
            ) : (
              <div className="mb-8">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Welcome back
                </h2>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                  Sign in to continue to your workstation
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-5 text-xs text-rose-700 dark:text-rose-200 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl p-3.5 space-y-2">
                <p className="font-medium">{error}</p>
                {isUnverifiedError && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resending}
                      className="text-cyan-700 dark:text-cyan-300 hover:underline font-bold cursor-pointer disabled:opacity-50"
                    >
                      {resending ? "Sending verification email..." : "Resend verification link"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Resend status notice */}
            {resendStatus && (
              <div className="mb-5 text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-3.5">
                {resendStatus}
              </div>
            )}

            {/* Show Form only when:
                1. Mode is login, OR
                2. Mode is register AND invite has been verified successfully */}
            {(!isRegister || (isRegister && inviteData && !inviteGateError)) && (
              <form onSubmit={submit} className="space-y-4">
                {/* Full Name Field (Register Mode Only) */}
                {isRegister && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Full name
                    </label>
                    <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 focus-within:border-cyan-600 focus-within:ring-2 focus-within:ring-cyan-500/20 focus-within:bg-white dark:focus-within:bg-slate-800 transition-all">
                      <UserRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        autoComplete="name"
                        maxLength={100}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Dr. Samuel Williams"
                        className="w-full bg-transparent pl-10 pr-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Email Address Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Corporate email address
                    </label>
                    {isRegister && inviteData && (
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Verified &amp; Locked</span>
                      </span>
                    )}
                  </div>
                  <div
                    className={`relative rounded-xl border border-slate-200 dark:border-slate-700 ${
                      isRegister && inviteData
                        ? "bg-slate-100/90 dark:bg-slate-800/90 cursor-not-allowed"
                        : "bg-slate-50/70 dark:bg-slate-800/60 focus-within:border-cyan-600 focus-within:ring-2 focus-within:ring-cyan-500/20 focus-within:bg-white dark:focus-within:bg-slate-800"
                    } transition-all`}
                  >
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      maxLength={255}
                      readOnly={Boolean(isRegister && inviteData)}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full bg-transparent pl-10 pr-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none disabled:opacity-80"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 focus-within:border-cyan-600 focus-within:ring-2 focus-within:ring-cyan-500/20 focus-within:bg-white dark:focus-within:bg-slate-800 transition-all">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete={isRegister ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-transparent pl-10 pr-10 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember me & Forgot Password Row */}
                {!isRegister && (
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-cyan-600 focus:ring-cyan-500 cursor-pointer accent-[#0f2137]"
                      />
                      <span>Remember me</span>
                    </label>

                    <Link
                      href="/forgot-password"
                      className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                )}

                {/* NDA Agreement Checkbox (Register Mode Only) */}
                {isRegister && (
                  <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 pt-1 cursor-pointer">
                    <input
                      required
                      checked={acceptedNda}
                      onChange={(e) => setAcceptedNda(e.target.checked)}
                      type="checkbox"
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-cyan-600 focus:ring-cyan-500 accent-[#0f2137] cursor-pointer"
                    />
                    <span className="leading-snug">
                      I agree to keep uploaded well log data confidential and use it only within my authorised workspace.
                    </span>
                  </label>
                )}

                {/* Sign In CTA Button */}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-[#0f2137] hover:bg-[#0c1c2e] dark:bg-purple-600 dark:hover:bg-purple-500 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer disabled:opacity-60"
                >
                  {saving && <LoaderCircle className="w-4 h-4 animate-spin" />}
                  <span>{isRegister ? "Activate Workstation Account" : "Sign in"}</span>
                </button>
              </form>
            )}
          </div>

          {/* Bottom Switch Link */}
          <div className="mt-8 text-center text-xs text-slate-600 dark:text-slate-400">
            {isRegister ? (
              <p>
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-slate-900 dark:text-white hover:underline transition-all ml-1"
                >
                  Sign in
                </Link>
              </p>
            ) : (
              <p>
                New organization?{" "}
                <Link
                  href="/#demo"
                  className="font-semibold text-cyan-700 dark:text-cyan-400 hover:underline transition-all ml-1 inline-flex items-center gap-1"
                >
                  <span>Request enterprise access &amp; demo</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
