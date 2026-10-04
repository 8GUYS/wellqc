"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { parseLASContent, ParsedLAS } from "@/lib/las/parser";
import { analyzeWellLogQuality, QualityAnalysisResult } from "@/lib/las/quality-engine";
import { generateAIAnalysis, AIAnalysisOutput } from "@/lib/las/ai-analyzer";
import { reconstructRawLASText } from "@/lib/las/exporter";
import { downsampleParsedLASForStorage } from "@/lib/las/storage-utils";
import { WellLogViewer } from "@/components/well-log/log-viewer";
import { CurveInventoryTable } from "@/components/well-log/curve-inventory-table";
import { UploadHeader } from "@/components/upload/upload-header";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { BatchQueueList } from "@/components/upload/batch-queue-list";
import { RestoredSessionBanner } from "@/components/upload/restored-session-banner";
import { WellOverviewCard } from "@/components/upload/well-overview-card";
import { AuditSummaryCards } from "@/components/upload/audit-summary-cards";
import { AIInsightsPanel } from "@/components/upload/ai-insights-panel";
import { AnomaliesListTab } from "@/components/upload/anomalies-list-tab";
import { HeadersTab } from "@/components/upload/headers-tab";
import { QueuedLASFile, UploadWorkspaceState } from "@/types/upload";
import {
  Activity,
  AlertTriangle,
  FileText,
  Layers,
  RefreshCw,
  Table,
} from "lucide-react";

