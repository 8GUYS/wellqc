"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";
import { WellListItem } from "@/lib/api-types";
import { safeReadJson } from "@/lib/http-client";
import {
  Database,
  Plus,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Trash2,
  Eye,
  RefreshCw,
  UploadCloud,
  Layers,
  Sparkles,
  X,
  CheckSquare,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getLatestCommittedWellSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("wellqc_latest_committed_well");
  } catch {
    return null;
  }
}

export default function WellManagementPage() {
  const [wells, setWells] = useState<WellListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedWellId, setExpandedWellId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Bulk selection and action state
  const [selectedWellIds, setSelectedWellIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    open: boolean;
    wells: WellListItem[];
  }>({ open: false, wells: [] });
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const storedWellRaw = useSyncExternalStore(
    subscribeToStorage,
    getLatestCommittedWellSnapshot,
    () => null
  );

  const recentCommittedWell = useMemo(() => {
    if (!storedWellRaw) return null;
    try {
      const activeUserId = typeof window !== "undefined" ? localStorage.getItem("wellqc_active_user_id") : null;
      const parsed = JSON.parse(storedWellRaw);
      // Multi-tenant check: do not show another user's recently committed well banner
      if (parsed && parsed.userId && activeUserId && parsed.userId !== activeUserId) {
        return null;
      }
      if (parsed && parsed.wellId && parsed.wellName) {
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed as {
            wellId: string;
            wellName: string;
            qualityScore: number;
            timestamp: number;
          };
        }
      }
    } catch {}
    return null;
  }, [storedWellRaw]);

  const [newWellName, setNewWellName] = useState("");
  const [newApiNo, setNewApiNo] = useState("");
  const [newOperator, setNewOperator] = useState("");
  const [newField, setNewField] = useState("");
  const [newBasin, setNewBasin] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [newTd, setNewTd] = useState("");

  useEffect(() => {
    loadWells();
  }, []);

  const toggleExpandWell = (wellId: string) => {
    setExpandedWellId((current) => (current === wellId ? null : wellId));
  };

  const filteredWells = wells.filter((well) => {
    const needle = searchQuery.toLowerCase();
    const matchesSearch =
      well.name.toLowerCase().includes(needle) ||
      well.apiNo.toLowerCase().includes(needle) ||
      well.operatorName.toLowerCase().includes(needle) ||
      well.fieldName.toLowerCase().includes(needle);
    const matchesStatus = statusFilter === "ALL" || well.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Bulk selection computations & handlers
  const isAllFilteredSelected =
    filteredWells.length > 0 &&
    filteredWells.every((well) => selectedWellIds.includes(well.id));

  const isSomeFilteredSelected =
    filteredWells.some((well) => selectedWellIds.includes(well.id)) && !isAllFilteredSelected;

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredWells.map((w) => w.id));
      setSelectedWellIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const currentSet = new Set(selectedWellIds);
      filteredWells.forEach((w) => currentSet.add(w.id));
      setSelectedWellIds(Array.from(currentSet));
    }
  };

  const toggleSelectWell = (id: string) => {
    setSelectedWellIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const clearSelection = () => {
    setSelectedWellIds([]);
  };

  const selectedWellsData = useMemo(() => {
    const selectedSet = new Set(selectedWellIds);
    const selectedList = wells.filter((w) => selectedSet.has(w.id));
    const totalCurves = selectedList.reduce((acc, w) => acc + (w.curveCount || 0), 0);
    const totalPoints = selectedList.reduce((acc, w) => acc + (w.pointCount || 0), 0);
    return {
      list: selectedList,
      count: selectedList.length,
      totalCurves,
      totalPoints,
    };
  }, [wells, selectedWellIds]);

  async function loadWells() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/wells", { cache: "no-store" });
      const res = await safeReadJson<{ wells: WellListItem[] }>(response, "Unable to load wells.");

      if (!res.ok || !res.data) {
        throw new Error(res.error || "Unable to load wells.");
      }

      const fetchedWells: WellListItem[] = res.data.wells || [];
      setWells(fetchedWells);

      // If URL has ?highlight=wellId or ?search=term, auto apply
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const highlightId = params.get("highlight");
        if (highlightId) {
          setExpandedWellId(highlightId);
        }
        const searchParam = params.get("search");
        if (searchParam) {
          setSearchQuery(searchParam);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load wells.");
    } finally {
      setIsLoading(false);
    }
  }

  const handleCreateWell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWellName || !newApiNo) return;

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch("/api/wells", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWellName,
          apiNo: newApiNo,
          operatorName: newOperator,
          fieldName: newField,
          basin: newBasin,
          country: newCountry,
          tdFt: parseFloat(newTd) || 0,
        }),
      });
      const res = await safeReadJson<{ well: WellListItem }>(response, "Unable to create well.");

      if (!res.ok || !res.data) {
        throw new Error(res.error || "Unable to create well.");
      }

      setIsCreateOpen(false);
      resetForm();
      await loadWells();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create well.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenBulkDelete = () => {
    if (selectedWellsData.list.length === 0) return;
    setDeleteConfirmModal({
      open: true,
      wells: selectedWellsData.list,
    });
  };

  const handleOpenSingleDelete = (well: WellListItem) => {
    setDeleteConfirmModal({
      open: true,
      wells: [well],
    });
  };

  const handleExecuteDelete = async () => {
    const targetWells = deleteConfirmModal.wells;
    if (targetWells.length === 0) return;

    setIsBulkDeleting(true);
    setError("");

    try {
      const targetIds = targetWells.map((w) => w.id);
      const response = await fetch("/api/wells/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wellIds: targetIds }),
      });

      const res = await safeReadJson<{
        success: boolean;
        deletedCount: number;
        deletedIds: string[];
        message?: string;
      }>(response, "Unable to delete selected well(s).");

      if (!res.ok) {
        throw new Error(res.error || "Unable to delete selected well(s).");
      }

      const deletedIds = new Set(res.data?.deletedIds || targetIds);
      setWells((current) => current.filter((well) => !deletedIds.has(well.id)));
      setSelectedWellIds((current) => current.filter((id) => !deletedIds.has(id)));
      setDeleteConfirmModal({ open: false, wells: [] });

      setFeedbackMessage({
        type: "success",
        text: res.data?.message || `Successfully deleted ${deletedIds.size} well asset(s).`,
      });

      setTimeout(() => {
        setFeedbackMessage(null);
      }, 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to delete well(s).";
      setError(msg);
      setFeedbackMessage({
        type: "error",
        text: msg,
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDeleteWell = async (id: string) => {
    const targetWell = wells.find((w) => w.id === id);
    if (targetWell) {
      handleOpenSingleDelete(targetWell);
    }
  };

  const resetForm = () => {
    setNewWellName("");
    setNewApiNo("");
    setNewOperator("");
    setNewField("");
    setNewBasin("");
    setNewCountry("");
    setNewTd("");
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-wellqc-panel/60 border border-wellqc-border p-5 rounded-2xl">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-blue-500/20 text-cyan-300 border border-cyan-500/40">
                Module 02 - Well Master Index
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              Enterprise Well Asset Management
            </h1>
            <p className="text-xs text-wellqc-muted font-mono mt-0.5">
              Database-backed list of wells created manually or committed from validated LAS uploads.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href="/upload"
              className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-wellqc-card border border-wellqc-border hover:border-cyan-500/50 text-cyan-300 font-bold text-xs transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload LAS</span>
            </Link>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Well Asset</span>
            </button>
          </div>
        </div>

        {recentCommittedWell && !bannerDismissed && (
          <div className="bg-gradient-to-r from-cyan-950/40 via-wellqc-panel to-cyan-950/40 border border-cyan-500/40 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                  <span>Recently Committed Well:</span>
                  <span className="text-cyan-300">{recentCommittedWell.wellName}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                    Score: {recentCommittedWell.qualityScore}/100
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Curve results and quality inventory are saved in database and accessible below.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => toggleExpandWell(recentCommittedWell.wellId)}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{expandedWellId === recentCommittedWell.wellId ? "Hide Curves" : "View Curve Results"}</span>
              </button>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                className="p-1.5 rounded-lg hover:bg-wellqc-card text-slate-400 hover:text-white"
                title="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {feedbackMessage && (
          <div
            className={`border rounded-xl px-4 py-3 text-xs font-mono flex items-center justify-between gap-3 ${
              feedbackMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-slate-400 hover:text-white p-1 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-xs font-mono">
            {error}
          </div>
        )}

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-wellqc-panel border border-wellqc-border p-4 rounded-xl">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter wells by Name, API/UWI number, Operator, or Field..."
              className="w-full bg-wellqc-card border border-wellqc-border rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-wellqc-card border border-wellqc-border rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DRILLING">Drilling</option>
              <option value="SHUT_IN">Shut In</option>
              <option value="UNVALIDATED">Unvalidated</option>
            </select>
          </div>
        </div>

        {isCreateOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-wellqc-border">
                <h3 className="text-base font-bold text-white font-mono">Create Well Asset Entry</h3>
                <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white text-sm">
                  X
                </button>
              </div>

              <form onSubmit={handleCreateWell} className="space-y-3 text-xs font-mono">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormInput label="Well Name *" value={newWellName} onChange={setNewWellName} placeholder="e.g. AKPO_NORTH_12" required />
                  <FormInput label="API / UWI Number *" value={newApiNo} onChange={setNewApiNo} placeholder="e.g. NG-AKPO-012" required />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormInput label="Operator" value={newOperator} onChange={setNewOperator} placeholder="Operator name" />
                  <FormInput label="Field Name" value={newField} onChange={setNewField} placeholder="Field name" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormInput label="Basin" value={newBasin} onChange={setNewBasin} placeholder="Basin" />
                  <FormInput label="Country" value={newCountry} onChange={setNewCountry} placeholder="Country" />
                  <FormInput label="Total Depth (FT)" value={newTd} onChange={setNewTd} placeholder="0" type="number" />
                </div>
                <div className="pt-3 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 rounded-lg bg-wellqc-card text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save Asset"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bulk Action Toolbar */}
        {selectedWellIds.length > 0 && (
          <div className="bg-gradient-to-r from-cyan-950/60 via-wellqc-panel to-blue-950/60 border border-cyan-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-cyan-950/20 transition-all">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold text-xs border border-cyan-500/40 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {selectedWellsData.count} of {wells.length} well{selectedWellsData.count > 1 ? "s" : ""} selected
                </span>
              </span>
              <span className="text-xs text-slate-400 font-mono hidden md:inline">
                {selectedWellsData.totalCurves} total curves · {selectedWellsData.totalPoints.toLocaleString()} points
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {filteredWells.length > selectedWellsData.count && (
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="px-3 py-1.5 rounded-lg bg-wellqc-card border border-wellqc-border hover:border-cyan-500/40 text-slate-300 hover:text-white text-xs font-mono font-semibold transition-colors"
                >
                  Select all visible ({filteredWells.length})
                </button>
              )}
              <button
                type="button"
                onClick={clearSelection}
                className="px-3 py-1.5 rounded-lg bg-wellqc-card border border-wellqc-border hover:border-slate-500 text-slate-400 hover:text-white text-xs font-mono transition-colors"
              >
                Deselect all
              </button>
              <button
                type="button"
                onClick={handleOpenBulkDelete}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 hover:border-rose-500 text-rose-300 font-bold text-xs font-mono flex items-center gap-1.5 transition-all shadow-md shadow-rose-950/40"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete Selected ({selectedWellsData.count})</span>
              </button>
            </div>
          </div>
        )}

        <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-8 text-center text-cyan-300 text-xs font-mono flex items-center justify-center">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Loading wells from database...
            </div>
          ) : filteredWells.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <Database className="w-8 h-8 text-cyan-400 mx-auto" />
              <div className="text-sm font-bold text-white">No wells found</div>
              <p className="text-xs text-wellqc-muted font-mono">
                Commit a validated LAS file or create a well asset to populate this table.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-wellqc-card border-b border-wellqc-border text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeFilteredSelected;
                        }}
                        onChange={toggleSelectAllFiltered}
                        title={isAllFilteredSelected ? "Deselect all visible" : "Select all visible"}
                        className="w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-400 bg-wellqc-panel cursor-pointer accent-cyan-500"
                      />
                    </th>
                    <th className="p-4">Well Asset Name</th>
                    <th className="p-4">API / UWI</th>
                    <th className="p-4">Operator</th>
                    <th className="p-4">Field & Basin</th>
                    <th className="p-4">Country</th>
                    <th className="p-4">LAS File</th>
                    <th className="p-4">Quality Score</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wellqc-border text-slate-200">
                  {filteredWells.map((well) => {
                    const isExpanded = expandedWellId === well.id;
                    const isSelected = selectedWellIds.includes(well.id);

                    return (
                      <React.Fragment key={well.id}>
                        <tr
                          className={`hover:bg-wellqc-card/60 transition-colors ${
                            isExpanded ? "bg-wellqc-card/40" : ""
                          } ${isSelected ? "bg-cyan-950/30 border-l-2 border-cyan-400" : ""}`}
                        >
                          <td className="p-4 text-center w-12" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectWell(well.id)}
                              title={`Select well ${well.name}`}
                              className="w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-400 bg-wellqc-panel cursor-pointer accent-cyan-500"
                            />
                          </td>
                          <td className="p-4 font-bold text-white">
                            <Link href={`/wells/${well.id}`} className="hover:text-cyan-400 flex items-center space-x-2">
                              <Database className="w-4 h-4 text-cyan-400 shrink-0" />
                              <span>{well.name}</span>
                            </Link>
                          </td>
                          <td className="p-4 text-slate-400">{well.apiNo}</td>
                          <td className="p-4 text-cyan-300 font-semibold">{well.operatorName}</td>
                          <td className="p-4">
                            <div>{well.fieldName}</div>
                            <div className="text-[10px] text-wellqc-muted">{well.basin}</div>
                          </td>
                          <td className="p-4 text-slate-400">{well.country}</td>
                          <td className="p-4">
                            <div>{well.latestLasFileName || "No LAS committed"}</div>
                            <div className="text-[10px] text-wellqc-muted">
                              {well.curveCount} curves | {well.pointCount.toLocaleString()} points
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                              well.qualityScore >= 90 ? "badge-excellent" :
                              well.qualityScore >= 75 ? "badge-good" :
                              well.qualityScore >= 50 ? "badge-poor" : "badge-critical"
                            }`}>
                              {well.qualityScore}/100 ({well.qualityGrade})
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleExpandWell(well.id)}
                              className={`p-1.5 rounded-lg border inline-flex items-center gap-1 text-xs font-mono transition-all ${
                                isExpanded
                                  ? "bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-sm shadow-cyan-500/20"
                                  : "bg-wellqc-card border-wellqc-border hover:border-cyan-500/50 text-cyan-300"
                              }`}
                              title="View Curve Standardisation & Quality Inventory"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-bold">Curves</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <Link
                              href={`/wells/${well.id}`}
                              className="p-1.5 rounded-lg bg-wellqc-card hover:bg-cyan-500/20 text-cyan-300 inline-block transition-colors"
                              title="View Well Log Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleOpenSingleDelete(well)}
                              className="p-1.5 rounded-lg bg-wellqc-card hover:bg-red-500/20 text-red-400 inline-block transition-colors"
                              title="Delete Well"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-950/80">
                            <td colSpan={9} className="p-4 border-b border-wellqc-border">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                  <div className="text-xs font-bold text-slate-200 font-mono flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-cyan-400" />
                                    <span>
                                      Curve Results for <span className="text-cyan-300">{well.name}</span> ({well.apiNo})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs font-mono">
                                    <Link
                                      href={`/wells/${well.id}`}
                                      className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-bold"
                                    >
                                      <span>Interactive Wireline Viewer</span>
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() => setExpandedWellId(null)}
                                      className="text-slate-400 hover:text-white"
                                    >
                                      Close
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {(well.curveSummaries ?? []).length > 0 ? (
                                    (well.curveSummaries ?? []).map((summary, index) => {
                                      const curveSummary = summary;
                                      const curveName = typeof curveSummary.standardMnemonic === "string"
                                        ? curveSummary.standardMnemonic
                                        : typeof curveSummary.mnemonic === "string"
                                          ? curveSummary.mnemonic
                                          : `Curve ${index + 1}`;
                                      const curveStatus = typeof curveSummary.status === "string" ? curveSummary.status : "UNKNOWN";
                                      const curveHealth = typeof curveSummary.healthScore === "number" ? curveSummary.healthScore : null;
                                      const curveUnit = typeof curveSummary.unit === "string" ? curveSummary.unit : "—";
                                      const anomalyCount = Array.isArray(curveSummary.anomalies) ? curveSummary.anomalies.length : 0;

                                      return (
                                        <div key={`${well.id}-curve-${curveName}-${index}`} className="rounded-xl border border-wellqc-border bg-wellqc-panel/80 p-3">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-bold text-white font-mono">{curveName}</span>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 border border-cyan-500/40 text-cyan-300">
                                              {curveStatus}
                                            </span>
                                          </div>
                                          <div className="mt-2 text-[11px] text-slate-300 font-mono">
                                            Unit: {curveUnit} · Health: {curveHealth !== null ? `${curveHealth}/100` : "—"}
                                          </div>
                                          <div className="mt-1 text-[11px] text-slate-400 font-mono">
                                            Anomalies: {anomalyCount}
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p className="text-xs text-slate-400 font-mono">No curve summaries available for this well yet.</p>
                                  )}
                                </div>
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
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirmModal.open && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-wellqc-panel border border-rose-500/40 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl shadow-rose-950/50">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-white font-mono">
                    {deleteConfirmModal.wells.length === 1
                      ? `Delete Well Asset: ${deleteConfirmModal.wells[0].name}?`
                      : `Permanently Delete ${deleteConfirmModal.wells.length} Well Assets?`}
                  </h3>
                  <p className="text-xs text-slate-300 font-mono mt-1">
                    {deleteConfirmModal.wells.length === 1
                      ? "You are about to delete this well asset from the Well Master Index."
                      : `You are about to delete ${deleteConfirmModal.wells.length} selected well assets from the database.`}
                  </p>
                </div>
                <button
                  onClick={() => setDeleteConfirmModal({ open: false, wells: [] })}
                  disabled={isBulkDeleting}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-wellqc-card/80 border border-wellqc-border rounded-xl p-3 max-h-48 overflow-y-auto space-y-2">
                <div className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">
                  Assets to be removed ({deleteConfirmModal.wells.length}):
                </div>
                <div className="divide-y divide-wellqc-border/60">
                  {deleteConfirmModal.wells.map((w) => (
                    <div key={w.id} className="py-2 flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="font-bold text-white">{w.name}</span>
                        <span className="text-slate-400 ml-2">({w.apiNo})</span>
                      </div>
                      <span className="text-[11px] text-cyan-300">{w.operatorName || "No operator"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 font-mono space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Irreversible Action</span>
                </div>
                <p className="text-[11px] text-rose-200/80">
                  All associated LAS files, curve health matrices, anomaly logs, and QA reports will be permanently purged from the database.
                </p>
              </div>

              <div className="pt-2 flex justify-end space-x-3 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmModal({ open: false, wells: [] })}
                  disabled={isBulkDeleting}
                  className="px-4 py-2 rounded-xl bg-wellqc-card border border-wellqc-border hover:border-slate-500 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDelete}
                  disabled={isBulkDeleting}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-rose-950/40 disabled:opacity-60"
                >
                  {isBulkDeleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm & Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-wellqc-card border border-wellqc-border rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
      />
    </div>
  );
}
