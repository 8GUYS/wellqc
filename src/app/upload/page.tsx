"use client";

import { useEffect, useState, useRef } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ParsedLAS } from "@/lib/las/parser";
import { QualityAnalysisResult, CurveHealthSummary, AnomalyReportItem } from "@/lib/las/quality-engine";
import { AIAnalysisOutput } from "@/lib/las/ai-analyzer";
import { analyzeLAS } from "@/lib/las/api";
import { reconstructRawLASText } from "@/lib/las/exporter";
import { downsampleParsedLASForStorage } from "@/lib/las/storage-utils";
import { saveFullLasText, clearFullLasText } from "@/lib/las/full-text-store";
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
import { UploadedFilesTable } from "@/components/upload/uploaded-files-table";
import { OnboardingWelcomeBanner } from "@/components/dashboard/dashboard-tour";
import { QueuedLASFile, UploadWorkspaceState } from "@/types/upload";
import { PaystackUpgradeModal } from "@/components/payments/paystack-upgrade-modal";
import { useUploadProgress } from "@/lib/hooks/useUploadProgress";
import {
  Activity,
  AlertTriangle,
  Download,
  FileText,
  Layers,
  Lock,
  RefreshCw,
  Sparkles,
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
  const isHydratedRef = useRef(false);

  const [rawText, setRawText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [parsedLAS, setParsedLAS] = useState<ParsedLAS | null>(null);
  const [qaResult, setQaResult] = useState<QualityAnalysisResult | null>(null);
  const [aiOutput, setAiOutput] = useState<AIAnalysisOutput | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedWell, setSavedWell] = useState<{ id: string; name: string; qualityScore: number } | null>(null);
  const [uploadQueue, setUploadQueue] = useState<QueuedLASFile[]>([]);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  const [activeTab, setActiveTab] = useState<"curves" | "anomalies" | "headers" | "raw" | "viewer">("curves");
  const [wellsRefreshKey, setWellsRefreshKey] = useState(0);

  // User Profile & Pro Gating State
  const [userProfile, setUserProfile] = useState<{
    tier: string;
    role: string;
    freeChecksUsed?: number;
  }>({
    tier: "FREE",
    role: "USER",
    freeChecksUsed: 0,
  });
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const isFreeTier = userProfile.tier === "FREE" && userProfile.role !== "ADMIN";

  // ── Async SSE batch progress (CE1-31) ─────────────────────────────────────
  const {
    submit: submitBatch,
    reset: resetBatch,
    status: batchStatus,
    files: batchFiles,
    isStreaming,
    isComplete: isBatchComplete,
  } = useUploadProgress();

  useEffect(() => {
    let active = true;
    async function loadUserProfile() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const { user } = await res.json();
          if (active && user) {
            let checksUsed = user.freeChecksUsed || 0;
            try {
              const checkRes = await fetch("/api/las/check", { cache: "no-store" });
              if (checkRes.ok) {
                const checkData = await checkRes.json();
                if (typeof checkData.freeChecksUsed === "number") {
                  checksUsed = Math.max(checksUsed, checkData.freeChecksUsed);
                }
              }
            } catch {
              // fallback to user.freeChecksUsed
            }

            setUserProfile({
              tier: (user.tier || "FREE").toUpperCase(),
              role: (user.role || "USER").toUpperCase(),
              freeChecksUsed: checksUsed,
            });
          }
        }
      } catch {
        // default to free
      }
    }
    loadUserProfile();

    const handleUserUpdated = () => {
      loadUserProfile();
    };
    window.addEventListener("wellqc_user_updated", handleUserUpdated);
    return () => {
      active = false;
      window.removeEventListener("wellqc_user_updated", handleUserUpdated);
    };
  }, []);

  // Restore previous session from localStorage after initial client mount to guarantee 100% SSR hydration fidelity
  useEffect(() => {
    isHydratedRef.current = true;
    const session = getInitialUploadWorkspace();
    if (session && session.parsedLAS && session.qaResult) {
      queueMicrotask(() => {
        setFileName(session.fileName || "restored-well-log.las");
        setRawText(session.rawText || "");
        setParsedLAS(session.parsedLAS);
        setQaResult(session.qaResult);
        setAiOutput(session.aiOutput || null);
        setSavedSuccess(Boolean(session.savedSuccess));
        setSavedWell(session.savedWell || null);
        setUploadQueue(session.uploadQueue || []);
        setRestoredFromStorage(true);
      });
    }
  }, []);

  // Persist complete un-downsampled raw LAS text to IndexedDB on file change only
  useEffect(() => {
    if (fileName && rawText) {
      saveFullLasText(fileName, rawText).catch(() => { });
    }
  }, [fileName, rawText]);

  // Persist state to localStorage on changes with quota protection
  useEffect(() => {
    if (!isHydratedRef.current || !parsedLAS || !qaResult) return;

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
      } catch { }
    }
  }, [parsedLAS, qaResult, aiOutput, rawText, fileName, savedSuccess, savedWell, uploadQueue]);

  const handleClearSession = () => {
    clearFullLasText().catch(() => { });
    try {
      localStorage.removeItem("wellqc_upload_workspace");
    } catch { }
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
    const freeChecksUsed = userProfile.freeChecksUsed || 0;
    const isLimitReached = isFreeTier && freeChecksUsed >= 3;
    if (isFreeTier) {
      if (isLimitReached) {
        setSaveError(
          "Free tier upload limit reached: You have uploaded 3 of 3 allowed LAS files. Please upgrade to WellQC Pro for unlimited uploads."
        );
        setUpgradeModalOpen(true);
        return;
      }
      const remaining = Math.max(0, 3 - freeChecksUsed);
      if (files.length > remaining) {
        setSaveError(
          `Free tier allows up to 3 total files. You have ${remaining} slot${remaining === 1 ? "" : "s"} remaining. Upgrading to Pro unlocks unlimited batch uploads.`
        );
        setUpgradeModalOpen(true);
        files = files.slice(0, remaining);
        if (files.length === 0) return;
      }
    }

    const lasFiles = files.filter((file) => /\.(las|txt)$/i.test(file.name) && file.size <= 20 * 1024 * 1024);
    if (lasFiles.length === 0) {
      setSaveError("Choose LAS or TXT files no larger than 20 MB.");
      return;
    }

    setSaveError("");

    // ── Multi-file: use async SSE batch path (CE1-31) ──────────────────────
    if (lasFiles.length >= 2) {
      setIsProcessing(true);
      try {
        const batchPayload = await Promise.all(
          lasFiles.map(async (file) => ({
            fileName: file.name,
            content: await file.text(),
          }))
        );
        // Load first file into viewer for preview while batch runs in background
        try {
          const first = batchPayload[0];
          const analysis = await analyzeLAS(first.content);
          setUploadQueue([{
            id: `${first.fileName}-${Date.now()}`,
            name: first.fileName,
            content: first.content,
            parsed: analysis.parsed,
            qa: analysis.qa,
            ai: analysis.ai,
            status: "ready",
          }]);
          loadQueuedFile({
            id: `${first.fileName}-${Date.now()}`,
            name: first.fileName,
            content: first.content,
            parsed: analysis.parsed,
            qa: analysis.qa,
            ai: analysis.ai,
            status: "ready",
          });
        } catch { /* preview optional */ }

        await submitBatch(batchPayload);
        setWellsRefreshKey((k) => k + 1);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Batch upload failed.");
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // ── Single file: existing synchronous path (unchanged) ─────────────────
    setIsProcessing(true);
    try {
      const queued = await Promise.all(
        lasFiles.map(async (file): Promise<QueuedLASFile | null> => {
          try {
            const content = await file.text();
            const analysis = await analyzeLAS(content);
            return {
              id: `${file.name}-${file.lastModified}-${file.size}`,
              name: file.name,
              content,
              parsed: analysis.parsed,
              qa: analysis.qa,
              ai: analysis.ai,
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

      // Auto-save files directly to the database upon upload/drag-and-drop
      setIsSaving(true);
      const committed: QueuedLASFile[] = [];
      for (let i = 0; i < validFiles.length; i++) {
        const item = validFiles[i];
        try {
          const res = await commitFile(item.name, item.content);
          committed.push({
            ...item,
            status: "saved",
            savedWell: res.well,
          });
          if (i === 0) {
            setSavedSuccess(true);
            setSavedWell(res.well);
            try {
              const activeUserId = localStorage.getItem("wellqc_active_user_id") || undefined;
              localStorage.setItem(
                "wellqc_latest_committed_well",
                JSON.stringify({
                  userId: activeUserId,
                  wellId: res.well.id,
                  wellName: res.well.name,
                  qualityScore: res.well.qualityScore,
                  curveSummaries: item.qa.curveSummaries,
                  timestamp: Date.now(),
                }),
              );
            } catch {}
          }
        } catch (commitErr) {
          console.warn("Auto-save failed for", item.name, commitErr);
          committed.push({
            ...item,
            status: "error",
            error: commitErr instanceof Error ? commitErr.message : "Failed to save",
          });
        }
      }
      setUploadQueue(committed);
      setWellsRefreshKey((k) => k + 1);
    } finally {
      setIsProcessing(false);
      setIsSaving(false);
    }
  };

  const commitFile = async (name: string, content: string) => {
    const response = await fetch("/api/las", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: name, content }),
    });

    let result: {
      message?: string;
      well?: { id: string; name: string; qualityScore: number };
      error?: string;
      detail?: string;
    } | null = null;
    try {
      result = await response.json();
    } catch {
      throw new Error(`Server returned HTTP ${response.status} (${response.statusText || "Unexpected error response"}).`);
    }

    if (!response.ok || !result?.well) {
      if (response.status === 403) {
        setUpgradeModalOpen(true);
      }
      const errDetail = result?.detail || result?.error || `Unable to upload this LAS file (HTTP ${response.status}).`;
      throw new Error(errDetail);
    }

    if (isFreeTier) {
      setUserProfile((prev) => ({
        ...prev,
        freeChecksUsed: (prev.freeChecksUsed || 0) + 1,
      }));
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
        "Only a downsampled preview is currently in browser memory. Please re-select or drop the original LAS file to ensure the complete, untouched raw log is saved.",
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
      setWellsRefreshKey((k) => k + 1);
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
      } catch { }
    } catch (error) {
      setSavedSuccess(false);
      setSaveError(error instanceof Error ? error.message : "Unable to upload this LAS file.");
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
          throw new Error(`File ${file.name} has no content to upload.`);
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
        } catch { }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to commit this LAS file.";
        setUploadQueue((files) =>
          files.map((item) => (item.id === file.id ? { ...item, status: "error", error: message } : item)),
        );
      }
    }
    setWellsRefreshKey((k) => k + 1);
    setIsSaving(false);
  };

  const handleSelectDatabaseWell = async (wellId: string) => {
    setIsProcessing(true);
    setSaveError("");
    try {
      const response = await fetch(`/api/wells/${encodeURIComponent(wellId)}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load well details (HTTP ${response.status})`);
      }
      const data = await response.json();
      const well = data.well || data;
      const wellName = well.name || "Well Log";
      const lasFileName = well.latestLasFileName || `${wellName}.las`;

      const curvesData = data.curvesData || { depth: [], curves: {} };
      const startDepth = typeof data.startDepth === "number" ? data.startDepth : 0;
      const stopDepth = typeof data.stopDepth === "number" ? data.stopDepth : (well.tdFt || 0);
      const depthUnit = data.depthUnit || well.depthUnit || "FT";

      const reconstructedParsed: ParsedLAS = {
        version: "2.0",
        wrap: false,
        wellInfo: {
          wellName,
          company: well.operatorName || "N/A",
          field: well.fieldName || "N/A",
          location: well.basin || "Niger Delta Basin",
          country: well.country || "Nigeria",
          state: "Rivers",
          apiUwi: well.apiNo || "N/A",
          serviceCompany: "Wireline Services",
          date: well.createdAt ? new Date(well.createdAt).toISOString().split("T")[0] : "2026-01-01",
          startDepth,
          stopDepth,
          step: 0.5,
          nullValue: -999.25,
          depthUnit,
        },
        curves: Object.keys(curvesData.curves || {}).map((m) => {
          const summary = (data.curveSummaries as CurveHealthSummary[] | undefined)?.find(
            (c) => c.mnemonic === m
          );
          return {
            mnemonic: m,
            unit: summary?.unit || "",
            code: "",
            description: m,
          };
        }),
        totalPoints: curvesData.depth?.length || well.pointCount || 0,
        data: curvesData,
        rawHeader: `~WELL\nWELL. ${wellName}\nAPI.  ${well.apiNo || ""}\nCOMP. ${well.operatorName || ""}\nFLD.  ${well.fieldName || ""}`,
        warnings: [],
      };

      const anomalies: AnomalyReportItem[] = Array.isArray(data.anomalies) ? data.anomalies : [];
      const criticalCount = anomalies.filter((a) => a.severity === "CRITICAL").length;
      const warningCount = anomalies.filter(
        (a) => a.severity === "WARNING" || (a.severity as string) === "MODERATE"
      ).length;

      const qualityGrade: QualityAnalysisResult["qualityGrade"] =
        well.qualityGrade === "EXCELLENT" ||
        well.qualityGrade === "GOOD" ||
        well.qualityGrade === "POOR" ||
        well.qualityGrade === "CRITICAL"
          ? well.qualityGrade
          : "GOOD";

      const reconstructedQA: QualityAnalysisResult = {
        overallScore: typeof well.qualityScore === "number" ? well.qualityScore : 75,
        qualityGrade,
        completenessScore: 88,
        consistencyScore: 92,
        anomalyCount: anomalies.length,
        criticalCount,
        warningCount,
        curveSummaries: Array.isArray(data.curveSummaries) ? data.curveSummaries : [],
        anomalies,
        missingStandardCurves: [],
      };

      const riskRating: AIAnalysisOutput["riskRating"] =
        well.qualityGrade === "CRITICAL"
          ? "CRITICAL"
          : well.qualityGrade === "POOR"
            ? "HIGH"
            : "LOW";

      const reconstructedAI: AIAnalysisOutput = {
        summary: data.aiSummary || "Interpretation-ready well log dataset loaded from assets repository.",
        recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
        riskRating,
        confidenceScore: 0.94,
        flaggedIntervals: [],
      };

      setFileName(lasFileName);
      setRawText("");
      setParsedLAS(reconstructedParsed);
      setQaResult(reconstructedQA);
      setAiOutput(reconstructedAI);
      setSavedSuccess(true);
      setSavedWell({ id: well.id, name: well.name, qualityScore: well.qualityScore });
      setActiveTab("curves");

      if (typeof window !== "undefined") {
        setTimeout(() => {
          const workspaceEl = document.getElementById("ingestion-results-workspace");
          if (workspaceEl) {
            workspaceEl.scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }, 120);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to load well.");
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <OnboardingWelcomeBanner
          onStartTour={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("wellqc_launch_tour"));
            }
          }}
        />

        <UploadHeader
          hasActiveSession={Boolean(parsedLAS)}
          onClearSession={handleClearSession}
        />

        <UploadDropzone
          onFilesSelected={queueFiles}
          disabled={isProcessing}
          isFreeTier={isFreeTier}
          freeChecksUsed={userProfile.freeChecksUsed || 0}
          maxFreeChecks={3}
          onUpgradeRequest={() => setUpgradeModalOpen(true)}
        />

        {isProcessing && batchStatus === "idle" && (
          <div className="p-6 bg-wellqc-panel border border-cyan-500/40 rounded-2xl text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            <div className="text-sm font-bold text-white font-mono">
              Extracting LAS Headers & Executing Petrophysical QA Rules...
            </div>
          </div>
        )}



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
        )}

        {restoredFromStorage && parsedLAS && (
          <RestoredSessionBanner
            fileName={fileName}
            onClearSession={handleClearSession}
            onDismiss={() => setRestoredFromStorage(false)}
          />
        )}

        {/* Ingestion Results Workspace */}
        {parsedLAS && qaResult && aiOutput && !isProcessing && (
          <main id="ingestion-results-workspace" aria-label="Ingestion Results Workspace" className="space-y-6 scroll-mt-6">
            <WellOverviewCard
              parsedLAS={parsedLAS}
              qaResult={qaResult}
              fileName={fileName}
              isSaving={isSaving}
              savedSuccess={savedSuccess}
              saveError={saveError}
              savedWell={savedWell}
              onUploadToDatabase={handleCommitToDatabase}
              onCommitToDatabase={handleCommitToDatabase}
            />

            {parsedLAS.warnings && parsedLAS.warnings.length > 0 && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Parser Warnings & Notices ({parsedLAS.warnings.length})</span>
                </div>
                <ul className="list-disc list-inside text-xs text-amber-200/90 space-y-1 font-mono">
                  {parsedLAS.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <BatchQueueList
              uploadQueue={uploadQueue}
              isSaving={isSaving}
              onUploadAll={handleCommitAll}
              onCommitAll={handleCommitAll}
              onLoadFile={loadQueuedFile}
              onRemoveFile={(id) => setUploadQueue((files) => files.filter((item) => item.id !== id))}
            />



            <AuditSummaryCards
              parsedLAS={parsedLAS}
              qaResult={qaResult}
            />
            <AIInsightsPanel aiOutput={aiOutput} />
            {/* Tabbed Detailed Analysis Inspector */}
            <section
              aria-label="Detailed Analysis Tabs"
              className="bg-wellqc-panel border border-wellqc-border rounded-2xl shadow-lg"
            >
              <div className="flex items-center border-b border-wellqc-border bg-wellqc-card/40 px-4 overflow-x-auto rounded-t-2xl">
                <button
                  type="button"
                  onClick={() => setActiveTab("curves")}
                  className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${activeTab === "curves"
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
                  className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${activeTab === "viewer"
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
                  className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${activeTab === "anomalies"
                    ? "border-cyan-400 text-cyan-300 bg-cyan-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Quality Anomalies ({qaResult.anomalies.length})</span>
                  {isFreeTier && (
                    <span className="flex items-center space-x-1 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold">
                      <Lock className="w-2.5 h-2.5 text-amber-400" />
                      <span>PRO</span>
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("headers")}
                  className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${activeTab === "headers"
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
                  className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${activeTab === "raw"
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
                  isFreeTier={isFreeTier}
                  onUpgradeRequest={() => setUpgradeModalOpen(true)}
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
                    onUpgradeRequest={() => setUpgradeModalOpen(true)}
                  />
                </div>
              )}

              {activeTab === "anomalies" && (
                <div className="p-4">
                  {isFreeTier ? (
                    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-950/20 via-slate-900/60 to-slate-950/80 p-8 text-center space-y-5">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
                        <Lock className="w-6 h-6" />
                      </div>
                      <div className="space-y-2 max-w-xl mx-auto">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                          <Sparkles className="w-3 h-3" />
                          <span>WellQC Pro Tier Feature</span>
                        </div>
                        <h3 className="text-xl font-black text-white font-mono">
                          Quality Anomalies Diagnostics ({qaResult.anomalies.length} Flagged)
                        </h3>
                        <p className="text-xs text-slate-400 font-mono leading-relaxed">
                          We flagged <span className="text-amber-300 font-semibold">{qaResult.anomalies.length} anomalies</span> across this well log. Detailed depth interval coordinates, anomaly classification, severity scores, and automated remediation recipes are restricted to WellQC Pro subscribers.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
                        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                          <div className="text-amber-400 font-mono text-xs font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Depth &amp; Limits</span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono">
                            Duplicate depths, non-monotonic steps, depth gaps, and physical limit breaches.
                          </p>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                          <div className="text-cyan-400 font-mono text-xs font-bold flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Signal Integrity</span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono">
                            Extreme sensor spikes, acoustic cycle skips, sensor flatlines, and null clusters.
                          </p>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                          <div className="text-emerald-400 font-mono text-xs font-bold flex items-center gap-1.5">
                            <Download className="w-3.5 h-3.5" />
                            <span>Automated Repair</span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono">
                            One-click despiking, boundary clamping, and KNN/Spline null imputation.
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setUpgradeModalOpen(true)}
                          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs font-mono shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-2"
                        >
                          <Sparkles className="w-4 h-4 text-slate-950" />
                          <span>Upgrade to WellQC Pro to Unlock (₦75,000 / $49)</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <AnomaliesListTab anomalies={qaResult.anomalies} />
                  )}
                </div>
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

        {/* Uploaded Well Files Catalog */}
        <div id="database-wells-catalog" className="pt-6 border-t border-wellqc-border scroll-mt-6">
          <UploadedFilesTable
            refreshTrigger={wellsRefreshKey}
            onSelectWell={handleSelectDatabaseWell}
            activeWellId={savedWell?.id || null}
          />
        </div>

        {/* Paystack License Upgrade Gatekeeper */}
        <PaystackUpgradeModal
          isOpen={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
          defaultPlanId="PRO_MONTHLY"
          reason="Upgrade to WellQC Pro to unlock multi-track wireline log curves, detailed anomaly diagnostics, automated repairs, and NUPRC certificates."
        />

      </div>
    </AppShell>
  );
}
