"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  getMergedStandardCurves,
  validateAliasForCurve,
  setCustomAliases,
  updateActiveUploadWithNewAlias,
  StandardCurveDef,
  CustomAliasEntry,
} from "@/lib/las/standardiser";
import { analyzeWellLogQuality } from "@/lib/las/quality-engine";
import {
  Search,
  Plus,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  User,
  X,
  Layers,
} from "lucide-react";

export default function StandardisationPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [curves, setCurves] = useState<StandardCurveDef[]>([]);
  const [customAliases, setCustomAliasesState] = useState<CustomAliasEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentUserName, setCurrentUserName] = useState("Lead Petrophysicist");

  // Active Popover on Click
  const [activePopoverAlias, setActivePopoverAlias] = useState<string | null>(null);

  // Manage All Custom Overrides Modal
  const [manageModalOpen, setManageModalOpen] = useState(false);

  // Add Alias Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedCurve, setSelectedCurve] = useState<string | null>(null);
  const [newAlias, setNewAlias] = useState("");
  const [addedByName, setAddedByName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isSavingAdd, setIsSavingAdd] = useState(false);

  // Edit Alias Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCurve, setEditingCurve] = useState<string | null>(null);
  const [oldAlias, setOldAlias] = useState("");
  const [newAliasEdit, setNewAliasEdit] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingCurve, setDeletingCurve] = useState<string | null>(null);
  const [deletingAlias, setDeletingAlias] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast Banner State
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  // Fetch current user details for author attribution
  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          if (data.user?.name) {
            setCurrentUserName(data.user.name);
            setAddedByName(data.user.name);
          }
        }
      } catch {
        // Keep default
      }
    }
    loadUser();
  }, []);

  // Sync Shared Aliases on demand (User click)
  const handleSyncShared = async () => {
    setIsSyncing(true);
    const startTime = Date.now();
    try {
      const res = await fetch("/api/standardisation/aliases", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const serverAliases: CustomAliasEntry[] = Array.isArray(data.aliases) ? data.aliases : [];
        setCustomAliases(serverAliases);
        setCustomAliasesState(serverAliases);
        const merged = getMergedStandardCurves(serverAliases);
        setCurves(Object.values(merged));

        const elapsed = Date.now() - startTime;
        if (elapsed < 500) {
          await new Promise((r) => setTimeout(r, 500 - elapsed));
        }
        showToast(
          `Synchronized ${serverAliases.length} custom override${serverAliases.length === 1 ? "" : "s"} across your account!`,
          "success"
        );
      } else {
        const merged = getMergedStandardCurves();
        setCurves(Object.values(merged));
        showToast("Failed to sync shared aliases from server.", "error");
      }
    } catch (err) {
      console.warn("Could not load aliases from server, using local fallback:", err);
      const merged = getMergedStandardCurves();
      setCurves(Object.values(merged));
      showToast("Network error syncing shared aliases.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  // Initial load on mount
  useEffect(() => {
    let isMounted = true;
    async function loadInitialAliases() {
      try {
        const res = await fetch("/api/standardisation/aliases", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            const serverAliases: CustomAliasEntry[] = Array.isArray(data.aliases) ? data.aliases : [];
            setCustomAliases(serverAliases);
            setCustomAliasesState(serverAliases);
            const merged = getMergedStandardCurves(serverAliases);
            setCurves(Object.values(merged));
          }
        } else if (isMounted) {
          const merged = getMergedStandardCurves();
          setCurves(Object.values(merged));
        }
      } catch (err) {
        if (isMounted) {
          console.warn("Could not load aliases from server, using local fallback:", err);
          const merged = getMergedStandardCurves();
          setCurves(Object.values(merged));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialAliases();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    function handleDocumentClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-alias-popover]") && !target.closest("[data-alias-pill]")) {
        setActivePopoverAlias(null);
      }
    }
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  // Filter curves
  const filteredCurves = curves.filter((c) => {
    const matchesSearch =
      c.standardMnemonic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.aliases.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === "ALL"
        ? true
        : selectedCategory === "CUSTOM_ONLY"
        ? Boolean(c.customAliases && c.customAliases.length > 0)
        : c.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = ["ALL", "DEPTH", "GAMMA", "DENSITY", "POROSITY", "SONIC", "RESISTIVITY", "CALIPER", "POTENTIAL", "OTHER"];

  // Open Add Alias Modal
  const openAddModal = (curveMnemonic: string) => {
    setSelectedCurve(curveMnemonic);
    setNewAlias("");
    setAddedByName(currentUserName);
    setAddError(null);
    setAddModalOpen(true);
  };

  // Real-time validation for adding alias (Issue 2)
  const handleNewAliasChange = (val: string) => {
    setNewAlias(val);
    if (!selectedCurve || !val.trim()) {
      setAddError(null);
      return;
    }
    const validation = validateAliasForCurve(val, selectedCurve, undefined, customAliases);
    if (!validation.valid) {
      setAddError(validation.error || null);
    } else {
      setAddError(null);
    }
  };

  // Submit Add Alias (Issue 1 & 2)
  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCurve || !newAlias.trim()) return;

    const validation = validateAliasForCurve(newAlias, selectedCurve, undefined, customAliases);
    if (!validation.valid) {
      setAddError(validation.error || "Alias is already mapped.");
      return;
    }

    setIsSavingAdd(true);
    try {
      const res = await fetch("/api/standardisation/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          standardMnemonic: selectedCurve,
          alias: newAlias.trim().toUpperCase(),
          addedBy: addedByName.trim() || currentUserName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || "Failed to save alias.");
        return;
      }

      const updatedList: CustomAliasEntry[] = data.aliases || [];
      setCustomAliases(updatedList);
      setCustomAliasesState(updatedList);
      setCurves(Object.values(getMergedStandardCurves(updatedList)));

      updateActiveUploadWithNewAlias(analyzeWellLogQuality);

      showToast(`Alias "${newAlias.trim().toUpperCase()}" mapped to ${selectedCurve} across all users!`, "success");
      setAddModalOpen(false);
      setNewAlias("");
      setAddError(null);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to connect to server.");
    } finally {
      setIsSavingAdd(false);
    }
  };

  // Open Edit Alias Modal (Issue 3)
  const openEditModal = (curveMnemonic: string, alias: string) => {
    setActivePopoverAlias(null);
    setEditingCurve(curveMnemonic);
    setOldAlias(alias);
    setNewAliasEdit(alias);
    setEditError(null);
    setEditModalOpen(true);
  };

  // Real-time validation for editing alias (Issue 2 & 3)
  const handleEditAliasChange = (val: string) => {
    setNewAliasEdit(val);
    if (!editingCurve || !val.trim()) {
      setEditError(null);
      return;
    }
    const validation = validateAliasForCurve(val, editingCurve, oldAlias, customAliases);
    if (!validation.valid) {
      setEditError(validation.error || null);
    } else {
      setEditError(null);
    }
  };

  // Submit Edit Alias (Issue 3)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCurve || !oldAlias || !newAliasEdit.trim()) return;

    if (oldAlias.toUpperCase() === newAliasEdit.trim().toUpperCase()) {
      setEditModalOpen(false);
      return;
    }

    const validation = validateAliasForCurve(newAliasEdit, editingCurve, oldAlias, customAliases);
    if (!validation.valid) {
      setEditError(validation.error || "Alias is already mapped.");
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch("/api/standardisation/aliases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          standardMnemonic: editingCurve,
          oldAlias: oldAlias.toUpperCase(),
          newAlias: newAliasEdit.trim().toUpperCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Failed to update alias.");
        return;
      }

      const updatedList: CustomAliasEntry[] = data.aliases || [];
      setCustomAliases(updatedList);
      setCustomAliasesState(updatedList);
      setCurves(Object.values(getMergedStandardCurves(updatedList)));

      updateActiveUploadWithNewAlias(analyzeWellLogQuality);

      showToast(`Updated alias "${oldAlias}" to "${newAliasEdit.trim().toUpperCase()}"`, "success");
      setEditModalOpen(false);
      setEditError(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to connect to server.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open Delete Modal (Issue 3)
  const openDeleteModal = (curveMnemonic: string, alias: string) => {
    setActivePopoverAlias(null);
    setDeletingCurve(curveMnemonic);
    setDeletingAlias(alias);
    setDeleteModalOpen(true);
  };

  // Submit Delete Alias (Issue 3)
  const handleConfirmDelete = async () => {
    if (!deletingCurve || !deletingAlias) return;

    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/standardisation/aliases?standardMnemonic=${encodeURIComponent(deletingCurve)}&alias=${encodeURIComponent(deletingAlias)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            standardMnemonic: deletingCurve,
            alias: deletingAlias,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to delete alias", "error");
        return;
      }

      const updatedList: CustomAliasEntry[] = data.aliases || [];
      setCustomAliases(updatedList);
      setCustomAliasesState(updatedList);
      setCurves(Object.values(getMergedStandardCurves(updatedList)));

      updateActiveUploadWithNewAlias(analyzeWellLogQuality);

      showToast(`Deleted custom alias "${deletingAlias}" from ${deletingCurve}`, "info");
      setDeleteModalOpen(false);
      setDeletingCurve(null);
      setDeletingAlias(null);
    } catch {
      showToast("Network error deleting alias.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper date formatter
  const formatTimestamp = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) return "Recently";
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
    } catch {
      return "Recently";
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Toast Alert */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 flex items-center space-x-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md transition-all font-mono text-xs ${
              toast.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
                : toast.type === "error"
                ? "bg-rose-950/90 border-rose-500/50 text-rose-200"
                : "bg-cyan-950/90 border-cyan-500/50 text-cyan-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Header with Stats & Sync */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-wellqc-panel/60 border border-wellqc-border p-5 rounded-2xl shadow-lg backdrop-blur-sm">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-purple-400" />
                Module 04 — Petrophysical Standardisation
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                Shared Enterprise Dictionary
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1.5 flex items-center gap-2">
              Curve Mnemonic Standardisation Dictionary
            </h1>
            <p className="text-xs text-wellqc-muted font-mono mt-0.5 max-w-3xl">
              Automated mapping rules, alias dictionaries, and shared team overrides. Custom aliases sync automatically across all users and browsers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncShared}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-wellqc-card hover:bg-wellqc-card/80 text-slate-300 hover:text-white border border-wellqc-border text-xs font-mono font-semibold transition-all disabled:opacity-50"
              title="Refresh shared aliases from server"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : "Sync Shared Aliases"}</span>
            </button>
          </div>
        </div>

        {/* Legend & Stats Banner (Addressing Issue 4) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-wellqc-panel/80 border border-wellqc-border p-4 rounded-xl flex items-center justify-between font-mono text-xs">
            <div>
              <span className="text-[10px] text-wellqc-muted uppercase tracking-wider block">Standard Curve Families</span>
              <span className="text-xl font-bold text-white mt-0.5 block">{curves.length} API Curves</span>
            </div>
            <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setManageModalOpen(true)}
            className="bg-wellqc-panel/80 hover:bg-wellqc-card border border-purple-500/40 hover:border-purple-400 p-4 rounded-xl flex items-center justify-between font-mono text-xs text-left transition-all group cursor-pointer shadow-lg hover:shadow-purple-500/10 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            title="Click to view and manage all custom overrides"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-purple-300 uppercase tracking-wider block font-bold">
                  Custom Team Aliases
                </span>
                <span className="text-[9px] bg-purple-500/30 text-purple-200 border border-purple-500/50 px-1.5 py-0.5 rounded font-mono font-semibold">
                  Manage ↗
                </span>
              </div>
              <span className="text-xl font-bold text-purple-300 mt-1 block group-hover:text-purple-100 transition-colors">
                {customAliases.length} Custom Override{customAliases.length === 1 ? "" : "s"}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block group-hover:text-cyan-300 transition-colors">
                Click to view, edit, or delete →
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 group-hover:scale-110 group-hover:bg-purple-500/20 transition-all">
              <Sparkles className="w-5 h-5" />
            </div>
          </button>

          <div className="bg-wellqc-panel/80 border border-wellqc-border p-4 rounded-xl flex flex-col justify-center font-mono text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-wellqc-muted uppercase tracking-wider font-bold">
                Alias Visual Legend (Clickable)
              </span>
              <span className="text-[9px] text-cyan-400">Interactive Filter</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <button
                type="button"
                id="legend-builtin-filter"
                onClick={() => {
                  setSelectedCategory("ALL");
                  showToast(`Showing all ${curves.length} standard curve families and built-in aliases`, "info");
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer select-none ${
                  selectedCategory === "ALL"
                    ? "bg-slate-800 text-cyan-300 border-cyan-500/60 ring-1 ring-cyan-500/40 shadow-sm"
                    : "bg-wellqc-card border-wellqc-border text-slate-300 hover:text-white hover:border-slate-500"
                }`}
                title="Click to show all standard curves with built-in aliases"
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"></span>
                <span>Built-in standard</span>
                {selectedCategory === "ALL" && (
                  <span className="text-[9px] text-cyan-300 font-bold ml-0.5">✓ Active</span>
                )}
              </button>

              <button
                type="button"
                id="legend-custom-filter"
                onClick={() => {
                  const next = selectedCategory === "CUSTOM_ONLY" ? "ALL" : "CUSTOM_ONLY";
                  setSelectedCategory(next);
                  if (next === "CUSTOM_ONLY") {
                    showToast(`Filtered table to curves with custom team overrides (${customAliases.length} active)`, "info");
                  } else {
                    showToast("Showing all standard curves", "info");
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer select-none ${
                  selectedCategory === "CUSTOM_ONLY"
                    ? "bg-purple-900/90 text-purple-100 border-purple-400 ring-1 ring-purple-500/60 shadow-md shadow-purple-500/20 font-bold"
                    : "bg-purple-950/70 border-purple-500/60 text-purple-200 hover:border-purple-300 hover:bg-purple-900/80"
                }`}
                title="Click to toggle filter for curves with custom team aliases"
              >
                <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                <span>Custom team alias</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 border border-purple-500/40 font-bold">
                  {customAliases.length}
                </span>
                {selectedCategory === "CUSTOM_ONLY" && (
                  <span className="text-[9px] text-purple-300 font-bold ml-0.5">✓ Filtered</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="bg-wellqc-panel border border-wellqc-border p-4 rounded-xl space-y-3">
          <div className="flex items-center space-x-3 bg-wellqc-card border border-wellqc-border rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search standard names (e.g. GR, RHOB, NPHI, DT) or vendor aliases..."
              className="w-full bg-transparent text-xs text-white focus:outline-none font-mono placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-slate-400 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono scrollbar-thin">
            <span className="text-slate-500 mr-1 flex items-center gap-1 shrink-0">
              Category:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md transition-all shrink-0 ${
                  selectedCategory === cat
                    ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30"
                    : "bg-wellqc-card text-slate-400 hover:text-slate-200 hover:bg-wellqc-card/80 border border-wellqc-border"
                }`}
              >
                {cat}
              </button>
            ))}

            {/* Quick Filter for Curves with Custom Overrides */}
            <button
              type="button"
              onClick={() =>
                setSelectedCategory(selectedCategory === "CUSTOM_ONLY" ? "ALL" : "CUSTOM_ONLY")
              }
              className={`px-2.5 py-1 rounded-md transition-all shrink-0 flex items-center gap-1.5 font-bold ${
                selectedCategory === "CUSTOM_ONLY"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "bg-purple-950/50 text-purple-300 hover:text-purple-100 hover:bg-purple-900/60 border border-purple-500/40"
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Custom Overrides ({customAliases.length})</span>
            </button>
          </div>
        </div>

        {/* Manage Custom Overrides Modal */}
        {manageModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-wellqc-panel border border-purple-500/40 rounded-2xl p-6 max-w-2xl w-full space-y-4 font-mono text-xs shadow-2xl relative max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-wellqc-border shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      Custom Curve Overrides
                      <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 border border-purple-500/40 text-purple-300">
                        {customAliases.length} Active
                      </span>
                    </h3>
                    <p className="text-[11px] text-wellqc-muted">
                      Custom mnemonic aliases registered to your account
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setManageModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-wellqc-card"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-3 pr-1 py-1 flex-1">
                {customAliases.length === 0 ? (
                  <div className="text-center py-10 space-y-2 bg-wellqc-card/40 border border-wellqc-border rounded-xl">
                    <p className="text-slate-300 font-semibold">No custom overrides saved for this account</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      You can add custom aliases to any standard curve using the &quot;Add Alias&quot; button in the main dictionary table.
                    </p>
                  </div>
                ) : (
                  <div className="border border-wellqc-border rounded-xl overflow-hidden bg-wellqc-card/50">
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="bg-wellqc-card border-b border-wellqc-border text-slate-400 uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Custom Alias</th>
                          <th className="p-3">Standard Curve</th>
                          <th className="p-3">Added By</th>
                          <th className="p-3">Date Added</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-wellqc-border">
                        {customAliases.map((entry) => {
                          const curveDef = curves.find((c) => c.standardMnemonic === entry.standardMnemonic);
                          return (
                            <tr key={`${entry.standardMnemonic}_${entry.alias}`} className="hover:bg-wellqc-card/70 transition-colors">
                              <td className="p-3">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-950/80 border border-purple-500/60 text-purple-200 font-bold">
                                  <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                                  {entry.alias}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-cyan-300">{entry.standardMnemonic}</div>
                                {curveDef && (
                                  <div className="text-[10px] text-wellqc-muted truncate max-w-[150px]">
                                    {curveDef.name}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-slate-300 truncate max-w-[120px]">
                                {entry.addedBy || "You"}
                              </td>
                              <td className="p-3 text-[10px] text-slate-400 whitespace-nowrap">
                                {formatTimestamp(entry.addedAt)}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setManageModalOpen(false);
                                      openEditModal(entry.standardMnemonic, entry.alias);
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-wellqc-card hover:bg-cyan-500/20 text-cyan-300 border border-wellqc-border text-[11px] font-bold transition-colors cursor-pointer"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setManageModalOpen(false);
                                      openDeleteModal(entry.standardMnemonic, entry.alias);
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold transition-colors cursor-pointer shadow-sm"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                    <span>Delete</span>
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

              <div className="pt-3 border-t border-wellqc-border flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-400">
                  Custom overrides automatically standardise your curve mnemonics during LAS upload.
                </span>
                <button
                  type="button"
                  onClick={() => setManageModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-wellqc-card hover:bg-wellqc-card/80 text-slate-300 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Alias Modal (Issues 1 & 2) */}
        {addModalOpen && selectedCurve && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-wellqc-panel border border-purple-500/40 rounded-2xl p-6 max-w-md w-full space-y-4 font-mono text-xs shadow-2xl relative">
              <div className="flex items-center justify-between pb-2 border-b border-wellqc-border">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Add Raw Tool Alias</h3>
                    <p className="text-[11px] text-wellqc-muted">
                      Shared across all team members and browsers
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-wellqc-card"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-wellqc-card/80 border border-wellqc-border rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Target Standard Curve</span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-cyan-300">{selectedCurve}</span>
                  <span className="text-xs text-slate-300">
                    {curves.find((c) => c.standardMnemonic === selectedCurve)?.name}
                  </span>
                </div>
              </div>

              {/* Duplicate conflict inline error banner (Issue 2) */}
              {addError && (
                <div className="bg-rose-950/70 border border-rose-500/60 rounded-xl p-3.5 flex items-start space-x-3 text-rose-200 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-[11px] text-rose-300 block">Conflict Detected</span>
                    <p className="text-[11px] leading-relaxed">{addError}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleAddAlias} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span>New Mnemonic Alias:</span>
                    <span className="text-[10px] text-slate-500 font-normal">Auto-converted to uppercase</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. GAM_CORR_V2"
                    value={newAlias}
                    onChange={(e) => handleNewAliasChange(e.target.value)}
                    className="w-full bg-wellqc-card border border-wellqc-border focus:border-purple-500 rounded-lg p-2.5 text-white uppercase placeholder:normal-case font-bold tracking-wider text-sm focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>Added By (Attribution):</span>
                  </label>
                  <input
                    type="text"
                    value={addedByName}
                    onChange={(e) => setAddedByName(e.target.value)}
                    placeholder="Your name or team handle"
                    className="w-full bg-wellqc-card border border-wellqc-border focus:border-cyan-500 rounded-lg p-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-wellqc-border">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-wellqc-card hover:bg-wellqc-card/80 text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingAdd || !!addError || !newAlias.trim()}
                    className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-md shadow-purple-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSavingAdd ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Alias</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Alias Modal (Issue 3) */}
        {editModalOpen && editingCurve && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-wellqc-panel border border-cyan-500/40 rounded-2xl p-6 max-w-md w-full space-y-4 font-mono text-xs shadow-2xl relative">
              <div className="flex items-center justify-between pb-2 border-b border-wellqc-border">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Edit Custom Alias</h3>
                    <p className="text-[11px] text-wellqc-muted">
                      Modify mapping under curve {editingCurve}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-wellqc-card"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-wellqc-card/80 border border-wellqc-border rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Current Mapping</span>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-300">{oldAlias}</span>
                  <span className="text-xs text-cyan-300 font-bold">➔ {editingCurve}</span>
                </div>
              </div>

              {/* Duplicate conflict inline error banner (Issue 2 & 3) */}
              {editError && (
                <div className="bg-rose-950/70 border border-rose-500/60 rounded-xl p-3.5 flex items-start space-x-3 text-rose-200 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-[11px] text-rose-300 block">Conflict Detected</span>
                    <p className="text-[11px] leading-relaxed">{editError}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span>New Mnemonic Name:</span>
                    <span className="text-[10px] text-slate-500 font-normal">Auto-converted to uppercase</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newAliasEdit}
                    onChange={(e) => handleEditAliasChange(e.target.value)}
                    className="w-full bg-wellqc-card border border-wellqc-border focus:border-cyan-500 rounded-lg p-2.5 text-white uppercase font-bold tracking-wider text-sm focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-wellqc-border">
                  <button
                    type="button"
                    onClick={() => {
                      setEditModalOpen(false);
                      openDeleteModal(editingCurve, oldAlias);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors font-bold text-[11px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>

                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(false)}
                      className="px-4 py-2 rounded-lg bg-wellqc-card hover:bg-wellqc-card/80 text-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingEdit || !!editError || !newAliasEdit.trim()}
                      className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all shadow-md shadow-cyan-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSavingEdit ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <span>Save Changes</span>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal (Issue 3) */}
        {deleteModalOpen && deletingCurve && deletingAlias && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-wellqc-panel border border-rose-500/40 rounded-2xl p-6 max-w-sm w-full space-y-4 font-mono text-xs shadow-2xl">
              <div className="flex items-center space-x-3 text-rose-300 pb-2 border-b border-wellqc-border">
                <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/40">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Delete Custom Alias</h3>
                  <p className="text-[11px] text-wellqc-muted">Remove from shared dictionary</p>
                </div>
              </div>

              <p className="text-slate-300 leading-relaxed">
                Are you sure you want to remove alias{" "}
                <span className="font-bold text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/40">
                  {deletingAlias}
                </span>{" "}
                from curve <span className="font-bold text-cyan-300">{deletingCurve}</span>?
              </p>

              <p className="text-[11px] text-slate-400 bg-wellqc-card p-3 rounded-lg border border-wellqc-border">
                This alias will be removed across all analysts&apos; browsers and will no longer automatically standardise on upload.
              </p>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-wellqc-card hover:bg-wellqc-card/80 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-md shadow-rose-600/30 flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Confirm Delete</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dictionary Table */}
        <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-wellqc-card border-b border-wellqc-border text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-4">Standard Name</th>
                  <th className="p-4">Petrophysical Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Standard Unit</th>
                  <th className="p-4 w-[45%]">Recognized Raw Tool Aliases</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wellqc-border text-slate-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      <div className="flex items-center justify-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                        <span>Loading enterprise standardization dictionary...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredCurves.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No standard curves or tool aliases match &quot;{searchQuery}&quot;.
                    </td>
                  </tr>
                ) : (
                  filteredCurves.map((c) => {
                    const customList = c.customAliases || [];
                    const customAliasesMap = new Map(
                      customList.map((entry) => [entry.alias.toUpperCase(), entry])
                    );

                    return (
                      <tr key={c.standardMnemonic} className="hover:bg-wellqc-card/40 transition-colors">
                        <td className="p-4 font-black text-cyan-300 text-sm align-top">
                          {c.standardMnemonic}
                        </td>
                        <td className="p-4 font-bold text-white align-top">
                          <div>{c.name}</div>
                          <div className="text-[10px] text-wellqc-muted font-normal mt-0.5 max-w-xs">
                            {c.description}
                          </div>
                        </td>
                        <td className="p-4 align-top">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-cyan-300 border border-cyan-500/30">
                            {c.category}
                          </span>
                        </td>
                        <td className="p-4 text-slate-300 font-bold align-top">
                          {c.standardUnit}
                        </td>
                        <td className="p-4 align-top">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {c.aliases.map((alias) => {
                              const cleanAlias = alias.toUpperCase();
                              const customEntry = customAliasesMap.get(cleanAlias);
                              const isCustom = !!customEntry;
                              const popoverKey = `${c.standardMnemonic}_${cleanAlias}`;
                              const isPopoverOpen = activePopoverAlias === popoverKey;

                              if (isCustom && customEntry) {
                                return (
                                  <div
                                    key={cleanAlias}
                                    className="relative inline-block"
                                    data-alias-pill="true"
                                  >
                                    {/* Custom Pill with Distinct Color & Quick Delete */}
                                    <div className="group/pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition-all shadow-sm bg-purple-950/70 border border-purple-500/60 text-purple-200 hover:border-purple-300 hover:bg-purple-900/80">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActivePopoverAlias(
                                            isPopoverOpen ? null : popoverKey
                                          );
                                        }}
                                        className="inline-flex items-center gap-1 text-purple-200 hover:text-white cursor-pointer"
                                        title={`Custom alias added by ${customEntry.addedBy} on ${formatTimestamp(customEntry.addedAt)}. Click for info & edit.`}
                                      >
                                        <Sparkles className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                                        <span className="font-bold">{cleanAlias}</span>
                                        <span className="text-[9px] text-purple-400/80 font-normal">
                                          ● Custom
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openDeleteModal(c.standardMnemonic, cleanAlias);
                                        }}
                                        className="text-rose-400 hover:text-rose-200 hover:bg-rose-500/30 rounded p-1 transition-colors cursor-pointer flex items-center"
                                        title={`Delete custom alias ${cleanAlias}`}
                                        aria-label={`Delete custom alias ${cleanAlias}`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                      </button>
                                    </div>

                                    {/* Interactive Popover / Tooltip on Click or Hover (Issues 3 & 4) */}
                                    {isPopoverOpen && (
                                      <div
                                        data-alias-popover="true"
                                        className="absolute left-0 top-full mt-1.5 z-40 w-64 bg-wellqc-panel border border-purple-500/50 rounded-xl p-3.5 shadow-2xl backdrop-blur-xl text-xs space-y-2.5 animate-in fade-in zoom-in-95"
                                      >
                                        <div className="flex items-center justify-between pb-2 border-b border-wellqc-border">
                                          <span className="font-bold text-purple-300 flex items-center gap-1.5 text-[11px]">
                                            <Sparkles className="w-3 h-3 text-purple-400" />
                                            Custom Team Alias
                                          </span>
                                          <button
                                            onClick={() => setActivePopoverAlias(null)}
                                            className="text-slate-400 hover:text-white"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>

                                        <div className="space-y-1.5 text-[11px]">
                                          <div className="flex items-center justify-between text-slate-300">
                                            <span className="text-slate-500">Mnemonic:</span>
                                            <span className="font-bold text-white bg-purple-900/40 px-1.5 py-0.5 rounded border border-purple-500/30">
                                              {cleanAlias}
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between text-slate-300">
                                            <span className="text-slate-500 flex items-center gap-1">
                                              <User className="w-3 h-3" /> Added by:
                                            </span>
                                            <span className="font-semibold text-cyan-300 truncate max-w-[130px]">
                                              {customEntry.addedBy}
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between text-slate-300">
                                            <span className="text-slate-500 flex items-center gap-1">
                                              <Clock className="w-3 h-3" /> Date:
                                            </span>
                                            <span className="text-slate-400 text-[10px]">
                                              {formatTimestamp(customEntry.addedAt)}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Actions: Edit & Delete (Issue 3) */}
                                        <div className="pt-2 border-t border-wellqc-border flex items-center justify-end gap-1.5">
                                          <button
                                            onClick={() => openEditModal(c.standardMnemonic, cleanAlias)}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-wellqc-card hover:bg-cyan-500/20 text-cyan-300 border border-wellqc-border text-[11px] font-bold transition-colors"
                                          >
                                            <Edit2 className="w-3 h-3" />
                                            <span>Edit</span>
                                          </button>
                                          <button
                                            onClick={() => openDeleteModal(c.standardMnemonic, cleanAlias)}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-wellqc-card hover:bg-rose-500/20 text-rose-300 border border-wellqc-border text-[11px] font-bold transition-colors"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                            <span>Delete</span>
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              // Built-in standard alias pill
                              return (
                                <span
                                  key={alias}
                                  className="px-2 py-0.5 rounded bg-wellqc-card border border-wellqc-border text-[10px] text-slate-300 hover:text-white transition-colors"
                                  title="Built-in standardized API alias"
                                >
                                  {alias}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="p-4 text-right align-top">
                          <button
                            onClick={() => openAddModal(c.standardMnemonic)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-wellqc-card hover:bg-purple-500/20 text-purple-300 border border-wellqc-border hover:border-purple-500/40 font-bold text-xs transition-all shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Alias</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
