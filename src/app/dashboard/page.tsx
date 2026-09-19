"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";
import { DashboardSummary } from "@/lib/api-types";
import {
  Database,
  UploadCloud,
  Award,
  Activity,
  AlertTriangle,
  FileQuestion,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  ArrowUpRight,
  ChevronRight,
  Layers,
  MapPin,
  Clock,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

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
  const [error, setError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState<{ status: string; plan?: string; ref?: string } | null>(null);

  useEffect(() => {
    // Check for payment callback params in URL
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const payment = urlParams.get("payment");
      if (payment === "success") {
        setPaymentNotice({
          status: "success",
          plan: urlParams.get("plan") || "Pro Petrophysicist Plan",
          ref: urlParams.get("reference") || undefined,
        });
      } else if (payment === "failed" || payment === "error") {
        setPaymentNotice({
          status: "failed",
          plan: urlParams.get("message") || "Payment processing could not be completed.",
        });
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load dashboard data.");
        }

        if (!cancelled) {
          setSummary(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load dashboard data.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasUploadedData = summary.totalWells > 0 || summary.lasFilesUploaded > 0;
  const trendData = summary.trend.length > 0 ? summary.trend : EMPTY_SUMMARY.trend;

  return (
    <AppShell>
      <div className="space-y-6">
        {paymentNotice && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300 ${
              paymentNotice.status === "success"
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200"
                : "bg-rose-500/10 border-rose-500/40 text-rose-200"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  paymentNotice.status === "success"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/20 text-rose-400"
                }`}
              >
                {paymentNotice.status === "success" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="text-sm font-bold text-white">
                  {paymentNotice.status === "success"
                    ? `Payment Successful! Subscription Upgraded to PRO (${paymentNotice.plan})`
                    : "Payment Incomplete or Cancelled"}
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  {paymentNotice.status === "success"
                    ? `Unlimited LAS file audits & KNN imputation enabled. ${paymentNotice.ref ? `Transaction Ref: ${paymentNotice.ref}` : ""}`
                    : paymentNotice.plan}
                </div>
              </div>
            </div>

            <button
              onClick={() => setPaymentNotice(null)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-wellqc-panel/60 border border-wellqc-border p-5 rounded-2xl">
          <div>
            <div className="flex items-center space-x-3">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                Database Telemetry
              </span>
              <span className="text-xs text-wellqc-muted font-mono">
                {isLoading ? "Loading uploaded wells..." : "Updated from committed LAS uploads"}
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              Petrophysical Quality Control Command Center
            </h1>
            <p className="text-xs text-wellqc-muted font-mono mt-0.5">
              Live QA metrics from wells you commit through the LAS ingestion workspace.
            </p>
          </div>

          <Link
            href="/upload"
            className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-xs shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02]"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload LAS Log File</span>
          </Link>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-xs font-mono">
            {error}
          </div>
        )}

        {!hasUploadedData && !isLoading && (
          <div className="bg-wellqc-panel border border-cyan-500/30 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">No committed LAS data yet</h2>
              <p className="text-xs text-wellqc-muted font-mono mt-1">
                Upload a LAS file, run validation, then click Commit Well to Database to populate this dashboard.
              </p>
            </div>
            <Link
              href="/upload"
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Start Upload</span>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Wells"
            value={summary.totalWells.toLocaleString()}
            detail={`${summary.uploadedToday} uploads today`}
            icon={<Database className="w-4 h-4 text-cyan-400" />}
          />
          <MetricCard
            title="LAS Files Uploaded"
            value={summary.lasFilesUploaded.toLocaleString()}
            detail="Committed validation runs"
            icon={<UploadCloud className="w-4 h-4 text-blue-400" />}
          />
          <MetricCard
            title="Avg Quality Score"
            value={`${summary.averageQualityScore} / 100`}
            detail={`Grade: ${summary.averageQualityGrade}`}
            icon={<Award className="w-4 h-4 text-emerald-400" />}
            valueClass={summary.averageQualityScore >= 90 ? "text-emerald-400" : "text-cyan-400"}
          />
          <MetricCard
            title="Curves Analysed"
            value={summary.curvesAnalysed.toLocaleString()}
            detail="Persisted curve channels"
            icon={<Layers className="w-4 h-4 text-purple-400" />}
          />
          <MetricCard
            title="Errors Detected"
            value={summary.errorsDetected.toLocaleString()}
            detail="Critical and warning flags"
            icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
            valueClass="text-amber-400"
          />
          <MetricCard
            title="Missing Curves"
            value={summary.missingCurves.toLocaleString()}
            detail="From committed QA reports"
            icon={<FileQuestion className="w-4 h-4 text-red-400" />}
            valueClass={summary.missingCurves > 0 ? "text-red-400" : "text-white"}
          />
          <MetricCard
            title="Anomalies Found"
            value={summary.anomaliesFound.toLocaleString()}
            detail="Spikes, gaps, units, values"
            icon={<Activity className="w-4 h-4 text-cyan-400" />}
            valueClass="text-cyan-400"
          />
          <MetricCard
            title="Data Cleaned Today"
            value={summary.cleanedTodayLabel}
            detail="Committed LAS volume"
            icon={<Sparkles className="w-4 h-4 text-emerald-400" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-wellqc-panel border border-wellqc-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-wellqc-border">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <span>Quality Trend & Ingestion Volume</span>
                </h3>
                <p className="text-xs text-wellqc-muted font-mono">
                  Seven-day view from committed LAS validation reports.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-blue-500/10 text-cyan-300 border border-cyan-500/30">
                Database
              </span>
            </div>

            <div className="h-72 w-full">
              {isLoading ? (
                <LoadingPanel label="Loading trend data" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#233252" />
                    <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: "#131b2e", borderColor: "#233252", fontSize: "12px" }} />
                    <Area type="monotone" dataKey="avgScore" name="Avg Quality Score" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#scoreColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-wellqc-panel border border-wellqc-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-wellqc-border">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Field Performance</span>
              </h3>
              <Link href="/wells" className="text-xs text-cyan-400 hover:underline font-mono">
                View Wells
              </Link>
            </div>

            <div className="space-y-3">
              {summary.fieldPerformance.length === 0 ? (
                <EmptyPanel label="No field performance yet" />
              ) : (
                summary.fieldPerformance.map((field) => (
                  <div key={field.field} className="p-3 rounded-lg bg-wellqc-card border border-wellqc-border space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{field.field}</span>
                      <span className={`font-mono font-bold ${field.score >= 90 ? "text-emerald-400" : field.score >= 75 ? "text-cyan-400" : "text-amber-400"}`}>
                        {field.score}/100
                      </span>
                    </div>
                    <div className="w-full bg-wellqc-dark h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${field.score >= 90 ? "bg-emerald-400" : field.score >= 75 ? "bg-cyan-400" : "bg-amber-400"}`}
                        style={{ width: `${field.score}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{field.wells} Wells</span>
                      <span className="uppercase">{field.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-wellqc-panel border border-wellqc-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-wellqc-border">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="text-base font-bold text-white">Problem Wells</h3>
              </div>
              <span className="text-xs text-red-400 font-mono font-bold">
                {summary.problemWells.length} flagged
              </span>
            </div>

            <div className="space-y-3">
              {summary.problemWells.length === 0 ? (
                <EmptyPanel label="No low-quality committed wells" />
              ) : (
                summary.problemWells.map((well) => (
                  <div key={well.id} className="p-3.5 rounded-xl bg-wellqc-card border border-red-500/20 hover:border-red-500/40 transition-all flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-100 font-mono">{well.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                          {well.grade}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">{well.issue}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-red-400 font-mono">{well.score}/100</div>
                      <Link
                        href={`/wells/${well.id}`}
                        className="text-[11px] text-cyan-400 hover:underline font-semibold flex items-center space-x-1 justify-end"
                      >
                        <span>Inspect</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-wellqc-panel border border-wellqc-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-wellqc-border">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Recent Activity Feed</h3>
              </div>
              <Link href="/activity" className="text-xs text-cyan-400 hover:underline font-mono">
                View Audit Trail
              </Link>
            </div>

            <div className="space-y-3 text-xs">
              {summary.recentActivity.length === 0 ? (
                <EmptyPanel label="No database activity yet" />
              ) : (
                summary.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-2.5 rounded-lg bg-wellqc-card/60 border border-wellqc-border">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5" />
                    <div className="flex-1">
                      <div className="font-semibold text-slate-200">
                        {activity.userName} ({activity.userRole}) {activity.action.replace(/_/g, " ").toLowerCase()}
                      </div>
                      <div className="text-wellqc-muted text-[11px] font-mono">
                        {activity.details} | {activity.timestamp}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon,
  valueClass = "text-white",
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="bg-wellqc-card border border-wellqc-border p-4 rounded-xl space-y-2 relative overflow-hidden group hover:border-cyan-500/50 transition-all">
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-xs font-mono uppercase tracking-wider">{title}</span>
        {icon}
      </div>
      <div className={`text-2xl font-black font-mono ${valueClass}`}>{value}</div>
      <div className="flex items-center space-x-1 text-[11px] text-emerald-400 font-mono">
        <ArrowUpRight className="w-3.5 h-3.5" />
        <span>{detail}</span>
      </div>
    </div>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="h-full rounded-xl bg-wellqc-card/60 border border-wellqc-border flex items-center justify-center text-xs text-cyan-300 font-mono">
      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
      {label}
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-xl bg-wellqc-card/60 border border-wellqc-border px-4 py-5 text-center text-xs text-wellqc-muted font-mono">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-2" />
      {label}
    </div>
  );
}