function getInitialUploadWorkspace(): UploadWorkspaceState {
  if (typeof window !== "undefined") {
    try {
      const activeUserId = localStorage.getItem("wellqc_active_user_id");
      const saved = localStorage.getItem("wellqc_upload_workspace");
      if (saved) {
        const session = JSON.parse(saved);
        if (session && session.userId && activeUserId && session.userId !== activeUserId) {
          localStorage.removeItem("wellqc_upload_workspace");
        } else if (session && session.parsedLAS && session.qaResult) {
          return {
            fileName: session.fileName || "restored-well-log.las",
            rawText: session.rawText || "",
            parsedLAS: {
              ...session.parsedLAS,
              data: {
                depth: Array.isArray(session.parsedLAS.data?.depth) ? session.parsedLAS.data.depth : [],
                curves: session.parsedLAS.data?.curves || {},
              },
            },
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

  const [rawText, setRawText] = useState<string>(initialWorkspace.rawText);
  const [fileName, setFileName] = useState<string>(initialWorkspace.fileName);
  const [parsedLAS, setParsedLAS] = useState<ParsedLAS | null>(initialWorkspace.parsedLAS);
  const [qaResult, setQaResult] = useState<QualityAnalysisResult | null>(initialWorkspace.qaResult);
  const [aiOutput, setAiOutput] = useState<AIAnalysisOutput | null>(initialWorkspace.aiOutput);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(initialWorkspace.savedSuccess);
  const [saveError, setSaveError] = useState("");
  const [savedWell, setSavedWell] = useState<{ id: string; name: string; qualityScore: number } | null>(
    initialWorkspace.savedWell,
  );
  const [uploadQueue, setUploadQueue] = useState<QueuedLASFile[]>(initialWorkspace.uploadQueue);
  const [restoredFromStorage, setRestoredFromStorage] = useState(initialWorkspace.restoredFromStorage);
  const [activeTab, setActiveTab] = useState<"curves" | "anomalies" | "headers" | "raw" | "viewer">("curves");

  // Persist state to localStorage on changes with quota protection
  useEffect(() => {
    if (!parsedLAS || !qaResult) return;

    try {
      const activeUserId = localStorage.getItem("wellqc_active_user_id") || undefined;
      const lightweightParsed = downsampleParsedLASForStorage(parsedLAS, 300);
      const payload = {
        userId: activeUserId,
        fileName,
        rawText: rawText.length > 50_000 ? "" : rawText,
        parsedLAS: lightweightParsed,
        qaResult,
        aiOutput,
        savedSuccess,
        savedWell,
        uploadQueue: uploadQueue.map((item) => ({
          ...item,
          content: "",
          parsed: downsampleParsedLASForStorage(item.parsed, 50),
        })),
        updatedAt: Date.now(),
      };
      localStorage.setItem("wellqc_upload_workspace", JSON.stringify(payload));
    } catch {
      try {
        const activeUserId = localStorage.getItem("wellqc_active_user_id") || undefined;
        const minimal = {
          userId: activeUserId,
          fileName,
          rawText: "",
          parsedLAS: {
            ...parsedLAS,
            data: { depth: [], curves: {} },
          },
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

    setIsProcessing(true);
    setSaveError("");
    try {
      const queued = await Promise.all(
        lasFiles.map(async (file): Promise<QueuedLASFile | null> => {
          try {
            const content = await file.text();
            const parsed = parseLASContent(content);
            const qa = analyzeWellLogQuality(parsed);
            const ai = generateAIAnalysis(parsed, qa);
            return {
              id: `${file.name}-${file.lastModified}-${file.size}`,
              name: file.name,
              content,
              parsed,
              qa,
              ai,
              status: "ready",
            };
          } catch {
            return null;
          }
        }),
      );
      const validFiles = queued.filter((file): file is QueuedLASFile => file !== null);
      if (validFiles.length === 0) {
        setSaveError("None of the selected files could be read as LAS data.");
        return;
      }
      setUploadQueue(validFiles);
      loadQueuedFile(validFiles[0]);
      if (validFiles.length !== files.length) {
        setSaveError(`${files.length - validFiles.length} file(s) were skipped because they are invalid or over 20 MB.`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const commitFile = async (name: string, content: string) => {
    const response = await fetch("/api/las", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: name, content }),
    });

    let result: { message?: string; well?: { id: string; name: string; qualityScore: number }; error?: string } | null = null;
    try {
      result = await response.json();
    } catch {
      throw new Error(`Server returned HTTP ${response.status} (${response.statusText || "Unexpected error response"}).`);
    }

    if (!response.ok || !result?.well) {
      throw new Error(result?.error || `Unable to commit this LAS file (HTTP ${response.status}).`);
    }
    return result as { message: string; well: { id: string; name: string; qualityScore: number } };
  };

  const handleCommitToDatabase = async () => {
    const isDownsampled = Boolean(
      parsedLAS &&
      parsedLAS.data?.depth &&
      parsedLAS.totalPoints > parsedLAS.data.depth.length,
    );

    if (!rawText && isDownsampled) {
      setSaveError(
        "Only a downsampled preview is currently in browser memory. Please re-select or drop the original LAS file to ensure the complete, untouched raw log is committed to the database.",
      );
      return;
    }

    const contentToCommit =
      rawText ||
      uploadQueue.find((f) => f.name === fileName)?.content ||
      (parsedLAS && parsedLAS.data?.depth && parsedLAS.data.depth.length === parsedLAS.totalPoints
        ? reconstructRawLASText(parsedLAS)
        : "");

    if (!contentToCommit || !parsedLAS || !qaResult) {
      setSaveError("No LAS log content is available to upload. Please re-select or drag-and-drop your LAS file.");
      return;
    }

    if (!rawText && contentToCommit) {
      setRawText(contentToCommit);
    }

    setIsSaving(true);
    setSaveError("");
    try {
      const validName = fileName && fileName !== "2" && !/^\d+$/.test(fileName) ? fileName : "";
      const validWellName =
        parsedLAS.wellInfo.wellName && parsedLAS.wellInfo.wellName !== "2" && !/^\d+$/.test(parsedLAS.wellInfo.wellName)
          ? `${parsedLAS.wellInfo.wellName}.las`
          : "";
      const activeName = validName || validWellName || "well-log.las";
      const result = await commitFile(activeName, contentToCommit);
      setSavedSuccess(true);
      setSavedWell(result.well);
      setUploadQueue((files) =>
        files.map((file) =>
          file.name === activeName || file.name === fileName
            ? { ...file, status: "saved", savedWell: result.well, error: undefined }
            : file,
        ),
      );

      try {
        const activeUserId = localStorage.getItem("wellqc_active_user_id") || undefined;
        localStorage.setItem(
          "wellqc_latest_committed_well",
          JSON.stringify({
            userId: activeUserId,
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
      setUploadQueue((files) =>
        files.map((item) => (item.id === file.id ? { ...item, status: "saving", error: undefined } : item)),
      );
      try {
        const isDownsampled = Boolean(
          file.parsed &&
          file.parsed.data?.depth &&
          file.parsed.totalPoints > file.parsed.data.depth.length,
        );
        if (!file.content && isDownsampled) {
          throw new Error(`File ${file.name} only has a preview in memory. Please re-select the file to upload full raw data.`);
        }

        const fileContent =
          file.content ||
          (file.parsed && file.parsed.data?.depth && file.parsed.data.depth.length === file.parsed.totalPoints
            ? reconstructRawLASText(file.parsed)
            : "");
        if (!fileContent) {
          throw new Error(`File ${file.name} has no content to commit.`);
        }
        const result = await commitFile(file.name, fileContent);
        const savedFile = { ...file, status: "saved" as const, savedWell: result.well, error: undefined };
        setUploadQueue((files) => files.map((item) => (item.id === file.id ? savedFile : item)));
        loadQueuedFile(savedFile);

        try {
          const activeUserId = localStorage.getItem("wellqc_active_user_id") || undefined;
          localStorage.setItem(
            "wellqc_latest_committed_well",
            JSON.stringify({
              userId: activeUserId,
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
        setUploadQueue((files) =>
          files.map((item) => (item.id === file.id ? { ...item, status: "error", error: message } : item)),
        );
      }
    }
    setIsSaving(false);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <UploadHeader
          hasActiveSession={Boolean(parsedLAS)}
          onClearSession={handleClearSession}
        />

        <UploadDropzone
          onFilesSelected={queueFiles}
          disabled={isProcessing}
        />

        {isProcessing && (
          <div className="p-6 bg-wellqc-panel border border-cyan-500/40 rounded-2xl text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            <div className="text-sm font-bold text-white font-mono">
              Extracting LAS Headers & Executing Petrophysical QA Rules...
            </div>
          </div>
        )}

        <BatchQueueList
          uploadQueue={uploadQueue}
          isSaving={isSaving}
          onCommitAll={handleCommitAll}
          onLoadFile={loadQueuedFile}
          onRemoveFile={(id) => setUploadQueue((files) => files.filter((item) => item.id !== id))}
        />

        {restoredFromStorage && parsedLAS && (
          <RestoredSessionBanner
            fileName={fileName}
            onClearSession={handleClearSession}
            onDismiss={() => setRestoredFromStorage(false)}
          />
        )}

        {/* Ingestion Results Workspace */}
        {parsedLAS && qaResult && aiOutput && !isProcessing && (
          <main aria-label="Ingestion Results Workspace" className="space-y-6">
            <WellOverviewCard
              parsedLAS={parsedLAS}
              qaResult={qaResult}
              fileName={fileName}
              isSaving={isSaving}
              savedSuccess={savedSuccess}
              saveError={saveError}
              savedWell={savedWell}
              onCommitToDatabase={handleCommitToDatabase}
            />

            <AuditSummaryCards
              parsedLAS={parsedLAS}
              qaResult={qaResult}
            />

            <AIInsightsPanel aiOutput={aiOutput} />

            {/* Tabbed Detailed Analysis Inspector */}
            <section
              aria-label="Detailed Analysis Tabs"
              className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-lg"
            >
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

              {activeTab === "curves" && (
                <CurveInventoryTable
                  curveSummaries={qaResult.curveSummaries}
                  parsedLAS={parsedLAS}
                />
              )}

              {activeTab === "viewer" && parsedLAS && (
                <div className="p-4">
                  <WellLogViewer
                    wellName={`${parsedLAS.wellInfo.wellName || fileName} (Original Untouched Raw)`}
                    depthUnit={parsedLAS.wellInfo.depthUnit || "FT"}
                    startDepth={parsedLAS.wellInfo.startDepth}
                    stopDepth={parsedLAS.wellInfo.stopDepth}
                    curvesData={parsedLAS.data}
                    anomalies={qaResult?.anomalies || []}
                  />
                </div>
              )}

              {activeTab === "anomalies" && (
                <AnomaliesListTab anomalies={qaResult.anomalies} />
              )}

              {activeTab === "headers" && (
                <HeadersTab parsedLAS={parsedLAS} />
              )}

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
      </div>
    </AppShell>
  );
}
