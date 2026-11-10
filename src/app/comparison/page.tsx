"use client";

import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";
import {
  GitCompare,
  RefreshCw,
  UploadCloud,
  ArrowLeftRight,
  TrendingUp,
  Activity,
  Layers,
  Download,
  AlertTriangle,
  Info,
  BarChart2,
  Sliders,
  Lock,
  Sparkles,
} from "lucide-react";
import { WellLogViewer } from "@/components/well-log/log-viewer";
import {
  WellDetailResponse,
  WellListItem,
  WellComparisonResult,
} from "@/lib/api-types";
import { safeReadJson } from "@/lib/http-client";
import { PaystackUpgradeModal } from "@/components/payments/paystack-upgrade-modal";

type ComparisonTab = "analytics" | "overlay" | "sideBySide";

export default function ComparisonPage() {
  const [wells, setWells] = useState<WellListItem[]>([]);
  const [well1, setWell1] = useState("");
  const [well2, setWell2] = useState("");
  const [detail1, setDetail1] = useState<WellDetailResponse | null>(null);
  const [detail2, setDetail2] = useState<WellDetailResponse | null>(null);
  const [comparisonData, setComparisonData] = useState<WellComparisonResult | null>(null);
  const comparison = well1 && well2 ? comparisonData : null;
  const [activeTab, setActiveTab] = useState<ComparisonTab>("analytics");
  const [selectedOverlayCurve, setSelectedOverlayCurve] = useState<string>("");
  const [matrixFilter, setMatrixFilter] = useState<"ALL" | "COMMON" | "PRIMARY_ONLY" | "OFFSET_ONLY">("ALL");
  const [resampleDensity] = useState<number>(400);
  const [isLoadingWells, setIsLoadingWells] = useState(true);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState("");

  // User Profile & License Gatekeeper State
  const [userProfile, setUserProfile] = useState<{
    tier: string;
    role: string;
  }>({ tier: "FREE", role: "USER" });
  const [isVerifyingTier, setIsVerifyingTier] = useState<boolean>(true);
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
      } catch {} finally {
        if (active) {
          setIsVerifyingTier(false);
        }
      }
    }
    loadUserProfile();
    window.addEventListener("wellqc_user_updated", loadUserProfile);
    return () => {
      active = false;
      window.removeEventListener("wellqc_user_updated", loadUserProfile);
    };
  }, []);

  const isFreeTier = userProfile.tier === "FREE" && userProfile.role !== "ADMIN";

  const filteredCorrelations = useMemo(() => {
    if (!comparison) return [];
    if (matrixFilter === "COMMON") {
      return comparison.curve_correlations.filter(
        (c) => !c.availability || c.availability === "BOTH"
      );
    }
    if (matrixFilter === "PRIMARY_ONLY") {
      return comparison.curve_correlations.filter(
        (c) => c.availability === "WELL_A_ONLY"
      );
    }
    if (matrixFilter === "OFFSET_ONLY") {
      return comparison.curve_correlations.filter(
        (c) => c.availability === "WELL_B_ONLY"
      );
    }
    return comparison.curve_correlations;
  }, [comparison, matrixFilter]);

  // Load committed wells list
  useEffect(() => {
    let cancelled = false;

    async function loadWells() {
      try {
        const response = await fetch("/api/wells", { cache: "no-store" });
        const res = await safeReadJson<{ wells: WellListItem[] }>(response, "Unable to load wells.");

        if (!res.ok || !res.data) {
          throw new Error(res.error || "Unable to load wells.");
        }

        const committedWells: WellListItem[] = (res.data.wells || []).filter(
          (well: WellListItem) => well.latestLasFileId
        );

        if (!cancelled) {
          setWells(committedWells);

          let paramA: string | null = null;
          let paramB: string | null = null;
          if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            paramA = params.get("wellA") || params.get("well1");
            paramB = params.get("wellB") || params.get("well2");
          }

          const matchedA = paramA && committedWells.some((w) => w.id === paramA) ? paramA : null;
          const matchedB = paramB && committedWells.some((w) => w.id === paramB) ? paramB : null;

          const initialWell1 = matchedA || (committedWells.length > 0 ? committedWells[0].id : "");
          let initialWell2 = matchedB;

          if (!initialWell2) {
            if (committedWells.length >= 2) {
              initialWell2 = committedWells.find((w) => w.id !== initialWell1)?.id || committedWells[1].id;
            } else if (committedWells.length === 1) {
              initialWell2 = committedWells[0].id;
            } else {
              initialWell2 = "";
            }
          }

          setWell1(initialWell1);
          setWell2(initialWell2);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load wells.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWells(false);
        }
      }
    }

    loadWells();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load details for individual well tracks
  useEffect(() => {
    loadDetail(well1, setDetail1, setError);
  }, [well1]);

  useEffect(() => {
    loadDetail(well2, setDetail2, setError);
  }, [well2]);

  // Execute multi-well correlation analysis
  useEffect(() => {
    if (!well1 || !well2) {
      return;
    }

    let cancelled = false;

    async function runComparison() {
      setIsComparing(true);
      setError("");

      try {
        const response = await fetch("/api/wells/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            primary_well_id: well1,
            offset_well_id: well2,
            num_resample_points: resampleDensity,
          }),
        });

        const res = await safeReadJson<WellComparisonResult>(
          response,
          "Failed to compute cross-well correlation."
        );

        if (!res.ok || !res.data) {
          throw new Error(res.error || "Failed to compute cross-well correlation.");
        }

        if (!cancelled && res.data) {
          const compData = res.data;
          setComparisonData(compData);
          if (compData.common_curves.length > 0) {
            const firstCurve = compData.common_curves[0];
            setSelectedOverlayCurve((curr) =>
              compData.common_curves.includes(curr) ? curr : firstCurve
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to compute cross-well correlation.");
        }
      } finally {
        if (!cancelled) {
          setIsComparing(false);
        }
      }
    }

    runComparison();

    return () => {
      cancelled = true;
    };
  }, [well1, well2, resampleDensity]);

  const handleSwapWells = () => {
    const temp = well1;
    setWell1(well2);
    setWell2(temp);
  };

  const handleExportJson = () => {
    if (!comparison) return;
    if (isFreeTier) {
      setTargetUpgradeWellId(well1 || well2 || undefined);
      setUpgradeModalOpen(true);
      return;
    }
    const blob = new Blob([JSON.stringify(comparison, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `WellQC_Correlation_${comparison.well_a_name}_vs_${comparison.well_b_name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (!comparison) return;
    if (isFreeTier) {
      setTargetUpgradeWellId(well1 || well2 || undefined);
      setUpgradeModalOpen(true);
      return;
    }
    const headers = [
      "Curve Mnemonic",
      "Sample Points",
      "Pearson r",
      "Optimal Lag Depth",
      "Max Correlation at Lag",
      "Continuity Grade",
      "RMSD",
      "MAE",
      `Mean ${comparison.well_a_name}`,
      `Mean ${comparison.well_b_name}`,
    ];

    const rows = comparison.curve_correlations.map((c) => [
      c.mnemonic,
      c.sample_count,
      c.pearson_r.toFixed(4),
      c.optimal_lag_depth.toFixed(2),
      c.max_correlation_at_lag.toFixed(4),
      c.stratigraphic_continuity,
      c.rmsd.toFixed(4),
      c.mae.toFixed(4),
      c.mean_a.toFixed(2),
      c.mean_b.toFixed(2),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `WellQC_Correlation_Matrix_${comparison.well_a_name}_vs_${comparison.well_b_name}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const wellAObj = useMemo(() => wells.find((w) => w.id === well1), [wells, well1]);
  const wellBObj = useMemo(() => wells.find((w) => w.id === well2), [wells, well2]);

  if (isVerifyingTier) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-slate-400">Verifying subsurface license credentials...</p>
        </div>
      </AppShell>
    );
  }

  if (isFreeTier) {
    return (
      <AppShell>
        <div className="space-y-8 pb-20 max-w-5xl mx-auto pt-2">
          {/* Paywall Header */}
          <div className="flex items-center justify-between bg-slate-900/60 border border-amber-500/30 p-4 rounded-2xl backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white font-mono">Well Comparison Restricted</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    FREE TIER
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Multi-well stratigraphic correlation, lag-shift analysis, and cross-well overlays are available on WellQC Pro.
                </p>
              </div>
            </div>

            <Link
              href="/upload"
              className="px-3.5 py-1.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-mono transition-all flex items-center gap-1.5 shrink-0"
            >
              <span>Back to Workstation</span>
            </Link>
          </div>

          {/* Paywall Hero Banner */}
          <div className="relative rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 p-8 md:p-12 shadow-2xl overflow-hidden backdrop-blur-xl text-center space-y-6">
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>WELLQC PRO CROSS-WELL SUITE</span>
            </div>

            <div className="max-w-2xl mx-auto space-y-3">
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                Unlock Multi-Well Petrophysical Correlation &amp; Comparison
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed font-sans">
                You are currently on the <span className="text-cyan-400 font-bold font-mono">Free Tier</span>.
                You can upload and inspect single-well wireline telemetry without limits on the Data Upload page.
                To perform multi-well stratigraphic depth alignment, structural lag shifts (Δz), composite cross-track overlays, and side-by-side dual log tracks, upgrade to WellQC Pro.
              </p>
            </div>

            {/* Feature comparison cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-4xl mx-auto pt-4">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold font-mono text-sm">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <span>Pearson Correlation Analysis (r)</span>
                </div>
                <p className="text-xs text-slate-400 font-mono leading-relaxed">
                  Automated pairwise statistical cross-correlation matching across GR, RES, NPHI, RHOB, and DT curves between target and offset wells.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold font-mono text-sm">
                  <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
                  <span>Structural Lag Shifts &amp; Dip Realignment</span>
                </div>
                <p className="text-xs text-slate-400 font-mono leading-relaxed">
                  Dynamic depth lag search (±50m) to identify stratigraphic fault offsets, regional dip displacements, and formation marker tops.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold font-mono text-sm">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Composite Cross-Track Overlays</span>
                </div>
                <p className="text-xs text-slate-400 font-mono leading-relaxed">
                  Dual-curve overlay tracks with custom opacity and depth synchronization to instantly visualize lithology and fluid contact variations.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold font-mono text-sm">
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>Multi-Well Matrix CSV &amp; JSON Exports</span>
                </div>
                <p className="text-xs text-slate-400 font-mono leading-relaxed">
                  Export correlation matrices, lag depths, RMSD, and continuity classifications directly into geoscience workflows and basin models.
                </p>
              </div>
            </div>

            {/* CTA action buttons */}
            <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={() => setUpgradeModalOpen(true)}
                className="w-full sm:w-auto px-7 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-mono font-black text-sm tracking-wide shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Upgrade to WellQC Pro (₦75,000 / $49)</span>
              </button>

              <Link
                href="/pricing"
                className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-mono text-sm transition-all text-center"
              >
                View Plans &amp; Pricing
              </Link>
            </div>
          </div>
        </div>

        {/* Upgrade Modal */}
        <PaystackUpgradeModal
          isOpen={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
          defaultPlanId="PRO_MONTHLY"
          targetWellId={targetUpgradeWellId}
          reason="Upgrade to WellQC Pro to access multi-well petrophysical correlation, lag shift matching, and cross-well exports."
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Workstation Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-wellqc-panel/60 border border-wellqc-border p-5 rounded-2xl shadow-xl backdrop-blur-md">
          <div>
            <div className="flex items-center space-x-2">

              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Cross-Well Telemetry
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center space-x-3">
              <GitCompare className="w-6 h-6 text-cyan-400" />
              <span>Multi-Well Petrophysical Correlation &amp; Comparison</span>
            </h1>
            <p className="text-xs text-wellqc-muted font-mono mt-0.5">
              Stratigraphic depth alignment, Pearson correlation coefficient ($r$), structural lag shifts, and Niger Delta marker matching.
            </p>
          </div>

          {comparison && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportCsv}
                className={`px-3 py-2 rounded-xl text-xs font-mono flex items-center space-x-2 transition ${
                  isFreeTier
                    ? "bg-purple-950/50 hover:bg-purple-900/70 border border-purple-500/40 text-purple-300"
                    : "bg-wellqc-card border border-wellqc-border hover:border-cyan-500/50 text-cyan-300"
                }`}
                title={isFreeTier ? "Upgrade to Pro to export correlation CSV" : "Export correlation metrics as CSV"}
              >
                {isFreeTier ? <Lock className="w-3.5 h-3.5 text-purple-400" /> : <Download className="w-3.5 h-3.5" />}
                <span>CSV Matrix</span>
                {isFreeTier && <span className="px-1 py-0.2 rounded bg-purple-500/30 text-purple-200 text-[9px] font-bold">PRO</span>}
              </button>
              <button
                onClick={handleExportJson}
                className={`px-3 py-2 rounded-xl text-xs font-mono flex items-center space-x-2 transition ${
                  isFreeTier
                    ? "bg-purple-950/50 hover:bg-purple-900/70 border border-purple-500/40 text-purple-300"
                    : "bg-wellqc-card border border-wellqc-border hover:border-cyan-500/50 text-white"
                }`}
                title={isFreeTier ? "Upgrade to Pro to export comparison JSON" : "Export complete comparison payload as JSON"}
              >
                {isFreeTier ? <Lock className="w-3.5 h-3.5 text-purple-400" /> : <Download className="w-3.5 h-3.5" />}
                <span>JSON Report</span>
                {isFreeTier && <span className="px-1 py-0.2 rounded bg-purple-500/30 text-purple-200 text-[9px] font-bold">PRO</span>}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-xs font-mono flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoadingWells ? (
          <div className="p-12 bg-wellqc-panel border border-wellqc-border rounded-2xl text-center text-cyan-300 text-xs font-mono flex items-center justify-center">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Loading committed well assets...
          </div>
        ) : wells.length < 2 ? (
          <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
              <GitCompare className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">Minimum Two Committed Wells Required</h2>
              <p className="text-xs text-wellqc-muted font-mono max-w-md mx-auto">
                Multi-well correlation requires at least two distinct LAS-backed well assets to calculate cross-well continuity and depth overlap.
              </p>
            </div>
            <Link
              href="/upload"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Ingest Second Well Log</span>
            </Link>
          </div>
        ) : (
          <>
            {/* Well Selector Control Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-wellqc-panel border border-wellqc-border p-4 rounded-2xl">
              <div className="lg:col-span-5">
                <label className="block text-[11px] font-mono font-bold text-cyan-400 mb-1.5 flex items-center justify-between">
                  <span>Primary Reference Well (Offset A):</span>
                  {wellAObj && (
                    <span className="text-[10px] text-wellqc-muted font-normal">
                      TD: {wellAObj.tdFt ? `${wellAObj.tdFt.toLocaleString()} FT` : "N/A"}
                    </span>
                  )}
                </label>
                <select
                  value={well1}
                  onChange={(e) => setWell1(e.target.value)}
                  className="w-full bg-wellqc-card border border-wellqc-border hover:border-cyan-500/40 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-cyan-400 transition"
                >
                  {wells.map((w) => (
                    <option key={`w1-${w.id}`} value={w.id}>
                      {w.name} &bull; Score: {w.qualityScore}/100 &bull; {w.operatorName || "Field Well"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2 flex flex-col items-center justify-center gap-1">
                <button
                  onClick={handleSwapWells}
                  className="p-2.5 rounded-xl bg-wellqc-card border border-wellqc-border hover:border-cyan-400 text-cyan-300 hover:text-white transition flex items-center justify-center shadow"
                  title="Swap Primary and Comparison Wells"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-mono text-wellqc-muted">Swap Offsets</span>
              </div>

              <div className="lg:col-span-5">
                <label className="block text-[11px] font-mono font-bold text-amber-400 mb-1.5 flex items-center justify-between">
                  <span>Comparison Target Well (Offset B):</span>
                  {wellBObj && (
                    <span className="text-[10px] text-wellqc-muted font-normal">
                      TD: {wellBObj.tdFt ? `${wellBObj.tdFt.toLocaleString()} FT` : "N/A"}
                    </span>
                  )}
                </label>
                <select
                  value={well2}
                  onChange={(e) => setWell2(e.target.value)}
                  className="w-full bg-wellqc-card border border-wellqc-border hover:border-amber-500/40 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-amber-400 transition"
                >
                  {wells.map((w) => (
                    <option key={`w2-${w.id}`} value={w.id}>
                      {w.name} &bull; Score: {w.qualityScore}/100 &bull; {w.operatorName || "Field Well"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cross-Well Correlation Telemetry Banner */}
            {comparison && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-wellqc-panel border border-wellqc-border p-4 rounded-xl flex items-center space-x-3.5">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-base ${comparison.composite_correlation_score >= 80
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : comparison.composite_correlation_score >= 60
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-red-500/20 text-red-400 border border-red-500/30"
                      }`}
                  >
                    {Math.round(comparison.composite_correlation_score)}%
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-wellqc-muted uppercase block">
                      Composite Score
                    </span>
                    <span className="text-xs font-bold text-white block">
                      {comparison.overall_match_grade.replace("_", " ")}
                    </span>
                  </div>
                </div>

                <div className="bg-wellqc-panel border border-wellqc-border p-4 rounded-xl flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-wellqc-muted uppercase block">
                      Recommended Shift
                    </span>
                    <span className="text-xs font-bold text-white block">
                      {comparison.recommended_depth_shift > 0 ? "+" : ""}
                      {comparison.recommended_depth_shift.toFixed(1)} {comparison.depth_unit}
                    </span>
                    <span className="text-[9px] font-mono text-cyan-300">
                      {comparison.recommended_depth_shift > 0
                        ? "Down-dip / Normal Fault"
                        : comparison.recommended_depth_shift < 0
                          ? "Up-dip / Reverse Fault"
                          : "Stratigraphically Flat"}
                    </span>
                  </div>
                </div>

                <div className="bg-wellqc-panel border border-wellqc-border p-4 rounded-xl flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-wellqc-muted uppercase block">
                      Overlap Interval
                    </span>
                    <span className="text-xs font-bold text-white block">
                      {comparison.overlap_span.toLocaleString()} {comparison.depth_unit}
                    </span>
                    <span className="text-[9px] font-mono text-wellqc-muted">
                      {comparison.overlap_start_depth.toFixed(0)} -{" "}
                      {comparison.overlap_stop_depth.toFixed(0)} {comparison.depth_unit}
                    </span>
                  </div>
                </div>

                <div className="bg-wellqc-panel border border-wellqc-border p-4 rounded-xl flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-wellqc-muted uppercase block">
                      Channel Suite
                    </span>
                    <span className="text-xs font-bold text-white block">
                      {comparison.curve_correlations.length} Channels Total
                    </span>
                    <span className="text-[9px] font-mono text-cyan-300 truncate block max-w-[140px]">
                      {comparison.common_curves.length} Common ({comparison.common_curves.join(", ")})
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Interactive Workspace Tabs */}
            <div className="flex items-center space-x-2 border-b border-wellqc-border pb-2">
              <TabButton
                active={activeTab === "analytics"}
                onClick={() => setActiveTab("analytics")}
                icon={BarChart2}
                label="Correlation Analytics & Matrix"
                badge={comparison ? `${comparison.curve_correlations.length} Channels` : undefined}
              />
              <TabButton
                active={activeTab === "overlay"}
                onClick={() => setActiveTab("overlay")}
                icon={TrendingUp}
                label="Overlaid Stratigraphic Track"
                badge="Resampled SVG"
              />
              <TabButton
                active={activeTab === "sideBySide"}
                onClick={() => setActiveTab("sideBySide")}
                icon={Sliders}
                label="Side-by-Side Dual Log Tracks"
              />
            </div>

            {/* TAB CONTENT 1: CORRELATION ANALYTICS MATRIX */}
            {activeTab === "analytics" && (
              <div className="space-y-4">
                {isComparing ? (
                  <div className="p-8 bg-wellqc-panel border border-wellqc-border rounded-xl text-center text-cyan-300 text-xs font-mono flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Computing Pearson correlation matrix and optimal structural lag shifts...
                  </div>
                ) : !comparison || comparison.curve_correlations.length === 0 ? (
                  <div className="p-6 bg-wellqc-panel border border-wellqc-border rounded-xl text-center text-xs font-mono text-wellqc-muted">
                    No petrophysical curve channels detected across the common depth interval.
                  </div>
                ) : (
                  <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-lg">
                    <div className="p-4 border-b border-wellqc-border bg-wellqc-card/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                        <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                          Cross-Well Petrophysical Correlation Matrix
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                          {comparison.curve_correlations.length} Channels Total
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 bg-wellqc-card/90 p-1 rounded-xl border border-wellqc-border text-[10px] font-mono">
                        <button
                          onClick={() => setMatrixFilter("ALL")}
                          className={`px-2.5 py-1 rounded-lg transition ${matrixFilter === "ALL"
                              ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                              : "text-wellqc-muted hover:text-white"
                            }`}
                        >
                          All ({comparison.curve_correlations.length})
                        </button>
                        <button
                          onClick={() => setMatrixFilter("COMMON")}
                          className={`px-2.5 py-1 rounded-lg transition ${matrixFilter === "COMMON"
                              ? "bg-emerald-500 text-slate-950 font-bold shadow-sm"
                              : "text-emerald-400/80 hover:text-emerald-300"
                            }`}
                        >
                          Shared ({comparison.common_curves.length})
                        </button>
                        <button
                          onClick={() => setMatrixFilter("PRIMARY_ONLY")}
                          className={`px-2.5 py-1 rounded-lg transition ${matrixFilter === "PRIMARY_ONLY"
                              ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                              : "text-cyan-400/80 hover:text-cyan-300"
                            }`}
                        >
                          Primary Only ({(comparison.curves_well_a_only || []).length})
                        </button>
                        <button
                          onClick={() => setMatrixFilter("OFFSET_ONLY")}
                          className={`px-2.5 py-1 rounded-lg transition ${matrixFilter === "OFFSET_ONLY"
                              ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                              : "text-amber-400/80 hover:text-amber-300"
                            }`}
                        >
                          Offset Only ({(comparison.curves_well_b_only || []).length})
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs">
                        <thead className="bg-wellqc-card/80 text-[10px] text-wellqc-muted uppercase border-b border-wellqc-border">
                          <tr>
                            <th className="py-3 px-4">Channel</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Samples</th>
                            <th className="py-3 px-4">Pearson Correlation (r)</th>
                            <th className="py-3 px-4">Optimal Dip Shift (&Delta;z)</th>
                            <th className="py-3 px-4">Max r at Shift</th>
                            <th className="py-3 px-4">Continuity Grade</th>
                            <th className="py-3 px-4">RMSD</th>
                            <th className="py-3 px-4">{comparison.well_a_name} Range</th>
                            <th className="py-3 px-4">{comparison.well_b_name} Range</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-wellqc-border">
                          {filteredCorrelations.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="py-6 text-center text-wellqc-muted font-mono text-xs">
                                No curves match the selected filter.
                              </td>
                            </tr>
                          ) : (
                            filteredCorrelations.map((stat) => {
                              const isShared = !stat.availability || stat.availability === "BOTH";
                              const isPrimaryOnly = stat.availability === "WELL_A_ONLY";
                              const isOffsetOnly = stat.availability === "WELL_B_ONLY";

                              return (
                                <tr key={stat.mnemonic} className="hover:bg-wellqc-card/40 transition">
                                  <td className="py-3 px-4 font-bold text-white flex items-center space-x-2">
                                    <span
                                      className={`w-2 h-2 rounded-full ${isShared
                                          ? "bg-emerald-400"
                                          : isPrimaryOnly
                                            ? "bg-cyan-400"
                                            : "bg-amber-400"
                                        }`}
                                    ></span>
                                    <span>{stat.mnemonic}</span>
                                  </td>
                                  <td className="py-3 px-4">
                                    {isShared && (
                                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        SHARED
                                      </span>
                                    )}
                                    {isPrimaryOnly && (
                                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                        PRIMARY ONLY
                                      </span>
                                    )}
                                    {isOffsetOnly && (
                                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        OFFSET ONLY
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-wellqc-muted">{stat.sample_count}</td>
                                  <td className="py-3 px-4">
                                    {isShared ? (
                                      <div className="flex items-center space-x-2">
                                        <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                          <div
                                            className={`h-full rounded-full ${stat.pearson_r >= 0.7
                                                ? "bg-emerald-400"
                                                : stat.pearson_r >= 0.4
                                                  ? "bg-amber-400"
                                                  : "bg-red-400"
                                              }`}
                                            style={{
                                              width: `${Math.max(5, Math.min(100, Math.abs(stat.pearson_r) * 100))}%`,
                                            }}
                                          ></div>
                                        </div>
                                        <span
                                          className={`font-bold ${stat.pearson_r >= 0.7
                                              ? "text-emerald-400"
                                              : stat.pearson_r >= 0.4
                                                ? "text-amber-400"
                                                : "text-red-400"
                                            }`}
                                        >
                                          {stat.pearson_r.toFixed(3)}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-wellqc-muted italic">
                                        N/A (Single-well)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    {isShared ? (
                                      <span className="text-cyan-300">
                                        {stat.optimal_lag_depth > 0 ? "+" : ""}
                                        {stat.optimal_lag_depth.toFixed(1)} {comparison.depth_unit}
                                      </span>
                                    ) : (
                                      <span className="text-wellqc-muted text-[11px]">&mdash;</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    {isShared ? (
                                      <span className="text-white">
                                        {stat.max_correlation_at_lag.toFixed(3)}
                                      </span>
                                    ) : (
                                      <span className="text-wellqc-muted text-[11px]">&mdash;</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    {isShared ? (
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${stat.stratigraphic_continuity === "HIGH"
                                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                            : stat.stratigraphic_continuity === "MODERATE"
                                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                              : "bg-red-500/20 text-red-400 border border-red-500/30"
                                          }`}
                                      >
                                        {stat.stratigraphic_continuity}
                                      </span>
                                    ) : (
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPrimaryOnly
                                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                          }`}
                                      >
                                        {isPrimaryOnly ? "PRIMARY ONLY" : "OFFSET ONLY"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    {isShared ? (
                                      <span className="text-wellqc-muted">{stat.rmsd.toFixed(2)}</span>
                                    ) : (
                                      <span className="text-wellqc-muted text-[11px]">&mdash;</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-[11px]">
                                    {isShared || isPrimaryOnly ? (
                                      <span className="text-cyan-300 font-mono">
                                        {stat.min_a.toFixed(1)} &ndash; {stat.max_a.toFixed(1)}
                                      </span>
                                    ) : (
                                      <span className="text-wellqc-muted italic text-[10px]">
                                        Not Logged
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-[11px]">
                                    {isShared || isOffsetOnly ? (
                                      <span className="text-amber-300 font-mono">
                                        {stat.min_b.toFixed(1)} &ndash; {stat.max_b.toFixed(1)}
                                      </span>
                                    ) : (
                                      <span className="text-wellqc-muted italic text-[10px]">
                                        Not Logged
                                      </span>
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
                )}
              </div>
            )}

            {/* TAB CONTENT 2: OVERLAID STRATIGRAPHIC TRACK (RESAMPLED SVG) */}
            {activeTab === "overlay" && (
              <div className="space-y-4">
                {comparison && comparison.common_curves.length > 0 ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-wellqc-panel border border-wellqc-border p-3.5 rounded-xl">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-wellqc-muted font-bold">
                          Select Channel to Overlay:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {comparison.common_curves.map((c) => (
                            <button
                              key={`chan-${c}`}
                              onClick={() => setSelectedOverlayCurve(c)}
                              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${selectedOverlayCurve === c
                                  ? "bg-cyan-500 text-slate-950 shadow"
                                  : "bg-wellqc-card border border-wellqc-border text-wellqc-muted hover:text-white"
                                }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 text-xs font-mono">
                        <span className="flex items-center space-x-1.5 text-cyan-400">
                          <span className="w-3 h-1 bg-cyan-400 rounded"></span>
                          <span>{comparison.well_a_name} (Primary)</span>
                        </span>
                        <span className="flex items-center space-x-1.5 text-amber-400">
                          <span className="w-3 h-1 bg-amber-400 rounded"></span>
                          <span>{comparison.well_b_name} (Offset)</span>
                        </span>
                      </div>
                    </div>

                    {((comparison.curves_well_a_only?.length || 0) + (comparison.curves_well_b_only?.length || 0)) > 0 && (
                      <div className="px-3.5 py-2 bg-slate-900/60 border border-wellqc-border rounded-xl text-[10px] font-mono text-wellqc-muted flex items-center space-x-2">
                        <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>
                          Cross-track overlay requires curves present in both wells. Single-well channels ({[...(comparison.curves_well_a_only || []), ...(comparison.curves_well_b_only || [])].join(", ")}) can be analyzed in the Side-by-Side Dual Log Tracks tab.
                        </span>
                      </div>
                    )}

                    <OverlaidCurveTrack
                      comparison={comparison}
                      mnemonic={selectedOverlayCurve}
                    />
                  </>
                ) : (
                  <div className="p-8 bg-wellqc-panel border border-wellqc-border rounded-xl text-center text-xs font-mono text-wellqc-muted">
                    No common curves available to overlay.
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 3: SIDE-BY-SIDE DUAL LOG TRACKS */}
            {activeTab === "sideBySide" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ComparisonPane detail={detail1} accent="cyan" />
                <ComparisonPane detail={detail2} accent="amber" />
              </div>
            )}
          </>
        )}

        {/* Paystack License Upgrade Gatekeeper */}
        <PaystackUpgradeModal
          isOpen={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
          defaultPlanId="PRO_MONTHLY"
          targetWellId={targetUpgradeWellId}
        />
      </div>
    </AppShell>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl font-mono text-xs flex items-center space-x-2 transition ${active
          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
          : "text-wellqc-muted hover:text-white hover:bg-wellqc-panel/60"
        }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      {badge && (
        <span
          className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${active ? "bg-cyan-500/30 text-cyan-200" : "bg-slate-800 text-slate-400"
            }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function OverlaidCurveTrack({
  comparison,
  mnemonic,
}: {
  comparison: WellComparisonResult;
  mnemonic: string;
}) {
  const depths = comparison.resampled_depth;
  const stat = comparison.curve_correlations.find((c) => c.mnemonic === mnemonic);

  const { pathA, pathB, fillPolygon, valMin, valMax, depthStart, depthStop } = useMemo(() => {
    const valsA = comparison.resampled_curves_a[mnemonic] || [];
    const valsB = comparison.resampled_curves_b[mnemonic] || [];

    if (!depths || depths.length === 0 || valsA.length === 0 || valsB.length === 0) {
      return {
        pathA: "",
        pathB: "",
        fillPolygon: "",
        valMin: 0,
        valMax: 100,
        depthStart: 0,
        depthStop: 100,
      };
    }

    const dStart = depths[0];
    const dStop = depths[depths.length - 1];

    let minV = Infinity;
    let maxV = -Infinity;

    for (let i = 0; i < depths.length; i++) {
      const va = valsA[i];
      const vb = valsB[i];
      if (typeof va === "number" && !isNaN(va) && va > -900) {
        if (va < minV) minV = va;
        if (va > maxV) maxV = va;
      }
      if (typeof vb === "number" && !isNaN(vb) && vb > -900) {
        if (vb < minV) minV = vb;
        if (vb > maxV) maxV = vb;
      }
    }

    if (minV === Infinity) minV = 0;
    if (maxV === -Infinity) maxV = 100;
    if (minV === maxV) maxV = minV + 10;

    // SVG coordinate space: 500w x 700h
    const padL = 70;
    const padR = 30;
    const padT = 30;
    const padB = 40;
    const trackW = 500 - padL - padR;
    const trackH = 700 - padT - padB;

    const scaleX = (v: number) => padL + ((v - minV) / (maxV - minV)) * trackW;
    const scaleY = (d: number) => padT + ((d - dStart) / (dStop - dStart)) * trackH;

    let pA = "";
    let pB = "";
    const ptsA: [number, number][] = [];
    const ptsB: [number, number][] = [];

    for (let i = 0; i < depths.length; i++) {
      const d = depths[i];
      const va = valsA[i];
      const vb = valsB[i];

      const y = scaleY(d);
      const xa = scaleX(va);
      const xb = scaleX(vb);

      ptsA.push([xa, y]);
      ptsB.push([xb, y]);

      if (i === 0) {
        pA += `M ${xa.toFixed(1)},${y.toFixed(1)}`;
        pB += `M ${xb.toFixed(1)},${y.toFixed(1)}`;
      } else {
        pA += ` L ${xa.toFixed(1)},${y.toFixed(1)}`;
        pB += ` L ${xb.toFixed(1)},${y.toFixed(1)}`;
      }
    }

    // Difference polygon: down A, then reverse up B
    let poly = "";
    if (ptsA.length > 0 && ptsB.length > 0) {
      poly = `M ${ptsA[0][0].toFixed(1)},${ptsA[0][1].toFixed(1)}`;
      for (let i = 1; i < ptsA.length; i++) {
        poly += ` L ${ptsA[i][0].toFixed(1)},${ptsA[i][1].toFixed(1)}`;
      }
      for (let i = ptsB.length - 1; i >= 0; i--) {
        poly += ` L ${ptsB[i][0].toFixed(1)},${ptsB[i][1].toFixed(1)}`;
      }
      poly += " Z";
    }

    return {
      pathA: pA,
      pathB: pB,
      fillPolygon: poly,
      valMin: minV,
      valMax: maxV,
      depthStart: dStart,
      depthStop: dStop,
    };
  }, [comparison.resampled_curves_a, comparison.resampled_curves_b, depths, mnemonic]);

  // Depth grid lines
  const depthTicks = useMemo(() => {
    if (depthStop <= depthStart) return [];
    const span = depthStop - depthStart;
    const step = span / 8;
    const ticks = [];
    for (let i = 0; i <= 8; i++) {
      ticks.push(depthStart + i * step);
    }
    return ticks;
  }, [depthStart, depthStop]);

  return (
    <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-5 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-wellqc-border">
        <div>
          <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">
            Composite Track Visualization
          </span>
          <h4 className="text-base font-bold text-white font-mono mt-0.5">
            Channel: {mnemonic} &bull; Overlaid Log Response
          </h4>
        </div>

        {stat && (
          <div className="flex items-center space-x-3 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-lg bg-wellqc-card border border-wellqc-border text-center">
              <span className="text-[9px] text-wellqc-muted block">Pearson r</span>
              <span className="font-bold text-emerald-400">{stat.pearson_r.toFixed(3)}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-wellqc-card border border-wellqc-border text-center">
              <span className="text-[9px] text-wellqc-muted block">Optimal Shift</span>
              <span className="font-bold text-cyan-300">
                {stat.optimal_lag_depth > 0 ? "+" : ""}
                {stat.optimal_lag_depth.toFixed(1)} {comparison.depth_unit}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-wellqc-card border border-wellqc-border text-center">
              <span className="text-[9px] text-wellqc-muted block">Continuity</span>
              <span className="font-bold text-amber-300">{stat.stratigraphic_continuity}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center overflow-x-auto">
        <svg
          viewBox="0 0 500 700"
          className="w-full max-w-[560px] h-auto bg-slate-950/80 rounded-xl border border-wellqc-border/80 shadow-inner font-mono text-[10px]"
        >
          <defs>
            <linearGradient id="diffFillGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* Grid lines and depth ticks */}
          {depthTicks.map((d, idx) => {
            const y = 30 + ((d - depthStart) / (depthStop - depthStart)) * 630;
            return (
              <g key={`dtick-${idx}`}>
                <line
                  x1="70"
                  y1={y}
                  x2="470"
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="3 3"
                />
                <text x="62" y={y + 3} textAnchor="end" fill="#94a3b8" fontSize="9">
                  {d.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Vertical Track boundaries */}
          <line x1="70" y1="30" x2="70" y2="660" stroke="rgba(255,255,255,0.2)" />
          <line x1="470" y1="30" x2="470" y2="660" stroke="rgba(255,255,255,0.2)" />

          {/* Scale labels on top */}
          <text x="70" y="20" fill="#06b6d4" fontSize="10" fontWeight="bold">
            {valMin.toFixed(1)}
          </text>
          <text x="270" y="20" fill="#94a3b8" fontSize="9" textAnchor="middle">
            {mnemonic} scale
          </text>
          <text x="470" y="20" fill="#f59e0b" fontSize="10" textAnchor="end" fontWeight="bold">
            {valMax.toFixed(1)}
          </text>

          {/* Shaded difference polygon */}
          {fillPolygon && <path d={fillPolygon} fill="url(#diffFillGradient)" />}

          {/* Curve A (Cyan) */}
          {pathA && (
            <path
              d={pathA}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          )}

          {/* Curve B (Amber) */}
          {pathB && (
            <path
              d={pathB}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.8"
              strokeDasharray="4 2"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-wellqc-muted px-2">
        <span>Shaded region denotes facies variation / petrophysical departure</span>
        <span>
          Overlap: {depthStart.toFixed(0)} - {depthStop.toFixed(0)} {comparison.depth_unit}
        </span>
      </div>
    </div>
  );
}

function ComparisonPane({
  detail,
  accent,
}: {
  detail: WellDetailResponse | null;
  accent: "cyan" | "amber";
}) {
  if (!detail) {
    return (
      <div className="p-8 bg-wellqc-panel border border-wellqc-border rounded-2xl text-center text-cyan-300 text-xs font-mono flex items-center justify-center">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        Loading well curves...
      </div>
    );
  }

  const border = accent === "cyan" ? "border-cyan-500/40" : "border-amber-500/40";
  const text = accent === "cyan" ? "text-cyan-300" : "text-amber-300";

  return (
    <div className="space-y-3">
      <div
        className={`p-3 bg-wellqc-card border ${border} rounded-xl flex items-center justify-between font-mono text-xs`}
      >
        <span className={`font-bold ${text}`}>{detail.well.name}</span>
        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
          Quality: {detail.well.qualityScore}/100 ({detail.well.qualityGrade})
        </span>
      </div>
      <WellLogViewer
        wellName={detail.well.name}
        depthUnit={detail.well.depthUnit}
        startDepth={detail.curvesData.depth[0] ?? 0}
        stopDepth={detail.curvesData.depth[detail.curvesData.depth.length - 1] ?? 0}
        curvesData={detail.curvesData}
        anomalies={detail.anomalies}
      />
    </div>
  );
}

async function loadDetail(
  wellId: string,
  setDetail: (detail: WellDetailResponse | null) => void,
  setError: (error: string) => void
) {
  if (!wellId) {
    setDetail(null);
    return;
  }

  try {
    const response = await fetch(`/api/wells/${wellId}`, { cache: "no-store" });
    const res = await safeReadJson<WellDetailResponse>(response, "Unable to load well detail.");

    if (!res.ok || !res.data) {
      throw new Error(res.error || "Unable to load well detail.");
    }

    setDetail(res.data);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unable to load well detail.");
  }
}
