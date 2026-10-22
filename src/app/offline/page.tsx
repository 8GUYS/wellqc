"use client";

import Link from "next/link";
import { WifiOff, RefreshCw, ArrowLeft, ShieldAlert } from "lucide-react";
import { WellQCLogo } from "@/components/ui/wellqc-logo";

export default function OfflinePage() {
  const handleRetry = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-wellqc-dark text-wellqc-text flex flex-col items-center justify-center p-4 selection:bg-cyan-500/30 font-sans">
      <div className="w-full max-w-md bg-wellqc-panel border border-wellqc-border rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
        <div className="flex justify-center">
          <WellQCLogo className="h-10 w-auto" />
        </div>

        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
          <WifiOff className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-white">
            Workstation Offline
          </h1>
          <p className="text-xs sm:text-sm text-wellqc-muted leading-relaxed">
            You are currently disconnected from the corporate network. Cached well logs, theme profiles, and local telemetry are preserved in your browser.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-wellqc-card border border-wellqc-border text-left flex items-start space-x-3 text-xs">
          <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-slate-200">Local Cache Protected</span>
            <p className="text-[11px] text-wellqc-muted leading-normal">
              Any pending audits or queue operations will automatically sync once your connection is restored.
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleRetry}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Check Connection</span>
          </button>
          <Link
            href="/dashboard"
            className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-wellqc-card hover:bg-slate-800 text-slate-300 hover:text-white border border-wellqc-border transition-colors flex items-center justify-center space-x-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
