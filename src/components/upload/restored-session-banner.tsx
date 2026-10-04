import { CheckCircle2, RotateCcw, X } from "lucide-react";

interface RestoredSessionBannerProps {
  fileName: string;
  onClearSession: () => void;
  onDismiss: () => void;
}

export function RestoredSessionBanner({
  fileName,
  onClearSession,
  onDismiss,
}: RestoredSessionBannerProps) {
  return (
    <div className="bg-cyan-950/40 border border-cyan-500/40 rounded-2xl p-4 flex items-center justify-between gap-4 animate-in fade-in">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
            <span>Session Restored from Local Storage</span>
            <span className="text-cyan-300">({fileName})</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            Your uploaded well curves, quality scores, and interpretation were preserved across page refresh.
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2 shrink-0">
        <button
          type="button"
          onClick={onClearSession}
          className="px-3 py-1.5 rounded-lg bg-wellqc-card hover:bg-wellqc-panel border border-wellqc-border hover:border-red-500/50 text-slate-300 hover:text-red-300 font-mono text-xs transition-all flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear &amp; Start New</span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1.5 rounded-lg hover:bg-wellqc-card text-slate-400 hover:text-white"
          title="Dismiss message"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
