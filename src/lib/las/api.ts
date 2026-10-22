/**
 * WellQC Enterprise API Client for Python Backend Services
 * Connects frontend Next.js pages directly to FastAPI endpoints.
 */

import {
  ParsedLAS,
  QualityAnalysisResult,
  AIAnalysisOutput,
  CleanedLogResult,
  CleaningOptions,
  VerificationReport,
  MissingValueDiagnostic,
  ImputationBenchmarkResult,
  CustomAliasEntry,
  ApprovedFix,
  GapRecommendationResult,
} from "@/lib/api-types";

export interface AnalyzeLASResponse {
  parsed: ParsedLAS;
  qa: QualityAnalysisResult;
  ai: AIAnalysisOutput;
  warnings: string[];
}

export interface ApplyFixesPayload {
  wellId: string;
  approvedFixes: Array<{
    anomalyId: string;
    anomalyType: string;
    curveMnemonic: string;
    depthStart: number;
    depthEnd: number;
    optionId: string;
    optionLabel: string;
    description?: string;
  }>;
  rawLasContent?: string;
  rawLas?: ParsedLAS;
}

export interface ApplyFixesResponse {
  success: boolean;
  message: string;
  cleanedLas: ParsedLAS;
  cleanedQa: QualityAnalysisResult;
  verificationReport: VerificationReport;
  cleanedLasText: string;
  cleanedCsvText: string;
}

/**
 * Single-call parse, QA analysis, and AI summary (no DB writes)
 */
export async function analyzeLAS(content: string): Promise<AnalyzeLASResponse> {
  const res = await fetch("/api/las/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `LAS analysis failed with status ${res.status}`);
  }
  return res.json();
}

/**
 * Re-run QA on an already parsed LAS file (e.g. after alias updates)
 */
export async function rerunQA(parsed: ParsedLAS): Promise<QualityAnalysisResult> {
  const res = await fetch("/api/las/qa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parsed }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `QA evaluation failed with status ${res.status}`);
  }
  return res.json();
}

/**
 * Clean LAS log data with specified cleaning options
 */
export async function cleanLAS(
  content: string,
  options?: CleaningOptions
): Promise<CleanedLogResult> {
  const res = await fetch("/api/las/clean", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, options }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `LAS cleaning failed with status ${res.status}`);
  }
  return res.json();
}

/**
 * Apply approved anomaly fixes to a well log
 */
export async function applyApprovedFixes(
  payload: ApplyFixesPayload
): Promise<ApplyFixesResponse> {
  const res = await fetch("/api/las/apply-fixes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Applying fixes failed with status ${res.status}`);
  }
  return res.json();
}

/**
 * Diagnose root causes of missing sensor values
 */
export async function diagnoseMissingValues(payload: {
  depth: number[];
  curves: Record<string, number[]>;
  curveMeta: Array<{ mnemonic: string; unit: string; description: string }>;
  wellInfo: ParsedLAS["wellInfo"];
}): Promise<MissingValueDiagnostic[]> {
  const res = await fetch("/api/las/diagnose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ las: payload }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Diagnostics failed with status ${res.status}`);
  }
  return res.json();
}

/**
 * Benchmark 5 imputation strategies for a specific curve channel
 */
export async function benchmarkImputation(payload: {
  depth: number[];
  curves: Record<string, number[]>;
  targetMnemonic: string;
  wellInfo: ParsedLAS["wellInfo"];
}): Promise<ImputationBenchmarkResult> {
  const res = await fetch("/api/las/benchmark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      las: {
        depth: payload.depth,
        curves: payload.curves,
        wellInfo: payload.wellInfo,
      },
      targetMnemonic: payload.targetMnemonic,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Benchmark failed with status ${res.status}`);
  }
  return res.json();
}

/**
 * Impute a missing curve series using a single chosen algorithm
 */
export async function imputeCurveChannel(payload: {
  curves: Record<string, number[]>;
  targetMnemonic: string;
  strategy: string;
  wellInfo: ParsedLAS["wellInfo"];
  k?: number;
}): Promise<{ curveMnemonic: string; strategy: string; values: number[] }> {
  const res = await fetch("/api/las/impute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      las: {
        curves: payload.curves,
        wellInfo: payload.wellInfo,
      },
      targetMnemonic: payload.targetMnemonic,
      strategy: payload.strategy,
      k: payload.k || 5,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Imputation failed with status ${res.status}`);
  }
  return res.json();
}

