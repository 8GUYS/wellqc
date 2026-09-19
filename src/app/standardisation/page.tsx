"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getMergedStandardCurves, addCustomAlias, updateActiveUploadWithNewAlias, StandardCurveDef } from "@/lib/las/standardiser";
import { analyzeWellLogQuality } from "@/lib/las/quality-engine";
import { Layers, Search, Check, Edit, Plus, RefreshCw, ShieldCheck } from "lucide-react";

export default function StandardisationPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [curves, setCurves] = useState<StandardCurveDef[]>([]);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedCurve, setSelectedCurve] = useState<string | null>(null);
  const [newAlias, setNewAlias] = useState("");

  useEffect(() => {
    setCurves(Object.values(getMergedStandardCurves()));
  }, []);

  const filteredCurves = curves.filter((c) =>
    c.standardMnemonic.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.aliases.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAddAlias = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCurve || !newAlias) return;

    addCustomAlias(selectedCurve, newAlias);
    updateActiveUploadWithNewAlias(analyzeWellLogQuality);
    setCurves(Object.values(getMergedStandardCurves()));

    setOverrideModalOpen(false);
    setNewAlias("");
  };



  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-wellqc-panel/60 border border-wellqc-border p-5 rounded-2xl">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
                Module 04 — Petrophysical Standardisation
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              Curve Mnemonic Standardisation Dictionary
            </h1>
            <p className="text-xs text-wellqc-muted font-mono mt-0.5">
              Automated mapping rules, alias dictionaries, and manual overrides to convert raw logging tool mnemonics into standardized API names.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-wellqc-panel border border-wellqc-border p-4 rounded-xl flex items-center space-x-4">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search standard mnemonics (e.g. GR, RHOB, NPHI, DT) or raw tool aliases..."
            className="w-full bg-wellqc-card border border-wellqc-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        {/* Alias Modal */}
        {overrideModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-6 max-w-md w-full space-y-4 font-mono text-xs shadow-2xl">
              <h3 className="text-base font-bold text-white">Add Raw Tool Alias Override</h3>
              <p className="text-wellqc-muted">
                Add custom logging vendor alias to automatically resolve to <span className="text-cyan-300 font-bold">{selectedCurve}</span>.
              </p>
              <form onSubmit={handleAddAlias} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="e.g. GAM_CORR_V2"
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  className="w-full bg-wellqc-card border border-wellqc-border rounded-lg p-2.5 text-white"
                />
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOverrideModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-wellqc-card text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white font-bold"
                  >
                    Save Alias
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dictionary Table */}
        <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-wellqc-card border-b border-wellqc-border text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-4">Standard Mnemonic</th>
                  <th className="p-4">Petrophysical Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Standard Unit</th>
                  <th className="p-4">Recognized Raw Tool Aliases</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wellqc-border text-slate-200">
                {filteredCurves.map((c, i) => (
                  <tr key={i} className="hover:bg-wellqc-card/60 transition-colors">
                    <td className="p-4 font-black text-cyan-300 text-sm">{c.standardMnemonic}</td>
                    <td className="p-4 font-bold text-white">{c.name}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-cyan-300 border border-cyan-500/30">
                        {c.category}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300 font-bold">{c.standardUnit}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {c.aliases.map((a, j) => (
                          <span
                            key={j}
                            className="px-2 py-0.5 rounded bg-wellqc-card border border-wellqc-border text-[10px] text-slate-300"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedCurve(c.standardMnemonic);
                          setOverrideModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-wellqc-card hover:bg-purple-500/20 text-purple-300 border border-wellqc-border font-bold text-xs"
                      >
                        + Add Alias
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
