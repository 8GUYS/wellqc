"""Injects the SSE batch progress panel into upload/page.tsx."""
import re, sys

with open("src/app/upload/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# ── 1. Gate the spinner on batchStatus === "idle" ────────────────────────────
content = content.replace(
    "{isProcessing && (",
    '{isProcessing && batchStatus === "idle" && (',
    1,
)

# ── 2. Build the SSE panel string ─────────────────────────────────────────────
SSE_PANEL = r"""

        {/* Async SSE Batch Progress Panel (CE1-31) */}
        {(isStreaming || isBatchComplete) && batchFiles.size > 0 && (
          <div className="border border-cyan-500/40 rounded-2xl overflow-hidden bg-wellqc-panel">
            <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-500/20 bg-black/30">
              <div className="flex items-center gap-2">
                {isStreaming ? (
                  <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                ) : (
                  <Layers className="w-4 h-4 text-emerald-400" />
                )}
                <span className="text-sm font-bold text-white font-mono">
                  {isStreaming ? "Ingesting Batch\u2026" : "Batch Complete"}
                </span>
                <span className="text-xs text-cyan-300/60 font-mono">
                  {Array.from(batchFiles.values()).filter(f => f.status === "done").length}
                  /{batchFiles.size} files saved
                </span>
              </div>
              {isBatchComplete && (
                <button
                  onClick={resetBatch}
                  className="text-xs text-cyan-400 hover:text-white transition-colors font-mono"
                >
                  Dismiss
                </button>
              )}
            </div>
            <div className="divide-y divide-cyan-500/10">
              {Array.from(batchFiles.values()).map((f) => (
                <div key={f.fileName} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-5 flex-shrink-0">
                    {f.status === "queued"     && <div className="w-2 h-2 rounded-full bg-gray-500 mx-auto" />}
                    {f.status === "processing" && <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />}
                    {f.status === "done"       && <div className="w-2 h-2 rounded-full bg-emerald-400 mx-auto" />}
                    {f.status === "error"      && <div className="w-2 h-2 rounded-full bg-red-400 mx-auto" />}
                    {f.status === "limit_hit"  && <Lock className="w-4 h-4 text-amber-400" />}
                  </div>
                  <span className="flex-1 text-xs font-mono text-cyan-100/80 truncate">
                    {f.fileName}
                  </span>
                  <span className="text-xs font-mono flex-shrink-0">
                    {f.status === "queued"     && <span className="text-gray-500">Queued</span>}
                    {f.status === "processing" && <span className="text-cyan-400">Processing\u2026</span>}
                    {f.status === "done"       && (
                      <span className="text-emerald-400">
                        {f.qualityGrade ?? "\u2713"}{f.overallScore ? ` \u00b7 ${f.overallScore}%` : ""}
                      </span>
                    )}
                    {f.status === "error"      && (
                      <span className="text-red-400 max-w-[180px] truncate">{f.error}</span>
                    )}
                    {f.status === "limit_hit"  && (
                      <button
                        onClick={() => setUpgradeModalOpen(true)}
                        className="text-amber-400 hover:text-amber-200 underline"
                      >
                        Upgrade to Pro
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}"""

# ── 3. Insert SSE panel after the spinner block ───────────────────────────────
# The spinner block ends with: )}\n\n        {restoredFromStorage
ANCHOR = "        {restoredFromStorage && parsedLAS && ("
if ANCHOR in content:
    content = content.replace(ANCHOR, SSE_PANEL + "\n\n" + ANCHOR, 1)
    with open("src/app/upload/page.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: SSE panel injected")
else:
    print("ERROR: anchor not found")
    sys.exit(1)