/**
 * Drop rows with missing values
 */
export async function dropMissingRowsApi(payload: {
  depth: number[];
  curves: Record<string, number[]>;
  wellInfo: ParsedLAS["wellInfo"];
  targetMnemonic?: string;
}): Promise<{
  depth: number[];
  curves: Record<string, number[]>;
  totalPoints: number;
  startDepth: number;
  stopDepth: number;
}> {
  const res = await fetch("/api/las/drop-rows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      las: {
        depth: payload.depth,
        curves: payload.curves,
        wellInfo: payload.wellInfo,
      },
      targetMnemonic: payload.targetMnemonic,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Drop rows failed with status ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch current user custom aliases
 */
export async function fetchUserAliases(): Promise<{ aliases: CustomAliasEntry[] }> {
  const res = await fetch("/api/standardisation/aliases", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    return { aliases: [] };
  }
  return res.json();
}

// ─── Petrophysical QA & Anomaly Repair Engine ────────────────────────────────

export interface QARepairRequestPayload {
  wellId?: string;
  wellName?: string;
  rawLasText?: string;
  rawLas?: ParsedLAS;
  despiking?: boolean;
  outlierClipping?: boolean;
  duplicateDepthPruning?: boolean;
  imputationStrategy?: string;
  duplicateAction?: "REMOVE_SECOND" | "COMPARE_ROWS";
  impossibleAction?: "REMOVE" | "CLIP" | "DELETE_ROW";
  approvedFixes?: ApprovedFix[];
}

export interface QAFixResult {
  problem: string;
  curve: string;
  depthStart: number;
  depthEnd: number;
  method?: string;
  samplesChanged: number;
}

export interface QAOtherChange {
  curve: string;
  samplesChanged: number;
  depthFrom: number;
  depthTo: number;
}

export interface QAChangeReport {
  rowsBefore: number;
  rowsAfter: number;
  rowsRemoved: number;
  valuesChangedByCurve: Record<string, number>;
  totalValuesChanged: number;
  fixResults: QAFixResult[];
  otherChanges: QAOtherChange[];
  otherRowsRemoved: number;
}

export interface QARepairResponse {
  success: boolean;
  message: string;
  wellName: string;
  wellId?: string;
  originalScore: number;
  cleanedScore: number;
  scoreDelta: number;
  originalGrade: string;
  cleanedGrade: string;
  isVerifiedClean: boolean;
  verificationReport: VerificationReport;
  cleanedLas: ParsedLAS;
  cleanedQa: QualityAnalysisResult;
  cleanedLasText: string;
  cleanedCsvText: string;
  auditCertificateId: string;
  changeReport?: QAChangeReport;
  auditLogEntry: {
    certificateId: string;
    userName: string;
    userRole: string;
    timestamp: string;
    details: string;
    actionsApplied: Record<string, boolean | string>;
  };
}

export interface QAEngineRule {
  ruleId: string;
  ruleName: string;
  description: string;
  enabled: boolean;
  threshold: number;
  unit: string;
  severity: string;
}

export interface QAEngineOverviewResponse {
  rules: QAEngineRule[];
  systemStatus: string;
  evaluatedWellsCount: number;
  totalAnomaliesDetected: number;
  targetAnomalyTypes: string[];
  supportedRepairActions: string[];
}

/**
 * Execute verified petrophysical repairs via QA Engine
 */
export async function repairQAEngine(
  payload: QARepairRequestPayload
): Promise<QARepairResponse> {
  const res = await fetch("/api/qa-engine/repair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `QA Engine repair failed with status ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch QA Engine rules overview and system status
 */
export async function getQAEngineOverview(): Promise<QAEngineOverviewResponse> {
  const res = await fetch("/api/qa-engine", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch QA Engine overview: status ${res.status}`);
  }
  return res.json();
}

/**
 * Rank null clusters with AUTO benchmark recommendations
 */
export async function rankGapsQAEngine(payload: {
  wellId?: string;
  wellName?: string;
  rawLasText?: string;
  rawLas?: ParsedLAS;
  gaps: Array<{ curve: string; depthStart: number; depthEnd: number }>;
}): Promise<{ recommendations: GapRecommendationResult[] }> {
  const res = await fetch("/api/qa-engine/rank-gaps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Gap ranking failed with status ${res.status}`);
  }
  return res.json();
}


