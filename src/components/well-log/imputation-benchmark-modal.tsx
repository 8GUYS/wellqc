"use client";

import { useState } from "react";
import { ParsedLAS } from "@/lib/las/parser";
import {
  diagnoseMissingValueCauses,
  benchmarkImputationMethods,
  MissingValueDiagnostic,
  ImputationBenchmarkResult,
  ImputationStrategy,
  imputeKNN,
  imputeLinear,
  imputeMean,
  imputeMedian,
  imputeSpline,
  dropMissingRows,
} from "@/lib/las/imputation-engine";
import {
  X,
  Sparkles,
  BarChart3,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  ArrowRight,
  ShieldAlert,
  FileCheck,
} from "lucide-react";

interface ImputationBenchmarkModalProps {
  las: ParsedLAS;
  isOpen: boolean;
  onClose: () => void;
  onApplyImputation: (updatedLas: ParsedLAS, appliedStrategy: string, curve: string) => void;
}

export function ImputationBenchmarkModal({
  las,
  isOpen,
  onClose,
  onApplyImputation,
}: ImputationBenchmarkModalProps) {
  const [selectedCurve, setSelectedCurve] = useState<string>(
    las.curves[0]?.mnemonic || "GR"
  );
  const [dropThreshold, setDropThreshold] = useState<number>(2.0);
  const [knnNeighbors, setKnnNeighbors] = useState<number>(5);

  const [benchmarkResult, setBenchmarkResult] = useState<ImputationBenchmarkResult | null>(
    null
  );
  const [diagnostics] = useState<MissingValueDiagnostic[]>(() =>
    diagnoseMissingValueCauses(las)
  );

  const activeDiag = diagnostics.find((d) => d.curveMnemonic === selectedCurve) || diagnostics[0];

  const handleRunBenchmark = () => {
    const res = benchmarkImputationMethods(las, selectedCurve);
    setBenchmarkResult(res);
  };

  const handleApplyStrategy = (strategy: ImputationStrategy) => {
    let updatedLas = { ...las };
    const nullVal = las.wellInfo.nullValue;

    if (strategy === "ROW_DROPPING" || activeDiag?.nullPercentage <= dropThreshold) {
      updatedLas = dropMissingRows(las, selectedCurve);
    } else {
      const rawSeries = las.data.curves[selectedCurve];
      let imputed: number[] = [];

      if (strategy === "KNN") {
        imputed = imputeKNN(las.data.curves, selectedCurve, nullVal, knnNeighbors);
      } else if (strategy === "LINEAR") {
        imputed = imputeLinear(rawSeries, nullVal);
      } else if (strategy === "MEAN") {
        imputed = imputeMean(rawSeries, nullVal);
      } else if (strategy === "MEDIAN") {
        imputed = imputeMedian(rawSeries, nullVal);
      } else if (strategy === "SPLINE") {
        imputed = imputeSpline(rawSeries, nullVal);
      }

      updatedLas = {
        ...las,
        data: {
          ...las.data,
          curves: {
            ...las.data.curves,
            [selectedCurve]: imputed,
          },
        },
      };
    }

    onApplyImputation(updatedLas, strategy, selectedCurve);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-5xl bg-wellqc-panel border border-wellqc-border rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col font-sans">
        {/* Modal Header */}
        <div className="p-5 border-b border-wellqc-border bg-wellqc-dark/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-wellqc-dark rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center space-x-2">
                <span>Missing Value Diagnostics & Imputation Benchmarking</span>
              </h2>
              <p className="text-xs text-wellqc-muted font-mono">
                Petrophysical Root Cause Analysis, Null Indicator Verification & Multi-Algorithm Ground-Truth Benchmark
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-wellqc-card rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Curve Selector Tabs */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-2">
              Select Log Curve Channel to Evaluate:
            </label>
            <div className="flex flex-wrap gap-2">
              {las.curves.map((c) => {
                const diag = diagnostics.find((d) => d.curveMnemonic === c.mnemonic);
                const nullPct = diag?.nullPercentage || 0;
                const isSelected = selectedCurve === c.mnemonic;

                return (
                  <button
                    key={c.mnemonic}
                    onClick={() => {
                      setSelectedCurve(c.mnemonic);
                      setBenchmarkResult(null);
                    }}
                    className={`px-3 py-2 rounded-xl font-mono text-xs font-semibold flex items-center space-x-2 border transition-all ${
                      isSelected
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/10"
                        : "bg-wellqc-card/80 text-slate-400 border-wellqc-border hover:bg-wellqc-card hover:text-slate-200"
                    }`}
                  >
                    <span>{c.mnemonic}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        nullPct === 0
                          ? "bg-emerald-500/20 text-emerald-300"
                          : nullPct < 2.0
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {nullPct.toFixed(1)}% null
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Root Cause Analysis Panel */}
          {activeDiag && (
            <div className="p-4 bg-wellqc-card border border-wellqc-border rounded-xl space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-white uppercase tracking-wider">
                    Missing Value Origin Diagnostic ({activeDiag.curveMnemonic})
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {activeDiag.primaryCause.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-slate-300 text-xs font-sans leading-relaxed">
                {activeDiag.causeDescription}
              </p>
              <div className="pt-2 border-t border-wellqc-border/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">
                  Total Samples: <strong className="text-white">{activeDiag.totalPoints}</strong> | Missing Count: <strong className="text-amber-300">{activeDiag.nullCount}</strong> ({activeDiag.nullPercentage.toFixed(2)}%)
                </span>
                <span className="text-cyan-300">
                  Header Null Value Symbol: <code className="bg-wellqc-panel px-1.5 py-0.5 rounded text-white font-mono">{las.wellInfo.nullValue}</code>
                </span>
              </div>
            </div>
          )}

          {/* Imputation Config & Threshold Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
            <div className="bg-wellqc-dark/60 border border-wellqc-border p-3.5 rounded-xl space-y-2">
              <label className="text-slate-300 font-bold block flex items-center justify-between">
                <span>Row Drop Threshold (%)</span>
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              </label>
              <input
                type="number"
                step="0.5"
                min="0.1"
                max="10"
                value={dropThreshold}
                onChange={(e) => setDropThreshold(parseFloat(e.target.value) || 2.0)}
                className="w-full bg-wellqc-card border border-wellqc-border rounded-lg p-2 text-white font-mono"
              />
              <span className="text-[10px] text-wellqc-muted block">
                If missing % &le; {dropThreshold}%, recommend Listwise Row Deletion instead of synthetic imputation.
              </span>
            </div>

            <div className="bg-wellqc-dark/60 border border-wellqc-border p-3.5 rounded-xl space-y-2">
              <label className="text-slate-300 font-bold block flex items-center justify-between">
                <span>KNN Neighbors (K)</span>
                <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              </label>
              <input
                type="number"
                min="2"
                max="15"
                value={knnNeighbors}
                onChange={(e) => setKnnNeighbors(parseInt(e.target.value) || 5)}
                className="w-full bg-wellqc-card border border-wellqc-border rounded-lg p-2 text-white font-mono"
              />
              <span className="text-[10px] text-wellqc-muted block">
                Number of spatial & petrophysical neighbors for KNN multi-curve distance weighting.
              </span>
            </div>

            <div className="flex items-center justify-center">
              <button
                onClick={handleRunBenchmark}
                className="w-full h-full min-h-[70px] px-4 py-3 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Run Empirical Benchmark Test</span>
              </button>
            </div>
          </div>

          {/* Benchmark Results */}
          {benchmarkResult && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-cyan-950/40 via-wellqc-card to-emerald-950/40 border border-cyan-500/40 rounded-xl space-y-2 font-mono">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-cyan-300 font-bold">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Evidence-Based Recommendation Engine</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold">
                    RANK #1 RECOMMENDED
                  </span>
                </div>
                <p className="text-white text-xs font-sans">
                  {benchmarkResult.recommendationReason}
                </p>
              </div>

              {/* Metrics Table */}
              <div className="overflow-x-auto border border-wellqc-border rounded-xl">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-wellqc-dark text-slate-400 uppercase tracking-wider text-[10px] border-b border-wellqc-border">
                    <tr>
                      <th className="p-3">Rank</th>
                      <th className="p-3">Imputation Method</th>
                      <th className="p-3">RMSE Error</th>
                      <th className="p-3">MAE Error</th>
                      <th className="p-3">R&sup2; Accuracy</th>
                      <th className="p-3">Var Preserved</th>
                      <th className="p-3">Speed (ms)</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-wellqc-border bg-wellqc-panel/60">
                    {benchmarkResult.metrics.map((m) => (
                      <tr
                        key={m.strategy}
                        className={`transition-colors ${
                          m.isRecommended
                            ? "bg-cyan-500/10 hover:bg-cyan-500/20 text-white font-semibold"
                            : "hover:bg-wellqc-card/60 text-slate-300"
                        }`}
                      >
                        <td className="p-3">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                              m.rank === 1
                                ? "bg-cyan-400 text-black font-extrabold"
                                : "bg-wellqc-card text-slate-400"
                            }`}
                          >
                            #{m.rank}
                          </span>
                        </td>
                        <td className="p-3">
                          <div>
                            <span className="font-bold">{m.strategyLabel}</span>
                            <span className="block text-[10px] text-slate-400 font-sans">
                              {m.notes}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-cyan-300">{m.rmse}</td>
                        <td className="p-3 text-slate-300">{m.mae}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.r2Score > 0.85
                                ? "bg-emerald-500/20 text-emerald-300"
                                : m.r2Score > 0.6
                                ? "bg-cyan-500/20 text-cyan-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {(m.r2Score * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3">{m.varianceRatio}%</td>
                        <td className="p-3 text-slate-400">{m.executionTimeMs} ms</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleApplyStrategy(m.strategy)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-all flex items-center space-x-1 ml-auto ${
                              m.isRecommended
                                ? "bg-cyan-500 text-black hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
                                : "bg-wellqc-card text-slate-200 border border-wellqc-border hover:bg-wellqc-panel"
                            }`}
                          >
                            <span>Apply</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {activeDiag?.nullPercentage <= dropThreshold && (
                      <tr className="bg-emerald-500/10 text-emerald-300">
                        <td className="p-3">
                          <span className="w-6 h-6 rounded-full bg-emerald-400 text-black flex items-center justify-center font-bold text-[10px]">
                            OPT
                          </span>
                        </td>
                        <td className="p-3">
                          <div>
                            <span className="font-bold">Row Dropping (Listwise Deletion)</span>
                            <span className="block text-[10px] text-emerald-400 font-sans">
                              Recommended option because missing % ({activeDiag.nullPercentage.toFixed(2)}%) is below drop threshold ({dropThreshold}%).
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-emerald-300">N/A (Raw)</td>
                        <td className="p-3 text-emerald-300">0.00</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                            100.0%
                          </span>
                        </td>
                        <td className="p-3">100%</td>
                        <td className="p-3 text-slate-400">0.1 ms</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleApplyStrategy("ROW_DROPPING")}
                            className="px-3 py-1.5 bg-emerald-500 text-black hover:bg-emerald-400 rounded-lg text-xs font-bold font-sans shadow-md shadow-emerald-500/20 flex items-center space-x-1 ml-auto"
                          >
                            <span>Drop Rows</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-wellqc-border bg-wellqc-dark/80 flex items-center justify-between font-mono text-xs text-wellqc-muted">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Multi-Method Benchmarking Engine Ready</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-wellqc-card border border-wellqc-border rounded-xl text-slate-300 hover:text-white transition-colors font-sans font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
