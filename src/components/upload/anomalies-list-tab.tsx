import { CheckCircle2 } from "lucide-react";
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
    <div className="p-5 space-y-2.5">
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
  );
}
