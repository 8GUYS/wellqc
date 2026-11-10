"use client";

import { use, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";
import { WellDetailResponse } from "@/lib/api-types";
import { safeReadJson } from "@/lib/http-client";
import {
  ArrowLeft,
  Database,
  Sparkles,
  Download,
  RefreshCw,
  UploadCloud,
  Layers,
  ShieldCheck,
  Wrench,
  Lock,
  GitCompare,
} from "lucide-react";
import { WellLogViewer } from "@/components/well-log/log-viewer";
import { PaystackUpgradeModal } from "@/components/payments/paystack-upgrade-modal";

export default function WellDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<WellDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // User Profile & License Gatekeeper State
  const [userProfile, setUserProfile] = useState<{
    tier: string;
    role: string;
  }>({ tier: "FREE", role: "USER" });
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/wells/${id}`, { cache: "no-store" });
        const res = await safeReadJson<WellDetailResponse>(response, "Unable to load well detail.");

        if (!res.ok || !res.data) {
          throw new Error(res.error || "Unable to load well detail.");
        }

        if (!cancelled) {
          setDetail(res.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load well detail.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const well = detail?.well;
  const hasCurves = Boolean(
    detail?.curvesData?.depth &&
    detail.curvesData.depth.length > 0 &&
    Object.keys(detail.curvesData.curves || {}).length > 0
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/wells"
            className="inline-flex items-center space-x-2 text-xs font-mono text-cyan-400 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Well Assets</span>
          </Link>
        </div>

        {isLoading && (
          <div className="p-8 bg-wellqc-panel border border-wellqc-border rounded-2xl text-center text-cyan-300 text-xs font-mono flex items-center justify-center">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Loading saved well data...
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-xs font-mono">
            {error}
          </div>
        )}

        {well && (
          <>
            <div className="bg-wellqc-panel border border-wellqc-border p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${well.qualityScore >= 75 ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <h1 className="text-2xl font-black text-white font-mono">{well.name}</h1>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                    well.qualityScore >= 90 ? "badge-excellent" :
                    well.qualityScore >= 75 ? "badge-good" :
                    well.qualityScore >= 50 ? "badge-poor" : "badge-critical"
                  }`}>
                    {well.qualityScore} / 100 {well.qualityGrade}
                  </span>
                </div>
                <p className="text-xs text-wellqc-muted font-mono">
                  API/UWI: {well.apiNo} | Operator: {well.operatorName} | Field: {well.fieldName} | Basin: {well.basin}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {isFreeTier ? (
                  <button
                    type="button"
                    onClick={() => setUpgradeModalOpen(true)}
                    className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-400/50 font-bold text-xs shadow-md transition-all cursor-pointer"
                    title="QA Engine requires WellQC Pro. Click to unlock."
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Fix in QA Engine</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold">
                      PRO
                    </span>
                  </button>
                ) : (
                  <Link
                    href={`/qa-engine?wellId=${well.id}`}
                    className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/20 hover:shadow-cyan-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    title="Launch petrophysical repair in Quality Engine"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Fix in QA Engine</span>
                  </Link>
                )}

                <Link
                  href={`/standardisation?wellId=${well.id}`}
                  className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 border border-purple-500/30 font-semibold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                  title="Map vendor curve mnemonics to API RP 66 standard"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>Standardise Curves</span>
                </Link>

                {isFreeTier ? (
                  <button
                    type="button"
                    onClick={() => setUpgradeModalOpen(true)}
                    className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 hover:text-purple-200 border border-purple-500/40 font-semibold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                    title="Upgrade to WellQC Pro for multi-well petrophysical correlation & comparison"
                  >
                    <Lock className="w-3.5 h-3.5 text-purple-400" />
                    <span>Compare Well</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-500/30 text-purple-200 border border-purple-400/40">
                      PRO
                    </span>
                  </button>
                ) : (
                  <Link
                    href={`/comparison?wellA=${well.id}`}
                    className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 font-semibold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                    title="Cross-correlate with offset well in Stratigraphic Comparison Engine"
                  >
                    <GitCompare className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Compare Well</span>
                  </Link>
                )}

                <Link
                  href="/reports"
                  className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-wellqc-card border border-wellqc-border hover:border-cyan-500/50 text-slate-300 hover:text-white font-semibold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                  title="View NUPRC compliance certificates"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Compliance Reports</span>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SpecCard label="Latitude / Longitude" value={`${well.latitude.toFixed(4)}, ${well.longitude.toFixed(4)}`} />
              <SpecCard label="Elevation (KB)" value={`${well.elevFt.toLocaleString()} FT`} />
              <SpecCard label="Total Depth (TD)" value={`${well.tdFt.toLocaleString()} FT`} />
              <SpecCard label="Active Curve Suite" value={`${well.curveCount} Log Channels`} accent />
            </div>

            <div className="p-4 bg-wellqc-card border border-cyan-500/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-cyan-300">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Petrophysical Summary</span>
                </div>
                {isFreeTier ? (
                  <button
                    type="button"
                    onClick={() => setUpgradeModalOpen(true)}
                    className="inline-flex items-center space-x-1.5 text-[11px] font-mono text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Repair Anomalies in QA Engine (PRO) &rarr;</span>
                  </button>
                ) : (
                  <Link
                    href={`/qa-engine?wellId=${well.id}`}
                    className="inline-flex items-center space-x-1.5 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 font-bold hover:underline"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Repair Anomalies in QA Engine &rarr;</span>
                  </Link>
                )}
              </div>
              <p className="text-xs text-slate-300 font-mono">{detail.aiSummary}</p>
              {detail.recommendations.length > 0 && (
                <ul className="list-disc list-inside text-xs text-slate-400 font-mono space-y-1">
                  {detail.recommendations.map((recommendation) => (
                    <li key={recommendation}>{recommendation}</li>
                  ))}
                </ul>
              )}
            </div>

            {hasCurves ? (
              <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wellqc-border pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                      <Layers className="w-5 h-5 text-cyan-400" />
                      <span>Interactive Multi-Track Wireline Log Viewer</span>
                    </h2>
                    <p className="text-xs text-slate-400 font-mono">
                      Synchronized 3-track petrophysical display with logarithmic resistivity and acoustic/gamma scales.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1.5 rounded-lg">
                    <span>Channels: {Object.keys(detail.curvesData.curves).length} curves</span>
                    <span>•</span>
                    <span>Samples: {detail.curvesData.depth.length.toLocaleString()} pts</span>
                  </div>
                </div>

                {isFreeTier ? (
                  <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-950/20 via-slate-900/60 to-slate-950/80 p-8 text-center space-y-5">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
                      <Lock className="w-6 h-6" />
                    </div>

                    <div className="space-y-2 max-w-xl mx-auto">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                        <Sparkles className="w-3 h-3" />
                        <span>WellQC Pro Tier Feature</span>
                      </div>
                      <h3 className="text-xl font-black text-white font-mono">
                        Interactive Wireline Log Viewer is Locked
                      </h3>
                      <p className="text-xs text-slate-400 font-mono leading-relaxed">
                        Upgrade to WellQC Pro to unlock multi-track composite curve rendering, logarithmic resistivity overlays, depth-synchronized scrolling, and real-time anomaly overlays for <span className="text-white font-semibold">{well.name}</span>.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                        <div className="text-cyan-400 font-mono text-xs font-bold flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5" />
                          <span>3-Track Composite</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Lithology (GR/SP), Resistivity (ILD/MSFL), and Porosity (NPHI/RHOB/DT) tracks.
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                        <div className="text-amber-400 font-mono text-xs font-bold flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Anomaly Banding</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Visual depth intervals for sensor flatlines, extreme spikes, and cycle skips.
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                        <div className="text-purple-400 font-mono text-xs font-bold flex items-center gap-1.5">
                          <Download className="w-3.5 h-3.5" />
                          <span>High-Res Export</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Export depth-indexed CSV points tables and print NUPRC-compliant certificates.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setUpgradeModalOpen(true)}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs font-mono shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 text-slate-950" />
                        <span>Upgrade to WellQC Pro (₦75,000 / $49)</span>
                      </button>
                      <Link
                        href="/pricing"
                        className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-mono text-xs border border-slate-700 transition-colors"
                      >
                        View All Plans
                      </Link>
                    </div>
                  </div>
                ) : (
                  <WellLogViewer
                    wellName={well.name}
                    depthUnit={well.depthUnit || "FT"}
                    startDepth={detail.curvesData.depth[0] ?? 0}
                    stopDepth={detail.curvesData.depth[detail.curvesData.depth.length - 1] ?? well.tdFt}
                    curvesData={detail.curvesData}
                    anomalies={detail.anomalies || []}
                  />
                )}
              </div>
            ) : (
              <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-8 text-center space-y-3">
                <Database className="w-8 h-8 text-cyan-400 mx-auto" />
                <h2 className="text-base font-bold text-white">No LAS curves uploaded for this well</h2>
                <p className="text-xs text-wellqc-muted font-mono">
                  Upload and validate a LAS file, then upload it to render curves and QA anomalies here.
                </p>
                <Link
                  href="/upload"
                  className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload LAS</span>
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* Paystack License Upgrade Modal */}
      <PaystackUpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        defaultPlanId="PRO_MONTHLY"
        targetWellId={well?.id}
        reason="Upgrade to WellQC Pro to access automated petrophysical repair, despiking, KNN/Spline null imputation, and certified exports."
      />
    </AppShell>
  );
}

function SpecCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-wellqc-card border border-wellqc-border p-4 rounded-xl space-y-1">
      <span className="text-[10px] font-mono uppercase text-wellqc-muted">{label}</span>
      <div className={`text-sm font-bold font-mono ${accent ? "text-cyan-400" : "text-white"}`}>{value}</div>
    </div>
  );
}
