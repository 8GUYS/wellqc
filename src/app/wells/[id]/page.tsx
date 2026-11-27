"use client";

import { use, useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";
import { WellDetailResponse } from "@/lib/api-types";
import { ParsedLAS } from "@/lib/las/parser";
import { QualityAnalysisResult, QualityAnomaly } from "@/lib/las/quality-engine";
import { AIAnalysisOutput } from "@/lib/las/ai-analyzer";
import { safeReadJson } from "@/lib/http-client";
import {
  ArrowLeft,
  Database,
  Download,
  RefreshCw,
  UploadCloud,
  Layers,
  ShieldCheck,
  Lock,
  Table,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { WellLogViewer } from "@/components/well-log/log-viewer";
import { CurveInventoryTable } from "@/components/well-log/curve-inventory-table";
import { AuditSummaryCards } from "@/components/upload/audit-summary-cards";
import { AIInsightsPanel } from "@/components/upload/ai-insights-panel";
import { AnomaliesListTab } from "@/components/upload/anomalies-list-tab";
import { HeadersTab } from "@/components/upload/headers-tab";
import { PaystackUpgradeModal } from "@/components/payments/paystack-upgrade-modal";

export default function WellDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<WellDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"viewer" | "curves" | "anomalies" | "headers" | "raw">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("wellqc_last_inspected_well");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id === id && parsed.activeTab) {
            return parsed.activeTab;
          }
        }
      } catch { }
    }
    return "viewer";
  });

  // User Profile & License Gatekeeper State
  const [userProfile, setUserProfile] = useState<{
    tier: string;
    role: string;
  }>({ tier: "FREE", role: "USER" });
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Persist the currently inspected well to localStorage so the user can easily resume/modify from Well Assets
  useEffect(() => {
    if (!detail?.well) return;
    try {
      const persisted = {
        id: detail.well.id,
        name: detail.well.name,
        apiNo: detail.well.apiNo || "",
        fileName: detail.well.latestLasFileName || `${detail.well.name}.las`,
        score: detail.well.qualityScore ?? 0,
        grade: detail.well.qualityGrade || "GOOD",
        operator: detail.well.operatorName || "",
        field: detail.well.fieldName || "",
        depthUnit: detail.well.depthUnit || "FT",
        tdFt: detail.well.tdFt || 0,
        curveCount: detail.curveSummaries?.length || Object.keys(detail.curvesData?.curves || {}).length,
        activeTab,
        inspectedAt: new Date().toISOString(),
      };
      localStorage.setItem("wellqc_last_inspected_well", JSON.stringify(persisted));
      localStorage.setItem("wellqc_last_inspected_well_id", detail.well.id);
    } catch { }
  }, [detail, activeTab]);

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

  // Construct structured ParsedLAS object from database records
  const parsedLAS: ParsedLAS | null = useMemo(() => {
    if (!detail) return null;
    const w = detail.well;
    const curvesData = detail.curvesData || { depth: [], curves: {} };
    const startDepth = curvesData.depth?.[0] ?? (w.tdFt ? 0 : 0);
    const stopDepth = curvesData.depth?.[curvesData.depth.length - 1] ?? (w.tdFt || 0);
    const depthUnit = w.depthUnit || "FT";

    const curveSummaries = detail.curveSummaries || [];
    const curves = Object.keys(curvesData.curves || {}).map((m) => {
      const summary = curveSummaries.find((c) => c.mnemonic.toUpperCase() === m.toUpperCase());
      return {
        mnemonic: m,
        unit: summary?.unit || "",
        code: "",
        description: summary?.standardMnemonic || m,
      };
    });

    return {
      version: "2.0",
      wrap: false,
      wellInfo: {
        wellName: w.name,
        company: w.operatorName || "N/A",
        field: w.fieldName || "N/A",
        location: w.basin || "Niger Delta Basin",
        country: w.country || "Nigeria",
        state: "Rivers",
        apiUwi: w.apiNo || "N/A",
        serviceCompany: "Wireline Services",
        date: w.createdAt ? new Date(w.createdAt).toISOString().split("T")[0] : "2026-01-01",
        startDepth,
        stopDepth,
        step: curvesData.depth?.length > 1 ? Math.abs(Number((curvesData.depth[1] - curvesData.depth[0]).toFixed(4))) : 0.5,
        nullValue: -999.25,
        depthUnit,
      },
      curves,
      totalPoints: curvesData.depth?.length || w.pointCount || 0,
      data: curvesData,
      rawHeader: detail.rawHeader || `~WELL\nWELL. ${w.name}\nAPI.  ${w.apiNo || ""}\nCOMP. ${w.operatorName || ""}\nFLD.  ${w.fieldName || ""}`,
      warnings: [],
    };
  }, [detail]);

  // Construct structured QualityAnalysisResult
  const qaResult: QualityAnalysisResult | null = useMemo(() => {
    if (!detail) return null;
    const anomalies = detail.anomalies || [];
    const criticalCount = anomalies.filter((a) => a.severity === "CRITICAL").length;
    const warningCount = anomalies.filter(
      (a) => a.severity === "WARNING" || (a.severity as string) === "MODERATE"
    ).length;

    const existingStd = new Set(
      (detail.curveSummaries || []).map((c) => (c.standardMnemonic || c.mnemonic).toUpperCase())
    );
    const coreStandards = ["GR", "RHOB", "NPHI", "DT", "LLD", "CALI", "SP"];
    const missingStandardCurves = coreStandards.filter((m) => !existingStd.has(m));

    return {
      overallScore: detail.well.qualityScore || 0,
      qualityGrade: (detail.well.qualityGrade as QualityAnalysisResult["qualityGrade"]) || "GOOD",
      completenessScore: Math.round(detail.well.qualityScore || 85),
      consistencyScore: Math.round(detail.well.qualityScore || 85),
      anomalyCount: anomalies.length,
      criticalCount,
      warningCount,
      anomalies: anomalies as unknown as QualityAnalysisResult["anomalies"],
      curveSummaries: detail.curveSummaries || [],
      missingStandardCurves,
    };
  }, [detail]);

  // Construct structured AIAnalysisOutput
  const aiOutput: AIAnalysisOutput | null = useMemo(() => {
    if (!detail) return null;
    const score = detail.well.qualityScore || 0;
    const rating: AIAnalysisOutput["riskRating"] =
      score < 50 ? "HIGH" : score < 75 ? "MEDIUM" : "LOW";
    return {
      summary: detail.aiSummary || "Comprehensive petrophysical quality audit and curve standardisation complete.",
      recommendations: detail.recommendations || [],
      riskRating: rating,
      confidenceScore: 0.94,
      flaggedIntervals: [],
    };
  }, [detail]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/wells"
            className="inline-flex items-center space-x-2 text-xs font-mono text-cyan-400 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Well Assets</span>
          </Link>

          <Link
            href="/upload"
            className="inline-flex items-center space-x-1.5 text-xs font-mono text-slate-400 hover:text-white"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Another LAS File</span>
          </Link>
        </div>

        {isLoading && (
          <div className="p-12 bg-wellqc-panel border border-cyan-500/30 rounded-2xl text-center text-cyan-300 text-xs font-mono flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Loading full well asset dossier & wireline telemetry...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-xs font-mono">
            {error}
          </div>
        )}

        {well && parsedLAS && qaResult && aiOutput && (
          <>
            {/* Top Well Dossier Header */}
            <div className="bg-wellqc-panel border border-wellqc-border p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`w-3.5 h-3.5 rounded-full ${well.qualityScore >= 75 ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <h1 className="text-2xl font-black text-white font-mono">{well.name}</h1>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                    well.qualityScore >= 90 ? "badge-excellent" :
                    well.qualityScore >= 75 ? "badge-good" :
                    well.qualityScore >= 50 ? "badge-poor" : "badge-critical"
                  }`}>
                    {well.qualityScore} / 100 {well.qualityGrade}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Saved in Database ✓
                  </span>
                </div>
                <p className="text-xs text-wellqc-muted font-mono">
                  API/UWI: <span className="text-white">{well.apiNo || "N/A"}</span> | Operator: <span className="text-white">{well.operatorName}</span> | Field: <span className="text-white">{well.fieldName}</span> | Basin: <span className="text-white">{well.basin}</span>
                </p>
              </div>

              {/* Action Toolbar */}
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

                <Link
                  href="/reports"
                  className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-wellqc-card border border-wellqc-border hover:border-cyan-500/50 text-slate-300 hover:text-white font-semibold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                  title="View NUPRC compliance reports"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Compliance Reports</span>
                </Link>
              </div>
            </div>

            {/* Core Subsurface Spec Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SpecCard label="Latitude / Longitude" value={`${well.latitude?.toFixed(4) || "0.0000"}, ${well.longitude?.toFixed(4) || "0.0000"}`} />
              <SpecCard label="Elevation (KB)" value={`${(well.elevFt || 0).toLocaleString()} FT`} />
              <SpecCard label="Total Depth (TD)" value={`${(well.tdFt || 0).toLocaleString()} ${well.depthUnit || "FT"}`} />
              <SpecCard label="Active Curve Suite" value={`${well.curveCount || 0} Log Channels`} accent />
            </div>

            {/* Audit Summary & KPI Metrics */}
            <AuditSummaryCards parsedLAS={parsedLAS} qaResult={qaResult} />

            {/* AI Insights Panel */}
            <AIInsightsPanel aiOutput={aiOutput} />

            {/* Tabbed Detailed Analysis Inspector */}
            <section
              aria-label="Detailed Analysis Tabs"
              className="bg-wellqc-panel border border-wellqc-border rounded-2xl shadow-xl"
            >
              <div className="flex items-center border-b border-wellqc-border bg-wellqc-card/40 px-4 overflow-x-auto rounded-t-2xl">
                <button
                  type="button"
                  onClick={() => setActiveTab("viewer")}
                  className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
                    activeTab === "viewer"
                      ? "border-cyan-400 text-cyan-300 bg-cyan-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Wireline Log Viewer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("curves")}
                  className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
                    activeTab === "curves"
                      ? "border-cyan-400 text-cyan-300 bg-cyan-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Curve Health &amp; Standardisation ({qaResult.curveSummaries.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("anomalies")}
                  className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
                    activeTab === "anomalies"
                      ? "border-cyan-400 text-cyan-300 bg-cyan-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Quality Anomalies ({qaResult.anomalies.length})</span>
                  {isFreeTier && (
                    <span className="flex items-center space-x-1 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold">
                      <Lock className="w-2.5 h-2.5 text-amber-400" />
                      <span>PRO</span>
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("headers")}
                  className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
                    activeTab === "headers"
                      ? "border-cyan-400 text-cyan-300 bg-cyan-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Headers &amp; Well Meta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("raw")}
                  className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
                    activeTab === "raw"
                      ? "border-cyan-400 text-cyan-300 bg-cyan-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Raw Header Payload</span>
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-4 sm:p-5">
                {activeTab === "viewer" && (
                  hasCurves ? (
                    <WellLogViewer
                      wellName={well.name}
                      depthUnit={well.depthUnit || "FT"}
                      startDepth={detail.curvesData.depth[0] ?? 0}
                      stopDepth={detail.curvesData.depth[detail.curvesData.depth.length - 1] ?? well.tdFt}
                      curvesData={detail.curvesData}
                      anomalies={detail.anomalies || []}
                      onUpgradeRequest={() => setUpgradeModalOpen(true)}
                    />
                  ) : (
                    <div className="p-8 text-center space-y-3">
                      <Database className="w-8 h-8 text-cyan-400 mx-auto" />
                      <h4 className="text-base font-bold text-white">No curve samples recorded</h4>
                      <p className="text-xs text-wellqc-muted font-mono">
                        This well asset does not have curve data points stored.
                      </p>
                    </div>
                  )
                )}

                {activeTab === "curves" && (
                  <CurveInventoryTable
                    curveSummaries={qaResult.curveSummaries}
                    parsedLAS={parsedLAS}
                    isFreeTier={isFreeTier}
                    onUpgradeRequest={() => setUpgradeModalOpen(true)}
                  />
                )}

                {activeTab === "anomalies" && (
                  <AnomaliesListTab anomalies={qaResult.anomalies as unknown as QualityAnomaly[]} />
                )}

                {activeTab === "headers" && (
                  <HeadersTab parsedLAS={parsedLAS} />
                )}

                {activeTab === "raw" && (
                  <div className="p-2 space-y-3 font-mono text-xs">
                    <pre className="text-slate-300 bg-wellqc-dark/90 p-4 rounded-xl border border-wellqc-border overflow-x-auto max-h-96 leading-relaxed">
                      {detail.rawHeader || parsedLAS.rawHeader || "No raw LAS header recorded."}
                    </pre>
                  </div>
                )}
              </div>
            </section>
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
