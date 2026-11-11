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
  CheckSquare,
  Square,
  MinusSquare,
  Lock,
} from "lucide-react";
import { PaystackUpgradeModal } from "@/components/payments/paystack-upgrade-modal";

interface UploadedFilesTableProps {
  refreshTrigger?: number;
  onSelectWell?: (wellId: string) => Promise<void> | void;
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

  // Selection & Bulk Delete state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Single Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmWell, setDeleteConfirmWell] = useState<WellListItem | null>(null);

  // Inspection loading state
  const [inspectingId, setInspectingId] = useState<string | null>(null);

  // User Profile & License Gatekeeper State
  const [userProfile, setUserProfile] = useState<{
    tier: string;
    role: string;
  }>({ tier: "FREE", role: "USER" });
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [targetUpgradeWellId, setTargetUpgradeWellId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    async function loadUserProfile() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const { user } = await res.json();
          if (active && user) {
            setUserProfile({
              tier: (user.tier || "FREE").toUpperCase(),
              role: (user.role || "USER").toUpperCase(),
            });
          }
        }
      } catch { }
    }
    loadUserProfile();
    window.addEventListener("wellqc_user_updated", loadUserProfile);
    return () => {
      active = false;
      window.removeEventListener("wellqc_user_updated", loadUserProfile);
    };
  }, []);

  const isFreeTier = userProfile.tier === "FREE" && userProfile.role !== "ADMIN";
  const isAdmin = userProfile.role === "ADMIN";

  // Feedback banner state
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
    let ignore = false;
    async function fetchWells() {
      try {
        const response = await fetch("/api/wells", { cache: "no-store" });
        const res = await safeReadJson<{ wells: WellListItem[] }>(response, "Unable to load uploaded files.");
        if (ignore) return;
        if (!res.ok || !res.data) {
          throw new Error(res.error || "Unable to load uploaded well files.");
        }
        setWells(res.data.wells || []);
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load uploaded files.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    fetchWells();
    return () => {
      ignore = true;
    };
  }, [refreshTrigger]);

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

  // Selection calculations
  const filteredWellIds = useMemo(() => filteredWells.map((w) => w.id), [filteredWells]);
  const isAllSelected = filteredWellIds.length > 0 && filteredWellIds.every((id) => selectedIds.has(id));
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredWellIds));
    }
  };

  const toggleSelectWell = (wellId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(wellId)) {
        next.delete(wellId);
      } else {
        next.add(wellId);
      }
      return next;
    });
  };

  // Inspect Handler with row loading state
  const handleInspectWell = async (wellId: string) => {
    if (!onSelectWell) return;
    setInspectingId(wellId);
    try {
      await onSelectWell(wellId);
      const well = wells.find((w) => w.id === wellId);
      setFeedback({
        type: "success",
        message: `Inspecting well "${well?.name || wellId}" in workspace above.`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load well details for inspection.",
      });
    } finally {
      setInspectingId(null);
    }
  };

  // Single Delete
  const handleDeleteWell = async (well: WellListItem) => {
    if (!isAdmin) {
      setFeedback({
        type: "error",
        message: "Access denied: Only system administrators are authorized to delete well assets to prevent quota manipulation and preserve compliance audit trails.",
      });
      return;
    }
    setDeletingId(well.id);
    try {
      const response = await fetch(`/api/wells/${encodeURIComponent(well.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Failed to delete well (HTTP ${response.status})`);
      }
      setWells((prev) => prev.filter((w) => w.id !== well.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(well.id);
        return next;
      });
      setDeleteConfirmWell(null);
      setFeedback({
        type: "success",
        message: `Well "${well.name}" and its associated LAS logs were successfully deleted.`,
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

  // Bulk Delete
  const handleBulkDeleteConfirm = async () => {
    if (!isAdmin) {
      setFeedback({
        type: "error",
        message: "Access denied: Only system administrators are authorized to perform bulk deletion of well assets.",
      });
      return;
    }
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    setIsBulkDeleting(true);
    try {
      const response = await fetch("/api/wells/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wellIds: idsToDelete }),
      });

      const res = await safeReadJson<{
        success: boolean;
        deletedCount: number;
        deletedIds: string[];
        message: string;
      }>(response, "Failed to bulk delete wells.");

      if (!response.ok || !res.data) {
        throw new Error(res.error || `Bulk deletion failed (HTTP ${response.status})`);
      }

      const deletedCount = res.data.deletedCount || idsToDelete.length;
      const deletedSet = new Set(res.data.deletedIds || idsToDelete);

      setWells((prev) => prev.filter((w) => !deletedSet.has(w.id)));
      setSelectedIds(new Set());
      setIsBulkDeleteModalOpen(false);

      setFeedback({
        type: "success",
        message: `Successfully deleted ${deletedCount} well asset${deletedCount === 1 ? "" : "s"} and their associated LAS logs.`,
      });
      setTimeout(() => setFeedback(null), 6000);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete selected wells in bulk.",
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

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
              Persisted well logs saved in your database repository. Inspect curves, repair in QA Engine, and track petrophysical asset quality.
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
          className={`px-4 py-3 rounded-xl border text-xs font-mono flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
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

      {/* Bulk Action Banner (Admins Only - Appears when items are selected) */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="bg-gradient-to-r from-cyan-950/80 via-slate-900 to-slate-900 border border-cyan-500/40 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center space-x-3 text-xs font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            <span className="text-white font-bold">
              {selectedIds.size} of {filteredWells.length} well file{selectedIds.size === 1 ? "" : "s"} selected
            </span>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-cyan-400 hover:text-cyan-300 underline font-semibold transition-colors"
            >
              {isAllSelected ? "Deselect All" : `Select All (${filteredWells.length})`}
            </button>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              Clear Selection
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white font-mono font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-rose-950/40 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-xl">
        {isLoading && wells.length === 0 ? (
          <div className="p-12 text-center text-cyan-300 text-xs font-mono flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Loading uploaded well files...</span>
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
          <div className="overflow-x-auto relative">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-wellqc-card/90 border-b border-wellqc-border text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  {/* Select All Checkbox (Admins Only) */}
                  {isAdmin && (
                    <th className="p-3.5 w-10 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center justify-center mx-auto"
                        title={isAllSelected ? "Deselect all files" : "Select all files in view"}
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400" />
                        ) : isSomeSelected ? (
                          <MinusSquare className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="p-3.5 min-w-[220px]">Well Asset &amp; File</th>
                  <th className="p-3.5 min-w-[140px]">Operator &amp; Field</th>
                  <th className="p-3.5 min-w-[120px]">Depth Interval</th>
                  <th className="p-3.5 min-w-[120px]">Curves / Points</th>
                  <th className="p-3.5 min-w-[110px]">Quality Score</th>
                  <th className="p-3.5 min-w-[120px]">Uploaded By</th>
                  {/* Sticky Actions Header: Always visible */}
                  <th className="p-3.5 text-right min-w-[230px] sticky right-0 bg-wellqc-card/95 backdrop-blur-md z-10 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.5)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wellqc-border/60">
                {filteredWells.map((well) => {
                  const isActive = activeWellId === well.id;
                  const isSelected = selectedIds.has(well.id);
                  const isInspectingThis = inspectingId === well.id;
                  const grade = (well.qualityGrade || "UNVALIDATED").toUpperCase();
                  const score = typeof well.qualityScore === "number" ? Math.round(well.qualityScore) : 0;
                  const hasCurves = (well.curveCount || 0) > 0;

                  return (
                    <tr
                      key={well.id}
                      className={`hover:bg-wellqc-card/40 transition-colors group ${
                        isActive
                          ? "bg-cyan-500/10 border-l-2 border-l-cyan-400"
                          : isSelected
                          ? "bg-cyan-500/5"
                          : ""
                      }`}
                    >
                      {/* Row Checkbox (Admins Only) */}
                      {isAdmin && (
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelectWell(well.id)}
                            className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center justify-center mx-auto"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-cyan-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                            )}
                          </button>
                        </td>
                      )}

                      {/* Well Name & File */}
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            {onSelectWell ? (
                              <button
                                type="button"
                                onClick={() => handleInspectWell(well.id)}
                                className="font-bold text-white text-xs tracking-tight hover:text-cyan-400 transition-colors text-left flex items-center space-x-1"
                                title="Click to inspect this well"
                              >
                                <span>{well.name}</span>
                              </button>
                            ) : (
                              <span className="font-bold text-white text-xs tracking-tight">
                                {well.name}
                              </span>
                            )}
                            {isActive && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold uppercase">
                                Active in Workspace
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                            <span className="text-cyan-400 font-semibold truncate max-w-[180px]">
                              {well.latestLasFileName || `${well.name}.las`}
                            </span>
                            <span>•</span>
                            <span className="text-slate-500">{well.apiNo || "No API"}</span>
                          </div>
                        </div>
                      </td>

                      {/* Operator & Field */}
                      <td className="p-3.5 text-slate-300">
                        <div className="truncate max-w-[150px]">{well.operatorName || "Unassigned"}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[150px]">{well.fieldName || "Standard Field"}</div>
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
                          <User className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate max-w-[110px]">{well.uploaderName || "System"}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {well.createdAt ? new Date(well.createdAt).toLocaleDateString() : "Recent"}
                        </div>
                      </td>

                      {/* Sticky Actions Column: Guaranteed to always be visible */}
                      <td className="p-3.5 text-right whitespace-nowrap sticky right-0 bg-wellqc-panel/95 backdrop-blur-md z-10 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.5)]">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Inspect Button */}
                          {onSelectWell && (
                            <button
                              type="button"
                              onClick={() => handleInspectWell(well.id)}
                              disabled={isInspectingThis}
                              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all flex items-center space-x-1 shadow-sm ${
                                isInspectingThis
                                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 cursor-wait"
                                  : "bg-wellqc-card hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border-wellqc-border hover:border-cyan-500/40"
                              }`}
                              title="Inspect curves & anomalies in workspace above"
                            >
                              {isInspectingThis ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                                  <span>Loading...</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Inspect</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* QA Engine Button with Upfront Pro/Free Gate */}
                          {isFreeTier ? (
                            <button
                              type="button"
                              onClick={() => {
                                setTargetUpgradeWellId(well.id);
                                setUpgradeModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all flex items-center space-x-1.5 shadow-sm bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border-amber-500/30 hover:border-amber-400/50 cursor-pointer"
                              title="Quality Engine requires WellQC Pro. Click to unlock."
                            >
                              <Lock className="w-3 h-3 text-amber-400" />
                              <span>QA Engine</span>
                              <span className="px-1 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold">
                                PRO
                              </span>
                            </button>
                          ) : (
                            <Link
                              href={`/qa-engine?wellId=${encodeURIComponent(well.id)}`}
                              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all flex items-center space-x-1 shadow-sm ${
                                hasCurves
                                  ? "bg-purple-500/10 hover:bg-purple-500/25 text-purple-300 hover:text-purple-200 border-purple-500/30"
                                  : "bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-300"
                              }`}
                              title={hasCurves ? "Repair in QA Engine" : "No curve data to repair"}
                            >
                              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                              <span>QA Engine</span>
                            </Link>
                          )}

                          {/* Standardisation Link */}
                          <Link
                            href={`/standardisation?wellId=${encodeURIComponent(well.id)}`}
                            className="p-1.5 rounded-lg bg-wellqc-card hover:bg-slate-800 text-slate-400 hover:text-white border border-wellqc-border transition-colors"
                            title="Open in Standardisation Engine"
                          >
                            <Layers className="w-3.5 h-3.5 text-slate-300" />
                          </Link>

                          {/* Delete Single Button (Admins Only) */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmWell(well)}
                              disabled={deletingId === well.id}
                              className="p-1.5 rounded-lg bg-wellqc-card hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-wellqc-border hover:border-rose-500/40 transition-colors disabled:opacity-50"
                              title="Delete well"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Single Delete Confirmation Modal */}
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

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-wellqc-panel border border-rose-500/50 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-mono">
                  Bulk Delete {selectedIds.size} Well Files?
                </h3>
                <p className="text-xs text-rose-300 font-mono">Irreversible database operation</p>
              </div>
            </div>

            <div className="bg-wellqc-card p-3.5 rounded-xl border border-wellqc-border max-h-48 overflow-y-auto space-y-1.5 text-xs font-mono">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                Selected Wells to be permanently purged:
              </span>
              {wells
                .filter((w) => selectedIds.has(w.id))
                .slice(0, 8)
                .map((w) => (
                  <div key={w.id} className="flex items-center justify-between text-slate-300 py-0.5">
                    <span className="text-white font-semibold truncate max-w-[240px]">{w.name}</span>
                    <span className="text-slate-500 text-[11px] truncate max-w-[180px]">
                      {w.latestLasFileName || `${w.name}.las`}
                    </span>
                  </div>
                ))}
              {selectedIds.size > 8 && (
                <div className="text-[11px] text-cyan-400 pt-1 font-semibold">
                  ...and {selectedIds.size - 8} more well files
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 font-mono leading-relaxed">
              Are you sure you want to permanently delete all <strong className="text-white font-bold">{selectedIds.size}</strong> selected well assets? This will purge all associated raw LAS curves, petrophysical diagnostic summaries, and audit reports from the database.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-wellqc-border/60">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                disabled={isBulkDeleting}
                className="px-4 py-2 rounded-xl bg-wellqc-card hover:bg-slate-800 text-slate-300 text-xs font-mono font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteConfirm}
                disabled={isBulkDeleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-all flex items-center space-x-2 shadow-lg shadow-rose-950/50 disabled:opacity-50"
              >
                {isBulkDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting {selectedIds.size} Files...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete ({selectedIds.size})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Paystack License Upgrade Modal */}
      <PaystackUpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        defaultPlanId="PRO_MONTHLY"
        targetWellId={targetUpgradeWellId}
        reason="Upgrade to WellQC Pro to access automated petrophysical repair, despiking, KNN/Spline null imputation, and certified exports."
      />
    </section>
  );
}
