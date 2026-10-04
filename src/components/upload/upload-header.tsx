import Link from "next/link";
import { Database, RotateCcw } from "lucide-react";

interface UploadHeaderProps {
  hasActiveSession: boolean;
  onClearSession: () => void;
}

export function UploadHeader({
  hasActiveSession,
  onClearSession,
}: UploadHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-wellqc-border">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-mono text-white flex items-center space-x-2">
          <span>Upload &amp; Audit LAS Files</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-sans">
            Automated QA
          </span>
        </h1>
        <p className="text-xs text-wellqc-muted font-mono mt-1">
          Validate LAS 2.0/3.0 formats, map mnemonics, detect physical outliers, and impute missing intervals.
        </p>
      </div>

      <div className="flex items-center gap-3">
        {hasActiveSession && (
          <button
            type="button"
            onClick={onClearSession}
            className="px-3.5 py-2 rounded-xl bg-wellqc-card hover:bg-wellqc-panel border border-wellqc-border hover:border-red-500/40 text-slate-300 hover:text-red-300 font-mono text-xs transition-all flex items-center gap-1.5"
            title="Start a fresh upload session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Upload</span>
          </button>
        )}
        <Link
          href="/wells"
          className="px-3.5 py-2 rounded-xl bg-wellqc-card hover:bg-wellqc-panel border border-wellqc-border text-slate-300 hover:text-white font-mono text-xs transition-all flex items-center gap-2"
        >
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span>Well Master Index</span>
        </Link>
      </div>
    </header>
  );
}
