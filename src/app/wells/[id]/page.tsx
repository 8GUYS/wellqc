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
} from "lucide-react";
import { WellLogViewer } from "@/components/well-log/log-viewer";

export default function WellDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<WellDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
            <span>Back to Well Master Index</span>
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
            <div className="bg-wellqc-panel border border-wellqc-border p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
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

              <div className="flex items-center space-x-3">
                <Link
                  href="/reports"
                  className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-wellqc-card border border-wellqc-border hover:border-cyan-500/50 text-cyan-300 font-semibold text-xs transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Open Reports</span>
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
              <div className="flex items-center space-x-2 text-xs font-bold text-cyan-300">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Petrophysical Summary</span>
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

                <WellLogViewer
                  wellName={well.name}
                  depthUnit={well.depthUnit || "FT"}
                  startDepth={detail.curvesData.depth[0] ?? 0}
                  stopDepth={detail.curvesData.depth[detail.curvesData.depth.length - 1] ?? well.tdFt}
                  curvesData={detail.curvesData}
                  anomalies={detail.anomalies || []}
                />
              </div>
            ) : (
              <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-8 text-center space-y-3">
                <Database className="w-8 h-8 text-cyan-400 mx-auto" />
                <h2 className="text-base font-bold text-white">No LAS curves committed for this well</h2>
                <p className="text-xs text-wellqc-muted font-mono">
                  Upload and validate a LAS file, then commit it to render curves and QA anomalies here.
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
