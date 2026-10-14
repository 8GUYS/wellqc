"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useRef } from "react";
import {
  CheckCircle2,
  XCircle,
  LoaderCircle,
  Database,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Mail,
} from "lucide-react";

import { safeReadJson } from "@/lib/http-client";

type VerificationStatus = "verifying" | "success" | "error";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<VerificationStatus>("verifying");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(3);

  // Resend state for error fallback
  const [resendEmail, setResendEmail] = useState<string>("");
  const [resending, setResending] = useState<boolean>(false);
  const [resendFeedback, setResendFeedback] = useState<string | null>(null);

  const verificationAttempted = useRef(false);

  useEffect(() => {
    if (!token || verificationAttempted.current) return;
    verificationAttempted.current = true;

    async function executeVerification() {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token!)}`);
        const jsonResult = await safeReadJson<{ user?: { email?: string }; message?: string }>(res);

        if (!jsonResult.ok) {
          throw new Error(jsonResult.error || "Verification failed. The link may be expired or the server is starting up.");
        }

        setStatus("success");
        if (jsonResult.data?.user?.email) {
          setUserEmail(jsonResult.data.user.email);
        }

        // Start countdown to redirect
        let secondsLeft = 3;
        const interval = setInterval(() => {
          secondsLeft -= 1;
          setCountdown(secondsLeft);
          if (secondsLeft <= 0) {
            clearInterval(interval);
            router.replace("/dashboard");
            router.refresh();
          }
        }, 1000);
      } catch (err) {
        setStatus("error");
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "The verification link is invalid or has expired."
        );
      }
    }

    executeVerification();
  }, [token, router]);

  async function handleResendFreshLink(e: React.FormEvent) {
    e.preventDefault();
    if (!resendEmail) return;
    setResending(true);
    setResendFeedback(null);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      const jsonResult = await safeReadJson<{ message?: string }>(res);
      if (!jsonResult.ok) {
        setResendFeedback(jsonResult.error || "Failed to send verification link. Please check your network connection.");
      } else {
        setResendFeedback(
          jsonResult.data?.message || "Fresh verification link sent! Please check your inbox."
        );
      }
    } catch {
      setResendFeedback("Failed to send verification link. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="min-h-screen bg-wellqc-dark flex items-center justify-center p-5 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg border border-wellqc-border bg-wellqc-panel/95 backdrop-blur-xl p-8 rounded-2xl shadow-2xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-wellqc-border/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <Database className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">WellQC</h1>
              <p className="text-xs text-wellqc-muted font-mono">Digital Signature &amp; Auth</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            Email Verification
          </span>
        </div>

        {/* State 1: Verifying in progress */}
        {status === "verifying" && (
          <div className="text-center py-6 space-y-4 font-mono">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <LoaderCircle className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Verifying your email...
            </h2>
            <p className="text-xs text-wellqc-muted max-w-xs mx-auto leading-relaxed">
              Validating cryptographic token signature against WellQC authentication authority.
            </p>
          </div>
        )}

        {/* State 2: Success */}
        {status === "success" && (
          <div className="text-center py-4 space-y-4 font-mono">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Email Verified!
              </h2>
              <p className="text-xs text-emerald-300">
                Your account is now fully active and verified.
              </p>
              {userEmail && (
                <div className="pt-2">
                  <span className="px-3 py-1 rounded-lg bg-wellqc-card border border-wellqc-border text-slate-300 text-xs">
                    {userEmail}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-wellqc-card/60 border border-wellqc-border rounded-xl p-4 text-xs text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Redirecting to workspace...</span>
              </span>
              <span className="font-bold text-cyan-400">{countdown}s</span>
            </div>

            <button
              type="button"
              onClick={() => {
                router.replace("/dashboard");
                router.refresh();
              }}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Launch Workspace Immediately</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* State 3: Error */}
        {status === "error" && (
          <div className="text-center py-4 space-y-5 font-mono">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shadow-lg shadow-red-500/10">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Verification Failed
              </h2>
              <p className="text-xs text-red-300 leading-relaxed max-w-sm mx-auto">
                {errorMessage || "The verification link is invalid or has expired."}
              </p>
            </div>

            {/* Request Fresh Link Card */}
            <div className="bg-wellqc-card/70 border border-wellqc-border rounded-xl p-5 text-left space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Mail className="w-4 h-4 text-cyan-400" />
                <span>Request a new verification link</span>
              </div>
              <p className="text-[11px] text-wellqc-muted leading-relaxed">
                Enter your registered email address and we will dispatch a fresh 24-hour verification token.
              </p>

              <form onSubmit={handleResendFreshLink} className="space-y-3 pt-1">
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-wellqc-dark border border-wellqc-border text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />

                <button
                  type="submit"
                  disabled={resending || !resendEmail}
                  className="w-full py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
                  <span>{resending ? "Dispatching..." : "Send Fresh Verification Link"}</span>
                </button>
              </form>

              {resendFeedback && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px]">
                  {resendFeedback}
                </div>
              )}
            </div>

            <div className="pt-2 text-xs text-wellqc-muted">
              <Link
                href="/login"
                className="text-cyan-300 hover:text-cyan-200 font-bold inline-flex items-center gap-1 transition-colors"
              >
                <span>Return to sign in</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-wellqc-dark flex items-center justify-center p-5">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
