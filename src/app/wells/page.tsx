"use client";

import { useEffect, useState, useMemo, useDeferredValue } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
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
  UploadCloud,
  GitCompare,
  Lock,
} from "lucide-react";
import { PaystackUpgradeModal } from "@/components/payments/paystack-upgrade-modal";

export default function WellAssetsManagementPage() {
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
      const res = await safeReadJson<{ wells: WellListItem[] }>(response, "Unable to load well assets.");
      if (!res.ok || !res.data) {
        throw new Error(res.error || "Unable to load well assets.");
      }
      setWells(res.data.wells || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load well assets.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadWells();
    });
    return () => {
      active = false;
    };
  }, []);

  // Filtered wells calculation
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

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    const totalWells = wells.length;
    const readyWells = wells.filter((w) => (w.qualityScore || 0) >= 80).length;
    const attentionWells = wells.filter((w) => (w.qualityScore || 0) < 60).length;
    const totalCurves = wells.reduce((sum, w) => sum + (w.curveCount || 0), 0);
    const avgScore = totalWells > 0
      ? Math.round(wells.reduce((sum, w) => sum + (w.qualityScore || 0), 0) / totalWells)
      : 0;

    return { totalWells, readyWells, attentionWells, totalCurves, avgScore };
  }, [wells]);

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
    <AppShell>
      <div className="space-y-6 pb-20">
        {/* Page Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl shadow-xl">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <Database className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold font-mono text-white tracking-tight">
                  Well Assets Management
                </h1>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold uppercase">
                  {wells.length} Total Wells
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Central subsurface database repository. Inspect wireline curves, manage logs, and track petrophysical asset quality.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            <button
              type="button"
              onClick={loadWells}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-wellqc-card hover:bg-slate-800 border border-wellqc-border hover:border-cyan-500/40 text-slate-300 hover:text-white font-mono text-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
              title="Refresh database wells list"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            <Link
              href="/upload"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-mono font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-cyan-500/20 transition-all"
            >
              <UploadCloud className="w-4 h-4 text-slate-950" />
              <span>Upload LAS Log</span>
            </Link>
          </div>
        </header>

        {/* Operational Metrics KPI Cards */}
        <section aria-label="Well Repository Metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl bg-wellqc-panel border border-wellqc-border font-mono shadow-md">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Well Assets</span>
            <div className="text-2xl font-black text-white mt-1">
              {metrics.totalWells} <span className="text-xs text-slate-400 font-normal">Registered</span>
            </div>
            <span className="text-[11px] text-cyan-400 mt-0.5 block">Avg Score: {metrics.avgScore}/100</span>
          </div>

          <div className="p-4 rounded-2xl bg-wellqc-panel border border-wellqc-border font-mono shadow-md">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Interpretation-Ready (≥80)</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {metrics.readyWells} <span className="text-xs text-slate-400 font-normal">Wells</span>
            </div>
            <span className="text-[11px] text-emerald-400/80 mt-0.5 block">Passes NUPRC Audit Grade</span>
          </div>

          <div className="p-4 rounded-2xl bg-wellqc-panel border border-wellqc-border font-mono shadow-md">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Needs Remediation (&lt;60)</span>
            <div className="text-2xl font-black text-amber-400 mt-1">
              {metrics.attentionWells} <span className="text-xs text-slate-400 font-normal">Wells</span>
            </div>
            <span className="text-[11px] text-amber-400/80 mt-0.5 block">Despike &amp; repair in QA Engine</span>
          </div>

          <div className="p-4 rounded-2xl bg-wellqc-panel border border-wellqc-border font-mono shadow-md">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Active Curve Channels</span>
            <div className="text-2xl font-black text-purple-400 mt-1">
              {metrics.totalCurves} <span className="text-xs text-slate-400 font-normal">Curves</span>
            </div>
            <span className="text-[11px] text-purple-400/80 mt-0.5 block">Extracted from ~C Sections</span>
          </div>
        </section>

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
              <option value="EXCELLENT">Excellent (≥80)</option>
              <option value="GOOD">Good (60-79)</option>
              <option value="POOR">Poor (40-59)</option>
              <option value="CRITICAL">Critical / Unvalidated</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Toolbar (Admins Only) */}
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

        {/* Wells Table Container */}
        <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-xl">
          {isLoading && wells.length === 0 ? (
            <div className="p-12 text-center text-cyan-300 text-xs font-mono flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Loading well assets...</span>
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
                {searchQuery || gradeFilter !== "ALL" ? "No matching well assets found" : "No wells registered yet"}
              </div>
              <p className="text-xs text-slate-400 font-mono max-w-md mx-auto">
                {searchQuery || gradeFilter !== "ALL"
                  ? "Try adjusting your search criteria or clearing filters above."
                  : "Upload a LAS well log on the Data Upload page to begin auditing and tracking your well assets."}
              </p>
              <Link
                href="/upload"
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-xs hover:bg-cyan-500/20 transition-all mt-2"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Go to Data Upload Workstation</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto relative">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-wellqc-card/90 border-b border-wellqc-border text-slate-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    {/* Header Checkbox (Admins Only) */}
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
                    <th className="p-3.5 text-right min-w-[260px] sticky right-0 bg-wellqc-card/95 backdrop-blur-md z-10 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.5)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wellqc-border/60">
                  {filteredWells.map((well) => {
                    const isSelected = selectedIds.has(well.id);
                    const grade = (well.qualityGrade || "UNVALIDATED").toUpperCase();
                    const score = typeof well.qualityScore === "number" ? Math.round(well.qualityScore) : 0;
                    const hasCurves = (well.curveCount || 0) > 0;

                    return (
                      <tr
                        key={well.id}
                        className={`hover:bg-wellqc-card/40 transition-colors group ${
                          isSelected ? "bg-cyan-500/5" : ""
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
                              <Link
                                href={`/wells/${well.id}`}
                                className="font-bold text-white text-xs tracking-tight hover:text-cyan-400 transition-colors flex items-center space-x-1"
                                title="Open full well dossier & log viewer"
                              >
                                <span>{well.name}</span>
                              </Link>
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
                            {/* Inspect Link */}
                            <Link
                              href={`/wells/${well.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-wellqc-card hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-wellqc-border hover:border-cyan-500/40 text-[11px] font-bold transition-colors flex items-center space-x-1 shadow-sm"
                              title="Inspect curves & anomalies in well dossier"
                            >
                              <Eye className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Inspect</span>
                            </Link>

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

                            {/* Well Comparison Link */}
                            <Link
                              href={`/comparison?wellA=${encodeURIComponent(well.id)}`}
                              className="p-1.5 rounded-lg bg-wellqc-card hover:bg-slate-800 text-slate-400 hover:text-white border border-wellqc-border transition-colors"
                              title="Compare with another well in Stratigraphic Engine"
                            >
                              <GitCompare className="w-3.5 h-3.5 text-slate-300" />
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
                  <h3 className="text-base font-bold text-white font-mono">Delete Well Asset?</h3>
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
                    Bulk Delete {selectedIds.size} Well Assets?
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
      </div>
    </AppShell>
  );
}
