"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";
import { GitCompare, RefreshCw, UploadCloud } from "lucide-react";
import { WellLogViewer } from "@/components/well-log/log-viewer";
import { WellDetailResponse, WellListItem } from "@/lib/api-types";

export default function ComparisonPage() {
  const [wells, setWells] = useState<WellListItem[]>([]);
  const [well1, setWell1] = useState("");
  const [well2, setWell2] = useState("");
  const [detail1, setDetail1] = useState<WellDetailResponse | null>(null);
  const [detail2, setDetail2] = useState<WellDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadWells() {
      try {
        const response = await fetch("/api/wells", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load wells.");
        }

        const committedWells: WellListItem[] = (data.wells || []).filter((well: WellListItem) => well.latestLasFileId);
        if (!cancelled) {
          setWells(committedWells);
          setWell1((current) => current || committedWells[0]?.id || "");
          setWell2((current) => current || committedWells[1]?.id || committedWells[0]?.id || "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load wells.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadWells();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!well1) {
      setDetail1(null);
      return;
    }
    loadDetail(well1, setDetail1, setError);
  }, [well1]);

  useEffect(() => {
    if (!well2) {
      setDetail2(null);
      return;
    }
    loadDetail(well2, setDetail2, setError);
  }, [well2]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-wellqc-panel/60 border border-wellqc-border p-5 rounded-2xl">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-blue-500/20 text-cyan-300 border border-cyan-500/40">
                Bonus Feature - Well-to-Well Log Comparison
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              Side-by-Side Petrophysical Curve Log Comparison
            </h1>
            <p className="text-xs text-wellqc-muted font-mono mt-0.5">
              Compare curve response and QA scores between committed LAS-backed wells.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-xs font-mono">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="p-8 bg-wellqc-panel border border-wellqc-border rounded-2xl text-center text-cyan-300 text-xs font-mono flex items-center justify-center">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Loading committed wells...
          </div>
        ) : wells.length < 2 ? (
          <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-8 text-center space-y-3">
            <GitCompare className="w-8 h-8 text-cyan-400 mx-auto" />
            <h2 className="text-base font-bold text-white">Need two committed wells to compare</h2>
            <p className="text-xs text-wellqc-muted font-mono">
              Upload and commit at least two LAS files before using the comparison workspace.
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload LAS</span>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <WellSelector
                label="Select Primary Well (Offset A):"
                value={well1}
                onChange={setWell1}
                wells={wells}
                accent="text-cyan-400"
              />
              <WellSelector
                label="Select Comparison Well (Offset B):"
                value={well2}
                onChange={setWell2}
                wells={wells}
                accent="text-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ComparisonPane detail={detail1} accent="cyan" />
              <ComparisonPane detail={detail2} accent="amber" />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function WellSelector({
  label,
  value,
  onChange,
  wells,
  accent,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wells: WellListItem[];
  accent: string;
}) {
  return (
    <div className="bg-wellqc-panel border border-wellqc-border p-4 rounded-xl space-y-2">
      <label className={`block text-xs font-mono font-bold ${accent}`}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-wellqc-card border border-wellqc-border rounded-lg p-2.5 text-xs text-white font-mono"
      >
        {wells.map((well) => (
          <option key={well.id} value={well.id}>
            {well.name} - Score: {well.qualityScore}
          </option>
        ))}
      </select>
    </div>
  );
}

function ComparisonPane({ detail, accent }: { detail: WellDetailResponse | null; accent: "cyan" | "amber" }) {
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
      <div className={`p-3 bg-wellqc-card border ${border} rounded-xl flex items-center justify-between font-mono text-xs`}>
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
  setDetail: (detail: WellDetailResponse) => void,
  setError: (error: string) => void,
) {
  try {
    const response = await fetch(`/api/wells/${wellId}`, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to load well detail.");
    }

    setDetail(data);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unable to load well detail.");
  }
}
