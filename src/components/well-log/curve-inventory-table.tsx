"use client";

import React, { useState } from "react";
import { CurveHealthSummary } from "@/lib/las/quality-engine";
import { ParsedLAS } from "@/lib/las/parser";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Layers } from "lucide-react";

interface CurveInventoryTableProps {
  curveSummaries: CurveHealthSummary[];
  parsedLAS?: ParsedLAS | null;
  onSelectCurveForTrack?: (mnemonic: string, track: 1 | 2 | 3) => void;
}

export function CurveInventoryTable({
  curveSummaries,
  parsedLAS,
  onSelectCurveForTrack,
}: CurveInventoryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs font-mono">
        <thead className="bg-wellqc-card border-b border-wellqc-border text-[11px] text-wellqc-muted uppercase">
          <tr>
            <th className="py-3 px-4">Raw Mnemonic</th>
            <th className="py-3 px-4">Standard Mnemonic</th>
            <th className="py-3 px-4">Description</th>
            <th className="py-3 px-4">Unit</th>
            <th className="py-3 px-4">Null Count / Total</th>
            <th className="py-3 px-4">Null %</th>
            <th className="py-3 px-4">Value Range (Min – Max)</th>
            <th className="py-3 px-4 text-center">Health Status</th>
            {onSelectCurveForTrack && <th className="py-3 px-4 text-center">Track Slot</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-wellqc-border/60">
          {curveSummaries.map((curve, idx) => {
            const rowKey = `${curve.mnemonic}-${idx}`;
            const curveMeta = parsedLAS?.curves.find((c) => c.mnemonic === curve.mnemonic);
            const isExpanded = Boolean(expandedRows[rowKey]);
            const hasAnomalies = curve.anomalies && curve.anomalies.length > 0;

            return (
              <React.Fragment key={rowKey}>
                <tr className="hover:bg-wellqc-card/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      {hasAnomalies ? (
                        <button
                          type="button"
                          onClick={() => toggleRow(rowKey)}
                          className="p-0.5 rounded text-slate-400 hover:text-white"
                          title="Toggle anomaly details"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                      <span className="font-bold text-white">{curve.mnemonic}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-cyan-300 font-semibold">{curve.standardMnemonic}</td>
                  <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                    {curveMeta?.description || "Curve channel"}
                  </td>
                  <td className="py-3 px-4 text-slate-400">{curve.unit || "—"}</td>
                  <td className="py-3 px-4 text-slate-400">
                    {curve.nullCount.toLocaleString()} / {curve.totalPoints.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span className={curve.nullPercentage > 20 ? "text-amber-400 font-bold" : "text-slate-300"}>
                      {curve.nullPercentage.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {curve.minVal !== null && curve.maxVal !== null
                      ? `${curve.minVal.toFixed(2)} – ${curve.maxVal.toFixed(2)}`
                      : "All Nulls"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        curve.status === "EXCELLENT"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : curve.status === "GOOD"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                          : curve.status === "POOR"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-red-500/20 text-red-300 border border-red-500/30"
                      }`}
                    >
                      {curve.status} ({curve.healthScore}/100)
                    </span>
                  </td>
                  {onSelectCurveForTrack && (
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => onSelectCurveForTrack(curve.mnemonic, 1)}
                          className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40 border border-emerald-500/40"
                          title="Assign to Track 1"
                        >
                          T1
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectCurveForTrack(curve.mnemonic, 2)}
                          className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 border border-rose-500/40"
                          title="Assign to Track 2"
                        >
                          T2
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectCurveForTrack(curve.mnemonic, 3)}
                          className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/40 border border-cyan-500/40"
                          title="Assign to Track 3"
                        >
                          T3
                        </button>
                      </div>
                    </td>
                  )}
                </tr>

                {/* Expanded Anomaly Details Row */}
                {isExpanded && hasAnomalies && (
                  <tr className="bg-wellqc-dark/50">
                    <td colSpan={onSelectCurveForTrack ? 9 : 8} className="p-3 pl-10">
                      <div className="space-y-1.5 border-l-2 border-amber-500/50 pl-3">
                        <div className="text-[11px] font-bold text-amber-300 uppercase">
                          Petrophysical Anomalies Flagged on {curve.mnemonic}:
                        </div>
                        {curve.anomalies.map((anom, idx) => (
                          <div
                            key={`${curve.mnemonic}-anom-${idx}`}
                            className="text-xs text-slate-300 flex items-start gap-2"
                          >
                            <span className="text-amber-400 font-bold">•</span>
                            <span>
                              <strong className="text-white">[{anom.anomalyType.replace(/_/g, " ")}]</strong>{" "}
                              {anom.description}
                              {anom.suggestedCorrection && (
                                <span className="text-cyan-300 block text-[11px]">
                                  Remediation: {anom.suggestedCorrection}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
