"use client";

import Link from "next/link";
import { useState, SyntheticEvent } from "react";
import { Database, Mail, LoaderCircle, Home, ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react";
import { safeReadJson } from "@/lib/http-client";
import { isValidEmail } from "@/lib/auth-validation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setError("Please provide a valid corporate email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const jsonResult = await safeReadJson<{ success?: boolean; message?: string }>(response);
      if (!jsonResult.ok) {
        throw new Error(jsonResult.error || "Failed to process password reset request.");
      }

      setSubmitted(true);
      setFeedbackMessage(
        jsonResult.data?.message ||
        "If an account exists with this email address, password reset instructions have been dispatched."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to process request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-wellqc-dark flex items-center justify-center p-5 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

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

        {!submitted ? (
          <>
            <h2 className="text-lg font-bold text-white">Forgot your password?</h2>
            <p className="mt-1 text-xs text-wellqc-muted">
              Enter your corporate email address and we will dispatch a secure, signed password reset link.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-200 mb-1.5">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  Email address
                </span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@energy-corp.com"
                  autoComplete="email"
                  className="w-full bg-wellqc-card border border-wellqc-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400 transition-colors"
                />
              </label>

              {error && (
                <div className="text-xs text-red-200 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
              >
                {loading && <LoaderCircle className="w-4 h-4 animate-spin" />}
                Send reset link
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-wellqc-border/60 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </Link>
            </div>
          </>
        ) : (
          <div className="space-y-5 text-center py-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">Instructions Dispatched</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                {feedbackMessage}
              </p>
              <div className="inline-block px-3 py-1 bg-wellqc-card border border-wellqc-border rounded font-mono text-xs text-cyan-300 break-all">
                {email}
              </div>
            </div>

            <div className="bg-wellqc-card/80 border border-wellqc-border/80 rounded-lg p-3 text-left space-y-1.5 text-[11px] text-wellqc-muted">
              <p className="font-semibold text-slate-300">Security Notes:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Reset link expires automatically in 1 hour.</li>
                <li>Check your spam or junk folder if the email doesn&apos;t arrive in 2 minutes.</li>
              </ul>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setError("");
                }}
                className="w-full py-2 rounded-lg border border-wellqc-border hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-colors"
              >
                Try a different email address
              </button>

              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 py-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Return to sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
