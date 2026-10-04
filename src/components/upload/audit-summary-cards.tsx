import { ParsedLAS } from "@/lib/las/parser";
import { QualityAnalysisResult } from "@/lib/las/quality-engine";

interface AuditSummaryCardsProps {
  parsedLAS: ParsedLAS;
  qaResult: QualityAnalysisResult;
}

export function AuditSummaryCards({
  parsedLAS,
  qaResult,
}: AuditSummaryCardsProps) {
  return (
    <div className="space-y-6">
      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-wellqc-card border border-wellqc-border font-mono">
          <span className="text-[10px] text-wellqc-muted uppercase block">Curves Detected</span>
          <div className="text-xl font-black text-white mt-0.5">
            {parsedLAS.curves.length} <span className="text-xs text-slate-400 font-normal">Channels</span>
          </div>
          <span className="text-[10px] text-cyan-400">Extracted from ~C Section</span>
        </div>

        <div className="p-3.5 rounded-xl bg-wellqc-card border border-wellqc-border font-mono">
          <span className="text-[10px] text-wellqc-muted uppercase block">Anomalies Detected</span>
          <div className="text-xl font-black text-amber-400 mt-0.5">
            {qaResult.anomalyCount} <span className="text-xs text-slate-400 font-normal">Issues</span>
          </div>
          <span className="text-[10px] text-slate-400">
            {qaResult.criticalCount} Critical · {qaResult.warningCount} Warnings
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-wellqc-card border border-wellqc-border font-mono">
          <span className="text-[10px] text-wellqc-muted uppercase block">Required Core Curves</span>
          <div className={`text-xl font-black mt-0.5 ${qaResult.missingStandardCurves.length === 0 ? "text-emerald-400" : "text-amber-300"}`}>
            {7 - qaResult.missingStandardCurves.length} / 7
          </div>
          <span className="text-[10px] text-slate-400 truncate block">
            {qaResult.missingStandardCurves.length > 0 ? `Missing: ${qaResult.missingStandardCurves.join(", ")}` : "GR, RHOB, NPHI, DT, RT, CALI, SP ✓"}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-wellqc-card border border-wellqc-border font-mono">
          <span className="text-[10px] text-wellqc-muted uppercase block">Overall Quality Status</span>
          <div className={`text-xl font-black mt-0.5 ${
            qaResult.overallScore >= 80 ? "text-emerald-400" :
            qaResult.overallScore >= 60 ? "text-cyan-400" :
            qaResult.overallScore >= 40 ? "text-amber-400" : "text-rose-400"
          }`}>
            {qaResult.qualityGrade}
          </div>
          <span className="text-[10px] text-slate-400">Index: {qaResult.overallScore} / 100</span>
        </div>
      </div>

      {/* 11 Anomaly Categories Check Grid */}
      <div className="space-y-2">
        <span className="text-[11px] font-mono text-wellqc-muted uppercase font-bold tracking-wider">
          Automated Anomaly Audit Checks:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 font-mono text-xs">
          {/* 1. Missing or Duplicate Depths */}
          {(() => {
            const cnt = qaResult.anomalies.filter((a) => a.anomalyType === "DUPLICATE_DEPTH").length;
            return (
              <div className={`p-2.5 rounded-lg border flex items-center justify-between ${cnt > 0 ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-wellqc-card/60 border-wellqc-border text-slate-300"}`}>
                <span className="truncate">Missing / Duplicate Depths</span>
                <span className="font-bold">{cnt > 0 ? `${cnt} Flagged` : "Clean ✓"}</span>
              </div>
            );
          })()}

          {/* 2. Depth Gaps */}
          {(() => {
            const cnt = qaResult.anomalies.filter((a) => a.anomalyType === "DEPTH_GAP").length;
            return (
              <div className={`p-2.5 rounded-lg border flex items-center justify-between ${cnt > 0 ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-wellqc-card/60 border-wellqc-border text-slate-300"}`}>
                <span className="truncate">Depth Gaps / Discontinuities</span>
                <span className="font-bold">{cnt > 0 ? `${cnt} Gaps` : "Clean ✓"}</span>
              </div>
            );
          })()}

          {/* 3. Null Values & Clusters */}
          {(() => {
            const cnt = qaResult.anomalies.filter((a) => a.anomalyType === "NULL_CLUSTER").length;
            return (
              <div className={`p-2.5 rounded-lg border flex items-center justify-between ${cnt > 0 ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-wellqc-card/60 border-wellqc-border text-slate-300"}`}>
                <span className="truncate">Nulls &amp; Null Clusters</span>
                <span className="font-bold">{cnt > 0 ? `${cnt} Clusters` : "Clean ✓"}</span>
              </div>
            );
          })()}

          {/* 4. Outside Physical Ranges */}
          {(() => {
            const cnt = qaResult.anomalies.filter((a) => a.anomalyType === "IMPOSSIBLE_VALUE").length;
            return (
              <div className={`p-2.5 rounded-lg border flex items-center justify-between ${cnt > 0 ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-wellqc-card/60 border-wellqc-border text-slate-300"}`}>
                <span className="truncate">Outside Physical Limits</span>
                <span className="font-bold">{cnt > 0 ? `${cnt} Outliers` : "Clean ✓"}</span>
              </div>
            );
          })()}

          {/* 5. Extreme Outliers */}
          {(() => {
            const cnt = qaResult.anomalies.filter((a) => a.anomalyType === "EXTREME_SPIKE" && !a.curveMnemonic.toUpperCase().includes("DT")).length;
            return (
              <div className={`p-2.5 rounded-lg border flex items-center justify-between ${cnt > 0 ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-wellqc-card/60 border-wellqc-border text-slate-300"}`}>
                <span className="truncate">Extreme / Outlier Spikes</span>
                <span className="font-bold">{cnt > 0 ? `${cnt} Spikes` : "Clean ✓"}</span>
              </div>
            );
          })()}

          {/* 6. Spikes in DT */}
          {(() => {
            const cnt = qaResult.anomalies.filter((a) => a.anomalyType === "EXTREME_SPIKE" && (a.curveMnemonic.toUpperCase().includes("DT") || a.description.toLowerCase().includes("sonic"))).length;
            return (
              <div className={`p-2.5 rounded-lg border flex items-center justify-between ${cnt > 0 ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-wellqc-card/60 border-wellqc-border text-slate-300"}`}>
                <span className="truncate">DT Acoustic Cycle Jumps</span>
                <span className="font-bold">{cnt > 0 ? `${cnt} Jumps` : "Clean ✓"}</span>
              </div>
            );
          })()}

          {/* 7. Flatlines */}
          {(() => {
            const cnt = qaResult.anomalies.filter((a) => a.anomalyType === "FLATLINE").length;
            return (
              <div className={`p-2.5 rounded-lg border flex items-center justify-between ${cnt > 0 ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-wellqc-card/60 border-wellqc-border text-slate-300"}`}>
                <span className="truncate">Stuck / Flatline Sensor</span>
                <span className="font-bold">{cnt > 0 ? `${cnt} Flatlines` : "Clean ✓"}</span>
              </div>
            );
          })()}

          {/* 8. Unit Mismatches */}
          {(() => {
            const cnt = qaResult.anomalies.filter((a) => a.anomalyType === "UNIT_MISMATCH").length;
            return (
              <div className={`p-2.5 rounded-lg border flex items-center justify-between ${cnt > 0 ? "bg-blue-500/10 border-blue-500/30 text-cyan-300" : "bg-wellqc-card/60 border-wellqc-border text-slate-300"}`}>
                <span className="truncate">Unit Mismatches</span>
                <span className="font-bold">{cnt > 0 ? `${cnt} Mismatches` : "Aligned ✓"}</span>
              </div>
            );
          })()}

          {/* 9. Non-standard Mnemonics */}
          {(() => {
            const cnt = qaResult.anomalies.filter((a) => a.anomalyType === "NON_STANDARD_MNEMONIC").length;
            return (
              <div className={`p-2.5 rounded-lg border flex items-center justify-between ${cnt > 0 ? "bg-purple-500/10 border-purple-500/30 text-purple-300" : "bg-wellqc-card/60 border-wellqc-border text-slate-300"}`}>
                <span className="truncate">Non-Standard Mnemonics</span>
                <span className="font-bold">{cnt > 0 ? `${cnt} Unmapped` : "Standardised ✓"}</span>
              </div>
            );
          })()}

          {/* 10. Duplicate Curves */}
          {(() => {
            const cnt = qaResult.anomalies.filter((a) => a.anomalyType === "DUPLICATE_CURVE").length;
            return (
              <div className={`p-2.5 rounded-lg border flex items-center justify-between ${cnt > 0 ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-wellqc-card/60 border-wellqc-border text-slate-300"}`}>
                <span className="truncate">Duplicate Curve Headers</span>
                <span className="font-bold">{cnt > 0 ? `${cnt} Duplicate` : "Unique ✓"}</span>
              </div>
            );
          })()}

          {/* 11. Missing Core Curves */}
          {(() => {
            const cnt = qaResult.missingStandardCurves.length;
            return (
              <div className={`p-2.5 rounded-lg border flex items-center justify-between sm:col-span-2 lg:col-span-2 ${cnt > 0 ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-wellqc-card/60 border-wellqc-border text-slate-300"}`}>
                <span className="truncate">Required Core Curves (GR, RHOB, NPHI, DT, RT, CALI, SP)</span>
                <span className="font-bold">{cnt > 0 ? `${cnt} Missing: ${qaResult.missingStandardCurves.join(", ")}` : "All 7 Core Curves Present ✓"}</span>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
