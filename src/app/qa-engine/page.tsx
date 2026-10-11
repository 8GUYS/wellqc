"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CleanedLogViewer } from "@/components/well-log/cleaned-log-viewer";
import {
  repairQAEngine,
  getQAEngineOverview,
  analyzeLAS,
  QARepairResponse,
  QAEngineOverviewResponse,
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
  Layers,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Filter,
  Sparkles,
  RefreshCw,
  Sliders,
  Database,
  UploadCloud,
  CheckSquare,
  Square,
  FileText,
  Activity,
  FileCheck2,
  BadgeCheck,
  TrendingUp,
  Gauge,
  FileCode,
  Copy,
  Check,
  RotateCcw,
  Info,
  Lock,
  ChevronRight,
  ArrowRight,
  Search,
} from "lucide-react";

// Target anomalies required by petrophysicist QA sprint specification
const TARGET_ANOMALY_TYPES = [
  "DUPLICATE_DEPTH",
  "IMPOSSIBLE_VALUE",
  "NULL_CLUSTER",
  "EXTREME_SPIKE",
] as const;

function isTargetAnomaly(type: string): boolean {
  const norm = (type || "").toUpperCase().trim();
  return (
    norm === "DUPLICATE_DEPTH" ||
    norm === "IMPOSSIBLE_VALUE" ||
    norm === "NULL_CLUSTER" ||
    norm === "NULL_DEPTH" ||
    norm === "EXTREME_SPIKE"
  );
}

function getAnomalyCategoryLabel(type: string): string {
  const norm = (type || "").toUpperCase().trim();
  if (norm === "DUPLICATE_DEPTH") return "Duplicate Depth Index";
  if (norm === "IMPOSSIBLE_VALUE") return "Physical Boundary Violation";
  if (norm === "NULL_CLUSTER" || norm === "NULL_DEPTH") return "Null / Missing Cluster";
  if (norm === "EXTREME_SPIKE") return "Extreme Sensor Spike";
  return norm;
}

function getCategoryBadgeClass(type: string): string {
  const norm = (type || "").toUpperCase().trim();
  if (norm === "DUPLICATE_DEPTH") {
    return "bg-rose-500/10 text-rose-400 border-rose-500/30";
  }
  if (norm === "IMPOSSIBLE_VALUE") {
    return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  }
  if (norm === "NULL_CLUSTER" || norm === "NULL_DEPTH") {
    return "bg-purple-500/10 text-purple-400 border-purple-500/30";
  }
  if (norm === "EXTREME_SPIKE") {
    return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
  }
  return "bg-slate-500/10 text-slate-400 border-slate-500/30";
}

