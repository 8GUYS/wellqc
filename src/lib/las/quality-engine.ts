/**
 * Well Log Quality Assurance Types.
 * All petrophysical quality assurance checks and anomaly detection are executed via
 * the Python FastAPI microservice (backend/app/services/quality_engine.py).
 * Domain types are centralized in src/lib/api-types.ts.
 */

export type {
  AnomalyType,
  AnomalyReportItem,
  QualityAnomaly,
  CurveHealthSummary,
  QualityAnalysisResult,
} from "@/lib/api-types";
