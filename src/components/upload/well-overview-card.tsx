import Link from "next/link";
import { CheckCircle2, Database, RefreshCw } from "lucide-react";
import { ParsedLAS } from "@/lib/las/parser";
import { QualityAnalysisResult } from "@/lib/las/quality-engine";

interface WellOverviewCardProps {
  parsedLAS: ParsedLAS;
  qaResult: QualityAnalysisResult;
  fileName: string;
  isSaving: boolean;
  savedSuccess: boolean;
  saveError: string;
  savedWell: { id: string; name: string; qualityScore: number } | null;
  onCommitToDatabase: () => void;
}

export function WellOverviewCard({
  parsedLAS,
  qaResult,
  fileName,
  isSaving,
  savedSuccess,
  saveError,
  savedWell,
  onCommitToDatabase,
}: WellOverviewCardProps) {
  return (
    <div className="space-y-4">
      <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xl">
        {/* Well Identity Metadata */}
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              {parsedLAS.wellInfo.wellName || fileName}
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold tracking-wide border shrink-0 ${
                qaResult.qualityGrade === "EXCELLENT"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : qaResult.qualityGrade === "GOOD"
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                  : qaResult.qualityGrade === "POOR"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-400"
              }`}
            >
              {qaResult.qualityGrade} QUALITY
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-300 font-mono">
            <span>Company: <span className="text-white">{parsedLAS.wellInfo.company || "Not provided in file"}</span></span>
            <span className="text-slate-600">|</span>
            <span>Field: <span className="text-white">{parsedLAS.wellInfo.field || "Not provided in file"}</span></span>
            <span className="text-slate-600">|</span>
            <span>API: <span className="text-white">{parsedLAS.wellInfo.apiUwi || "Not provided in file"}</span></span>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Depth Interval: {parsedLAS.wellInfo.startDepth} – {parsedLAS.wellInfo.stopDepth} {parsedLAS.wellInfo.depthUnit} (Step: {parsedLAS.wellInfo.step})
          </p>
        </div>

        {/* Right Side: Score Box & Upload Action */}
        <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
          <div className="px-8 py-3.5 rounded-2xl bg-wellqc-card border border-wellqc-border flex flex-col items-center justify-center min-w-[220px] shadow-lg">
            <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-widest">
              WELL QUALITY SCORE
            </span>
            <span className="text-3xl sm:text-4xl font-extrabold font-mono text-amber-400 mt-1 tracking-tight">
              {qaResult.overallScore} / 100
            </span>
          </div>

          <button
            type="button"
            onClick={onCommitToDatabase}
            disabled={isSaving}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-60 cursor-pointer"
            title="Save and index this well in the WellQC database"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            <span>{isSaving ? "Saving to DB..." : savedSuccess ? "Saved to Database ✓" : "Upload to Database"}</span>
          </button>
        </div>
      </div>

      {saveError && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 font-mono">
          {saveError}
        </div>
      )}

      {savedWell && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3 text-xs font-mono text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>
              Committed to database as <strong>{savedWell.name}</strong> (Audit Score: {savedWell.qualityScore}/100)
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/wells/${savedWell.id}`}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-mono font-bold text-xs hover:bg-emerald-400 transition-all"
            >
              View Well Log →
            </Link>
            <Link
              href={`/wells?highlight=${savedWell.id}`}
              className="px-3 py-1.5 rounded-lg bg-wellqc-card border border-wellqc-border text-cyan-300 font-mono text-xs hover:border-cyan-400 transition-all"
            >
              Manage Wells
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