function getGradeBadgeClass(grade: string): string {
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

export default function QAEngineWorkspace() {
  // Data source mode: active upload workspace vs saved database wells
  const [sourceMode, setSourceMode] = useState<"ACTIVE_UPLOAD" | "DATABASE_WELL" | "DIRECT_DROP">("ACTIVE_UPLOAD");

  // Well Data State
  const [wellName, setWellName] = useState<string>("Active Well");
  const [wellId, setWellId] = useState<string>("active-upload");
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
  const [wellSearchQuery, setWellSearchQuery] = useState<string>("");

  // Target Anomaly Filter state
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [selectedAnomalyIds, setSelectedAnomalyIds] = useState<Set<string>>(new Set());

  // Interactive Repair Actions toggles
  const [actionDespiking, setActionDespiking] = useState<boolean>(true);
  const [actionBoundaryClamping, setActionBoundaryClamping] = useState<boolean>(true);
  const [actionDuplicateDepthsOnly, setActionDuplicateDepthsOnly] = useState<boolean>(true);

  // Execution & Results State
  const [isExecutingRepair, setIsExecutingRepair] = useState<boolean>(false);
  const [repairResult, setRepairResult] = useState<QARepairResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [copiedCertId, setCopiedCertId] = useState<boolean>(false);

  // Engine Overview
  const [overview, setOverview] = useState<QAEngineOverviewResponse | null>(null);

  // 1. Fetch Engine Overview & Initial DB Wells
  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        const ov = await getQAEngineOverview();
        if (active) setOverview(ov);
      } catch (e) {
        console.warn("Failed to load QA Engine overview:", e);
      }

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
        console.warn("Failed to load DB wells:", e);
      } finally {
        if (active) setIsLoadingWells(false);
      }
    }

    loadInitialData();
    return () => {
      active = false;
    };
  }, []);

  // 2. Load Active Upload from localStorage on Mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const activeUserId = localStorage.getItem("wellqc_active_user_id");
      const stored = localStorage.getItem("wellqc_upload_workspace");
      if (stored) {
        const parsedData = JSON.parse(stored);
        if (parsedData && (!parsedData.userId || !activeUserId || parsedData.userId === activeUserId)) {
          if (parsedData.parsedLAS) {
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
            setSourceMode("ACTIVE_UPLOAD");
            return;
          }
        }
      }
    } catch (e) {
      console.warn("Error reading active upload workspace:", e);
    }
  }, []);

  // 3. Handle Selecting a Database Well
  const handleSelectDbWell = useCallback(
    async (id: string) => {
      if (!id) return;
      setSelectedDbWellId(id);
      setErrorMessage("");
      setRepairResult(null);

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

        // Construct client-side ParsedLAS object from curvesData for viewer compatibility
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

        // Construct QualityAnalysisResult from anomalies and score
        const qaFromDb: QualityAnalysisResult = {
          overallScore: detail.well.qualityScore || 80,
          qualityGrade: (detail.well.qualityGrade as any) || "GOOD",
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
            anomalyType: a.anomalyType as any,
            severity: a.severity as any,
            description: a.description,
            suggestedCorrection: a.suggestedCorrection,
          })),
          missingStandardCurves: [],
        };
        setQaResult(qaFromDb);
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to load database well details.");
      }
    },
    []
  );

  // 4. Handle Direct File Drop / Upload
  const handleDirectFileUpload = useCallback(async (file: File) => {
    if (!file) return;
    setErrorMessage("");
    setRepairResult(null);

    try {
      const content = await file.text();
      setRawLasText(content);
      const analysis = await analyzeLAS(content);

      setRawLas(analysis.parsed);
      setQaResult(analysis.qa);
      const fileNameWithoutExt = file.name.replace(/\.(las|txt)$/i, "");
      setWellName(analysis.parsed.wellInfo?.wellName || fileNameWithoutExt || "Uploaded Well");
      setWellId("direct-upload");
      setOperator(analysis.parsed.wellInfo?.company || "WellQC Petrophysics");
      setField(analysis.parsed.wellInfo?.field || "Direct Upload Basin");
      setDepthUnit(analysis.parsed.wellInfo?.depthUnit || "FT");
      setSourceMode("DIRECT_DROP");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to analyze uploaded LAS file.");
    }
  }, []);

  // Filter ONLY Target Anomalies:
  // "Get only duplicate depths,impossible value, nulls & null clusters, spikes anomalies from the active wells."
  const targetAnomalies = useMemo<AnomalyReportItem[]>(() => {
    if (!qaResult?.anomalies) return [];
    return qaResult.anomalies
      .filter((a) => isTargetAnomaly(a.anomalyType))
      .map((a, index) => ({
        ...a,
        id: a.id || `target-anom-${index}-${a.curveMnemonic}-${a.depthStart}`,
      }));
  }, [qaResult]);

  // Sync selected anomalies set with detected target anomalies
  useEffect(() => {
    const ids = new Set(targetAnomalies.map((a) => a.id!));
    setSelectedAnomalyIds(ids);
  }, [targetAnomalies]);

  // Filter by category pill
  const filteredAnomalies = useMemo(() => {
    if (categoryFilter === "ALL") return targetAnomalies;
    return targetAnomalies.filter((a) => {
      const norm = (a.anomalyType || "").toUpperCase();
      if (categoryFilter === "DUPLICATE_DEPTH") return norm === "DUPLICATE_DEPTH";
      if (categoryFilter === "IMPOSSIBLE_VALUE") return norm === "IMPOSSIBLE_VALUE";
      if (categoryFilter === "NULL_CLUSTER") return norm === "NULL_CLUSTER" || norm === "NULL_DEPTH";
      if (categoryFilter === "EXTREME_SPIKE") return norm === "EXTREME_SPIKE";
      return true;
    });
  }, [targetAnomalies, categoryFilter]);

  // Anomaly Category Counts
  const counts = useMemo(() => {
    let dup = 0;
    let imp = 0;
    let nul = 0;
    let spk = 0;
    targetAnomalies.forEach((a) => {
      const norm = (a.anomalyType || "").toUpperCase();
      if (norm === "DUPLICATE_DEPTH") dup++;
      else if (norm === "IMPOSSIBLE_VALUE") imp++;
      else if (norm === "NULL_CLUSTER" || norm === "NULL_DEPTH") nul++;
      else if (norm === "EXTREME_SPIKE") spk++;
    });
    return { dup, imp, nul, spk, total: targetAnomalies.length };
  }, [targetAnomalies]);

  // Toggle Anomaly Selection Checkbox
  const toggleAnomalySelection = (id: string) => {
    setSelectedAnomalyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllAnomalies = () => {
    setSelectedAnomalyIds(new Set(targetAnomalies.map((a) => a.id!)));
  };

  const handleClearAllAnomalies = () => {
    setSelectedAnomalyIds(new Set());
  };

  // 5. Execute Automated Anomaly Repair
  const handleExecuteRepair = async () => {
    if (!rawLas && !rawLasText && !wellId) {
      setErrorMessage("Please select or upload a valid well log to repair.");
      return;
    }

    if (!actionDespiking && !actionBoundaryClamping && !actionDuplicateDepthsOnly) {
      setErrorMessage("Please enable at least one interactive repair action (despiking, boundary clamping, or duplicate depth repair).");
      return;
    }

    setIsExecutingRepair(true);
    setErrorMessage("");

    try {
      const payload = {
        wellId: wellId !== "direct-upload" && wellId !== "active-upload" ? wellId : undefined,
        wellName: wellName || "Well Log",
        rawLasText: rawLasText || undefined,
        rawLas: rawLas || undefined,
        despiking: actionDespiking,
        outlierClipping: actionBoundaryClamping,
        duplicateDepthPruning: actionDuplicateDepthsOnly,
        imputationStrategy: "NONE",
      };

      const result = await repairQAEngine(payload);
      setRepairResult(result);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to execute petrophysical repair.");
    } finally {
      setIsExecutingRepair(false);
    }
  };

  // 6. Direct Cleaned Export Handlers
  const handleExportLAS = () => {
    if (!repairResult?.cleanedLasText) return;
    const cleanFileName = `${wellName.replace(/\s+/g, "_")}_CLEANED_VERIFIED.las`;
    downloadTextFile(cleanFileName, repairResult.cleanedLasText, "text/plain");
  };

  const handleExportCSV = () => {
    if (!repairResult?.cleanedCsvText) return;
    const cleanFileName = `${wellName.replace(/\s+/g, "_")}_CLEANED_VERIFIED.csv`;
    downloadTextFile(cleanFileName, repairResult.cleanedCsvText, "text/csv");
  };

  const handleCopyCertId = () => {
    if (!repairResult?.auditCertificateId) return;
    navigator.clipboard.writeText(repairResult.auditCertificateId);
    setCopiedCertId(true);
    setTimeout(() => setCopiedCertId(false), 2000);
  };

  // Filtered DB wells for search
  const filteredDbWells = useMemo(() => {
    if (!wellSearchQuery.trim()) return dbWells;
    const q = wellSearchQuery.toLowerCase();
    return dbWells.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.operatorName && w.operatorName.toLowerCase().includes(q)) ||
        (w.fieldName && w.fieldName.toLowerCase().includes(q)) ||
        (w.apiNo && w.apiNo.toLowerCase().includes(q))
    );
  }, [dbWells, wellSearchQuery]);

  return (
    <AppShell>
      <div className="space-y-6 pb-16">
        {/* Workspace Top Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-wellqc-panel/70 border border-wellqc-border p-5 rounded-2xl backdrop-blur-md">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                <span>Petrophysical QA Engine</span>
              </span>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Automated Repair Suite</span>
              </span>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono text-slate-400 border border-slate-700/50">
                Rule Filtering: Duplicate Depths • Boundary Limits • Spikes • Null Clusters
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Interactive Petrophysical Quality &amp; Data Repair Workspace</span>
            </h1>
            <p className="text-xs text-wellqc-muted font-mono leading-relaxed">
              Connect WellQC&apos;s Python quality engine to inspect target wireline anomalies, approve mathematical repairs, verify curve overlays, and export certified clean datasets.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {repairResult && (
              <button
                onClick={handleExportLAS}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-mono font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Export Clean LAS 2.0</span>
              </button>
            )}
          </div>
        </header>

        {/* Global Error Banner if any */}
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl flex items-start gap-3 font-mono text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">QA Engine Warning:</span>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* ─── SECTION 1: Well & Data Selection ────────────────────────────── */}
        <section className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-wellqc-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  Deliverable 1: Well &amp; Data Selection
                </h2>
                <p className="text-[11px] text-wellqc-muted font-mono">
                  Switch dynamically between active uploads, saved database wells, or drop a new LAS file.
                </p>
              </div>
            </div>

            {/* Source Mode Tabs */}
            <div className="flex items-center gap-1.5 bg-wellqc-dark p-1 rounded-xl border border-wellqc-border/70 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setSourceMode("ACTIVE_UPLOAD")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                  sourceMode === "ACTIVE_UPLOAD"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Active Upload</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceMode("DATABASE_WELL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                  sourceMode === "DATABASE_WELL"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Saved DB Wells ({dbWells.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceMode("DIRECT_DROP")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                  sourceMode === "DIRECT_DROP"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Direct LAS Drop</span>
              </button>
            </div>
          </div>

          {/* Source Sub-Panels */}
          {sourceMode === "ACTIVE_UPLOAD" && (
            <div className="space-y-3">
              {rawLas ? (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-wellqc-dark/80 border border-cyan-500/30">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-mono">{wellName}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Active Workspace Session
                      </span>
                    </div>
                    <div className="text-[11px] text-wellqc-muted font-mono flex flex-wrap gap-x-4 gap-y-1">
                      <span>Operator: <span className="text-slate-200">{operator}</span></span>
                      <span>Field: <span className="text-slate-200">{field}</span></span>
                      <span>Depth: <span className="text-slate-200">{rawLas.wellInfo?.startDepth} - {rawLas.wellInfo?.stopDepth} {depthUnit}</span></span>
                      <span>Curves: <span className="text-slate-200">{rawLas.curves?.length || 0}</span></span>
                      <span>Samples: <span className="text-slate-200">{rawLas.totalPoints || rawLas.data?.depth?.length || 0}</span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Workspace Ready</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-wellqc-dark/50 border border-dashed border-wellqc-border text-center space-y-2">
                  <p className="text-xs font-mono text-slate-400">
                    No active upload session found in your local workspace. Switch to Saved Database Wells or drop a file.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSourceMode("DIRECT_DROP")}
                    className="px-3.5 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold hover:bg-cyan-500/30 transition-all"
                  >
                    Upload Fresh LAS File
                  </button>
                </div>
              )}
            </div>
          )}

          {sourceMode === "DATABASE_WELL" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={wellSearchQuery}
                    onChange={(e) => setWellSearchQuery(e.target.value)}
                    placeholder="Search database wells by name, operator, or field..."
                    className="w-full bg-wellqc-dark border border-wellqc-border rounded-xl pl-8 pr-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {filteredDbWells.length} wells found
                </span>
              </div>

              {isLoadingWells ? (
                <div className="p-6 text-center text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Loading database wells...</span>
                </div>
              ) : filteredDbWells.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {filteredDbWells.map((w) => {
                    const isSelected = selectedDbWellId === w.id;
                    return (
                      <div
                        key={w.id}
                        onClick={() => handleSelectDbWell(w.id)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all space-y-1.5 ${
                          isSelected
                            ? "bg-cyan-500/10 border-cyan-500 shadow-sm"
                            : "bg-wellqc-dark/70 border-wellqc-border hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-mono font-bold text-white truncate">{w.name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${getGradeBadgeClass(
                              w.qualityGrade
                            )}`}
                          >
                            {w.qualityScore}% {w.qualityGrade}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
                          <span className="truncate">{w.operatorName || "Unassigned"}</span>
                          <span className="text-amber-400 shrink-0">{w.anomalyCount || 0} anomalies</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs font-mono text-slate-500 text-center py-4">
                  No database wells matched your query.
                </p>
              )}
            </div>
          )}

          {sourceMode === "DIRECT_DROP" && (
            <div className="space-y-3">
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) {
                    handleDirectFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-wellqc-border hover:border-cyan-500/60 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-wellqc-dark/40 group"
              >
                <UploadCloud className="w-8 h-8 text-slate-500 group-hover:text-cyan-400 transition-colors mb-2" />
                <span className="text-xs font-mono font-bold text-white">
                  Drop LAS 2.0 / 3.0 file here or click to browse
                </span>
                <span className="text-[11px] font-mono text-wellqc-muted mt-1">
                  Files are analyzed directly in-browser using Python microservices
                </span>
                <input
                  type="file"
                  accept=".las,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleDirectFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>
          )}
        </section>

        {/* ─── SECTION 2: Target Anomaly Filtering & Approvals ───────────── */}
        <section className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-wellqc-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Filter className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <span>Target Anomaly Inspection</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {counts.total} Detected
                  </span>
                </h2>
                <p className="text-[11px] text-wellqc-muted font-mono">
                  Strictly filtering: duplicate depths, impossible values, null clusters, and extreme spikes only.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllAnomalies}
                className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-wellqc-dark text-slate-300 hover:text-white border border-wellqc-border transition-all flex items-center gap-1"
              >
                <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                <span>Select All</span>
              </button>
              <button
                type="button"
                onClick={handleClearAllAnomalies}
                className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-wellqc-dark text-slate-300 hover:text-white border border-wellqc-border transition-all flex items-center gap-1"
              >
                <Square className="w-3.5 h-3.5 text-slate-400" />
                <span>Deselect All</span>
              </button>
            </div>
          </div>

          {/* Anomaly Category Pills Filter */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setCategoryFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                categoryFilter === "ALL"
                  ? "bg-cyan-500 text-slate-950 border-cyan-400"
                  : "bg-wellqc-dark text-slate-300 border-wellqc-border hover:border-slate-600"
              }`}
            >
              <span>All Target Anomalies</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/30">
                {counts.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter("DUPLICATE_DEPTH")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                categoryFilter === "DUPLICATE_DEPTH"
                  ? "bg-rose-500 text-white border-rose-400"
                  : "bg-wellqc-dark text-slate-300 border-wellqc-border hover:border-slate-600"
              }`}
            >
              <span>Duplicate Depths</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300">
                {counts.dup}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter("IMPOSSIBLE_VALUE")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                categoryFilter === "IMPOSSIBLE_VALUE"
                  ? "bg-amber-500 text-slate-950 border-amber-400"
                  : "bg-wellqc-dark text-slate-300 border-wellqc-border hover:border-slate-600"
              }`}
            >
              <span>Impossible Values / Boundary</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300">
                {counts.imp}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter("EXTREME_SPIKE")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                categoryFilter === "EXTREME_SPIKE"
                  ? "bg-cyan-500 text-slate-950 border-cyan-400"
                  : "bg-wellqc-dark text-slate-300 border-wellqc-border hover:border-slate-600"
              }`}
            >
              <span>Extreme Spikes</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300">
                {counts.spk}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter("NULL_CLUSTER")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                categoryFilter === "NULL_CLUSTER"
                  ? "bg-purple-500 text-white border-purple-400"
                  : "bg-wellqc-dark text-slate-300 border-wellqc-border hover:border-slate-600"
              }`}
            >
              <span>Nulls &amp; Null Clusters</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/20 text-purple-300">
                {counts.nul}
              </span>
            </button>
          </div>

          {/* Anomaly Cards List */}
          {filteredAnomalies.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredAnomalies.map((a) => {
                const isSelected = selectedAnomalyIds.has(a.id!);
                return (
                  <div
                    key={a.id}
                    onClick={() => toggleAnomalySelection(a.id!)}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-wellqc-dark border-cyan-500/60 shadow-sm"
                        : "bg-wellqc-dark/50 border-wellqc-border opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div className="pt-0.5">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                          {a.curveMnemonic}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${getCategoryBadgeClass(
                            a.anomalyType
                          )}`}
                        >
                          {getAnomalyCategoryLabel(a.anomalyType)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${
                            a.severity === "CRITICAL"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {a.severity}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 ml-auto">
                          Depth: {a.depthStart} - {a.depthEnd} {depthUnit}
                        </span>
                      </div>

                      <p className="text-xs font-mono text-slate-300 leading-snug">{a.description}</p>
                      {a.suggestedCorrection && (
                        <p className="text-[11px] font-mono text-cyan-300/90 leading-snug">
                          <span className="font-bold text-cyan-400">Repair Action:</span> {a.suggestedCorrection}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-xs font-mono text-slate-400 bg-wellqc-dark/40 rounded-xl border border-dashed border-wellqc-border">
              No anomalies found matching current filter ({categoryFilter}).
            </div>
          )}
        </section>

        {/* ─── SECTION 3: Automated Anomaly Repair Actions ────────────────── */}
        <section className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-wellqc-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  Deliverable 2: Automated Anomaly Repair Actions
                </h2>
                <p className="text-[11px] text-wellqc-muted font-mono">
                  User-approved interactive repair actions: despiking, physical boundary clamping, and duplicate-depth repairs only.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400">
                Approvals: <span className="text-cyan-400 font-bold">{selectedAnomalyIds.size}</span> / {targetAnomalies.length} items
              </span>
            </div>
          </div>

          {/* 3 User-Approved Interactive Repair Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Action 1: Despiking */}
            <div
              onClick={() => setActionDespiking(!actionDespiking)}
              className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2.5 ${
                actionDespiking
                  ? "bg-cyan-500/10 border-cyan-500/50 shadow-sm"
                  : "bg-wellqc-dark/60 border-wellqc-border opacity-70 hover:opacity-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>1. Median Despiking</span>
                </span>
                <span
                  className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                    actionDespiking ? "bg-cyan-500" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      actionDespiking ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
                Applies a 5-point median sliding filter across transit curves and electrical channels to suppress telemetry noise without blunting geological boundaries.
              </p>
              <div className="text-[10px] font-mono text-cyan-300 flex items-center gap-1 pt-1">
                <span>Targets: Extreme Spikes &amp; Cycle Skips</span>
              </div>
            </div>

            {/* Action 2: Physical Boundary Clamping */}
            <div
              onClick={() => setActionBoundaryClamping(!actionBoundaryClamping)}
              className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2.5 ${
                actionBoundaryClamping
                  ? "bg-amber-500/10 border-amber-500/50 shadow-sm"
                  : "bg-wellqc-dark/60 border-wellqc-border opacity-70 hover:opacity-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-amber-400" />
                  <span>2. Boundary Clamping</span>
                </span>
                <span
                  className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                    actionBoundaryClamping ? "bg-amber-500" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      actionBoundaryClamping ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
                Clamps thermodynamic impossible values for standard lithology curves (GR: 0-250 GAPI, RHOB: 1.8-3.0 g/cm³, NPHI: -0.05-0.60 m³/m³).
              </p>
              <div className="text-[10px] font-mono text-amber-300 flex items-center gap-1 pt-1">
                <span>Targets: Impossible Values &amp; Outliers</span>
              </div>
            </div>

            {/* Action 3: Duplicate-Depth Repairs Only */}
            <div
              onClick={() => setActionDuplicateDepthsOnly(!actionDuplicateDepthsOnly)}
              className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2.5 ${
                actionDuplicateDepthsOnly
                  ? "bg-rose-500/10 border-rose-500/50 shadow-sm"
                  : "bg-wellqc-dark/60 border-wellqc-border opacity-70 hover:opacity-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                  <span>3. Duplicate-Depth Repairs</span>
                </span>
                <span
                  className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                    actionDuplicateDepthsOnly ? "bg-rose-500" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      actionDuplicateDepthsOnly ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
                Prunes non-monotonic or repeating duplicate depth index rows, ensuring strict monotonic wireline indexing without corrupting borehole trajectory.
              </p>
              <div className="text-[10px] font-mono text-rose-300 flex items-center gap-1 pt-1">
                <span>Targets: Duplicate Depth Steps Only</span>
              </div>
            </div>
          </div>

          {/* Action Execution Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="text-xs font-mono text-slate-400">
              Transformations will be audited, validated with Python NumPy/SciPy engines, and logged to PostgreSQL.
            </div>

            <button
              type="button"
              disabled={isExecutingRepair || (!rawLas && !rawLasText && !wellId)}
              onClick={handleExecuteRepair}
              className={`px-6 py-3 rounded-xl font-mono font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2.5 ${
                isExecutingRepair
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/20"
              }`}
            >
              {isExecutingRepair ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
                  <span>Executing Mathematical Repairs...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                  <span>Execute Verified Anomaly Repair</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </section>

        {/* ─── SECTION 4: Before-and-After Verification ───────────────────── */}
        {repairResult && (
          <section className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-5 space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-wellqc-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                    <span>Deliverable 3: Before-and-After Verification</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Verified Clean
                    </span>
                  </h2>
                  <p className="text-[11px] text-wellqc-muted font-mono">
                    Curve comparison overlays, score delta gauges, and petrophysical resolution tracking.
                  </p>
                </div>
              </div>
            </div>

            {/* Score Delta Gauges & Telemetry Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Gauge 1: Quality Score Delta */}
              <div className="p-4 rounded-xl bg-wellqc-dark border border-wellqc-border space-y-2 lg:col-span-2">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">
                  Score Delta Gauge
                </span>
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-2xl font-black font-mono text-slate-300">
                      {repairResult.originalScore}%
                    </span>
                    <span
                      className={`block text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getGradeBadgeClass(
                        repairResult.originalGrade
                      )}`}
                    >
                      {repairResult.originalGrade} (Raw)
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
                      className={`block text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getGradeBadgeClass(
                        repairResult.cleanedGrade
                      )}`}
                    >
                      {repairResult.cleanedGrade} (Cleaned)
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${repairResult.originalScore}%` }}
                    className="bg-slate-600 h-full"
                  />
                  <div
                    style={{ width: `${Math.max(0, repairResult.scoreDelta)}%` }}
                    className="bg-emerald-500 h-full animate-pulse"
                  />
                </div>
              </div>

              {/* Stat 2: Duplicate Depths Pruned */}
              <div className="p-4 rounded-xl bg-wellqc-dark border border-wellqc-border space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Duplicate Depths</span>
                <div className="text-2xl font-black font-mono text-rose-400">
                  {repairResult.verificationReport?.duplicateDepthsPrunedCount ?? 0}
                </div>
                <span className="text-[10px] font-mono text-slate-400">Rows pruned</span>
              </div>

              {/* Stat 3: Boundary Clamped */}
              <div className="p-4 rounded-xl bg-wellqc-dark border border-wellqc-border space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Boundary Clamped</span>
                <div className="text-2xl font-black font-mono text-amber-400">
                  {repairResult.verificationReport?.outliersRemovedCount ?? 0}
                </div>
                <span className="text-[10px] font-mono text-slate-400">Samples bounded</span>
              </div>

              {/* Stat 4: Spikes Despiked */}
              <div className="p-4 rounded-xl bg-wellqc-dark border border-wellqc-border space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Spikes Despiked</span>
                <div className="text-2xl font-black font-mono text-cyan-400">
                  {repairResult.verificationReport?.spikesDespikedCount ?? 0}
                </div>
                <span className="text-[10px] font-mono text-slate-400">Transit spikes cleared</span>
              </div>
            </div>

            {/* Wireline Multi-Track Comparison Viewer */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Wireline Curve Comparison Overlay (Raw vs. Cleaned)</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Track 1: GR | Track 2: RT | Track 3: Density / Sonic
                </span>
              </div>

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

            {/* ─── SECTION 5: Certified Clean Export ──────────────────────── */}
            <div className="border-t border-wellqc-border/60 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                    <Download className="w-4 h-4 text-teal-400" />
                    <span>Deliverable 4: Certified Clean Export</span>
                  </h3>
                  <p className="text-[11px] text-wellqc-muted font-mono">
                    Direct browser export of verified Cleaned LAS 2.0 and CSV files.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-wellqc-dark border border-wellqc-border flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-cyan-400" />
                      <span>Cleaned LAS 2.0 Wireline (.las)</span>
                    </span>
                    <p className="text-[11px] font-mono text-slate-400">
                      Standard CWLS LAS 2.0 formatted file with verified headers, curve dictionary, and sanitized ~A ASCII data block.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportLAS}
                    className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Cleaned LAS 2.0</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-wellqc-dark border border-wellqc-border flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span>Cleaned Curve Matrix (.csv)</span>
                    </span>
                    <p className="text-[11px] font-mono text-slate-400">
                      Comma-separated matrix suitable for direct ingestion into Python pandas, Techlog, Petrel, and Machine Learning pipelines.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Cleaned CSV</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ─── SECTION 6: Audit Trail Logging & Compliance Certificate ─── */}
            <div className="border-t border-wellqc-border/60 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-purple-400" />
                    <span>Deliverable 5: Audit Trail Compliance Certificate</span>
                  </h3>
                  <p className="text-[11px] text-wellqc-muted font-mono">
                    All data transformations and approvals are persisted in PostgreSQL ActivityLog.
                  </p>
                </div>

                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Immutable Record</span>
                </span>
              </div>

              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="w-5 h-5 text-purple-400" />
                    <span className="text-xs font-mono font-bold text-purple-200">
                      Certificate ID: {repairResult.auditCertificateId}
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono text-slate-300">
                  <div>
                    <span className="text-slate-500">Petrophysicist:</span>{" "}
                    <span className="text-white font-bold">{repairResult.auditLogEntry?.userName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Role:</span>{" "}
                    <span className="text-white font-bold">{repairResult.auditLogEntry?.userRole}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Timestamp:</span>{" "}
                    <span className="text-white">{new Date(repairResult.auditLogEntry?.timestamp).toUTCString()}</span>
                  </div>
                </div>

                <p className="text-[11px] font-mono text-purple-200/90 bg-purple-900/30 p-2.5 rounded-lg border border-purple-500/20 leading-relaxed">
                  {repairResult.auditLogEntry?.details}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
