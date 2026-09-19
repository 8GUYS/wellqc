"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";
import { parseLASContent, ParsedLAS } from "@/lib/las/parser";
import { analyzeWellLogQuality, QualityAnalysisResult } from "@/lib/las/quality-engine";
import { generateAIAnalysis, AIAnalysisOutput } from "@/lib/las/ai-analyzer";
import { buildCleanedDataExport } from "@/lib/las/exporter";
import { LogViewer, LogViewerCurve } from "@/components/well-log/log-viewer";
import { CurveInventoryTable } from "@/components/well-log/curve-inventory-table";
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  Database,
  Download,
  RefreshCw,
  X,
  RotateCcw,
  Table,
  FileText,
  Activity,
  ShieldCheck,
} from "lucide-react";

type UploadStatus = "ready" | "saving" | "saved" | "error";

interface QueuedLASFile {
  id: string;
  name: string;
  content: string;
  parsed: ParsedLAS;
  qa: QualityAnalysisResult;
  ai: AIAnalysisOutput;
  status: UploadStatus;
  error?: string;
  savedWell?: { id: string; name: string; qualityScore: number };
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function getInitialUploadWorkspace(): {
  fileName: string;
  rawText: string;
  parsedLAS: ParsedLAS | null;
  qaResult: QualityAnalysisResult | null;
  aiOutput: AIAnalysisOutput | null;
  savedSuccess: boolean;
  savedWell: { id: string; name: string; qualityScore: number } | null;
  uploadQueue: QueuedLASFile[];
  restoredFromStorage: boolean;
} {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("wellqc_upload_workspace");
      if (saved) {
        const session = JSON.parse(saved);
        if (session && session.parsedLAS && session.qaResult) {
          return {
            fileName: session.fileName || "restored-well-log.las",
            rawText: session.rawText || "",
            parsedLAS: session.parsedLAS,
            qaResult: session.qaResult,
            aiOutput: session.aiOutput || null,
            savedSuccess: Boolean(session.savedSuccess),
            savedWell: session.savedWell || null,
            uploadQueue: Array.isArray(session.uploadQueue) ? session.uploadQueue : [],
            restoredFromStorage: true,
          };
        }
      }
    } catch (e) {
      console.warn("Could not restore upload session from localStorage", e);
    }
  }

  return {
    fileName: "",
    rawText: "",
    parsedLAS: null,
    qaResult: null,
    aiOutput: null,
    savedSuccess: false,
    savedWell: null,
    uploadQueue: [],
    restoredFromStorage: false,
  };
}

