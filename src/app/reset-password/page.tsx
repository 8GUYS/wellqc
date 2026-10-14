"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, SyntheticEvent } from "react";
import {
  Database,
  KeyRound,
  Eye,
  EyeOff,
  LoaderCircle,
  Home,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
} from "lucide-react";
import { safeReadJson } from "@/lib/http-client";
import { validatePassword } from "@/lib/auth-validation";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const validation = validatePassword(password);
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  function getStrengthLabel(score: number): { label: string; color: string; width: string } {
    if (password.length === 0) return { label: "", color: "bg-slate-700", width: "w-0" };
    switch (score) {
      case 1:
        return { label: "Weak", color: "bg-red-500", width: "w-1/4" };
      case 2:
        return { label: "Fair", color: "bg-amber-500", width: "w-2/4" };
      case 3:
        return { label: "Good", color: "bg-cyan-400", width: "w-3/4" };
      case 4:
      default:
        return { label: "Strong", color: "bg-emerald-400", width: "w-full" };
    }
  }

  const strength = getStrengthLabel(validation.score);

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();

    if (!token) {
      setError("Missing password reset token. Please request a new link.");
      return;
    }

    if (!hasMinLength) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const jsonResult = await safeReadJson<{ success?: boolean; message?: string }>(response);
      if (!jsonResult.ok) {
        throw new Error(jsonResult.error || "Unable to reset password.");
      }

      setSuccess(true);

      // Start redirect countdown
      let remaining = 3;
      const interval = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          router.replace("/login");
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  // Token missing state
  if (!token) {
    return (
      <div className="w-full max-w-md border border-wellqc-border bg-wellqc-panel/95 backdrop-blur-xl p-7 rounded-xl shadow-2xl relative z-10 text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">Invalid Reset Link</h2>
          <p className="text-xs text-wellqc-muted leading-relaxed">
            No password reset token was provided in the URL, or the link format is incomplete.
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-colors"
        >
          Request new reset link
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md border border-wellqc-border bg-wellqc-panel/95 backdrop-blur-xl p-7 rounded-xl shadow-2xl relative z-10">
      {/* Brand Header */}
      <div className="flex items-center justify-between mb-7 border-b border-wellqc-border/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
            <Database className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">WellQC</h1>
            <p className="text-xs text-wellqc-muted font-mono">Subsurface Security &amp; Auth</p>
          </div>
        </div>
        <Link
          href="/"
          title="Back to home page"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-slate-400 hover:text-white hover:bg-slate-700/60 border border-transparent hover:border-slate-600 transition-all"
        >
          <Home className="w-3.5 h-3.5" />
          Home
        </Link>
      </div>

      {!success ? (
        <>
          <h2 className="text-lg font-bold text-white">Create new password</h2>
          <p className="mt-1 text-xs text-wellqc-muted">
            Enter a new password for your WellQC account. Must be at least 8 characters.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* New Password Field */}
            <label className="block">
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-200 mb-1.5">
                <KeyRound className="w-4 h-4 text-cyan-400" />
                New password
              </span>
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="w-full bg-wellqc-card border border-wellqc-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400 pr-10 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-300 p-1 rounded transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <div className="space-y-2 bg-wellqc-card/60 border border-wellqc-border/80 rounded-lg p-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-wellqc-muted text-[11px]">Password Strength:</span>
                  <span className="font-semibold text-[11px] text-slate-200">{strength.label}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300`} />
                </div>
                <div className="grid grid-cols-2 gap-1 pt-1 text-[10px]">
                  <RequirementMet met={hasMinLength} text="At least 8 characters" />
                  <RequirementMet met={hasUppercase} text="Uppercase letter" />
                  <RequirementMet met={hasNumber} text="Number" />
                  <RequirementMet met={hasSymbol} text="Special symbol" />
                </div>
              </div>
            )}

            {/* Confirm Password Field */}
            <label className="block">
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-200 mb-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Confirm new password
              </span>
              <div className="relative">
                <input
                  required
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  className="w-full bg-wellqc-card border border-wellqc-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400 pr-10 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-300 p-1 rounded transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <div className="mt-1.5 text-[11px] flex items-center gap-1.5">
                  {passwordsMatch ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Passwords match
                    </span>
                  ) : (
                    <span className="text-red-400 flex items-center gap-1">
                      <X className="w-3 h-3" /> Passwords do not match
                    </span>
                  )}
                </div>
              )}
            </label>

            {error && (
              <div className="text-xs text-red-200 bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2">
                <p>{error}</p>
                {error.toLowerCase().includes("expired") || error.toLowerCase().includes("invalid") ? (
                  <div className="pt-1">
                    <Link
                      href="/forgot-password"
                      className="text-cyan-300 hover:text-cyan-200 font-bold underline"
                    >
                      Request a new reset link &rarr;
                    </Link>
                  </div>
                ) : null}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !hasMinLength || !passwordsMatch}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
            >
              {loading && <LoaderCircle className="w-4 h-4 animate-spin" />}
              Update password
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-wellqc-border/60 text-center">
            <Link
              href="/login"
              className="text-xs font-semibold text-slate-400 hover:text-cyan-300 transition-colors"
            >
              Cancel and back to sign in
            </Link>
          </div>
        </>
      ) : (
        <div className="space-y-5 text-center py-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Password Reset Complete</h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
              Your password has been updated successfully. You can now use your new password to access your WellQC workspace.
            </p>
          </div>

          <div className="bg-wellqc-card border border-wellqc-border rounded-lg py-2.5 px-4 font-mono text-xs text-cyan-300">
            Redirecting to sign in page in <span className="font-bold text-white">{countdown}s</span>...
          </div>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-colors"
          >
            Sign in now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

function RequirementMet({ met, text }: { met: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${met ? "text-emerald-400" : "text-slate-500"}`}>
      {met ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-slate-600" />}
      <span>{text}</span>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-wellqc-dark flex items-center justify-center p-5 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <Suspense
        fallback={
          <div className="w-full max-w-md border border-wellqc-border bg-wellqc-panel p-8 rounded-xl flex items-center justify-center">
            <LoaderCircle className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </main>
  );
}
