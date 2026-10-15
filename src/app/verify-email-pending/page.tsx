"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import {
  Mail,
  Database,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";

import { safeReadJson } from "@/lib/http-client";

function VerifyEmailPendingContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "your email address";

  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setResendStatus(null);
    setResendError(null);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email === "your email address" ? "" : email }),
      });
      const jsonResult = await safeReadJson<{ message?: string }>(res);
      if (!jsonResult.ok) {
        throw new Error(jsonResult.error || "Unable to resend verification email.");
      }
      setResendStatus(jsonResult.data?.message || "A fresh verification link has been sent to your inbox!");
      setCooldown(60);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to resend verification email.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="min-h-screen bg-wellqc-dark flex items-center justify-center p-5 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg border border-wellqc-border bg-wellqc-panel/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-wellqc-border/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <Database className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">WellQC</h1>
              <p className="text-xs text-wellqc-muted font-mono">Subsurface Data Assurance</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            Account Verification
          </span>
        </div>

        {/* Hero Notice */}
        <div className="text-center space-y-3 pt-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/10">
            <Mail className="w-8 h-8 text-cyan-300 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Check your inbox
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed font-mono">
            We sent a secure verification link to:
          </p>
          <div className="inline-block px-3.5 py-1.5 rounded-lg bg-wellqc-card border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold break-all">
            {email}
          </div>
        </div>

        {/* Verification Instructions Card */}
        <div className="bg-wellqc-card/60 border border-wellqc-border/80 rounded-xl p-4 space-y-3 font-mono text-xs text-slate-300">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>Click the verification link in the email to activate your account.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>The link expires automatically in <strong>24 hours</strong>.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>If you don&apos;t see it, check your spam or junk folder.</span>
          </div>
        </div>

        {/* Feedback Messages */}
        {resendStatus && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{resendStatus}</span>
          </div>
        )}

        {resendError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{resendError}</span>
          </div>
        )}

        {/* Resend Action */}
        <div className="pt-2 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
            className="w-full py-2.5 px-4 rounded-xl bg-wellqc-card hover:bg-wellqc-dark border border-wellqc-border hover:border-cyan-500/40 text-cyan-300 font-bold font-mono text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
            <span>
              {resending
                ? "Sending verification link..."
                : cooldown > 0
                  ? `Resend email in ${cooldown}s`
                  : "Resend verification email"}
            </span>
          </button>

          <div className="flex items-center gap-4 text-xs font-mono text-wellqc-muted pt-2">
            <Link
              href="/register"
              className="hover:text-cyan-300 transition-colors"
            >
              ← Use different email
            </Link>
            <span>•</span>
            <Link
              href="/login"
              className="text-cyan-300 hover:text-cyan-200 font-bold flex items-center gap-1 transition-colors"
            >
              <span>Back to sign in</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Local Development Logger Tip */}
        {/* <div className="pt-3 border-t border-wellqc-border/40 text-[11px] font-mono text-slate-400 bg-wellqc-card/30 p-3 rounded-lg flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            <strong>Local Dev Tip:</strong> The verification link has been printed directly to your Python backend terminal logger. Check your server console to click or copy the URL.
          </p>
        </div> */}
      </div>
    </main>
  );
}

export default function VerifyEmailPendingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-wellqc-dark flex items-center justify-center p-5">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <VerifyEmailPendingContent />
    </Suspense>
  );
}
