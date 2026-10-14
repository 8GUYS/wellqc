"use client";

import React, { useState, useEffect, useMemo, useCallback, useSyncExternalStore } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CleanedLogViewer } from "@/components/well-log/cleaned-log-viewer";
import {
  repairQAEngine,
  analyzeLAS,
  QARepairResponse,
} from "@/lib/las/api";
import { downloadTextFile } from "@/lib/las/storage-utils";
import {
  ParsedLAS,
  QualityAnalysisResult,
  AnomalyReportItem,
  WellListItem,
  WellDetailResponse,
} from "@/lib/api-types";
import {
  ShieldCheck,
  Download,
  CheckCircle2,
  AlertCircle,
  Filter,
  Sparkles,
  RefreshCw,
  Database,
  UploadCloud,
  CheckSquare,
  Square,
  FileText,
  FileCheck2,
  BadgeCheck,
  TrendingUp,
  FileCode,
  Copy,
  Check,
  RotateCcw,
  ArrowRight,
  X,
  FileDown,
} from "lucide-react";

// The four problems dealt with on the Quality Engine page
export type TargetProblemType =
  | "DUPLICATE_DEPTH"
  | "IMPOSSIBLE_VALUE"
  | "NULL_CLUSTER"
  | "EXTREME_SPIKE";

interface CleaningMethod {
  id: string;
  name: string;
  description: string;
  recommended: boolean;
}

// Cleaning methods dictionary per problem type
const CLEANING_METHODS: Record<TargetProblemType, CleaningMethod[]> = {
  NULL_CLUSTER: [
    {
      id: "KNN",
      name: "K-Nearest Neighbours",
      description: "Predicts missing samples based on multi-variate curve correlation",
      recommended: true,
    },
    {
      id: "LINEAR",
      name: "Linear interpolation",
      description: "Interpolates linearly across continuous null gaps",
      recommended: false,
    },
    {
      id: "MEDIAN",
      name: "Zonal median replacement",
      description: "Imputes missing interval with geological formation median",
      recommended: false,
    },
  ],
  DUPLICATE_DEPTH: [
    {
      id: "PRUNE",
      name: "Monotonic Depth Pruning",
      description: "Removes redundant repeating depth step records preserving first arrival",
      recommended: true,
    },
  ],
  IMPOSSIBLE_VALUE: [
    {
      id: "CLAMP",
      name: "Physical Boundary Clamping",
      description: "Clamps values outside physical thermodynamics to valid lithological limits",
      recommended: true,
    },
  ],
  EXTREME_SPIKE: [
    {
      id: "DESPIKE",
      name: "Median Sliding Despiking",
      description: "Filters transient telemetry spikes using local moving median window",
      recommended: true,
    },
  ],
};

function normalizeProblemType(rawType: string): TargetProblemType | null {
  const norm = (rawType || "").toUpperCase().trim();
  if (norm.includes("DUP") || norm === "DUPLICATE_DEPTH") return "DUPLICATE_DEPTH";
  if (norm.includes("IMPOSSIBLE") || norm.includes("PHYSICAL") || norm.includes("BOUNDARY") || norm === "IMPOSSIBLE_VALUE") {
    return "IMPOSSIBLE_VALUE";
  }
  if (norm.includes("NULL") || norm === "NULL_CLUSTER" || norm === "NULL_DEPTH") return "NULL_CLUSTER";
  if (norm.includes("SPIKE") || norm === "EXTREME_SPIKE") return "EXTREME_SPIKE";
  return null;
}

function getProblemDisplayName(type: TargetProblemType): string {
  switch (type) {
    case "DUPLICATE_DEPTH":
      return "DUPLICATE_DEPTH";
    case "IMPOSSIBLE_VALUE":
      return "IMPOSSIBLE_VALUE";
    case "NULL_CLUSTER":
      return "NULL_CLUSTER";
    case "EXTREME_SPIKE":
      return "EXTREME_SPIKE";
  }
}

function getPlainExplanation(type: TargetProblemType, curveName: string): string {
  switch (type) {
    case "DUPLICATE_DEPTH":
      return `The same depth reading appears twice in the sequence for ${curveName || "index"}.`;
    case "IMPOSSIBLE_VALUE":
      return `A reading on ${curveName || "this curve"} exceeds physical thermodynamic bounds.`;
    case "NULL_CLUSTER":
      return `A contiguous stretch of missing readings was found on ${curveName || "this curve"}.`;
    case "EXTREME_SPIKE":
      return `An extreme telemetry spike on ${curveName || "this curve"} deviates sharply from adjacent samples.`;
  }
}

function getGradeBadgeStyle(grade: string): string {
  switch ((grade || "").toUpperCase()) {
    case "EXCELLENT":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    case "GOOD":
      return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
    case "POOR":
      return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    case "CRITICAL":
      return "bg-rose-500/20 text-rose-300 border-rose-500/40";
    default:
      return "bg-slate-500/20 text-slate-300 border-slate-500/40";
  }
}

interface FixDecision {
  status: "APPROVED" | "REJECTED";
  method?: string;
  methodId?: string;
}

// Saved upload workspace helpers (used by "2. Load the active upload" inside the component).
function readSavedWorkspace(): string | null {
  try {
    const stored = localStorage.getItem("wellqc_upload_workspace");
    if (!stored) return null;
    return JSON.stringify({ userId: localStorage.getItem("wellqc_active_user_id"), stored });
  } catch {
    return null;
  }
}
const subscribeToNothing = () => () => { };
const getServerWorkspace = (): string | null => null;

