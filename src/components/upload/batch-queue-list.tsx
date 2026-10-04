import { QueuedLASFile } from "@/types/upload";
import { Database, RefreshCw, X } from "lucide-react";

interface BatchQueueListProps {
  uploadQueue: QueuedLASFile[];
  isSaving: boolean;
  onCommitAll: () => void;
  onLoadFile: (file: QueuedLASFile) => void;
  onRemoveFile: (id: string) => void;
}

export function BatchQueueList({
  uploadQueue,
  isSaving,
  onCommitAll,
  onLoadFile,
  onRemoveFile,
}: BatchQueueListProps) {
  if (uploadQueue.length === 0) return null;

  return (
    <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">Batch Upload Queue</h2>
          <p className="text-[11px] text-wellqc-muted font-mono">
            {uploadQueue.length} validated file{uploadQueue.length === 1 ? "" : "s"}. Files commit one at a time to preserve every result.
          </p>
        </div>
        <button
          onClick={onCommitAll}
          disabled={isSaving || uploadQueue.every((file) => file.status === "saved")}
          className="flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          <span>{isSaving ? "Committing queue..." : "Commit all to database"}</span>
        </button>
      </div>
      <div className="divide-y divide-wellqc-border border border-wellqc-border rounded-lg overflow-hidden">
        {uploadQueue.map((file) => (
          <div key={file.id} className="flex items-center gap-3 px-3 py-2 bg-wellqc-card/40">
            <button
              onClick={() => onLoadFile(file)}
              className="min-w-0 flex-1 text-left hover:text-cyan-300"
            >
              <span className="block truncate text-xs font-mono font-bold text-white">{file.name}</span>
              <span className="text-[10px] text-wellqc-muted">
                {file.parsed.wellInfo.wellName} · {file.qa.overallScore}/100
              </span>
            </button>
            <span
              className={`text-[10px] font-mono font-bold ${
                file.status === "saved"
                  ? "text-emerald-400"
                  : file.status === "error"
                  ? "text-red-300"
                  : file.status === "saving"
                  ? "text-cyan-300"
                  : "text-slate-400"
              }`}
            >
              {file.status === "saved"
                ? "SAVED"
                : file.status === "saving"
                ? "SAVING"
                : file.status === "error"
                ? "FAILED"
                : "READY"}
            </span>
            <button
              onClick={() => onRemoveFile(file.id)}
              disabled={isSaving}
              className="p-1 text-slate-500 hover:text-red-300 disabled:opacity-40"
              aria-label={`Remove ${file.name}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
