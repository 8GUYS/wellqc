"use client";

import { useState, useMemo } from "react";
import {
  Table,
  Download,
  Search,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  CheckCircle2,
  Database,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";
import { standardiseMnemonic } from "@/lib/las/standardiser";

interface LogDataTableProps {
  wellName: string;
  depthUnit: string;
  curvesData: {
    depth: number[];
    curves: Record<string, number[]>;
  };
  anomalies?: {
    depthStart: number;
    depthEnd: number;
    curveMnemonic: string;
    anomalyType: string;
    severity: string;
    description: string;
  }[];
  isCompact?: boolean;
  className?: string;
  selectedDepth?: number | null;
  onDepthSelect?: (depth: number) => void;
}

export function WellLogDataTable({
  wellName,
  depthUnit,
  curvesData,
  anomalies = [],
  isCompact = false,
  className = "",
  selectedDepth = null,
  onDepthSelect,
}: LogDataTableProps) {
  const depthArr = curvesData.depth || [];
  const totalRows = depthArr.length;
  const curveKeys = useMemo(() => Object.keys(curvesData.curves || {}), [curvesData.curves]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(isCompact ? 50 : 100);
  const [jumpDepthInput, setJumpDepthInput] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "ANOMALIES_ONLY" | "NULLS_ONLY">("ALL");
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  // Helper to check if a numeric value is null or sentinel
  const isNullValue = (val: number | null | undefined) => {
    return (
      val === null ||
      val === undefined ||
      isNaN(val) ||
      val === -999.25 ||
      val === -9999 ||
      val === -999.0
    );
  };

  // Helper to find anomalies at a given depth
  const getAnomaliesAtDepth = (depth: number) => {
    return anomalies.filter((a) => depth >= a.depthStart && depth <= a.depthEnd);
  };

  // Standardised curve metadata headers
  const curveMeta = useMemo(() => {
    return curveKeys.map((key) => {
      const std = standardiseMnemonic(key);
      return {
        key,
        standardMnemonic: std.standardMnemonic,
        name: std.matchedName,
        unit: std.standardUnit || "—",
      };
    });
  }, [curveKeys]);

  // Compute indices based on filterMode
  const filteredIndices = useMemo(() => {
    if (filterMode === "ALL") {
      return Array.from({ length: totalRows }, (_, i) => i);
    }

    const indices: number[] = [];
    for (let i = 0; i < totalRows; i++) {
      const d = depthArr[i];
      if (filterMode === "ANOMALIES_ONLY") {
        const hasAnom = anomalies.some((a) => d >= a.depthStart && d <= a.depthEnd);
        if (hasAnom) indices.push(i);
      } else if (filterMode === "NULLS_ONLY") {
        const hasNull = curveKeys.some((k) => isNullValue(curvesData.curves[k]?.[i]));
        if (hasNull) indices.push(i);
      }
    }
    return indices;
  }, [filterMode, totalRows, depthArr, anomalies, curveKeys, curvesData.curves]);

  const totalFiltered = filteredIndices.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedIndices = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filteredIndices.slice(start, start + pageSize);
  }, [filteredIndices, validPage, pageSize]);

  // Jump to depth handler
  const handleJumpToDepth = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const target = parseFloat(jumpDepthInput.trim());
    if (isNaN(target) || depthArr.length === 0) return;

    // Find closest index in full depth array
    let closestIdx = 0;
    let minDiff = Math.abs(depthArr[0] - target);
    for (let i = 1; i < depthArr.length; i++) {
      const diff = Math.abs(depthArr[i] - target);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    // Find where closestIdx appears in filteredIndices
    let positionInFiltered = filteredIndices.indexOf(closestIdx);
    if (positionInFiltered === -1) {
      // If current filter excludes it, switch filter back to ALL
      setFilterMode("ALL");
      positionInFiltered = closestIdx;
    }

    const targetPage = Math.floor(positionInFiltered / pageSize) + 1;
    setCurrentPage(targetPage);
    setHighlightedIndex(closestIdx);

    if (onDepthSelect) {
      onDepthSelect(depthArr[closestIdx]);
    }
  };

  // Export data as CSV
  const handleExportCSV = () => {
    if (totalRows === 0) return;
    const headerRow = [`DEPTH_${depthUnit.toUpperCase()}`, ...curveKeys].join(",");
    const rows = [headerRow];

    for (let i = 0; i < totalRows; i++) {
      const rowVals = [
        depthArr[i].toFixed(2),
        ...curveKeys.map((k) => {
          const val = curvesData.curves[k]?.[i];
          return isNullValue(val) ? "" : String(val);
        }),
      ];
      rows.push(rowVals.join(","));
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${wellName.replace(/[^a-zA-Z0-9_-]/g, "_")}_well_log_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (totalRows === 0) {
    return (
      <div className={`bg-wellqc-panel border border-wellqc-border rounded-2xl p-8 text-center space-y-3 ${className}`}>
        <Database className="w-8 h-8 text-slate-500 mx-auto" />
        <h4 className="text-sm font-bold text-white">No Tabular Log Data</h4>
        <p className="text-xs text-slate-400 font-mono">No depth or curve points available for numerical display.</p>
      </div>
    );
  }

  return (
    <div className={`bg-wellqc-panel border border-wellqc-border rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl font-sans ${className}`}>
      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-wellqc-border">
        <div>
          <div className="flex items-center space-x-2">
            <Table className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Well Log Numerical Spreadsheet
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              {totalRows.toLocaleString()} Samples
            </span>
          </div>
          <p className="text-[11px] text-wellqc-muted font-mono mt-0.5">
            Depth Span: {depthArr[0]?.toFixed(1)} – {depthArr[totalRows - 1]?.toFixed(1)} {depthUnit} | {curveKeys.length} Curves Registered
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* Jump to Depth Input */}
          <form onSubmit={handleJumpToDepth} className="flex items-center space-x-1">
            <div className="relative">
              <input
                type="number"
                step="any"
                placeholder={`Depth (${depthUnit})...`}
                value={jumpDepthInput}
                onChange={(e) => setJumpDepthInput(e.target.value)}
                className="w-28 sm:w-32 px-2.5 py-1.5 bg-wellqc-card border border-wellqc-border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-2.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg font-bold transition-colors"
              title="Jump directly to sample closest to this depth"
            >
              Jump
            </button>
          </form>

          {/* Filter Mode Selector */}
          <div className="flex items-center bg-wellqc-card border border-wellqc-border rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => {
                setFilterMode("ALL");
                setCurrentPage(1);
              }}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                filterMode === "ALL" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterMode("ANOMALIES_ONLY");
                setCurrentPage(1);
              }}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                filterMode === "ANOMALIES_ONLY" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
              title="Filter to rows within anomalous depth intervals"
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Anomalies</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterMode("NULLS_ONLY");
                setCurrentPage(1);
              }}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                filterMode === "NULLS_ONLY" ? "bg-rose-500 text-white" : "text-slate-400 hover:text-white"
              }`}
              title="Filter to rows containing null / missing values"
            >
              Nulls
            </button>
          </div>

          {/* CSV Export Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-wellqc-card hover:bg-wellqc-border/60 border border-wellqc-border rounded-lg text-slate-200 hover:text-cyan-300 font-bold transition-colors"
            title="Download full well log dataset as CSV"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Tabular Scroll Container */}
      <div className="border border-wellqc-border rounded-xl overflow-hidden bg-wellqc-card/40">
        <div className="overflow-x-auto max-h-[560px] relative scrollbar-thin scrollbar-thumb-wellqc-border">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="bg-wellqc-panel/95 backdrop-blur sticky top-0 z-20 border-b border-wellqc-border text-slate-300 shadow-sm">
              <tr>
                {/* Fixed Depth Column */}
                <th className="p-2.5 sm:p-3 sticky left-0 z-30 bg-wellqc-panel border-r border-wellqc-border whitespace-nowrap min-w-[110px]">
                  <div className="flex items-center space-x-1 font-bold text-white">
                    <span>DEPTH</span>
                    <span className="text-[10px] text-cyan-400">({depthUnit})</span>
                  </div>
                  <div className="text-[9px] text-slate-500 font-normal">Sample Index</div>
                </th>

                {/* Dynamic Curve Channels */}
                {curveMeta.map((meta) => (
                  <th key={meta.key} className="p-2.5 sm:p-3 border-r border-wellqc-border/60 whitespace-nowrap min-w-[120px]">
                    <div className="font-bold text-cyan-300 flex items-center justify-between">
                      <span>{meta.key}</span>
                      <span className="text-[10px] text-slate-400 font-normal">[{meta.unit}]</span>
                    </div>
                    <div className="text-[9px] text-slate-400 truncate max-w-[130px] font-normal" title={meta.name}>
                      {meta.name}
                    </div>
                  </th>
                ))}

                {/* Status / Flag Column */}
                <th className="p-2.5 sm:p-3 whitespace-nowrap min-w-[100px] text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">QA Flag</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-wellqc-border/50 text-slate-200">
              {paginatedIndices.length === 0 ? (
                <tr>
                  <td colSpan={curveKeys.length + 2} className="p-8 text-center text-slate-400">
                    No depth samples match the selected filter.
                  </td>
                </tr>
              ) : (
                paginatedIndices.map((rowIdx) => {
                  const d = depthArr[rowIdx];
                  const rowAnomalies = getAnomaliesAtDepth(d);
                  const hasAnom = rowAnomalies.length > 0;
                  const isHighlighted = highlightedIndex === rowIdx || selectedDepth === d;

                  return (
                    <tr
                      key={rowIdx}
                      onClick={() => {
                        setHighlightedIndex(rowIdx);
                        if (onDepthSelect) onDepthSelect(d);
                      }}
                      className={`cursor-pointer transition-colors group ${
                        isHighlighted
                          ? "bg-cyan-500/20 hover:bg-cyan-500/25"
                          : hasAnom
                          ? "bg-amber-500/5 hover:bg-amber-500/10"
                          : "hover:bg-wellqc-panel/60"
                      }`}
                    >
                      {/* Sticky Depth Cell */}
                      <td className={`p-2.5 sm:p-3 sticky left-0 z-10 border-r border-wellqc-border font-bold whitespace-nowrap ${
                        isHighlighted ? "bg-slate-900/90 text-cyan-300" : "bg-wellqc-panel/90 text-white"
                      }`}>
                        <div className="flex items-center space-x-1.5">
                          <span>{d.toFixed(2)}</span>
                          {isHighlighted && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                        </div>
                      </td>

                      {/* Curve Values */}
                      {curveKeys.map((key) => {
                        const val = curvesData.curves[key]?.[rowIdx];
                        const isNull = isNullValue(val);

                        return (
                          <td key={key} className="p-2.5 sm:p-3 border-r border-wellqc-border/40 whitespace-nowrap">
                            {isNull ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                NULL
                              </span>
                            ) : (
                              <span className="text-slate-200 group-hover:text-white">
                                {typeof val === "number" ? val.toFixed(2) : String(val)}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* QA Anomaly Indicator Cell */}
                      <td className="p-2.5 sm:p-3 text-center whitespace-nowrap">
                        {hasAnom ? (
                          <span
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            title={rowAnomalies.map((a) => `${a.curveMnemonic}: ${a.description}`).join(" | ")}
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>{rowAnomalies[0].anomalyType.replace(/_/g, " ")}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs font-mono text-slate-400">
        <div className="flex items-center space-x-2">
          <span>
            Showing rows {totalFiltered > 0 ? ((validPage - 1) * pageSize + 1).toLocaleString() : 0} –{" "}
            {Math.min(validPage * pageSize, totalFiltered).toLocaleString()} of {totalFiltered.toLocaleString()}
          </span>
          {filterMode !== "ALL" && (
            <span className="text-amber-400 text-[11px]">(Filtered from {totalRows.toLocaleString()} total)</span>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {/* Page size selector */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 text-[11px]">Rows/page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-wellqc-card border border-wellqc-border text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-cyan-400"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={validPage === 1}
              className="p-1 rounded bg-wellqc-card border border-wellqc-border hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={validPage === 1}
              className="p-1 rounded bg-wellqc-card border border-wellqc-border hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="px-2 text-slate-200 font-bold">
              {validPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validPage === totalPages}
              className="p-1 rounded bg-wellqc-card border border-wellqc-border hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={validPage === totalPages}
              className="p-1 rounded bg-wellqc-card border border-wellqc-border hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const LogDataTable = WellLogDataTable;