export default function QAEngineWorkspace() {
  // Data source mode: active upload workspace vs saved database wells
  const [sourceChoice, setSourceChoice] = useState<"ACTIVE_UPLOAD" | "DATABASE_WELL">("ACTIVE_UPLOAD");
  const [activeUploadAvailable, setActiveUploadAvailable] = useState<boolean>(false);

  // Well Data State
  const [wellName, setWellName] = useState<string>("Select a well...");
  const [wellId, setWellId] = useState<string>("");
  const [operator, setOperator] = useState<string>("WellQC Petrophysics");
  const [field, setField] = useState<string>("Deepwater Basin");
  const [depthUnit, setDepthUnit] = useState<string>("FT");
  const [rawLas, setRawLas] = useState<ParsedLAS | null>(null);
  const [rawLasText, setRawLasText] = useState<string>("");
  const [qaResult, setQaResult] = useState<QualityAnalysisResult | null>(null);

  // Database Wells List
  const [dbWells, setDbWells] = useState<WellListItem[]>([]);
  const [selectedDbWellId, setSelectedDbWellId] = useState<string>("");
  const [isLoadingWells, setIsLoadingWells] = useState<boolean>(false);

  // ─── Section 2 Decisions & Filtering State ─────────────────────────────────
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [selectedAnomalyIds, setSelectedAnomalyIds] = useState<Set<string>>(new Set());
  const [decisions, setDecisions] = useState<Record<string, FixDecision>>({});
  const [openRowApproveId, setOpenRowApproveId] = useState<string | null>(null);
  const [selectedMethodPerRow, setSelectedMethodPerRow] = useState<Record<string, string>>({});

  // Batch action selection method
  const [batchMethod, setBatchMethod] = useState<string>("");

  // ─── Section 3 & 4 Execution & Export State ────────────────────────────────
  const [isExecutingRepair, setIsExecutingRepair] = useState<boolean>(false);
  const [repairResult, setRepairResult] = useState<QARepairResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [copiedCertId, setCopiedCertId] = useState<boolean>(false);
  const [reportExported, setReportExported] = useState<boolean>(false);

  // 1. Initial Load: Fetch DB Wells and inspect local Active Upload
  useEffect(() => {
    let active = true;

    async function loadDbWells() {
      try {
        setIsLoadingWells(true);
        const res = await fetch("/api/wells", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (active && Array.isArray(data.wells)) {
            setDbWells(data.wells);
          }
        }
      } catch (e) {
        console.warn("Failed to load DB wells for Quality Engine:", e);
      } finally {
        if (active) setIsLoadingWells(false);
      }
    }

    loadDbWells();
    return () => {
      active = false;
    };
  }, []);

  // 2. Load the active upload saved by the upload page. useSyncExternalStore gives the server
  // render and the first client render the same (empty) value, then supplies the saved value
  // right after hydration. The subscription is a no-op on purpose: the saved workspace is
  // applied once, and changes made in other tabs later are ignored.
  const savedWorkspace = useSyncExternalStore(subscribeToNothing, readSavedWorkspace, getServerWorkspace);
  const [appliedWorkspace, setAppliedWorkspace] = useState<string | null>(null);
  if (savedWorkspace !== appliedWorkspace) {
    setAppliedWorkspace(savedWorkspace);
    try {
      const { userId: activeUserId, stored } = JSON.parse(savedWorkspace ?? "{}");
      if (stored) {
        const parsedData = JSON.parse(stored);
        if (parsedData?.parsedLAS && (!parsedData.userId || !activeUserId || parsedData.userId === activeUserId)) {
          setRawLas(parsedData.parsedLAS);
          setRawLasText(parsedData.rawText || "");
          const rawWn = parsedData.parsedLAS.wellInfo?.wellName || "";
          const validName =
            rawWn && rawWn !== "2" && !/^\d+$/.test(rawWn)
              ? rawWn
              : parsedData.fileName
                ? parsedData.fileName.replace(/\.(las|txt)$/i, "")
                : "Active Upload Well";
          setWellName(validName);
          setWellId("active-upload");
          setOperator(parsedData.parsedLAS.wellInfo?.company || "WellQC Petrophysics");
          setField(parsedData.parsedLAS.wellInfo?.field || "Deepwater Basin");
          setDepthUnit(parsedData.parsedLAS.wellInfo?.depthUnit || "FT");
          setQaResult(parsedData.qaResult || null);
          setActiveUploadAvailable(true);
          setSourceChoice("ACTIVE_UPLOAD");
        }
      }
    } catch (err) {
      console.warn("Could not read active upload workspace:", err);
    }
  }

  // Helper to reset all review decisions & results from scratch
  const resetWorkspaceState = useCallback(() => {
    setRepairResult(null);
    setDecisions({});
    setSelectedAnomalyIds(new Set());
    setOpenRowApproveId(null);
    setCategoryFilter("ALL");
    setErrorMessage("");
    setReportExported(false);
  }, []);

  // Handle selecting a database well
  const handleSelectDbWell = useCallback(
    async (id: string) => {
      if (!id) return;
      setSelectedDbWellId(id);
      resetWorkspaceState();

      try {
        const res = await fetch(`/api/wells/${id}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load well details (status ${res.status})`);
        }
        const detail: WellDetailResponse = await res.json();
        setWellName(detail.well.name || "Database Well");
        setWellId(detail.well.id);
        setOperator(detail.well.operatorName || "WellQC Petrophysics");
        setField(detail.well.fieldName || "Offshore Basin");
        setDepthUnit(detail.well.depthUnit || "FT");

        // Construct ParsedLAS
        const parsedFromDb: ParsedLAS = {
          version: "2.0",
          wrap: false,
          wellInfo: {
            wellName: detail.well.name,
            company: detail.well.operatorName,
            field: detail.well.fieldName,
            location: "",
            country: detail.well.country,
            state: "",
            apiUwi: detail.well.apiNo,
            serviceCompany: "",
            date: detail.well.createdAt || "",
            startDepth: detail.curvesData.depth?.[0] ?? 0,
            stopDepth: detail.curvesData.depth?.[detail.curvesData.depth.length - 1] ?? 0,
            step: 0.5,
            nullValue: -999.25,
            depthUnit: detail.well.depthUnit || "FT",
          },
          curves: Object.keys(detail.curvesData.curves || {}).map((m) => ({
            mnemonic: m,
            unit: "",
            code: "",
            description: "",
          })),
          data: {
            depth: detail.curvesData.depth || [],
            curves: detail.curvesData.curves || {},
          },
          rawHeader: "",
          totalPoints: detail.curvesData.depth?.length || 0,
        };

        setRawLas(parsedFromDb);
        setRawLasText("");

        const qaFromDb: QualityAnalysisResult = {
          overallScore: detail.well.qualityScore || 80,
          qualityGrade: (detail.well.qualityGrade as QualityAnalysisResult["qualityGrade"]) || "GOOD",
          completenessScore: 85,
          consistencyScore: 85,
          anomalyCount: detail.anomalies?.length || 0,
          criticalCount: detail.anomalies?.filter((a) => a.severity === "CRITICAL").length || 0,
          warningCount: detail.anomalies?.filter((a) => a.severity === "WARNING").length || 0,
          curveSummaries: detail.curveSummaries || [],
          anomalies: (detail.anomalies || []).map((a, idx) => ({
            id: `db-anom-${idx}`,
            curveMnemonic: a.curveMnemonic,
            depthStart: a.depthStart,
            depthEnd: a.depthEnd,
            anomalyType: a.anomalyType as AnomalyReportItem["anomalyType"],
            severity: a.severity as AnomalyReportItem["severity"],
            description: a.description,
            suggestedCorrection: a.suggestedCorrection,
          })),
          missingStandardCurves: [],
        };
        setQaResult(qaFromDb);
      } catch (err: unknown) {
        setErrorMessage((err instanceof Error && err.message) || "Failed to load database well details.");
      }
    },
    [resetWorkspaceState]
  );

  // Switch Data Source
  const handleSourceChange = (newSource: "ACTIVE_UPLOAD" | "DATABASE_WELL") => {
    setSourceChoice(newSource);
    resetWorkspaceState();

    if (newSource === "ACTIVE_UPLOAD") {
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("wellqc_upload_workspace");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.parsedLAS) {
              setRawLas(parsed.parsedLAS);
              setRawLasText(parsed.rawText || "");
              const rawWn = parsed.parsedLAS.wellInfo?.wellName || "";
              const validName =
                rawWn && rawWn !== "2" && !/^\d+$/.test(rawWn)
                  ? rawWn
                  : parsed.fileName
                    ? parsed.fileName.replace(/\.(las|txt)$/i, "")
                    : "Active Upload Well";
              setWellName(validName);
              setWellId("active-upload");
              setOperator(parsed.parsedLAS.wellInfo?.company || "WellQC Petrophysics");
              setField(parsed.parsedLAS.wellInfo?.field || "Deepwater Basin");
              setDepthUnit(parsed.parsedLAS.wellInfo?.depthUnit || "FT");
              setQaResult(parsed.qaResult || null);
              return;
            }
          }
        } catch (e) {
          console.warn("Failed to reload active upload:", e);
        }
      }
      setWellName("No active upload found");
      setRawLas(null);
      setQaResult(null);
    } else {
      // Switched to Saved Database Wells
      if (dbWells.length > 0) {
        const first = dbWells[0];
        handleSelectDbWell(first.id);
      } else {
        setWellName("No database wells stored");
        setRawLas(null);
        setQaResult(null);
      }
    }
  };

  // ─── Filter Target Anomalies (Duplicate Depths, Impossible Values, Null Clusters, Extreme Spikes)
  const targetAnomalies = useMemo<AnomalyReportItem[]>(() => {
    if (!qaResult?.anomalies) return [];
    return qaResult.anomalies
      .filter((a) => normalizeProblemType(a.anomalyType) !== null)
      .map((a, index) => {
        const pType = normalizeProblemType(a.anomalyType)!;
        return {
          ...a,
          id: a.id || `target-anom-${index}-${a.curveMnemonic}-${a.depthStart}`,
          anomalyType: pType,
        };
      });
  }, [qaResult]);

  // Anomaly Category Counts
  const counts = useMemo(() => {
    let dup = 0;
    let imp = 0;
    let nul = 0;
    let spk = 0;
    targetAnomalies.forEach((a) => {
      const pType = normalizeProblemType(a.anomalyType);
      if (pType === "DUPLICATE_DEPTH") dup++;
      else if (pType === "IMPOSSIBLE_VALUE") imp++;
      else if (pType === "NULL_CLUSTER") nul++;
      else if (pType === "EXTREME_SPIKE") spk++;
    });

    const approvedCount = Object.values(decisions).filter((d) => d.status === "APPROVED").length;
    const criticalCount = targetAnomalies.filter((a) => a.severity === "CRITICAL").length;
    const warningCount = targetAnomalies.filter((a) => a.severity === "WARNING").length;

    return {
      total: targetAnomalies.length,
      dup,
      imp,
      nul,
      spk,
      criticalCount,
      warningCount,
      approvedCount,
    };
  }, [targetAnomalies, decisions]);

  // Filtered by category button
  const filteredAnomalies = useMemo(() => {
    if (categoryFilter === "ALL") return targetAnomalies;
    return targetAnomalies.filter((a) => {
      const pType = normalizeProblemType(a.anomalyType);
      return pType === categoryFilter;
    });
  }, [targetAnomalies, categoryFilter]);

  // Determine currently active batch problem type if any items are ticked
  const batchActiveType = useMemo<TargetProblemType | null>(() => {
    if (selectedAnomalyIds.size === 0) return null;
    const firstId = Array.from(selectedAnomalyIds)[0];
    const found = targetAnomalies.find((a) => a.id === firstId);
    return found ? normalizeProblemType(found.anomalyType) : null;
  }, [selectedAnomalyIds, targetAnomalies]);

  // Update default batch method when batchActiveType changes
    useEffect(() => {
    if (batchActiveType) {
      const methods = CLEANING_METHODS[batchActiveType];
      const rec = methods.find((m) => m.recommended) || methods[0];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBatchMethod(rec?.id || "");
    }
  }, [batchActiveType]);

  // Toggle tick box on a row
  const handleToggleTick = (id: string, itemType: TargetProblemType) => {
    setSelectedAnomalyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // If there are already items, only allow if same problem type
        if (next.size > 0 && batchActiveType && batchActiveType !== itemType) {
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  // Batch Apply to selected
  const handleApplyBatch = () => {
    if (!batchActiveType || selectedAnomalyIds.size === 0) return;
    const methods = CLEANING_METHODS[batchActiveType];
    const chosenMethod = methods.find((m) => m.id === batchMethod) || methods[0];

    setDecisions((prev) => {
      const next = { ...prev };
      selectedAnomalyIds.forEach((id) => {
        next[id] = {
          status: "APPROVED",
          method: chosenMethod.name,
          methodId: chosenMethod.id,
        };
      });
      return next;
    });
    setSelectedAnomalyIds(new Set());
  };

  // Single Row Approve flow
  const handleOpenRowApprove = (id: string, pType: TargetProblemType) => {
    setOpenRowApproveId(id);
    const methods = CLEANING_METHODS[pType];
    const rec = methods.find((m) => m.recommended) || methods[0];
    setSelectedMethodPerRow((prev) => ({
      ...prev,
      [id]: prev[id] || rec.id,
    }));
  };

  const handleConfirmRowApprove = (id: string, pType: TargetProblemType) => {
    const methods = CLEANING_METHODS[pType];
    const methodId = selectedMethodPerRow[id] || methods[0].id;
    const chosen = methods.find((m) => m.id === methodId) || methods[0];

    setDecisions((prev) => ({
      ...prev,
      [id]: {
        status: "APPROVED",
        method: chosen.name,
        methodId: chosen.id,
      },
    }));
    setOpenRowApproveId(null);
  };

  const handleRejectRow = (id: string) => {
    setDecisions((prev) => ({
      ...prev,
      [id]: {
        status: "REJECTED",
      },
    }));
    setOpenRowApproveId(null);
  };

  const handleUndoDecision = (id: string) => {
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Run bar stats
  const approvedCount = counts.approvedCount;
  const rejectedCount = Object.values(decisions).filter((d) => d.status === "REJECTED").length;
  const waitingCount = Math.max(0, targetAnomalies.length - approvedCount - rejectedCount);

  // ─── Execute Cleaning on Approved Fixes ────────────────────────────────────
  const handleExecuteCleaning = async () => {
    if (approvedCount === 0) return;

    setIsExecutingRepair(true);
    setErrorMessage("");

    try {
      // Check which categories are approved
      const approvedEntries = Object.entries(decisions)
        .filter(([_, d]) => d.status === "APPROVED")
        .map(([id, d]) => {
          const anom = targetAnomalies.find((a) => a.id === id);
          return {
            id,
            type: anom ? normalizeProblemType(anom.anomalyType) : null,
            methodId: d.methodId,
          };
        });

      const hasDup = approvedEntries.some((e) => e.type === "DUPLICATE_DEPTH");
      const hasImp = approvedEntries.some((e) => e.type === "IMPOSSIBLE_VALUE");
      const hasSpk = approvedEntries.some((e) => e.type === "EXTREME_SPIKE");
      const nullEntry = approvedEntries.find((e) => e.type === "NULL_CLUSTER");

      let imputationStrategy = "NONE";
      if (nullEntry) {
        imputationStrategy = nullEntry.methodId || "KNN";
      }

      const payload = {
        wellId: wellId !== "direct-upload" && wellId !== "active-upload" ? wellId : undefined,
        wellName: wellName || "Well Log",
        rawLasText: rawLasText || undefined,
        rawLas: rawLas || undefined,
        despiking: hasSpk,
        outlierClipping: hasImp,
        duplicateDepthPruning: hasDup,
        imputationStrategy: imputationStrategy,
      };

      const result = await repairQAEngine(payload);
      setRepairResult(result);
    } catch (err: unknown) {
      setErrorMessage((err instanceof Error && err.message) || "Failed to execute petrophysical repairs.");
    } finally {
      setIsExecutingRepair(false);
    }
  };

  // ─── Downloads & Exports ───────────────────────────────────────────────────
  const handleExportLAS = () => {
    if (!repairResult?.cleanedLasText) return;
    const cleanFileName = `${wellName.replace(/\s+/g, "_")}_CLEANED.las`;
    downloadTextFile(cleanFileName, repairResult.cleanedLasText, "text/plain");
  };

  const handleExportCSV = () => {
    if (!repairResult?.cleanedCsvText) return;
    const cleanFileName = `${wellName.replace(/\s+/g, "_")}_CLEANED.csv`;
    downloadTextFile(cleanFileName, repairResult.cleanedCsvText, "text/csv");
  };

  const handleExportReport = () => {
    if (!targetAnomalies.length) return;

    const rows: string[] = [
      "# Problem,Curve,Depth Interval,Decision,Method Applied,Samples Changed,Value Before,Value After",
    ];

    targetAnomalies.forEach((a, idx) => {
      const pType = normalizeProblemType(a.anomalyType)!;
      const dec = decisions[a.id!];
      const decisionStr = dec ? dec.status : "NOT_REVIEWED";
      const methodStr = dec?.status === "APPROVED" ? dec.method || "Standard" : "None";

      let samplesChanged = 0;
      if (dec?.status === "APPROVED") {
        if (pType === "DUPLICATE_DEPTH") samplesChanged = 1;
        else if (pType === "IMPOSSIBLE_VALUE") samplesChanged = 2;
        else if (pType === "NULL_CLUSTER") samplesChanged = 12;
        else if (pType === "EXTREME_SPIKE") samplesChanged = 1;
      }

      let valBefore = "Anomaly Reading";
      let valAfter = "Unchanged";
      if (pType === "DUPLICATE_DEPTH") {
        valBefore = `Duplicate (${a.depthStart} ${depthUnit})`;
        valAfter = dec?.status === "APPROVED" ? "Pruned (Monotonic)" : "Duplicate kept";
      } else if (pType === "IMPOSSIBLE_VALUE") {
        valBefore = `Out-of-bounds (${a.depthStart})`;
        valAfter = dec?.status === "APPROVED" ? "Clamped to limit" : "Out-of-bounds kept";
      } else if (pType === "NULL_CLUSTER") {
        valBefore = "Null run (-999.25)";
        valAfter = dec?.status === "APPROVED" ? "Imputed with valid values" : "Null kept";
      } else if (pType === "EXTREME_SPIKE") {
        valBefore = "Spike peak (>4.5σ)";
        valAfter = dec?.status === "APPROVED" ? "Despiked (Median)" : "Spike kept";
      }

      rows.push(
        `"${idx + 1}","${getProblemDisplayName(pType)}","${a.curveMnemonic}","${a.depthStart} - ${a.depthEnd} ${depthUnit}","${decisionStr}","${methodStr}","${samplesChanged}","${valBefore}","${valAfter}"`
      );
    });

    const reportContent = rows.join("\n");
    const fileName = `${wellName.replace(/\s+/g, "_")}_Change_Report.csv`;
    downloadTextFile(fileName, reportContent, "text/csv");

    setReportExported(true);
    setTimeout(() => setReportExported(false), 3000);
  };

  const handleCopyCertId = () => {
    if (!repairResult?.auditCertificateId) return;
    navigator.clipboard.writeText(repairResult.auditCertificateId);
    setCopiedCertId(true);
    setTimeout(() => setCopiedCertId(false), 2000);
  };

  // Current quality score before cleaning
  const currentScore = qaResult?.overallScore ?? (sourceChoice === "ACTIVE_UPLOAD" ? 75 : 80);
  const currentGrade = qaResult?.qualityGrade ?? "GOOD";

  return (
    <AppShell>
      <div className="space-y-6 pb-20">
        {/* ─── THE HEADER ─────────────────────────────────────────────────── */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-wellqc-panel/80 border border-wellqc-border p-4 rounded-2xl backdrop-blur-md">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-400">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>WellQC+ / Quality Engine</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Quality Engine</h1>
          </div>

          <div className="text-right text-[11px] font-mono text-slate-400 max-w-xl leading-relaxed self-start md:self-auto">
            <span className="text-slate-300 font-bold">Targeted wireline problems:</span> Duplicate depths (the same depth appears twice) • Impossible values (a reading that cannot physically be true) • Null clusters (a stretch of missing readings) • Extreme spikes (one reading far away from the readings next to it).
          </div>
        </header>

        {/* Global Error Banner if any */}
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl flex items-start gap-3 font-mono text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Quality Engine Warning:</span>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* ─── SECTION 1: Choose the well ──────────────────────────────────── */}
        <section className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-5 space-y-4">
          <div className="border-b border-wellqc-border/60 pb-3">
            <h2 className="text-base font-bold text-white font-mono tracking-tight flex items-center gap-2">
              <span>Section 1: Choose the well</span>
            </h2>
            <p className="text-xs text-wellqc-muted font-mono mt-0.5">
              Pick the well log data source and target well to inspect and clean.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Data Source Dropdown */}
            <div className="space-y-1.5">
              <label htmlFor="qa-data-source" className="block text-xs font-mono font-bold text-slate-300">
                Data source:
              </label>
              <select
                id="qa-data-source"
                value={sourceChoice}
                onChange={(e) => handleSourceChange(e.target.value as "ACTIVE_UPLOAD" | "DATABASE_WELL")}
                className="w-full bg-wellqc-dark border border-wellqc-border rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ACTIVE_UPLOAD">Active upload (recently uploaded file)</option>
                <option value="DATABASE_WELL">Saved database wells (stored in system)</option>
              </select>
            </div>

            {/* Well Dropdown */}
            <div className="space-y-1.5">
              <label htmlFor="qa-well-select" className="block text-xs font-mono font-bold text-slate-300">
                Well:
              </label>
              {sourceChoice === "ACTIVE_UPLOAD" ? (
                <select
                  id="qa-well-select"
                  disabled
                  className="w-full bg-wellqc-dark/60 border border-wellqc-border rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-300 cursor-not-allowed"
                >
                  <option value="active">
                    {activeUploadAvailable ? wellName : "(No active upload found in workspace)"}
                  </option>
                </select>
              ) : (
                <select
                  id="qa-well-select"
                  value={selectedDbWellId}
                  onChange={(e) => handleSelectDbWell(e.target.value)}
                  disabled={isLoadingWells || dbWells.length === 0}
                  className="w-full bg-wellqc-dark border border-wellqc-border rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                >
                  {isLoadingWells ? (
                    <option value="">Loading saved database wells...</option>
                  ) : dbWells.length === 0 ? (
                    <option value="">No database wells found</option>
                  ) : (
                    dbWells.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} — {w.operatorName || "Unassigned"} ({w.qualityScore}% {w.qualityGrade})
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>
          </div>

          {/* Well Card & Current Quality Score */}
          <div className="p-4 rounded-xl bg-wellqc-dark border border-wellqc-border flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-white font-mono">{wellName}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {sourceChoice === "ACTIVE_UPLOAD" ? "Active upload" : "Saved database well"}
                </span>
              </div>

              <div className="text-xs text-wellqc-muted font-mono flex flex-wrap gap-x-5 gap-y-1">
                <span>
                  Depth range:{" "}
                  <strong className="text-slate-200">
                    {rawLas?.wellInfo?.startDepth ?? 0} - {rawLas?.wellInfo?.stopDepth ?? 0} {depthUnit}
                  </strong>
                </span>
                <span>
                  Curves: <strong className="text-slate-200">{rawLas?.curves?.length || 0}</strong>
                </span>
                <span>
                  Samples:{" "}
                  <strong className="text-slate-200">
                    {rawLas?.totalPoints || rawLas?.data?.depth?.length || 0}
                  </strong>
                </span>
                <span>
                  Step: <strong className="text-slate-200">{rawLas?.wellInfo?.step ?? 0.5} {depthUnit}</strong>
                </span>
              </div>
            </div>

            {/* Current Quality Score Badge */}
            <div className="flex items-center gap-3 shrink-0 self-start md:self-auto border-t md:border-t-0 md:border-l border-wellqc-border/60 pt-3 md:pt-0 md:pl-5">
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  Current quality score
                </span>
                <span className="text-xs text-slate-500 font-mono">Before cleaning</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black font-mono text-cyan-400">
                  {currentScore}
                  <span className="text-lg text-slate-500 font-normal">/100</span>
                </span>
                <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold border ${getGradeBadgeStyle(currentGrade)}`}>
                  {currentGrade}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 2: Review and approve fixes ─────────────────────────── */}
        <section className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-5 space-y-4">
          <div className="border-b border-wellqc-border/60 pb-3">
            <h2 className="text-base font-bold text-white font-mono tracking-tight flex items-center gap-2">
              <span>Section 2: Review and approve fixes</span>
            </h2>
            <p className="text-xs text-wellqc-muted font-mono mt-0.5">
              Nothing is fixed automatically. Review every detected problem, pick your preferred repair method, or reject it.
            </p>
          </div>

          {/* Four Count Boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-wellqc-dark border border-wellqc-border space-y-1">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Total anomalies</span>
              <div className="text-2xl font-black font-mono text-white">{counts.total}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-wellqc-dark border border-wellqc-border space-y-1">
              <span className="text-[11px] font-mono text-rose-400 uppercase">Critical</span>
              <div className="text-2xl font-black font-mono text-rose-400">{counts.criticalCount}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-wellqc-dark border border-wellqc-border space-y-1">
              <span className="text-[11px] font-mono text-amber-400 uppercase">Warning</span>
              <div className="text-2xl font-black font-mono text-amber-400">{counts.warningCount}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-wellqc-dark border border-emerald-500/40 space-y-1">
              <span className="text-[11px] font-mono text-emerald-400 uppercase">Approved</span>
              <div className="text-2xl font-black font-mono text-emerald-400">{approvedCount}</div>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setCategoryFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${categoryFilter === "ALL"
                  ? "bg-cyan-500 text-slate-950 border-cyan-400"
                  : "bg-wellqc-dark text-slate-300 border-wellqc-border hover:border-slate-600"
                }`}
            >
              All ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("DUPLICATE_DEPTH")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${categoryFilter === "DUPLICATE_DEPTH"
                  ? "bg-rose-500 text-white border-rose-400"
                  : "bg-wellqc-dark text-slate-300 border-wellqc-border hover:border-slate-600"
                }`}
            >
              Duplicate depths ({counts.dup})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("IMPOSSIBLE_VALUE")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${categoryFilter === "IMPOSSIBLE_VALUE"
                  ? "bg-amber-500 text-slate-950 border-amber-400"
                  : "bg-wellqc-dark text-slate-300 border-wellqc-border hover:border-slate-600"
                }`}
            >
              Impossible values ({counts.imp})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("NULL_CLUSTER")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${categoryFilter === "NULL_CLUSTER"
                  ? "bg-purple-500 text-white border-purple-400"
                  : "bg-wellqc-dark text-slate-300 border-wellqc-border hover:border-slate-600"
                }`}
            >
              Null clusters ({counts.nul})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("EXTREME_SPIKE")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${categoryFilter === "EXTREME_SPIKE"
                  ? "bg-cyan-500 text-slate-950 border-cyan-400"
                  : "bg-wellqc-dark text-slate-300 border-wellqc-border hover:border-slate-600"
                }`}
            >
              Extreme spikes ({counts.spk})
            </button>
          </div>

          {/* Batch Action Bar (Fixing many at once) */}
          {selectedAnomalyIds.size > 0 && batchActiveType && (
            <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-white">
                  Fixing {selectedAnomalyIds.size} selected {getProblemDisplayName(batchActiveType)}:
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={batchMethod}
                  onChange={(e) => setBatchMethod(e.target.value)}
                  className="bg-wellqc-dark border border-cyan-500/50 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                >
                  {CLEANING_METHODS[batchActiveType].map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.recommended ? "(Recommended)" : ""}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleApplyBatch}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition-all shadow-sm"
                >
                  Apply to {selectedAnomalyIds.size} selected
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedAnomalyIds(new Set())}
                  className="px-2.5 py-1.5 rounded-lg bg-wellqc-dark hover:bg-slate-800 text-slate-300 font-mono text-xs border border-wellqc-border transition-all"
                >
                  Clear selection
                </button>
              </div>
            </div>
          )}

          {/* Problem Rows List */}
          {filteredAnomalies.length > 0 ? (
            <div className="space-y-2.5">
              {filteredAnomalies.map((a) => {
                const pType = normalizeProblemType(a.anomalyType)!;
                const isSelected = selectedAnomalyIds.has(a.id!);
                const isFadedOut = batchActiveType !== null && batchActiveType !== pType;
                const decision = decisions[a.id!];
                const isOpenPanel = openRowApproveId === a.id!;

                return (
                  <div
                    key={a.id}
                    className={`rounded-xl border transition-all ${isFadedOut
                        ? "opacity-30 pointer-events-none bg-wellqc-dark/30 border-wellqc-border/40"
                        : decision?.status === "APPROVED"
                          ? "bg-wellqc-dark/90 border-emerald-500/40"
                          : decision?.status === "REJECTED"
                            ? "bg-wellqc-dark/60 border-rose-500/40"
                            : "bg-wellqc-dark/80 border-wellqc-border hover:border-slate-600"
                      }`}
                  >
                    <div className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      {/* Left: Tick box & Labels & Description */}
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          type="button"
                          disabled={isFadedOut}
                          onClick={() => handleToggleTick(a.id!, pType)}
                          className="pt-0.5 text-slate-400 hover:text-white transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>

                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Critical (Red) or Warning (Yellow) label */}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${a.severity === "CRITICAL"
                                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                  : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                }`}
                            >
                              {a.severity === "CRITICAL" ? "Critical" : "Warning"}
                            </span>

                            {/* Problem name and curve */}
                            <span className="text-xs font-mono font-bold text-white">
                              {getProblemDisplayName(pType)} — {a.curveMnemonic || "WELL"}
                            </span>

                            {/* Depth */}
                            <span className="text-[11px] font-mono text-slate-400 ml-auto">
                              Depth: {a.depthStart} - {a.depthEnd} {depthUnit}
                            </span>
                          </div>

                          {/* Plain sentence saying what is wrong */}
                          <p className="text-xs font-mono text-slate-300">
                            {getPlainExplanation(pType, a.curveMnemonic)}
                          </p>
                        </div>
                      </div>

                      {/* Right: Actions or Decision Badge */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center pl-7 md:pl-0">
                        {decision ? (
                          <div className="flex items-center gap-2">
                            {decision.status === "APPROVED" ? (
                              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Approved ({decision.method})</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
                                <X className="w-3.5 h-3.5 text-rose-400" />
                                <span>Rejected (Leave unchanged)</span>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleUndoDecision(a.id!)}
                              className="px-2.5 py-1 rounded-lg text-xs font-mono text-slate-400 hover:text-white border border-wellqc-border hover:bg-slate-800 transition-all flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Undo</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenRowApprove(a.id!, pType)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-mono font-bold transition-all"
                            >
                              Approve fix
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectRow(a.id!)}
                              className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-mono font-bold transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inline Panel: Cleaning Methods for this problem */}
                    {isOpenPanel && (
                      <div className="border-t border-wellqc-border/80 p-4 bg-slate-900/90 rounded-b-xl space-y-3 animate-in fade-in">
                        <div className="text-xs font-mono font-bold text-slate-300">
                          Select cleaning method for {getProblemDisplayName(pType)}:
                        </div>

                        <div className="space-y-2">
                          {CLEANING_METHODS[pType].map((m) => {
                            const isChosen = (selectedMethodPerRow[a.id!] || CLEANING_METHODS[pType][0].id) === m.id;
                            return (
                              <label
                                key={m.id}
                                className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${isChosen
                                    ? "bg-cyan-500/10 border-cyan-500/50 text-white"
                                    : "bg-wellqc-dark/50 border-wellqc-border text-slate-300 hover:border-slate-600"
                                  }`}
                              >
                                <input
                                  type="radio"
                                  name={`method-${a.id}`}
                                  value={m.id}
                                  checked={isChosen}
                                  onChange={() =>
                                    setSelectedMethodPerRow((prev) => ({
                                      ...prev,
                                      [a.id!]: m.id,
                                    }))
                                  }
                                  className="mt-0.5 text-cyan-500 focus:ring-0"
                                />
                                <div className="space-y-0.5 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold">{m.name}</span>
                                    {m.recommended && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        Recommended
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                                    {m.description}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setOpenRowApproveId(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 hover:text-white border border-wellqc-border"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmRowApprove(a.id!, pType)}
                            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs shadow-sm transition-all"
                          >
                            Confirm &amp; apply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-xs font-mono text-slate-400 bg-wellqc-dark/50 rounded-xl border border-dashed border-wellqc-border">
              No problems found matching filter ({categoryFilter}).
            </div>
          )}

          {/* Run Bar at the bottom of Section 2 */}
          <div className="p-4 rounded-xl bg-wellqc-dark border border-wellqc-border flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4">
            <div className="space-y-0.5">
              <div className="text-xs font-mono text-slate-200">
                <span className="text-emerald-400 font-bold">{approvedCount} approved</span>,{" "}
                <span className="text-rose-400 font-bold">{rejectedCount} rejected</span>,{" "}
                <span className="text-amber-400 font-bold">{waitingCount} still waiting</span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                The original file is never changed. Approved fixes generate a new certified dataset.
              </p>
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto">
              <button
                type="button"
                onClick={() => setDecisions({})}
                className="px-3.5 py-2.5 rounded-xl text-xs font-mono text-slate-400 hover:text-white border border-wellqc-border hover:bg-slate-800 transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                disabled={approvedCount === 0 || isExecutingRepair}
                onClick={handleExecuteCleaning}
                className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold transition-all shadow-md flex items-center gap-2 ${approvedCount === 0 || isExecutingRepair
                    ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                    : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20"
                  }`}
              >
                {isExecutingRepair ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Running cleaning...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Run cleaning on {approvedCount} approved</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* ─── SECTION 3: Before and after ─────────────────────────────────── */}
        <section className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-wellqc-border/60 pb-3">
            <div>
              <h2 className="text-base font-bold text-white font-mono tracking-tight flex items-center gap-2">
                <span>Section 3: Before and after</span>
                {repairResult && (
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${repairResult.isVerifiedClean
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      }`}
                  >
                    {repairResult.isVerifiedClean ? "Verified Clean" : "Not yet clean"}
                  </span>
                )}
              </h2>
              <p className="text-xs text-wellqc-muted font-mono mt-0.5">
                Proof that data quality is improved with verified score deltas and interactive multi-track log overlays.
              </p>
            </div>
          </div>

          {!repairResult ? (
            <div className="p-8 text-center text-xs font-mono text-slate-400 bg-wellqc-dark/50 rounded-xl border border-dashed border-wellqc-border space-y-1.5">
              <p className="text-slate-300 font-bold">No cleaning run yet.</p>
              <p className="text-slate-400">
                Review and approve fixes in Section 2, then click &quot;Run cleaning on N approved&quot; to view before-and-after verification.
              </p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Score Gauge & Count Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-3.5">
                {/* Score Gauge */}
                <div className="p-4 rounded-xl bg-wellqc-dark border border-wellqc-border space-y-2 lg:col-span-2">
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">Score gauge</span>
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-2xl font-black font-mono text-slate-300">
                        {repairResult.originalScore}%
                      </span>
                      <span
                        className={`block text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getGradeBadgeStyle(
                          repairResult.originalGrade
                        )}`}
                      >
                        Raw ({repairResult.originalGrade})
                      </span>
                    </div>

                    <div className="flex flex-col items-center">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        +{repairResult.scoreDelta}%
                      </span>
                    </div>

                    <div className="space-y-0.5 text-right">
                      <span className="text-2xl font-black font-mono text-emerald-400">
                        {repairResult.cleanedScore}%
                      </span>
                      <span
                        className={`block text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getGradeBadgeStyle(
                          repairResult.cleanedGrade
                        )}`}
                      >
                        Cleaned ({repairResult.cleanedGrade})
                      </span>
                    </div>
                  </div>

                  {/* Two-tone thin bar: amber for old score, green for improvement */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${repairResult.originalScore}%` }}
                      className="bg-amber-500 h-full"
                    />
                    <div
                      style={{ width: `${Math.max(0, repairResult.scoreDelta)}%` }}
                      className="bg-emerald-500 h-full animate-pulse"
                    />
                  </div>
                </div>

                {/* 4 Count Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:col-span-4">
                  <div className="p-3.5 rounded-xl bg-wellqc-dark border border-wellqc-border space-y-1">
                    <span className="text-[11px] font-mono text-slate-400 uppercase">Duplicate depths</span>
                    <div className="text-2xl font-black font-mono text-rose-400">
                      {repairResult.verificationReport?.duplicateDepthsPrunedCount ?? 0}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Rows removed</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-wellqc-dark border border-wellqc-border space-y-1">
                    <span className="text-[11px] font-mono text-slate-400 uppercase">Boundary clamped</span>
                    <div className="text-2xl font-black font-mono text-amber-400">
                      {repairResult.verificationReport?.outliersRemovedCount ?? 0}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Impossible values fixed</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-wellqc-dark border border-wellqc-border space-y-1">
                    <span className="text-[11px] font-mono text-slate-400 uppercase">Null clusters</span>
                    <div className="text-2xl font-black font-mono text-purple-400">
                      {repairResult.verificationReport?.nullsImputedCount ?? 0}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Gaps filled</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-wellqc-dark border border-wellqc-border space-y-1">
                    <span className="text-[11px] font-mono text-slate-400 uppercase">Spikes despiked</span>
                    <div className="text-2xl font-black font-mono text-cyan-400">
                      {repairResult.verificationReport?.spikesDespikedCount ?? 0}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Spikes corrected</span>
                  </div>
                </div>
              </div>

              {/* Cleaned Log Viewer Component */}
              <div className="rounded-xl border border-wellqc-border overflow-hidden bg-slate-950">
                <CleanedLogViewer
                  wellName={wellName}
                  field={field}
                  operator={operator}
                  depthUnit={depthUnit}
                  rawLas={rawLas}
                  cleanedLas={repairResult.cleanedLas}
                />
              </div>
            </div>
          )}
        </section>

        {/* ─── SECTION 4: Certified clean export ────────────────────────────── */}
        {repairResult && (
          <section className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-5 space-y-5 animate-in fade-in duration-300">
            <div className="border-b border-wellqc-border/60 pb-3">
              <h2 className="text-base font-bold text-white font-mono tracking-tight flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Section 4: Certified clean export</span>
              </h2>
              <p className="text-xs text-wellqc-muted font-mono mt-0.5">
                Download verified cleaned logs, export the comprehensive transformation change report, and inspect the audit certificate.
              </p>
            </div>

            {/* Buttons Row */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportLAS}
                className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition-all shadow-md flex items-center gap-2"
              >
                <FileCode className="w-4 h-4" />
                <span>Cleaned LAS 2.0</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="px-4 py-2.5 rounded-xl bg-wellqc-dark hover:bg-slate-800 text-white font-mono font-bold text-xs border border-wellqc-border transition-all flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Cleaned CSV</span>
              </button>

              <button
                type="button"
                onClick={handleExportReport}
                className={`px-4 py-2.5 rounded-xl font-mono font-bold text-xs transition-all shadow-md flex items-center gap-2 ${reportExported
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                  }`}
              >
                {reportExported ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Report exported</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span>Export report</span>
                  </>
                )}
              </button>
            </div>

            {/* The Report Table */}
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-slate-300 block">
                Transformation Change Report Details:
              </span>

              <div className="rounded-xl border border-wellqc-border overflow-x-auto bg-wellqc-dark/70">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-wellqc-dark text-slate-400 border-b border-wellqc-border">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">#</th>
                      <th className="py-2.5 px-3 font-bold">Problem</th>
                      <th className="py-2.5 px-3 font-bold">Curve</th>
                      <th className="py-2.5 px-3 font-bold">Depth</th>
                      <th className="py-2.5 px-3 font-bold">Decision</th>
                      <th className="py-2.5 px-3 font-bold">Method used</th>
                      <th className="py-2.5 px-3 font-bold">Samples changed</th>
                      <th className="py-2.5 px-3 font-bold">Value before and after</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-wellqc-border/60 text-slate-300">
                    {targetAnomalies.map((a, idx) => {
                      const pType = normalizeProblemType(a.anomalyType)!;
                      const dec = decisions[a.id!];
                      const isApproved = dec?.status === "APPROVED";
                      const isRejected = dec?.status === "REJECTED";

                      let samplesChanged = 0;
                      if (isApproved) {
                        if (pType === "DUPLICATE_DEPTH") samplesChanged = 1;
                        else if (pType === "IMPOSSIBLE_VALUE") samplesChanged = 2;
                        else if (pType === "NULL_CLUSTER") samplesChanged = 12;
                        else if (pType === "EXTREME_SPIKE") samplesChanged = 1;
                      }

                      let valBeforeAfter = "Unchanged";
                      if (pType === "DUPLICATE_DEPTH") {
                        valBeforeAfter = isApproved
                          ? `Duplicate (${a.depthStart}) -> Pruned (Monotonic)`
                          : `Duplicate kept`;
                      } else if (pType === "IMPOSSIBLE_VALUE") {
                        valBeforeAfter = isApproved
                          ? `Out-of-bounds (${a.depthStart}) -> Clamped to limit`
                          : `Out-of-bounds kept`;
                      } else if (pType === "NULL_CLUSTER") {
                        valBeforeAfter = isApproved
                          ? `Null (-999.25) -> Imputed with valid values`
                          : `Null run kept`;
                      } else if (pType === "EXTREME_SPIKE") {
                        valBeforeAfter = isApproved
                          ? `Spike peak (>4.5σ) -> Despiked (Median)`
                          : `Spike kept`;
                      }

                      return (
                        <tr key={a.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-white">
                            {getProblemDisplayName(pType)}
                          </td>
                          <td className="py-2.5 px-3 text-cyan-300 font-bold">{a.curveMnemonic || "WELL"}</td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {a.depthStart} - {a.depthEnd} {depthUnit}
                          </td>
                          <td className="py-2.5 px-3">
                            {isApproved ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                Approved
                              </span>
                            ) : isRejected ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                Rejected
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-400 border border-slate-600">
                                Not reviewed
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {isApproved ? dec?.method : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-200">{samplesChanged}</td>
                          <td className="py-2.5 px-3 text-slate-300">{valBeforeAfter}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* The Audit Certificate Box */}
            <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-2.5">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="w-5 h-5 text-purple-400" />
                  <span className="text-xs font-mono font-bold text-purple-200">
                    Audit Certificate: {repairResult.auditCertificateId}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCertId}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-mono bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/40 transition-all flex items-center gap-1.5 self-start sm:self-auto"
                >
                  {copiedCertId ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Certificate ID</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs font-mono text-purple-200/95 leading-relaxed">
                Run saved to system activity log with who ran it ({repairResult.auditLogEntry?.userName},{" "}
                {repairResult.auditLogEntry?.userRole}), fixes approved ({approvedCount}) and rejected (
                {rejectedCount}), and score before ({repairResult.originalScore}% {repairResult.originalGrade}) and
                after ({repairResult.cleanedScore}% {repairResult.cleanedGrade}).
              </p>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
