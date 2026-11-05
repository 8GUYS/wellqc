"use client";

import { useEffect, useState, useMemo, useDeferredValue } from "react";
import Link from "next/link";
import { WellListItem } from "@/lib/api-types";
import { safeReadJson } from "@/lib/http-client";
import {
  Database,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Trash2,
  Sparkles,
  Layers,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  User,
  ArrowUpRight,
} from "lucide-react";

interface UploadedFilesTableProps {
  refreshTrigger?: number;
  onSelectWell?: (wellId: string) => void;
  activeWellId?: string | null;
}

export function UploadedFilesTable({
  refreshTrigger = 0,
  onSelectWell,
  activeWellId,
}: UploadedFilesTableProps) {
  const [wells, setWells] = useState<WellListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [gradeFilter, setGradeFilter] = useState<string>("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmWell, setDeleteConfirmWell] = useState<WellListItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadWells = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/wells", { cache: "no-store" });
      const res = await safeReadJson<{ wells: WellListItem[] }>(response, "Unable to load uploaded files.");
      if (!res.ok || !res.data) {
        throw new Error(res.error || "Unable to load uploaded well files.");
      }
      setWells(res.data.wells || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load uploaded files.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWells();
  }, [refreshTrigger]);

  const handleDeleteWell = async (well: WellListItem) => {
    setDeletingId(well.id);
    try {
      const response = await fetch(`/api/wells/${well.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Failed to delete well (HTTP ${response.status})`);
      }
      setWells((prev) => prev.filter((w) => w.id !== well.id));
      setDeleteConfirmWell(null);
      setFeedback({
        type: "success",
        message: `Well "${well.name}" and its associated LAS files were successfully deleted.`,
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete well.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredWells = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return wells.filter((well) => {
      const matchesSearch =
        !q ||
        well.name.toLowerCase().includes(q) ||
        well.apiNo.toLowerCase().includes(q) ||
        (well.latestLasFileName && well.latestLasFileName.toLowerCase().includes(q)) ||
        well.operatorName.toLowerCase().includes(q) ||
        well.fieldName.toLowerCase().includes(q) ||
        (well.uploaderName && well.uploaderName.toLowerCase().includes(q));

      const matchesGrade =
        gradeFilter === "ALL" ||
        well.qualityGrade === gradeFilter ||
        (gradeFilter === "CRITICAL" && (well.qualityGrade === "CRITICAL" || well.qualityGrade === "UNVALIDATED"));

      return matchesSearch && matchesGrade;
    });
  }, [wells, deferredSearchQuery, gradeFilter]);

  return (
    <section aria-label="Uploaded Well Files Catalog" className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold font-mono text-white tracking-tight">
                Uploaded Well Files
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold">
                {wells.length} Saved {wells.length === 1 ? "File" : "Files"}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Persisted well logs saved in your database repository. Inspect, repair in QA Engine, or manage files.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={loadWells}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl bg-wellqc-card hover:bg-slate-800 border border-wellqc-border hover:border-cyan-500/40 text-slate-300 hover:text-white font-mono text-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            title="Refresh database wells list"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-mono flex items-center justify-between gap-3 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-wellqc-panel border border-wellqc-border p-3.5 rounded-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by well name, LAS file, API/UWI, operator, or field..."
            className="w-full bg-wellqc-card border border-wellqc-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 font-mono focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center space-x-2 shrink-0 text-xs font-mono">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Quality:</span>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="bg-wellqc-card border border-wellqc-border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Grades</option>
            <option value="EXCELLENT">Excellent (&ge;80)</option>
            <option value="GOOD">Good (60-79)</option>
            <option value="POOR">Poor (40-59)</option>
            <option value="CRITICAL">Critical / Unvalidated</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-xl">
        {isLoading && wells.length === 0 ? (
          <div className="p-12 text-center text-cyan-300 text-xs font-mono flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Loading uploaded well files from database...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-300 text-xs font-mono space-y-2">
            <AlertTriangle className="w-6 h-6 text-red-400 mx-auto" />
            <p>{error}</p>
            <button
              onClick={loadWells}
              className="px-3 py-1.5 rounded-lg bg-wellqc-card border border-wellqc-border text-white text-xs hover:border-cyan-500"
            >
              Retry
            </button>
          </div>
        ) : filteredWells.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <FileText className="w-8 h-8 text-slate-500 mx-auto" />
            <div className="text-sm font-bold text-white font-mono">
              {searchQuery || gradeFilter !== "ALL" ? "No matching files found" : "No well files uploaded yet"}
            </div>
            <p className="text-xs text-slate-400 font-mono max-w-md mx-auto">
              {searchQuery || gradeFilter !== "ALL"
                ? "Try adjusting your search criteria or clearing filters above."
                : "Drop or select LAS well logs in the upload box above to automatically parse, audit, and save them to the database."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-wellqc-card/80 border-b border-wellqc-border text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Well Asset &amp; File</th>
                  <th className="p-3.5">Operator &amp; Field</th>
                  <th className="p-3.5">Depth Interval</th>
                  <th className="p-3.5">Curves / Points</th>
                  <th className="p-3.5">Quality Score</th>
                  <th className="p-3.5">Uploaded By</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wellqc-border/60">
                {filteredWells.map((well) => {
                  const isActive = activeWellId === well.id;
                  const grade = (well.qualityGrade || "UNVALIDATED").toUpperCase();
                  const score = typeof well.qualityScore === "number" ? Math.round(well.qualityScore) : 0;

                  return (
                    <tr
                      key={well.id}
                      className={`hover:bg-wellqc-card/40 transition-colors ${
                        isActive ? "bg-cyan-500/10 border-l-2 border-l-cyan-400" : ""
                      }`}
                    >
                      {/* Well Name & File */}
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white text-xs tracking-tight">
                              {well.name}
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold uppercase">
                                Active in Workspace
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                            <span className="text-cyan-400 font-semibold">
                              {well.latestLasFileName || `${well.name}.las`}
                            </span>
                            <span>•</span>
                            <span className="text-slate-500">{well.apiNo || "No API"}</span>
                          </div>
                        </div>
                      </td>

                      {/* Operator & Field */}
                      <td className="p-3.5 text-slate-300">
                        <div>{well.operatorName || "Unassigned"}</div>
                        <div className="text-[11px] text-slate-500">{well.fieldName || "Standard Field"}</div>
                      </td>

                      {/* Depth Interval */}
                      <td className="p-3.5 text-slate-300 whitespace-nowrap">
                        <div>
                          {well.tdFt ? `TD: ${well.tdFt.toLocaleString()} ${well.depthUnit || "FT"}` : "Interval logged"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {well.depthUnit || "FT"}
                        </div>
                      </td>

                      {/* Curves / Points */}
                      <td className="p-3.5 text-slate-300 whitespace-nowrap">
                        <div className="font-semibold text-white">
                          {well.curveCount || 0} Curves
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {(well.pointCount || 0).toLocaleString()} depth points
                        </div>
                      </td>

                      {/* Quality Score */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${
                              grade === "EXCELLENT"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : grade === "GOOD"
                                ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                                : grade === "POOR"
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            }`}
                          >
                            {score}/100
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">
                            {grade}
                          </span>
                        </div>
                      </td>

                      {/* Uploaded By */}
                      <td className="p-3.5 text-slate-400 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-300">
                          <User className="w-3 h-3 text-slate-500" />
                          <span>{well.uploaderName || "System"}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {well.createdAt ? new Date(well.createdAt).toLocaleDateString() : "Recent"}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {onSelectWell && (
                            <button
                              type="button"
                              onClick={() => onSelectWell(well.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-wellqc-card hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-wellqc-border hover:border-cyan-500/40 text-[11px] font-bold transition-colors flex items-center space-x-1"
                              title="Inspect curves & anomalies in workspace above"
                            >
                              <Eye className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Inspect</span>
                            </button>
                          )}

                          <Link
                            href={`/qa-engine?wellId=${encodeURIComponent(well.id)}`}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/25 text-purple-300 hover:text-purple-200 border border-purple-500/30 text-[11px] font-bold transition-colors flex items-center space-x-1"
                            title="Repair in QA Engine"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            <span>QA Engine</span>
                          </Link>

                          <Link
                            href={`/standardisation?wellId=${encodeURIComponent(well.id)}`}
                            className="p-1.5 rounded-lg bg-wellqc-card hover:bg-slate-800 text-slate-400 hover:text-white border border-wellqc-border transition-colors"
                            title="Open in Standardisation Engine"
                          >
                            <Layers className="w-3.5 h-3.5 text-slate-300" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmWell(well)}
                            disabled={deletingId === well.id}
                            className="p-1.5 rounded-lg bg-wellqc-card hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-wellqc-border hover:border-rose-500/40 transition-colors disabled:opacity-50"
                            title="Delete well from database"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmWell && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-wellqc-panel border border-rose-500/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-mono">Delete Uploaded File?</h3>
                <p className="text-xs text-rose-300 font-mono">This action cannot be undone.</p>
              </div>
            </div>

            <div className="bg-wellqc-card p-3 rounded-xl border border-wellqc-border space-y-1 text-xs font-mono">
              <div className="text-white font-bold">{deleteConfirmWell.name}</div>
              <div className="text-slate-400">
                File: {deleteConfirmWell.latestLasFileName || `${deleteConfirmWell.name}.las`}
              </div>
              <div className="text-slate-500">
                {deleteConfirmWell.curveCount} curves · {deleteConfirmWell.operatorName || "Standard Operator"}
              </div>
            </div>

            <p className="text-xs text-slate-400 font-mono leading-relaxed">
              Are you sure you want to permanently remove this well asset, all its associated raw LAS logs, and quality diagnostic history from the database?
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmWell(null)}
                disabled={Boolean(deletingId)}
                className="px-4 py-2 rounded-xl bg-wellqc-card hover:bg-slate-800 text-slate-300 text-xs font-mono font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteWell(deleteConfirmWell)}
                disabled={Boolean(deletingId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-all flex items-center space-x-1.5 shadow-lg shadow-rose-950/50 disabled:opacity-50"
              >
                {deletingId === deleteConfirmWell.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