export default function LASUploadPage() {
  const [initialWorkspace] = useState(getInitialUploadWorkspace);

  const [dragActive, setDragActive] = useState(false);
  const [rawText, setRawText] = useState<string>(initialWorkspace.rawText);
  const [fileName, setFileName] = useState<string>(initialWorkspace.fileName);
  const [parsedLAS, setParsedLAS] = useState<ParsedLAS | null>(initialWorkspace.parsedLAS);
  const [qaResult, setQaResult] = useState<QualityAnalysisResult | null>(initialWorkspace.qaResult);
  const [aiOutput, setAiOutput] = useState<AIAnalysisOutput | null>(initialWorkspace.aiOutput);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(initialWorkspace.savedSuccess);
  const [saveError, setSaveError] = useState("");
  const [savedWell, setSavedWell] = useState<{ id: string; name: string; qualityScore: number } | null>(initialWorkspace.savedWell);
  const [uploadQueue, setUploadQueue] = useState<QueuedLASFile[]>(initialWorkspace.uploadQueue);
  const [limitReachedModal, setLimitReachedModal] = useState(false);
  const [restoredFromStorage, setRestoredFromStorage] = useState(initialWorkspace.restoredFromStorage);
  const [activeTab, setActiveTab] = useState<"curves" | "anomalies" | "headers" | "raw" | "viewer">("curves");

  // 2. Persist state to localStorage on changes
  useEffect(() => {
    if (!parsedLAS || !qaResult) return;

    try {
      const payload = {
        fileName,
        rawText: rawText.length > 2_000_000 ? "" : rawText,
        parsedLAS,
        qaResult,
        aiOutput,
        savedSuccess,
        savedWell,
        uploadQueue: uploadQueue.map((item) => ({
          ...item,
          content: item.content.length > 500_000 ? "" : item.content,
        })),
        updatedAt: Date.now(),
      };
      localStorage.setItem("wellqc_upload_workspace", JSON.stringify(payload));
    } catch (err) {
      console.warn("Storage quota exceeded or storage unavailable, falling back to lightweight payload", err);
      try {
        const minimal = {
          fileName,
          rawText: "",
          parsedLAS,
          qaResult,
          aiOutput,
          savedSuccess,
          savedWell,
          uploadQueue: [],
          updatedAt: Date.now(),
        };
        localStorage.setItem("wellqc_upload_workspace", JSON.stringify(minimal));
      } catch {}
    }
  }, [parsedLAS, qaResult, aiOutput, rawText, fileName, savedSuccess, savedWell, uploadQueue]);

  const handleClearSession = () => {
    try {
      localStorage.removeItem("wellqc_upload_workspace");
    } catch {}
    setRawText("");
    setFileName("");
    setParsedLAS(null);
    setQaResult(null);
    setAiOutput(null);
    setSavedSuccess(false);
    setSavedWell(null);
    setUploadQueue([]);
    setSaveError("");
    setRestoredFromStorage(false);
  };

  const checkFreemiumLimit = async () => {
    // Payment / Freemium check limit commented out for unrestricted testing
    /*
    try {
      const response = await fetch("/api/las/check", { method: "POST" });
      const data = await response.json();
      if (response.status === 402 || data.limitReached) {
        setLimitReachedModal(true);
        return false;
      }
      return true;
    } catch {
      return true;
    }
    */
    return true;
  };



  const loadQueuedFile = (file: QueuedLASFile) => {
    setRawText(file.content);
    setFileName(file.name);
    setParsedLAS(file.parsed);
    setQaResult(file.qa);
    setAiOutput(file.ai);
    setSavedSuccess(file.status === "saved");
    setSaveError(file.error || "");
    setSavedWell(file.savedWell || null);
  };

  const queueFiles = async (files: File[]) => {
    const lasFiles = files.filter((file) => /\.(las|txt)$/i.test(file.name) && file.size <= 20 * 1024 * 1024);
    if (lasFiles.length === 0) {
      setSaveError("Choose LAS or TXT files no larger than 20 MB.");
      return;
    }

    const allowed = await checkFreemiumLimit();
    if (!allowed) return;

    setIsProcessing(true);
    setSaveError("");
    try {
      const queued = await Promise.all(lasFiles.map(async (file): Promise<QueuedLASFile | null> => {
        try {
          const content = await file.text();
          const parsed = parseLASContent(content);
          const qa = analyzeWellLogQuality(parsed);
          const ai = generateAIAnalysis(parsed, qa);
          return { id: `${file.name}-${file.lastModified}-${file.size}`, name: file.name, content, parsed, qa, ai, status: "ready" };
        } catch {
          return null;
        }
      }));
      const validFiles = queued.filter((file): file is QueuedLASFile => file !== null);
      if (validFiles.length === 0) {
        setSaveError("None of the selected files could be read as LAS data.");
        return;
      }
      setUploadQueue(validFiles);
      loadQueuedFile(validFiles[0]);
      if (validFiles.length !== files.length) {
        setSaveError(`${files.length - validFiles.length} file(s) were skipped because they are invalid, unsupported, or over 20 MB.`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    void queueFiles(files);
    e.target.value = "";
  };


  const handleCleanedDataDownload = (format: "las" | "csv") => {
    if (!parsedLAS || !qaResult) return;

    const cleanedExport = buildCleanedDataExport(parsedLAS, qaResult);

    if (format === "las") {
      downloadTextFile(
        `${cleanedExport.fileStem}_cleaned.las`,
        cleanedExport.lasContent,
        "application/octet-stream;charset=utf-8",
      );
      return;
    }

    downloadTextFile(`${cleanedExport.fileStem}_cleaned.csv`, cleanedExport.csvContent, "text/csv;charset=utf-8");
  };

  const commitFile = async (name: string, content: string) => {
    const response = await fetch("/api/las", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: name, content }),
      });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to commit this LAS file.");
    }
    return result;
  };

  const handleCommitToDatabase = async () => {
    if (!rawText || !parsedLAS || !qaResult) return;

    setIsSaving(true);
    setSaveError("");
    try {
      const result = await commitFile(fileName, rawText);
      setSavedSuccess(true);
      setSavedWell(result.well);
      setUploadQueue((files) => files.map((file) => file.name === fileName
        ? { ...file, status: "saved", savedWell: result.well, error: undefined }
        : file));

      // Cache latest committed well so Well Management can highlight and render curves instantly
      try {
        localStorage.setItem(
          "wellqc_latest_committed_well",
          JSON.stringify({
            wellId: result.well.id,
            wellName: result.well.name,
            qualityScore: result.well.qualityScore,
            curveSummaries: qaResult.curveSummaries,
            timestamp: Date.now(),
          }),
        );
      } catch {}
    } catch (error) {
      setSavedSuccess(false);
      setSaveError(error instanceof Error ? error.message : "Unable to commit this LAS file.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCommitAll = async () => {
    const pendingFiles = uploadQueue.filter((file) => file.status === "ready" || file.status === "error");
    if (pendingFiles.length === 0) return;

    setIsSaving(true);
    setSaveError("");
    for (const file of pendingFiles) {
      setUploadQueue((files) => files.map((item) => item.id === file.id ? { ...item, status: "saving", error: undefined } : item));
      try {
        const result = await commitFile(file.name, file.content);
        const savedFile = { ...file, status: "saved" as const, savedWell: result.well, error: undefined };
        setUploadQueue((files) => files.map((item) => item.id === file.id ? savedFile : item));
        loadQueuedFile(savedFile);

        try {
          localStorage.setItem(
            "wellqc_latest_committed_well",
            JSON.stringify({
              wellId: result.well.id,
              wellName: result.well.name,
              qualityScore: result.well.qualityScore,
              curveSummaries: file.qa.curveSummaries,
              timestamp: Date.now(),
            }),
          );
        } catch {}
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to commit this LAS file.";
        setUploadQueue((files) => files.map((item) => item.id === file.id ? { ...item, status: "error", error: message } : item));
      }
    }
    setIsSaving(false);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-wellqc-panel/60 border border-wellqc-border p-5 rounded-2xl">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                Module 03 — Ingestion & QA
              </span>
              {parsedLAS && (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Log Active</span>
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              LAS File Upload & Quality Ingestion Workspace
            </h1>
            <p className="text-xs text-wellqc-muted font-mono">
              Drag & drop raw LAS 2.0 / 3.0 well log files for real-time header extraction, curve standardisation, and AI anomaly detection.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {parsedLAS && (
              <button
                type="button"
                onClick={handleClearSession}
                className="px-3.5 py-2 rounded-xl bg-wellqc-card hover:bg-wellqc-panel border border-wellqc-border hover:border-red-500/50 text-slate-300 hover:text-red-300 font-mono text-xs transition-all flex items-center gap-2"
                title="Clear current log and load another file"
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

        {/* Drag & Drop Upload Zone */}
        <section
          aria-label="Upload Zone"
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            void queueFiles(Array.from(e.dataTransfer.files || []));
          }}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
            dragActive
              ? "border-cyan-400 bg-cyan-500/10 shadow-2xl shadow-cyan-500/20"
              : "border-wellqc-border hover:border-cyan-500/40 bg-wellqc-panel/40"
          }`}
        >
          <input
            type="file"
            accept=".las,.txt"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            id="las-file-input"
          />
          <label htmlFor="las-file-input" className="cursor-pointer block space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 shadow-inner">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <span className="text-base font-bold text-white block">Drag and drop raw LAS files here, or click to browse</span>
              <p className="text-xs text-wellqc-muted font-mono">
                Supports LAS 2.0 &amp; 3.0 ASCII well log files (.las, .txt up to 20MB per file)
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <span className="px-2.5 py-1 rounded bg-slate-900 border border-wellqc-border text-[11px] font-mono text-slate-300">
                LAS 2.0 / 3.0
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-900 border border-wellqc-border text-[11px] font-mono text-slate-300">
                Batch Ingestion
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-900 border border-wellqc-border text-[11px] font-mono text-slate-300">
                Mnemonic Mapping
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-900 border border-wellqc-border text-[11px] font-mono text-slate-300">
                AI QA Engine
              </span>
            </div>
          </label>
        </section>

        {/* Live Processing Indicator */}
        {isProcessing && (
          <div className="p-6 bg-wellqc-panel border border-cyan-500/40 rounded-2xl text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            <div className="text-sm font-bold text-white font-mono">Extracting LAS Headers & Executing Petrophysical QA Rules...</div>
          </div>
        )}

        {uploadQueue.length > 0 && !isProcessing && (
          <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">Batch Upload Queue</h2>
                <p className="text-[11px] text-wellqc-muted font-mono">{uploadQueue.length} validated file{uploadQueue.length === 1 ? "" : "s"}. Files commit one at a time to preserve every result.</p>
              </div>
              <button
                onClick={handleCommitAll}
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
                  <button onClick={() => loadQueuedFile(file)} className="min-w-0 flex-1 text-left hover:text-cyan-300">
                    <span className="block truncate text-xs font-mono font-bold text-white">{file.name}</span>
                    <span className="text-[10px] text-wellqc-muted">{file.parsed.wellInfo.wellName} · {file.qa.overallScore}/100</span>
                  </button>
                  <span className={`text-[10px] font-mono font-bold ${file.status === "saved" ? "text-emerald-400" : file.status === "error" ? "text-red-300" : file.status === "saving" ? "text-cyan-300" : "text-slate-400"}`}>
                    {file.status === "saved" ? "SAVED" : file.status === "saving" ? "SAVING" : file.status === "error" ? "FAILED" : "READY"}
                  </span>
                  <button
                    onClick={() => setUploadQueue((files) => files.filter((item) => item.id !== file.id))}
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
        )}

        {/* Restored Session Banner */}
        {restoredFromStorage && parsedLAS && (
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
                onClick={handleClearSession}
                className="px-3 py-1.5 rounded-lg bg-wellqc-card hover:bg-wellqc-panel border border-wellqc-border hover:border-red-500/50 text-slate-300 hover:text-red-300 font-mono text-xs transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear &amp; Start New</span>
              </button>
              <button
                type="button"
                onClick={() => setRestoredFromStorage(false)}
                className="p-1.5 rounded-lg hover:bg-wellqc-card text-slate-400 hover:text-white"
                title="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* PARSED RESULTS WORKSPACE */}
        {parsedLAS && qaResult && aiOutput && !isProcessing && (
          <main aria-label="Ingestion Results Workspace" className="space-y-6">
            {/* 1. Well Overview & Actions Bar */}
            <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Well Identity Metadata */}
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`w-3 h-3 rounded-full shrink-0 ${
                      qaResult.overallScore >= 75 ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-amber-400 shadow-sm shadow-amber-400/50"
                    }`}
                  />
                  <h2 className="text-xl sm:text-2xl font-black text-white font-mono truncate">
                    {parsedLAS.wellInfo.wellName || fileName}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold shrink-0 ${
                      qaResult.qualityGrade === "EXCELLENT"
                        ? "badge-excellent"
                        : qaResult.qualityGrade === "GOOD"
                        ? "badge-good"
                        : qaResult.qualityGrade === "POOR"
                        ? "badge-poor"
                        : "badge-critical"
                    }`}
                  >
                    {qaResult.qualityGrade} QUALITY
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 font-mono">
                  <span>
                    <strong className="text-slate-400">API/UWI:</strong> {parsedLAS.wellInfo.apiUwi || "N/A"}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>
                    <strong className="text-slate-400">Operator:</strong> {parsedLAS.wellInfo.company || "N/A"}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>
                    <strong className="text-slate-400">Field:</strong> {parsedLAS.wellInfo.field || "N/A"}
                  </span>
                </div>
                <p className="text-xs text-wellqc-muted font-mono">
                  Interval: {parsedLAS.wellInfo.startDepth} – {parsedLAS.wellInfo.stopDepth} {parsedLAS.wellInfo.depthUnit} (Step: {parsedLAS.wellInfo.step}) • {parsedLAS.totalPoints.toLocaleString()} depth records
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCommitToDatabase}
                  disabled={savedSuccess || isSaving}
                  className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-60"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  <span>{isSaving ? "Saving..." : savedSuccess ? "Saved to Database ✓" : "Commit to Database"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCleanedDataDownload("las")}
                  className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Cleaned LAS</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCleanedDataDownload("csv")}
                  className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-wellqc-card hover:bg-cyan-500/20 border border-wellqc-border hover:border-cyan-500/50 text-cyan-300 font-bold text-xs font-mono transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Cleaned CSV</span>
                </button>
              </div>
            </div>

            {/* Error Message if Commit Failed */}
            {saveError && (
              <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 font-mono">
                {saveError}
              </div>
            )}

            {/* Success State Banner after Commit */}
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

            {/* 2. Key QA Health Metrics KPI Cards (Equal Height & Aligned Grid) */}
            <section aria-label="Quality Metrics KPI Cards" className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-wellqc-panel border border-wellqc-border rounded-xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-wellqc-muted font-bold">Overall Score</span>
                <div
                  className={`text-3xl font-black font-mono my-1 ${
                    qaResult.overallScore >= 90
                      ? "text-emerald-400"
                      : qaResult.overallScore >= 75
                      ? "text-cyan-400"
                      : qaResult.overallScore >= 50
                      ? "text-amber-400"
                      : "text-red-400"
                  }`}
                >
                  {qaResult.overallScore}
                  <span className="text-sm font-normal text-slate-500">/100</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">{qaResult.qualityGrade} Grade</span>
              </div>

              <div className="bg-wellqc-panel border border-wellqc-border rounded-xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-wellqc-muted font-bold">Completeness</span>
                <div className="text-3xl font-black font-mono my-1 text-cyan-400">
                  {qaResult.completenessScore}
                  <span className="text-sm font-normal text-slate-500">%</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Non-null data volume</span>
              </div>

              <div className="bg-wellqc-panel border border-wellqc-border rounded-xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-wellqc-muted font-bold">Consistency</span>
                <div className="text-3xl font-black font-mono my-1 text-emerald-400">
                  {qaResult.consistencyScore}
                  <span className="text-sm font-normal text-slate-500">%</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Monotonic step audit</span>
              </div>

              <div className="bg-wellqc-panel border border-wellqc-border rounded-xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-wellqc-muted font-bold">Anomalies Detected</span>
                <div
                  className={`text-3xl font-black font-mono my-1 ${
                    qaResult.anomalyCount === 0
                      ? "text-emerald-400"
                      : qaResult.criticalCount > 0
                      ? "text-red-400"
                      : "text-amber-400"
                  }`}
                >
                  {qaResult.anomalyCount}
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {qaResult.criticalCount} crit · {qaResult.warningCount} warn
                </span>
              </div>

              <div className="col-span-2 md:col-span-1 bg-wellqc-panel border border-wellqc-border rounded-xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-wellqc-muted font-bold">Curve Channels</span>
                <div className="text-3xl font-black font-mono my-1 text-white">
                  {qaResult.curveSummaries.length}
                </div>
                <span className="text-[10px] font-mono text-slate-400">Standardised & mapped</span>
              </div>
            </section>

            {/* 3. AI Petrophysical Insights & Recommendations */}
            <section aria-label="AI Interpretation" className="bg-wellqc-panel border border-cyan-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center space-x-2 text-sm font-bold text-cyan-300">
                <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
                <span>AI Automated Petrophysical Interpretation &amp; Recommendations</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-mono bg-wellqc-dark/60 p-4 rounded-xl border border-wellqc-border">
                {aiOutput.summary}
              </p>
              {aiOutput.recommendations.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-mono text-wellqc-muted uppercase font-bold">Recommended Engineering Actions:</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {aiOutput.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className="flex items-start space-x-2.5 p-2.5 rounded-lg bg-wellqc-card/60 border border-wellqc-border text-xs text-slate-300 font-mono"
                      >
                        <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 4. Tabbed Detailed Analysis Inspector */}
            <section aria-label="Detailed Analysis Tabs" className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-lg">
              {/* Tabs Navigation Header */}
              <div className="flex items-center border-b border-wellqc-border bg-wellqc-card/40 px-4 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab("curves")}
                  className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
                    activeTab === "curves"
                      ? "border-cyan-400 text-cyan-300 bg-cyan-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Curve Health & Standardisation ({qaResult.curveSummaries.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("viewer")}
                  className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
                    activeTab === "viewer"
                      ? "border-cyan-400 text-cyan-300 bg-cyan-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Wireline Log Viewer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("anomalies")}
                  className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
                    activeTab === "anomalies"
                      ? "border-cyan-400 text-cyan-300 bg-cyan-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Quality Anomalies ({qaResult.anomalies.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("headers")}
                  className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
                    activeTab === "headers"
                      ? "border-cyan-400 text-cyan-300 bg-cyan-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Header Metadata (~WELL & ~CURVE)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("raw")}
                  className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
                    activeTab === "raw"
                      ? "border-cyan-400 text-cyan-300 bg-cyan-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Raw LAS Header</span>
                </button>
              </div>

              {/* Tab 1: Curves Table */}
              {activeTab === "curves" && (
                <CurveInventoryTable curveSummaries={qaResult.curveSummaries} parsedLAS={parsedLAS} />
              )}

              {/* Tab 1b: Wireline Log Viewer with Logarithmic Resistivity Scale */}
              {activeTab === "viewer" && parsedLAS && (
                <div className="p-4">
                  <LogViewer
                    title="Wireline Log Viewer (LAS Ingestion)"
                    wellName={parsedLAS.wellInfo.wellName || fileName}
                    field={parsedLAS.wellInfo.field || "N/A"}
                    operator={parsedLAS.wellInfo.company || "N/A"}
                    depthUnit={parsedLAS.wellInfo.depthUnit || "FT"}
                    startDepth={parsedLAS.wellInfo.startDepth}
                    stopDepth={parsedLAS.wellInfo.stopDepth}
                    step={parsedLAS.wellInfo.step}
                    depths={parsedLAS.data.depth}
                    curves={Object.entries(parsedLAS.data.curves).map(([mnemonic, values]) => {
                      const meta = parsedLAS.curves.find((c) => c.mnemonic === mnemonic);
                      return {
                        mnemonic,
                        unit: meta?.unit || "",
                        description: meta?.description || "",
                        values,
                      };
                    })}
                    showCompareToRaw={false}
                    nullValue={parsedLAS.wellInfo.nullValue}
                  />
                </div>
              )}

              {/* Tab 2: Quality Anomalies */}
              {activeTab === "anomalies" && (
                <div className="p-5 space-y-3">
                  {qaResult.anomalies.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                      <h4 className="text-sm font-bold text-white font-mono">Zero Petrophysical Anomalies Flagged</h4>
                      <p className="text-xs text-wellqc-muted font-mono">
                        This well log passed all depth sequencing, null threshold, spike, and physical boundary checks.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {qaResult.anomalies.map((anom, idx) => (
                        <div
                          key={`${anom.curveMnemonic}-${anom.anomalyType}-${idx}`}
                          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono ${
                            anom.severity === "CRITICAL"
                              ? "bg-red-500/10 border-red-500/30 text-red-200"
                              : "bg-amber-500/10 border-amber-500/30 text-amber-200"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  anom.severity === "CRITICAL"
                                    ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                }`}
                              >
                                {anom.severity}
                              </span>
                              <span className="font-bold text-white">Curve: {anom.curveMnemonic}</span>
                              <span className="text-slate-400 text-[11px] font-mono">
                                [{anom.anomalyType.replace(/_/g, " ")}]
                              </span>
                              {anom.depthStart !== undefined && anom.depthEnd !== undefined && (
                                <span className="text-slate-400 text-[11px]">
                                  depth {anom.depthStart} – {anom.depthEnd}
                                </span>
                              )}
                            </div>
                            <p className="text-slate-300 text-xs">{anom.description}</p>
                          </div>
                          {anom.suggestedCorrection && (
                            <div className="text-left sm:text-right shrink-0">
                              <span className="text-[10px] text-wellqc-muted uppercase block">Remediation:</span>
                              <span className="text-[11px] text-cyan-300">{anom.suggestedCorrection}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Header Metadata */}
              {activeTab === "headers" && (
                <div className="p-5 space-y-6">
                  <div>
                    <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider mb-3">
                      ~WELL Information Block
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs font-mono">
                      <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
                        <span className="text-[10px] text-wellqc-muted uppercase block">Well Name (WELL)</span>
                        <span className="font-bold text-white truncate block">{parsedLAS.wellInfo.wellName || "—"}</span>
                      </div>
                      <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
                        <span className="text-[10px] text-wellqc-muted uppercase block">Operating Company (COMP)</span>
                        <span className="font-bold text-white truncate block">{parsedLAS.wellInfo.company || "—"}</span>
                      </div>
                      <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
                        <span className="text-[10px] text-wellqc-muted uppercase block">Field Name (FLD)</span>
                        <span className="font-bold text-white truncate block">{parsedLAS.wellInfo.field || "—"}</span>
                      </div>
                      <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
                        <span className="text-[10px] text-wellqc-muted uppercase block">Unique Well Identifier (API/UWI)</span>
                        <span className="font-bold text-white truncate block">{parsedLAS.wellInfo.apiUwi || "—"}</span>
                      </div>
                      <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
                        <span className="text-[10px] text-wellqc-muted uppercase block">Start Depth (STRT)</span>
                        <span className="font-bold text-white">{parsedLAS.wellInfo.startDepth} {parsedLAS.wellInfo.depthUnit}</span>
                      </div>
                      <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
                        <span className="text-[10px] text-wellqc-muted uppercase block">Stop Depth (STOP)</span>
                        <span className="font-bold text-white">{parsedLAS.wellInfo.stopDepth} {parsedLAS.wellInfo.depthUnit}</span>
                      </div>
                      <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
                        <span className="text-[10px] text-wellqc-muted uppercase block">Sampling Step (STEP)</span>
                        <span className="font-bold text-white">{parsedLAS.wellInfo.step}</span>
                      </div>
                      <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
                        <span className="text-[10px] text-wellqc-muted uppercase block">Null Value (NULL)</span>
                        <span className="font-bold text-white">{parsedLAS.wellInfo.nullValue}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider mb-3">
                      ~CURVE Header Declarations ({parsedLAS.curves.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
                      {parsedLAS.curves.map((curve) => (
                        <div key={curve.mnemonic} className="bg-wellqc-card/40 p-2.5 rounded-lg border border-wellqc-border flex items-center justify-between">
                          <div>
                            <span className="font-bold text-cyan-300">{curve.mnemonic}</span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">{curve.description || "Curve channel"}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-wellqc-panel border border-wellqc-border text-slate-300">
                            {curve.unit || "unitless"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Raw LAS Header */}
              {activeTab === "raw" && (
                <div className="p-4">
                  <pre className="text-xs font-mono text-slate-300 bg-wellqc-dark/80 p-4 rounded-xl border border-wellqc-border overflow-x-auto max-h-96 leading-relaxed">
                    {parsedLAS.rawHeader || rawText.slice(0, 5000) || "No raw header recorded."}
                  </pre>
                </div>
              )}
            </section>
          </main>
        )}

        {/* Freemium Limit Reached Modal - Commented out for free testing (uncomment when payment is implemented) */}
        {/*
        {limitReachedModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center animate-in fade-in zoom-in duration-200">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-white">
                  Free Check Limit Reached (2/2 Used)
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  You have used your <strong className="text-white">2 free LAS log file checks</strong> on the Starter plan. Upgrade to <strong className="text-emerald-400">Pro Petrophysicist</strong> for unlimited checks, multi-track wireline rendering, and KNN imputation.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-2.5 text-xs text-slate-300">
                <div className="font-semibold text-slate-200 flex items-center justify-between">
                  <span>Pro Plan Benefits:</span>
                  <span className="text-emerald-400 font-mono font-bold">₦75,000 / $49 mo</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Unlimited LAS File Audits &amp; QA Reports</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Interactive Wireline Track Viewer</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Machine Learning KNN Curve Imputation</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href="/pricing"
                  className="w-full py-3.5 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 shadow-lg shadow-emerald-500/25 transition-all text-center cursor-pointer"
                >
                  View Pricing Plans
                </Link>
                <div className="flex items-center gap-2">
                  <Link
                    href="/pricing"
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-cyan-300 bg-slate-800 hover:bg-slate-700 transition-colors text-center"
                  >
                    View All Plans
                  </Link>
                  <button
                    onClick={() => setLimitReachedModal(false)}
                    className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        */}

      </div>
    </AppShell>
  );
}
