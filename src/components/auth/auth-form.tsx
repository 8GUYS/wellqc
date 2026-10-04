"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, SyntheticEvent } from "react";
import { Database, KeyRound, Mail, UserRound, LoaderCircle, Home, Eye, EyeOff } from "lucide-react";
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("PETROPHYSICIST");
  const [acceptedNda, setAcceptedNda] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isRegister = mode === "register";

  async function submit(event: SyntheticEvent) {
    event.preventDefault();


    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, acceptedNda }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to continue.");

      // Clear any previous user's workspace session from this device
      try {
        localStorage.removeItem("wellqc_upload_workspace");
        localStorage.removeItem("wellqc_latest_committed_well");
        localStorage.removeItem("wellqc_active_user_id");
      } catch {}

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-wellqc-dark flex items-center justify-center p-5">
      <div className="w-full max-w-md border border-wellqc-border bg-wellqc-panel p-7 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <Database className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">WellQC+</h1>
              <p className="text-xs text-wellqc-muted font-mono">Well log quality workspace</p>
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
        <h2 className="text-lg font-bold text-white">{isRegister ? "Create your account" : "Sign in"}</h2>
        <p className="mt-1 text-xs text-wellqc-muted">
          {isRegister ? "Start validating and managing your well logs." : "Use your WellQC+ account to continue."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {isRegister && (
            <Field icon={<UserRound className="w-4 h-4" />} label="Full name" value={name} onChange={setName} autoComplete="name" />
          )}
          <Field icon={<Mail className="w-4 h-4" />} label="Email address" value={email} onChange={setEmail} type="email" autoComplete="email" />
          <Field icon={<KeyRound className="w-4 h-4" />} label="Password" value={password} onChange={setPassword} type="password" autoComplete={isRegister ? "new-password" : "current-password"} hint={isRegister ? "At least 8 characters" : undefined} />


          {isRegister && (
            <label className="flex items-start gap-2 text-xs text-slate-300">
              <input required checked={acceptedNda} onChange={(event) => setAcceptedNda(event.target.checked)} type="checkbox" className="mt-0.5 accent-cyan-400" />
              <span>I agree to keep uploaded well data confidential and use it only within my authorised workspace.</span>
            </label>
          )}
          {error && <div className="text-xs text-red-200 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{error}</div>}
          <button disabled={saving} className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold text-sm">
            {saving && <LoaderCircle className="w-4 h-4 animate-spin" />}
            {isRegister ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-wellqc-muted">
          {isRegister ? "Already have an account?" : "New to WellQC+?"}{" "}
          <Link href={isRegister ? "/login" : "/register"} className="text-cyan-300 hover:text-cyan-200 font-semibold">
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </main>
  );
}


function Field({
  icon,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete: string;
  hint?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordField = type === "password";
  const inputType = isPasswordField ? (showPassword ? "text" : "password") : type;

  return (
    <label className="block">
      <span className="flex items-center gap-2 text-xs font-semibold text-slate-200 mb-1.5">
        {icon}
        {label}
      </span>
      <div className="relative">
        <input
          required
          minLength={isPasswordField ? 8 : undefined}
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          className={`w-full bg-wellqc-card border border-wellqc-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400 ${
            isPasswordField ? "pr-10" : ""
          }`}
        />
        {isPasswordField && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-300 p-1 rounded transition-colors focus:outline-none focus:text-cyan-300"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
      {hint && <span className="mt-1 block text-[10px] text-wellqc-muted">{hint}</span>}
    </label>
  );
}
