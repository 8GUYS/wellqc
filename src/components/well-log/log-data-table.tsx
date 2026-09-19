"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Search, Download } from "lucide-react";

interface LogDataTableProps {
  depths: number[];
  curves: Record<string, number[]>;
  depthUnit?: string;
  nullValue?: number;
}

export function LogDataTable({
  depths,
  curves,
  depthUnit = "FT",
  nullValue = -999.25,
}: LogDataTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const [searchDepth, setSearchDepth] = useState("");

  const curveNames = useMemo(() => Object.keys(curves), [curves]);
  const totalRows = depths.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  // Depth search filter
  const filteredIndices = useMemo(() => {
    if (!searchDepth.trim()) {
      return null;
    }
    const target = parseFloat(searchDepth);
    if (isNaN(target)) return null;

    const indices: number[] = [];
    for (let i = 0; i < depths.length; i++) {
      if (Math.abs(depths[i] - target) <= 2.0) {
        indices.push(i);
      }
    }
    return indices;
  }, [depths, searchDepth]);

  const displayedIndices = useMemo(() => {
    if (filteredIndices) {
      return filteredIndices.slice(0, 100);
    }
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, totalRows);
    const list: number[] = [];
    for (let i = start; i < end; i++) {
      list.push(i);
    }
    return list;
  }, [filteredIndices, currentPage, pageSize, totalRows]);

  return (
    <div className="bg-wellqc-panel border border-wellqc-border rounded-xl overflow-hidden font-mono text-xs">
      {/* Table Controls */}
      <div className="p-3 border-b border-wellqc-border bg-wellqc-card/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search depth (e.g. 5240)..."
              value={searchDepth}
              onChange={(e) => setSearchDepth(e.target.value)}
              className="pl-8 pr-3 py-1 bg-wellqc-dark border border-wellqc-border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 w-52"
            />
          </div>
          {searchDepth && (
            <button
              type="button"
              onClick={() => setSearchDepth("")}
              className="text-[11px] text-cyan-400 hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* Pagination */}
        {!filteredIndices && (
          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded bg-wellqc-dark border border-wellqc-border text-slate-300 disabled:opacity-40 hover:bg-wellqc-panel"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-slate-300">
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalRows.toLocaleString()} rows)
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded bg-wellqc-dark border border-wellqc-border text-slate-300 disabled:opacity-40 hover:bg-wellqc-panel"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Data Grid */}
      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-left">
          <thead className="bg-wellqc-dark border-b border-wellqc-border text-[10px] text-wellqc-muted uppercase sticky top-0">
            <tr>
              <th className="py-2.5 px-3">Index</th>
              <th className="py-2.5 px-3 text-cyan-300">DEPTH ({depthUnit})</th>
              {curveNames.map((cName) => (
                <th key={cName} className="py-2.5 px-3">
                  {cName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-wellqc-border/40">
            {displayedIndices.map((rowIdx) => {
              const d = depths[rowIdx];
              return (
                <tr key={rowIdx} className="hover:bg-wellqc-card/40 transition-colors">
                  <td className="py-1.5 px-3 text-slate-500 text-[10px]">{rowIdx + 1}</td>
                  <td className="py-1.5 px-3 font-bold text-cyan-300">{d.toFixed(2)}</td>
                  {curveNames.map((cName) => {
                    const val = curves[cName]?.[rowIdx];
                    const isNull =
                      val === undefined ||
                      val === nullValue ||
                      Math.abs(val - nullValue) < 0.01 ||
                      Number.isNaN(val);

                    return (
                      <td key={`${rowIdx}-${cName}`} className="py-1.5 px-3">
                        {isNull ? (
                          <span className="text-slate-600 font-normal">NULL</span>
                        ) : (
                          <span className="text-slate-200">{val.toFixed(2)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
