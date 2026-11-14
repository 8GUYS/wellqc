/**
 * useUploadProgress — React hook for real-time SSE batch ingestion progress.
 *
 * Usage:
 *   const { submit, jobs, reset } = useUploadProgress();
 *
 *   // 1. Call submit() with an array of { content, fileName } objects.
 *   //    It POSTs to /api/las/batch, gets a jobId back, then opens an
 *   //    EventSource to /api/las/job/{jobId}/stream.
 *
 *   // 2. `jobs` is a Map<fileName, FileProgress> that updates in real-time
 *   //    as SSE events arrive. Render it as a progress list in the UI.
 *
 * CE1-31 · Sprint 9 · Nov 2026
 */

"use client";

import { useCallback, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type FileStatus =
  | "queued"
  | "processing"
  | "done"
  | "error"
  | "limit_hit";

export interface FileProgress {
  fileName:    string;
  index:       number;
  total:       number;
  status:      FileStatus;
  wellId?:     string;
  wellName?:   string;
  overallScore?: number;
  qualityGrade?: string;
  error?:      string;
  limitHit?:   boolean;
}

export interface BatchFile {
  content:  string;
  fileName: string;
}

export type BatchStatus = "idle" | "submitting" | "streaming" | "complete" | "error";

// ── Hook ───────────────────────────────────────────────────────────────────

export function useUploadProgress() {
  const [status, setStatus]       = useState<BatchStatus>("idle");
  const [files, setFiles]         = useState<Map<string, FileProgress>>(new Map());
  const [batchError, setBatchError] = useState<string | null>(null);
  const esRef                     = useRef<EventSource | null>(null);

  /** Internal: update one file's progress record. */
  const _updateFile = useCallback((key: string, patch: Partial<FileProgress>) => {
    setFiles(prev => {
      const next = new Map(prev);
      const existing = next.get(key) ?? {
        fileName: key, index: 0, total: 0, status: "queued" as FileStatus,
      };
      next.set(key, { ...existing, ...patch });
      return next;
    });
  }, []);

  /** Close any open EventSource. */
  const _closeStream = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  /**
   * submit() — POST files to /api/las/batch then open the SSE stream.
   * Returns the jobId on success, throws on network error.
   */
  const submit = useCallback(async (batchFiles: BatchFile[]): Promise<string> => {
    _closeStream();
    setStatus("submitting");
    setBatchError(null);

    // Seed the files map with "queued" state for every file
    const initial = new Map<string, FileProgress>();
    batchFiles.forEach((f, i) => {
      initial.set(f.fileName, {
        fileName: f.fileName,
        index:    i + 1,
        total:    batchFiles.length,
        status:   "queued",
      });
    });
    setFiles(initial);

    // ── 1. POST to /api/las/batch ────────────────────────────────────────
    let jobId: string;
    try {
      const res = await fetch("/api/las/batch", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ files: batchFiles }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Batch submit failed");
      }
      const data = await res.json();
      jobId = data.jobId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus("error");
      setBatchError(msg);
      throw err;
    }

    // ── 2. Open SSE stream ───────────────────────────────────────────────
    setStatus("streaming");

    const es = new EventSource(`/api/las/job/${jobId}/stream`);
    esRef.current = es;

    es.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as Record<string, unknown>;
        const type  = event.type as string;
        const fileName = (event.fileName as string) ?? "";

        if (type === "file_start") {
          _updateFile(fileName, { status: "processing", index: event.index as number, total: event.total as number });
        } else if (type === "file_done") {
          _updateFile(fileName, {
            status:       "done",
            wellId:       event.wellId   as string | undefined,
            wellName:     event.wellName as string | undefined,
            overallScore: event.overallScore as number | undefined,
            qualityGrade: event.qualityGrade as string | undefined,
          });
        } else if (type === "file_error") {
          _updateFile(fileName, {
            status:   event.limitHit ? "limit_hit" : "error",
            error:    event.error as string | undefined,
            limitHit: event.limitHit as boolean | undefined,
          });
        } else if (type === "batch_complete") {
          setStatus("complete");
          _closeStream();
        }
      } catch {
        // malformed event — ignore
      }
    };

    es.addEventListener("done", () => {
      setStatus("complete");
      _closeStream();
    });

    es.onerror = () => {
      // EventSource auto-reconnects on transient errors; only mark as error
      // if it's already complete (the server closed the stream intentionally).
      if (status === "streaming") {
        setStatus("error");
        setBatchError("Connection to upload stream lost.");
      }
      _closeStream();
    };

    return jobId;
  }, [_closeStream, _updateFile, status]);

  /** Reset state — call after the user dismisses the progress panel. */
  const reset = useCallback(() => {
    _closeStream();
    setStatus("idle");
    setFiles(new Map());
    setBatchError(null);
  }, [_closeStream]);

  return {
    submit,
    reset,
    status,
    files,          // Map<fileName, FileProgress>
    batchError,
    isIdle:       status === "idle",
    isSubmitting: status === "submitting",
    isStreaming:  status === "streaming",
    isComplete:   status === "complete",
    isError:      status === "error",
  };
}
