/**
 * WellQC+ Enterprise API Client for Python Backend Services
 * Connects frontend Next.js pages directly to FastAPI endpoints.
 */

import { ParsedLAS } from "./parser";
import { QualityAnalysisResult } from "./quality-engine";
import { AIAnalysisOutput } from "./ai-analyzer";
import { CleanedLogResult, CleaningOptions, VerificationReport } from "./cleaner";
import {
  MissingValueDiagnostic,
  ImputationBenchmarkResult,
} from "./imputation-engine";
import { CustomAliasEntry } from "./standardiser";

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
