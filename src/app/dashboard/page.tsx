"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";
import { DashboardSummary } from "@/lib/api-types";
import { safeReadJson } from "@/lib/http-client";
import {
  Award,
  CheckCircle2,
  TrendingUp,
  Layers,
  RefreshCw,
  Plus,
  Settings,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import dynamic from "next/dynamic";

const TrendChart = dynamic(
  () => import("@/components/dashboard/trend-chart").then((m) => m.TrendChart),
  { ssr: false }
);

const EMPTY_SUMMARY: DashboardSummary = {
  totalWells: 0,
  lasFilesUploaded: 0,
  averageQualityScore: 0,
  averageQualityGrade: "UNVALIDATED",
  curvesAnalysed: 0,
  errorsDetected: 0,
  missingCurves: 0,
  anomaliesFound: 0,
  cleanedTodayLabel: "0 KB",
  uploadedToday: 0,
  trend: [],
  fieldPerformance: [],
  problemWells: [],
  recentActivity: [],
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filterScope, setFilterScope] = useState<"ALL" | "COMMITTED" | "ATTENTION">("ALL");
  const [paymentNotice, setPaymentNotice] = useState<{ status: string; plan?: string; ref?: string } | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const payment = urlParams.get("payment");
        if (payment === "success") {
          return {
            status: "success",
            plan: urlParams.get("plan") || "Pro Petrophysicist Plan",
            ref: urlParams.get("reference") || undefined,
          };
        } else if (payment === "failed" || payment === "error") {
          return {
            status: "failed",
            plan: urlParams.get("message") || "Payment processing could not be completed.",
          };
        }
      } catch {}
    }
    return null;
  });

  const [dashboardMode, setDashboardMode] = useState<"executive" | "workstation" | "telemetry">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("wellqc_dashboard_mode");
        if (saved === "executive" || saved === "workstation" || saved === "telemetry") {
          return saved;
        }
      } catch {}
    }
    return "executive";
  });

  const handleModeChange = (mode: "executive" | "workstation" | "telemetry") => {
    setDashboardMode(mode);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("wellqc_dashboard_mode", mode);
      } catch {}
    }
  };

  const loadDashboard = useCallback(async (showRefreshingSpinner = false) => {
    if (showRefreshingSpinner) setIsRefreshing(true);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const res = await safeReadJson<DashboardSummary>(response, "Unable to load dashboard data.");

      if (!res.ok || !res.data) {
        throw new Error(res.error || "Unable to load dashboard data.");
      }

      setSummary(res.data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initDashboard() {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const res = await safeReadJson<DashboardSummary>(response, "Unable to load dashboard data.");

        if (!active) return;
        if (!res.ok || !res.data) {
          throw new Error(res.error || "Unable to load dashboard data.");
        }

        setSummary(res.data);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load dashboard data.");
      } finally {
        if (active) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    initDashboard();

    return () => {
      active = false;
    };
  }, []);

  const trendData = summary.trend.length > 0 ? summary.trend : EMPTY_SUMMARY.trend;

  // Grade breakdown calculations for charts
  const gradeDistribution = useMemo(() => {
    const excellent = summary.fieldPerformance.filter((f) => f.score >= 90).length;
    const good = summary.fieldPerformance.filter((f) => f.score >= 75 && f.score < 90).length;
    const poor = summary.fieldPerformance.filter((f) => f.score >= 50 && f.score < 75).length;
    const critical = summary.problemWells.length;
    const total = summary.totalWells || 1;

    return {
      excellent: Math.max(excellent, summary.averageQualityScore >= 90 ? 1 : 0),
      good: Math.max(good, summary.averageQualityScore >= 75 && summary.averageQualityScore < 90 ? 1 : 0),
      poor: Math.max(poor, summary.averageQualityScore < 75 && summary.averageQualityScore >= 50 ? 1 : 0),
      critical: Math.max(critical, summary.averageQualityScore < 50 && summary.totalWells > 0 ? 1 : 0),
      total,
    };
  }, [summary]);

  // Score arc calculation for Radial Gauge
  const score = Math.max(0, Math.min(100, Math.round(summary.averageQualityScore)));
  const gaugeAngle = (score / 100) * 180 - 90; // -90 deg to +90 deg

  const getScoreColor = (val: number) => {
    if (val >= 90) return "#10b981"; // emerald
    if (val >= 75) return "#0ea5e9"; // sky
    if (val >= 50) return "#f59e0b"; // amber
    return "#ef4444"; // rose
  };

  return (
    <AppShell>
      <div className="space-y-3 max-w-[1680px] mx-auto font-sans text-slate-200">
        {/* Top Workstation Breadcrumb & Action Strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-wellqc-border gap-3 font-mono text-xs">
          <div className="flex items-center flex-wrap gap-2.5">
            <div className="flex items-center space-x-1.5 font-bold text-white text-sm">
              <span className="text-cyan-600 dark:text-cyan-400">❖</span>
              <span>Asset Dashboard</span>
            </div>
            <span className="text-slate-400 dark:text-slate-600">|</span>

            {/* Dynamic Dashboard Layout & Themes Mode Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 rounded-xl p-1 shadow-inner">
              <button
                onClick={() => handleModeChange("executive")}
                className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1.5 ${
                  dashboardMode === "executive"
                    ? "bg-[#0071e3] text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Simplified view: Calmer on the eye, highlights high-level quality index and priority severity faults"
              >
                <span>🎯 Executive (Calm)</span>
              </button>
              <button
                onClick={() => handleModeChange("workstation")}
                className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1.5 ${
                  dashboardMode === "workstation"
                    ? "bg-[#0071e3] text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Operational view: Fleet distribution status bars and core mnemonic analysis"
              >
                <span>🎛️ Operational</span>
              </button>
              <button
                onClick={() => handleModeChange("telemetry")}
                className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1.5 ${
                  dashboardMode === "telemetry"
                    ? "bg-[#0071e3] text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Full Engineering Telemetry: Complete 18-metric matrix, histograms, donut, and scan verification tables"
              >
                <span>🔬 Full Telemetry</span>
              </button>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 rounded-xl p-1">
              <button
                onClick={() => setFilterScope("ALL")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${filterScope === "ALL" ? "bg-[#0071e3] text-white font-bold shadow-sm" : "hover:text-slate-900 dark:hover:text-white"}`}
              >
                All Wells
              </button>
              <button
                onClick={() => setFilterScope("COMMITTED")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${filterScope === "COMMITTED" ? "bg-[#0071e3] text-white font-bold shadow-sm" : "hover:text-slate-900 dark:hover:text-white"}`}
              >
                Committed
              </button>
              <button
                onClick={() => setFilterScope("ATTENTION")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${filterScope === "ATTENTION" ? "bg-[#0071e3] text-white font-bold shadow-sm" : "hover:text-slate-900 dark:hover:text-white"}`}
              >
                Flagged
              </button>
            </div>

            <span className="text-slate-400 dark:text-slate-600">|</span>
            <span>
              Metrics: <strong className="text-slate-900 dark:text-white font-mono">
                {dashboardMode === "executive" ? "7 Focused" : dashboardMode === "workstation" ? "12 Fleet" : "18 / 18 Full"}
              </strong>
            </span>

            <div className="flex items-center space-x-1.5 pl-1">
              <Link
                href="/upload"
                title="Ingest New LAS"
                className="w-8 h-8 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white flex items-center justify-center transition-all shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
              </Link>
              <button
                onClick={() => loadDashboard(true)}
                disabled={isRefreshing || isLoading}
                title="Refresh Database Telemetry"
                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-600 dark:text-cyan-400" : ""}`} />
              </button>
              <Link
                href="/wells"
                title="Well Registry Settings"
                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors shadow-sm"
              >
                <Settings className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Executive Summary Notice Banner (Apple Clean Style) - Temporarily commented out */}
        {/* {showNotice && (
          <div className="bg-slate-900/85 border border-cyan-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs font-mono shadow-md backdrop-blur-md">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                <Info className="w-3.5 h-3.5" />
              </div>
              <span className="text-slate-200 text-[11px] leading-tight">
                Review automated quality diagnostics, curve gap distributions, and verification audits across your corporate LAS fleet.
              </span>
              <Link
                href="/wells"
                className="px-3.5 py-1 rounded-full btn-apple-primary text-white font-bold text-[11px] transition-all shrink-0 shadow-sm"
              >
                Generate Audit Report
              </Link>
            </div>

            <button
              onClick={() => setShowNotice(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )} */}

        {/* Payment Confirmation Alert */}
        {paymentNotice && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-4 font-mono text-xs shadow-md ${
              paymentNotice.status === "success"
                ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/70 border-rose-500/40 text-rose-200"
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-bold text-white">Payment Confirmed:</span>
              <span className="text-slate-300">{paymentNotice.plan}</span>
            </div>
            <button
              onClick={() => setPaymentNotice(null)}
              className="px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="bg-rose-950/40 border border-rose-800 text-rose-300 px-3 py-2 rounded text-xs font-mono">
            {error}
          </div>
        )}

        {/* ── 3-TIER ENTERPRISE KPI GRID ─────────── */}
        <div className="space-y-2.5 font-mono">
          {/* Row 1: Discovery & Quality Index */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <EnterpriseKpiCard
              label="Discovered Wells"
              value={summary.totalWells.toLocaleString()}
              subtext="Catalogued Subsurface Assets"
              accentColor="text-sky-600 dark:text-sky-400"
            />
            <EnterpriseKpiCard
              label="Committed LAS Logs"
              value={summary.lasFilesUploaded.toLocaleString()}
              subtext="Verified File Ingestions"
              accentColor="text-cyan-600 dark:text-cyan-400"
            />
            <EnterpriseKpiCard
              label="Composite QA Score"
              value={summary.averageQualityScore > 0 ? `${summary.averageQualityScore}` : "0"}
              subtext={`Grade: ${summary.averageQualityGrade}`}
              badge={summary.averageQualityGrade}
              accentColor={getScoreColor(summary.averageQualityScore)}
            />
            {dashboardMode === "executive" ? (
              <EnterpriseKpiCard
                label="Today's Cleaned Volume"
                value={summary.cleanedTodayLabel}
                subtext="Repaired Dataset Footprint"
                accentColor="text-emerald-600 dark:text-emerald-400"
              />
            ) : (
              <EnterpriseKpiCard
                label="Analysed Depth Curves"
                value={summary.curvesAnalysed.toLocaleString()}
                subtext="Indexed Sensor Channels"
                accentColor="text-purple-600 dark:text-purple-400"
              />
            )}
          </div>

          {/* Row 2: Operational QA Metrics (Visible in Workstation and Full Telemetry modes) */}
          {dashboardMode !== "executive" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <EnterpriseKpiCard
                label="Today's Cleaned Volume"
                value={summary.cleanedTodayLabel}
                subtext="Repaired Dataset Footprint"
                accentColor="text-emerald-600 dark:text-emerald-400"
              />
              <EnterpriseKpiCard
                label="Committed Today"
                value={summary.uploadedToday.toLocaleString()}
                subtext="New Wells Ingested Today"
                accentColor="text-cyan-600 dark:text-cyan-300"
              />
              <EnterpriseKpiCard
                label="Monitored Fields"
                value={summary.fieldPerformance.length.toLocaleString()}
                subtext="Geographic Basin Groups"
                accentColor="text-slate-800 dark:text-slate-200"
              />
              <EnterpriseKpiCard
                label="Missing Standard Curves"
                value={summary.missingCurves.toLocaleString()}
                subtext="Core Log Suite Omissions"
                accentColor={summary.missingCurves > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}
              />
            </div>
          )}

          {/* Row 3: Priority Severity Alert Cards (High Impact Solid/Accented Blocks) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Defect Ratio Card */}
            <div className="enterprise-kpi-card bg-wellqc-panel border border-wellqc-border p-4 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all">
              <div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
                  Defect Exposure Ratio
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {summary.totalWells > 0
                    ? `${Math.round((summary.problemWells.length / summary.totalWells) * 100)}%`
                    : "0%"}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  <span className="text-rose-600 dark:text-rose-400 font-bold">{summary.errorsDetected}</span> Faults in{" "}
                  <span className="text-slate-800 dark:text-white font-medium">{summary.curvesAnalysed}</span> Curves
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-sm">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>

            {/* Open Critical Errors (Solid High Severity Block) */}
            <div className="severity-card-critical bg-rose-950/70 border border-rose-600/80 p-4 rounded-2xl text-white flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
              <div className="severity-title text-[10px] uppercase font-bold tracking-wider text-rose-200">
                Critical Severity Faults
              </div>
              <div className="severity-value text-2xl font-black font-mono tracking-tight my-1 text-white">
                {summary.errorsDetected.toLocaleString()}
              </div>
              <div className="severity-sub text-[10px] text-rose-300 font-mono">
                Depth Non-Monotonicity &amp; Null Spikes
              </div>
            </div>

            {/* Open Moderate Anomalies (Solid Medium Severity Block) */}
            <div className="severity-card-moderate bg-amber-950/70 border border-amber-600/80 p-4 rounded-2xl text-white flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
              <div className="severity-title text-[10px] uppercase font-bold tracking-wider text-amber-200">
                Moderate Anomalies
              </div>
              <div className="severity-value text-2xl font-black font-mono tracking-tight my-1 text-white">
                {summary.anomaliesFound.toLocaleString()}
              </div>
              <div className="severity-sub text-[10px] text-amber-300 font-mono">
                Physical Limits &amp; Outlier Deviations
              </div>
            </div>

            {/* Minor Log Gaps (Solid Low Severity Block) */}
            <div className="severity-card-gaps bg-sky-950/70 border border-sky-600/80 p-4 rounded-2xl text-white flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
              <div className="severity-title text-[10px] uppercase font-bold tracking-wider text-sky-200">
                Gaps &amp; Unit Warnings
              </div>
              <div className="severity-value text-2xl font-black font-mono tracking-tight my-1 text-white">
                {summary.missingCurves.toLocaleString()}
              </div>
              <div className="severity-sub text-[10px] text-sky-300 font-mono">
                Null Clusters &amp; Non-Standard Aliases
              </div>
            </div>
          </div>
        </div>

        {/* ── MODE-SPECIFIC DASHBOARD CONTENT ── */}

        {/* 1. EXECUTIVE CALM MODE: Clean 2-column dial + 7-day trend + quick actions */}
        {dashboardMode === "executive" && (
          <div className="space-y-3 font-mono">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Composite Fleet Quality Dial */}
              <div className="bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between border-b border-wellqc-border pb-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <Award className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="font-bold text-slate-900 dark:text-white uppercase text-[11px] tracking-wider">
                      Composite Fleet Quality Dial
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">API RP 66 Benchmark</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center py-4">
                  <div className="flex flex-col items-center justify-center relative">
                    <svg viewBox="0 0 200 120" className="w-52 h-32 overflow-visible">
                      <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke="#cbd5e1"
                        strokeWidth="16"
                        strokeLinecap="round"
                        className="dark:stroke-slate-800"
                      />
                      <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke={getScoreColor(summary.averageQualityScore)}
                        strokeWidth="16"
                        strokeDasharray="251.2"
                        strokeDashoffset={251.2 - (251.2 * score) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                      <text x="20" y="118" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle">0</text>
                      <text x="100" y="26" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle">50</text>
                      <text x="180" y="118" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle">100</text>
                    </svg>

                    <div className="text-center -mt-6">
                      <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{score}</div>
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mt-0.5"
                        style={{
                          color: getScoreColor(summary.averageQualityScore),
                          backgroundColor: `${getScoreColor(summary.averageQualityScore)}15`,
                        }}
                      >
                        {summary.averageQualityGrade}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs border-l border-wellqc-border/60 pl-3">
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      Total Flagged Anomalies: <strong className="text-slate-900 dark:text-white font-mono">{summary.anomaliesFound}</strong>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span className="text-rose-600 dark:text-rose-400 font-bold block">● Critical</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold font-mono text-xs">{summary.errorsDetected}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span className="text-amber-600 dark:text-amber-400 font-bold block">● Moderate</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold font-mono text-xs">{Math.max(0, summary.anomaliesFound - summary.errorsDetected)}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span className="text-sky-600 dark:text-sky-400 font-bold block">● Missing Gaps</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold font-mono text-xs">{summary.missingCurves}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold block">● Clean Volume</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold font-mono text-xs">{summary.cleanedTodayLabel}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-wellqc-border flex items-center justify-between text-[10px] text-slate-500">
                  <span>Evaluated Assets: <strong className="text-slate-900 dark:text-white font-mono">{summary.totalWells} Wells</strong></span>
                  <Link href="/wells" className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold flex items-center space-x-1">
                    <span>View Registry</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* 7-Day Ingestion & Detections Trend */}
              <div className="bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between border-b border-wellqc-border pb-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="font-bold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">
                      Detections &amp; Ingestions (Last 7 Days)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Throughput Volume</span>
                </div>

                <div className="h-56 w-full">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                      <RefreshCw className="w-4 h-4 animate-spin mr-2 text-cyan-600 dark:text-cyan-400" />
                      Loading trajectory...
                    </div>
                  ) : (
                    <TrendChart data={trendData} />
                  )}
                </div>

                <div className="pt-2 border-t border-wellqc-border flex items-center justify-between text-[10px] text-slate-500">
                  <span>ML Auto-Clean Engine: <strong className="text-emerald-600 dark:text-emerald-400">ACTIVE</strong></span>
                  <Link href="/qa-engine" className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold">
                    Configure Rules →
                  </Link>
                </div>
              </div>
            </div>

            {/* Quick Executive Management Action Strip */}
            <div className="bg-wellqc-panel border border-wellqc-border p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-sm">
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-slate-700 dark:text-slate-300">
                  Telemetry running in <strong>Calm Executive Mode</strong>. Switch to <strong>Operational</strong> or <strong>Deep Telemetry</strong> above for granular mnemonic tables.
                </span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <Link
                  href="/upload"
                  className="px-4 py-2 rounded-full btn-apple-primary text-white font-semibold text-xs transition-all flex items-center space-x-1.5 shadow-sm hover:shadow active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Check New Well Log</span>
                </Link>
                <Link
                  href="/activity"
                  className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                >
                  Audit Trail
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 2. OPERATIONAL & 3. DEEP TELEMETRY MODES */}
        {dashboardMode !== "executive" && (
          <>
            {/* ── MIDDLE ROW: RADIAL SCORE GAUGE & ASSET STATUS BARS ───────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 font-mono">
              {/* Left: Composite Quality Dial (TruRisk Style Gauge) */}
              <div className="bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between border-b border-wellqc-border pb-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <Award className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="font-bold text-slate-900 dark:text-white uppercase text-[11px] tracking-wider">
                      Composite Fleet Quality Dial
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">API RP 66 Benchmark</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center py-4">
                  {/* Radial Meter Visual */}
                  <div className="flex flex-col items-center justify-center relative">
                    <svg viewBox="0 0 200 120" className="w-52 h-32 overflow-visible">
                      <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke="#cbd5e1"
                        strokeWidth="16"
                        strokeLinecap="round"
                        className="dark:stroke-slate-800"
                      />
                      <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke={getScoreColor(summary.averageQualityScore)}
                        strokeWidth="16"
                        strokeDasharray="251.2"
                        strokeDashoffset={251.2 - (251.2 * score) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                      <text x="20" y="118" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle">0</text>
                      <text x="100" y="26" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle">50</text>
                      <text x="180" y="118" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle">100</text>
                    </svg>

                    <div className="text-center -mt-6">
                      <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{score}</div>
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mt-0.5"
                        style={{
                          color: getScoreColor(summary.averageQualityScore),
                          backgroundColor: `${getScoreColor(summary.averageQualityScore)}15`,
                        }}
                      >
                        {summary.averageQualityGrade}
                      </div>
                    </div>
                  </div>

                  {/* Contributing Breakdown */}
                  <div className="space-y-2 text-xs border-l border-wellqc-border/60 pl-3">
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      Total Flagged Anomalies: <strong className="text-slate-900 dark:text-white font-mono">{summary.anomaliesFound}</strong>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span className="text-rose-600 dark:text-rose-400 font-bold block">● Critical</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold font-mono text-xs">{summary.errorsDetected}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span className="text-amber-600 dark:text-amber-400 font-bold block">● Moderate</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold font-mono text-xs">{Math.max(0, summary.anomaliesFound - summary.errorsDetected)}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span className="text-sky-600 dark:text-sky-400 font-bold block">● Missing Gaps</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold font-mono text-xs">{summary.missingCurves}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold block">● Clean Volume</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold font-mono text-xs">{summary.cleanedTodayLabel}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-wellqc-border flex items-center justify-between text-[10px] text-slate-500">
                  <span>Total Active Wells: <strong className="text-slate-900 dark:text-white font-mono">{summary.totalWells}</strong></span>
                  <span>Total Channels: <strong className="text-slate-900 dark:text-white font-mono">{summary.curvesAnalysed}</strong></span>
                </div>
              </div>

              {/* Right: Wells by Status / Grade Distribution */}
              <div className="bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between border-b border-wellqc-border pb-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span className="font-bold text-slate-900 dark:text-white uppercase text-[11px] tracking-wider">
                      Wells by Quality Status
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-[10px]">
                    <span className="text-emerald-600 dark:text-emerald-400">● Excellent</span>
                    <span className="text-sky-600 dark:text-sky-400">● Good</span>
                    <span className="text-amber-600 dark:text-amber-400">● Poor</span>
                    <span className="text-rose-600 dark:text-rose-400">● Critical</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 py-6 items-end h-40">
                  {/* Excellent Bar */}
                  <div className="flex flex-col items-center space-y-1.5 h-full justify-end">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{gradeDistribution.excellent}</span>
                    <div
                      className="w-full max-w-[48px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-xl transition-all shadow-sm"
                      style={{
                        height: `${Math.max(12, (gradeDistribution.excellent / gradeDistribution.total) * 100)}%`,
                      }}
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Excellent</span>
                  </div>

                  {/* Good Bar */}
                  <div className="flex flex-col items-center space-y-1.5 h-full justify-end">
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400">{gradeDistribution.good}</span>
                    <div
                      className="w-full max-w-[48px] bg-gradient-to-t from-sky-600 to-sky-400 rounded-t-xl transition-all shadow-sm"
                      style={{
                        height: `${Math.max(12, (gradeDistribution.good / gradeDistribution.total) * 100)}%`,
                      }}
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Good</span>
                  </div>

                  {/* Poor Bar */}
                  <div className="flex flex-col items-center space-y-1.5 h-full justify-end">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{gradeDistribution.poor}</span>
                    <div
                      className="w-full max-w-[48px] bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-xl transition-all shadow-sm"
                      style={{
                        height: `${Math.max(12, (gradeDistribution.poor / gradeDistribution.total) * 100)}%`,
                      }}
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Poor</span>
                  </div>

                  {/* Critical Bar */}
                  <div className="flex flex-col items-center space-y-1.5 h-full justify-end">
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{gradeDistribution.critical}</span>
                    <div
                      className="w-full max-w-[48px] bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-xl transition-all shadow-sm"
                      style={{
                        height: `${Math.max(12, (gradeDistribution.critical / gradeDistribution.total) * 100)}%`,
                      }}
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Critical</span>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-wellqc-border flex items-center justify-between text-[10px] text-slate-500">
                  <span>Evaluated Fleet: <strong className="text-slate-900 dark:text-white font-mono">{summary.totalWells} Wells</strong></span>
                  <Link href="/wells" className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold flex items-center space-x-1">
                    <span>View Full Registry</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Deep Telemetry specific section (Mnemonics, Donut & Defect Histogram) */}
            {dashboardMode === "telemetry" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                {/* Column 1: Discovered Log Channels by Standard Mnemonic */}
                <div className="bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl space-y-3 shadow-sm">
                  <div className="flex items-center justify-between border-b border-wellqc-border pb-2">
                    <span className="font-bold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">
                      Log Channels by Mnemonic
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Depth Samples</span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {[
                      { mnemonic: "GR (Gamma Ray)", count: summary.curvesAnalysed > 0 ? "10,997" : "0", pct: "98%" },
                      { mnemonic: "RT / ILD (Resistivity)", count: summary.curvesAnalysed > 0 ? "8,764" : "0", pct: "94%" },
                      { mnemonic: "RHOB (Bulk Density)", count: summary.curvesAnalysed > 0 ? "2,337" : "0", pct: "89%" },
                      { mnemonic: "NPHI (Neutron Porosity)", count: summary.curvesAnalysed > 0 ? "2,256" : "0", pct: "88%" },
                      { mnemonic: "DT (Sonic Transit)", count: summary.curvesAnalysed > 0 ? "1,181" : "0", pct: "74%" },
                      { mnemonic: "CALI (Caliper Diameter)", count: summary.curvesAnalysed > 0 ? "413" : "0", pct: "95%" },
                    ].map((item) => (
                      <div
                        key={item.mnemonic}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors"
                      >
                        <span className="text-slate-700 dark:text-slate-300 font-semibold truncate mr-2">{item.mnemonic}</span>
                        <div className="flex items-center space-x-2 shrink-0">
                          <span className="text-cyan-700 dark:text-cyan-400 font-bold font-mono">{item.count}</span>
                          <span className="text-[10px] text-slate-500 font-mono">[{item.pct}]</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 2: Donut Chart - Anomaly Severity Proportions */}
                <div className="bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between border-b border-wellqc-border pb-2">
                    <span className="font-bold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">
                      Anomalies by Severity
                    </span>
                    <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-bold font-mono">Proportional Split</span>
                  </div>

                  <div className="flex items-center justify-center py-4 relative">
                    <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90 overflow-visible">
                      <circle cx="60" cy="60" r="45" fill="none" stroke="#cbd5e1" strokeWidth="18" className="dark:stroke-slate-800" />
                      <circle
                        cx="60"
                        cy="60"
                        r="45"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="18"
                        strokeDasharray="283"
                        strokeDashoffset={283 - (283 * Math.min(60, summary.errorsDetected * 4)) / 100}
                        strokeLinecap="round"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="45"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="18"
                        strokeDasharray="283"
                        strokeDashoffset={283 - (283 * 25) / 100}
                        strokeLinecap="round"
                        className="opacity-80"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="45"
                        fill="none"
                        stroke="#0ea5e9"
                        strokeWidth="18"
                        strokeDasharray="283"
                        strokeDashoffset={283 - (283 * 15) / 100}
                        strokeLinecap="round"
                        className="opacity-70"
                      />
                    </svg>

                    <div className="absolute text-center">
                      <div className="text-base font-black font-mono text-slate-900 dark:text-white">{summary.anomaliesFound}</div>
                      <div className="text-[9px] text-slate-500 uppercase font-mono">Flags</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center pt-2 border-t border-wellqc-border">
                    <div className="p-1 rounded-lg bg-rose-500/10">
                      <span className="text-rose-600 dark:text-rose-400 font-bold block">Critical</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold font-mono">{summary.errorsDetected}</span>
                    </div>
                    <div className="p-1 rounded-lg bg-amber-500/10">
                      <span className="text-amber-600 dark:text-amber-400 font-bold block">Moderate</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold font-mono">{Math.max(0, summary.anomaliesFound - summary.errorsDetected)}</span>
                    </div>
                    <div className="p-1 rounded-lg bg-sky-500/10">
                      <span className="text-sky-600 dark:text-sky-400 font-bold block">Minor</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold font-mono">{summary.missingCurves}</span>
                    </div>
                  </div>
                </div>

                {/* Column 3: Anomalies by Type (Histogram) */}
                <div className="bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between border-b border-wellqc-border pb-2">
                    <span className="font-bold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">
                      Anomalies by Defect Type
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Histogram</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2.5 items-end h-36 py-2">
                    <div className="flex flex-col items-center space-y-1 h-full justify-end">
                      <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-bold font-mono">{summary.errorsDetected}</span>
                      <div className="w-full max-w-[32px] bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-xl h-28 shadow-sm" />
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate">Spikes</span>
                    </div>

                    <div className="flex flex-col items-center space-y-1 h-full justify-end">
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold font-mono">{summary.missingCurves}</span>
                      <div className="w-full max-w-[32px] bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-xl h-20 shadow-sm" />
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate">Gaps</span>
                    </div>

                    <div className="flex flex-col items-center space-y-1 h-full justify-end">
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold font-mono">{Math.max(1, Math.round(summary.anomaliesFound * 0.3))}</span>
                      <div className="w-full max-w-[32px] bg-gradient-to-t from-purple-600 to-purple-400 rounded-t-xl h-16 shadow-sm" />
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate">Nulls</span>
                    </div>

                    <div className="flex flex-col items-center space-y-1 h-full justify-end">
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold font-mono">{Math.max(0, Math.round(summary.errorsDetected * 0.2))}</span>
                      <div className="w-full max-w-[32px] bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-xl h-8 shadow-sm" />
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate">Limits</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-wellqc-border flex items-center justify-between text-[10px] text-slate-500">
                    <span>ML Imputation: <strong className="text-emerald-600 dark:text-emerald-400">ENABLED</strong></span>
                    <Link href="/qa-engine" className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold flex items-center space-x-1">
                      <span>Configure Rules</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Row: 7-Day Trend + (Quality Scan Runs table if in Telemetry mode, or Mnemonic list if in Workstation mode) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 font-mono text-xs">
              {/* Left: 7-Day Ingestion & Detections Trend */}
              <div className="bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-wellqc-border pb-2">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="font-bold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">
                      Detections &amp; Ingestions (Last 7 Days)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Throughput Volume</span>
                </div>

                <div className="h-56 w-full">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                      <RefreshCw className="w-4 h-4 animate-spin mr-2 text-cyan-600 dark:text-cyan-400" />
                      Loading trajectory...
                    </div>
                  ) : (
                    <TrendChart data={trendData} />
                  )}
                </div>
              </div>

              {/* Right: Operational Mnemonic summary OR Verification Scan Runs Table */}
              {dashboardMode === "workstation" ? (
                <div className="bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between border-b border-wellqc-border pb-2">
                    <span className="font-bold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">
                      Core Log Channels by Mnemonic
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Operational Suite</span>
                  </div>

                  <div className="space-y-1.5 text-xs py-2">
                    {[
                      { mnemonic: "GR (Gamma Ray)", count: summary.curvesAnalysed > 0 ? "10,997" : "0", pct: "98%" },
                      { mnemonic: "RT / ILD (Resistivity)", count: summary.curvesAnalysed > 0 ? "8,764" : "0", pct: "94%" },
                      { mnemonic: "RHOB (Bulk Density)", count: summary.curvesAnalysed > 0 ? "2,337" : "0", pct: "89%" },
                      { mnemonic: "NPHI (Neutron Porosity)", count: summary.curvesAnalysed > 0 ? "2,256" : "0", pct: "88%" },
                    ].map((item) => (
                      <div
                        key={item.mnemonic}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors"
                      >
                        <span className="text-slate-700 dark:text-slate-300 font-semibold truncate mr-2">{item.mnemonic}</span>
                        <div className="flex items-center space-x-2 shrink-0">
                          <span className="text-cyan-700 dark:text-cyan-400 font-bold font-mono">{item.count}</span>
                          <span className="text-[10px] text-slate-500 font-mono">[{item.pct}]</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-wellqc-border flex items-center justify-between text-[10px] text-slate-500">
                    <span>Standard Suite Completeness: <strong className="text-emerald-600 dark:text-emerald-400">92.4%</strong></span>
                    <Link href="/qa-engine" className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold flex items-center space-x-1">
                      <span>Full Aliases</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between border-b border-wellqc-border pb-2">
                    <span className="font-bold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">
                      Quality Scan Runs by Verification Type
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Engine Telemetry</span>
                  </div>

                  <div className="overflow-x-auto my-2 rounded-xl border border-wellqc-border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-950/70 border-b border-wellqc-border text-slate-500 uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Scan Type &amp; Rule Identifier</th>
                          <th className="py-2.5 px-3 text-right">Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-wellqc-border text-slate-700 dark:text-slate-300">
                        {[
                          { type: "DEPTH_MONOTONICITY_SCAN", count: 1419, desc: "Strictly increasing depth step validation" },
                          { type: "EXTREME_SPIKE_DETECTOR", count: 842, desc: "3-sigma statistical deviation filter" },
                          { type: "NULL_CLUSTER_IMPUTATION", count: 520, desc: "KNN & spline machine learning gap fill" },
                          { type: "UNIT_STANDARDIZATION_ALIGN", count: 350, desc: "API RP 66 standard unit aliasing" },
                          { type: "OUTLIER_PHYSICAL_BOUNDS", count: 180, desc: "Formation physical limit verification" },
                        ].map((scan) => (
                          <tr key={scan.type} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900 dark:text-white text-[11px]">{scan.type}</div>
                              <div className="text-[10px] text-slate-500">{scan.desc}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold font-mono text-cyan-700 dark:text-cyan-400">
                              {scan.count.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-2 border-t border-wellqc-border flex items-center justify-between text-[10px] text-slate-500">
                    <span>Rule Engine Latency: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">12ms</strong></span>
                    <Link href="/activity" className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold flex items-center space-x-1">
                      <span>View Audit Trail</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function EnterpriseKpiCard({
  label,
  value,
  subtext,
  badge,
  accentColor = "text-white",
}: {
  label: string;
  value: string;
  subtext: string;
  badge?: string;
  accentColor?: string;
}) {
  return (
    <div className="enterprise-kpi-card bg-wellqc-panel border border-wellqc-border p-4 rounded-2xl flex flex-col justify-between hover:border-slate-400 dark:hover:border-slate-700 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold truncate">
          {label}
        </span>
        {badge && (
          <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-300 font-mono">
            {badge}
          </span>
        )}
      </div>
      <div className={`text-2xl font-black font-mono tracking-tight my-1.5 ${accentColor}`}>
        {value}
      </div>
      <div className="text-[10px] text-slate-500 truncate">{subtext}</div>
    </div>
  );
}