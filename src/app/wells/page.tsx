"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";
import { WellListItem } from "@/lib/api-types";
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

  const storedWellRaw = useSyncExternalStore(
    subscribeToStorage,
    getLatestCommittedWellSnapshot,
    () => null
  );

  const recentCommittedWell = useMemo(() => {
    if (!storedWellRaw) return null;
    try {
      const parsed = JSON.parse(storedWellRaw);
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

  async function loadWells() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/wells", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load wells.");
      }

      const fetchedWells: WellListItem[] = data.wells || [];
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
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create well.");
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

  const handleDeleteWell = async (id: string) => {
    setError("");

    try {
      const response = await fetch(`/api/wells/${id}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to delete well.");
      }

      setWells((current) => current.filter((well) => well.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete well.");
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

                    return (
                      <React.Fragment key={well.id}>
                        <tr className={`hover:bg-wellqc-card/60 transition-colors ${isExpanded ? "bg-wellqc-card/40" : ""}`}>
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
                              onClick={() => handleDeleteWell(well.id)}
                              className="p-1.5 rounded-lg bg-wellqc-card hover:bg-red-500/20 text-red-400 inline-block transition-colors"
                              title="Delete Well"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-950/80">
                            <td colSpan={8} className="p-4 border-b border-wellqc-border">
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
