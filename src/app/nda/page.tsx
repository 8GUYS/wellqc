"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  FileText,
  CheckCircle2,
  AlertCircle,
  Activity,
  ArrowRight,
  LogOut,
  RefreshCw,
  Eye,
  Globe,
  Database,
} from "lucide-react";

export default function NDAPage() {
  const router = useRouter();
  const [acceptedCheckbox, setAcceptedCheckbox] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAcceptNDA() {
    if (!acceptedCheckbox) {
      setError("Please check the confirmation box to accept the agreement terms.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/auth/nda", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to accept NDA.");
        setLoading(false);
        return;
      }

      // Notify AppShell session listener
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("wellqc_user_updated"));
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError("An error occurred while submitting NDA agreement.");
      setLoading(false);
    }
  }

  async function handleDecline() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      router.replace("/login");
    }
  }

  return (
    <div className="min-h-screen bg-wellqc-dark flex items-center justify-center p-4 md:p-6 relative overflow-hidden select-none">
      {/* Dynamic Background Glow Effects */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-4xl bg-wellqc-card/90 backdrop-blur-xl border border-wellqc-border rounded-3xl p-6 md:p-10 shadow-2xl space-y-6 relative z-10">
        {/* Header Branding */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wellqc-border pb-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-wellqc-dark rounded-[14px] flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-extrabold tracking-tight text-white">
                  WellQC<span className="text-cyan-400 font-black">+</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  ENTERPRISE DATA ROOM
                </span>
              </div>
              <p className="text-xs text-wellqc-muted mt-0.5">
                Subsurface Log Data Processing & Non-Disclosure Agreement (NDA)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>Multi-Tenant Data Isolation Active</span>
          </div>
        </div>

        {/* Error Alert Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* NDA Terms Container */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center space-x-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Legal Terms & Subsurface Data Protection Policies</span>
            </h2>
            <span className="text-[11px] text-wellqc-muted font-mono">Version 2.4.0-Enterprise</span>
          </div>

          <div className="h-80 overflow-y-auto p-5 rounded-2xl bg-wellqc-panel/80 border border-wellqc-border space-y-5 text-xs text-slate-300 leading-relaxed font-sans scrollbar-thin scrollbar-thumb-wellqc-border">
            {/* Clause 1 */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-white flex items-center space-x-2">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <span>1. Proprietary Subsurface Data Ownership & Workspace Isolation</span>
              </h3>
              <p className="text-slate-400 text-[11px] pl-5">
                All Log ASCII Standard (LAS) files, headers (`~V`, `~W`, `~C`, `~P`), wireline curve data matrices (GR, RHOB, NPHI, DT, RT, etc.), geographic coordinates, and calculated petrophysical anomalies submitted to WellQC+ remain the exclusive, non-transferable property of the subscribing organization (`ownerId`). WellQC+ enforces multi-tenant database row-level query isolation across all API endpoints.
              </p>
            </div>

            {/* Clause 2 */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-white flex items-center space-x-2">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>2. Zero-Retention In-Memory Processing & No Model Training</span>
              </h3>
              <p className="text-slate-400 text-[11px] pl-5">
                Uploaded LAS well log curves are parsed and evaluated in transient server memory for quality scoring, physical limit checks, and KNN imputation. WellQC+ explicitly covenants that private client well log curves, synthetic rock property models, and reservoir interpretations will never be used to train public machine learning or third-party AI foundation models.
              </p>
            </div>

            {/* Clause 3 */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-white flex items-center space-x-2">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>3. Regulatory Alignment & International E&P Standards</span>
              </h3>
              <p className="text-slate-400 text-[11px] pl-5">
                This agreement aligns with international E&P regulatory frameworks, including the UK North Sea Transition Authority (NSTA) Data Governance Code, US NOGICP standards, and the Nigerian Upstream Petroleum Regulatory Commission (NUPRC) data confidentiality guidelines.
              </p>
            </div>

            {/* Clause 4 */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-white flex items-center space-x-2">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>4. Audit Log Integrity & Immutable Activity Tracking</span>
              </h3>
              <p className="text-slate-400 text-[11px] pl-5">
                Every LAS file ingestion, curve standardisation alias override, KNN imputation execution, export download, and API token dispatch is recorded in an immutable compliance audit trail (`ActivityLog`) visible to system administrators.
              </p>
            </div>
          </div>
        </div>

        {/* Confirmation Checkbox */}
        <div className="p-4 rounded-2xl bg-wellqc-panel border border-cyan-500/30 flex items-start space-x-3">
          <input
            type="checkbox"
            id="ndaCheck"
            checked={acceptedCheckbox}
            onChange={(e) => setAcceptedCheckbox(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-wellqc-border bg-wellqc-card text-cyan-500 focus:ring-cyan-500/40 focus:ring-offset-0 cursor-pointer"
          />
          <label htmlFor="ndaCheck" className="text-xs text-slate-200 cursor-pointer select-none font-medium">
            I confirm that I am authorized to bind my organization, and I accept the terms of the <span className="text-cyan-300 font-bold">WellQC+ Subsurface Data Processing & Non-Disclosure Agreement</span>.
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-wellqc-border">
          <button
            onClick={handleDecline}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-wellqc-panel border border-wellqc-border hover:bg-wellqc-card text-slate-400 hover:text-white font-semibold text-xs transition-all flex items-center justify-center space-x-2"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Decline & Sign Out</span>
          </button>

          <button
            onClick={handleAcceptNDA}
            disabled={!acceptedCheckbox || loading}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow-xl shadow-cyan-500/25 flex items-center justify-center space-x-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-cyan-200" />
            )}
            <span>{loading ? "Recording Agreement..." : "Accept NDA & Enter Platform"}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
