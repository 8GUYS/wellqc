import Link from "next/link";
import { CheckCircle2, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { QualityAnomaly } from "@/lib/las/quality-engine";

interface AnomaliesListTabProps {
  anomalies: QualityAnomaly[];
}

export function AnomaliesListTab({ anomalies }: AnomaliesListTabProps) {
  if (anomalies.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
        <h4 className="text-sm font-bold text-white font-mono">Zero Petrophysical Anomalies Flagged</h4>
        <p className="text-xs text-wellqc-muted font-mono">
          This well log passed all depth sequencing, null threshold, spike, and physical boundary checks.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      {/* QA Engine Action Callout Banner */}
      <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0" />
          <div className="space-y-0.5">
            <span className="text-xs font-mono font-bold text-white">
              {anomalies.length} Wireline Anomalies Detected
            </span>
            <p className="text-[11px] font-mono text-purple-200/80">
              Execute user-approved despiking, physical boundary clamping, and duplicate-depth repairs in the interactive QA Engine.
            </p>
          </div>
        </div>

        <Link
          href="/qa-engine"
          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-200" />
          <span>Clean in QA Engine</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-2.5">
      {anomalies.map((anom, idx) => (
        <div
          key={`${anom.curveMnemonic}-${anom.anomalyType}-${idx}`}
          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono ${
            anom.severity === "CRITICAL"
              ? "bg-red-500/10 border-red-500/30 text-red-200"
              : "bg-amber-500/10 border-amber-500/30 text-amber-200"
          }`}
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  anom.severity === "CRITICAL"
                    ? "bg-red-500/20 text-red-300 border border-red-500/40"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                }`}
              >
                {anom.severity}
              </span>
              <span className="font-bold text-white">Curve: {anom.curveMnemonic}</span>
              <span className="text-slate-400 text-[11px] font-mono">
                [{anom.anomalyType.replace(/_/g, " ")}]
              </span>
              {anom.depthStart !== undefined && anom.depthEnd !== undefined && (
                <span className="text-slate-400 text-[11px]">
                  depth {anom.depthStart} – {anom.depthEnd}
                </span>
              )}
            </div>
            <p className="text-slate-300 text-xs">{anom.description}</p>
          </div>
          {anom.suggestedCorrection && (
            <div className="text-left sm:text-right shrink-0">
              <span className="text-[10px] text-wellqc-muted uppercase block">Remediation:</span>
              <span className="text-[11px] text-cyan-300">{anom.suggestedCorrection}</span>
            </div>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}
