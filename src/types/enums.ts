/**
 * WellQC Centralized Application Enums.
 * Provides both runtime const objects and compile-time TypeScript union types.
 */

export const AnomalySeverity = {
  CRITICAL: "CRITICAL",
  WARNING: "WARNING",
  INFO: "INFO",
} as const;
export type AnomalySeverity = (typeof AnomalySeverity)[keyof typeof AnomalySeverity];

export const QualityGrade = {
  EXCELLENT: "EXCELLENT",
  GOOD: "GOOD",
  POOR: "POOR",
  CRITICAL: "CRITICAL",
  UNKNOWN: "UNKNOWN",
} as const;
export type QualityGrade = (typeof QualityGrade)[keyof typeof QualityGrade];

export const UserRole = {
  ADMIN: "ADMIN",
  PETROPHYSICIST: "PETROPHYSICIST",
  DATA_ENGINEER: "DATA_ENGINEER",
  GEOSCIENTIST: "GEOSCIENTIST",
  VIEWER: "VIEWER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SubscriptionTier = {
  FREE: "FREE",
  PRO: "PRO",
  ENTERPRISE: "ENTERPRISE",
} as const;
export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

export const WellStatus = {
  ACTIVE: "ACTIVE",
  DRILLING: "DRILLING",
  SHUT_IN: "SHUT_IN",
  COMPLETED: "COMPLETED",
  ABANDONED: "ABANDONED",
} as const;
export type WellStatus = (typeof WellStatus)[keyof typeof WellStatus];

export const DiagnosticCause = {
  CASING_SHOE_BOUNDARY: "CASING_SHOE_BOUNDARY",
  BOREHOLE_WASHOUT: "BOREHOLE_WASHOUT",
  OFF_BOTTOM_WINDOW: "OFF_BOTTOM_WINDOW",
  TELEMETRY_DROPOUT: "TELEMETRY_DROPOUT",
  UNKNOWN_SENSOR_GAP: "UNKNOWN_SENSOR_GAP",
} as const;
export type DiagnosticCause = (typeof DiagnosticCause)[keyof typeof DiagnosticCause];

export const ImputationStrategy = {
  KNN: "KNN",
  LINEAR: "LINEAR",
  MEAN: "MEAN",
  MEDIAN: "MEDIAN",
  SPLINE: "SPLINE",
  ROW_DROPPING: "ROW_DROPPING",
} as const;
export type ImputationStrategy = (typeof ImputationStrategy)[keyof typeof ImputationStrategy];

export const ThresholdAction = {
  DROP_ROWS: "DROP_ROWS",
  APPLY_IMPUTATION: "APPLY_IMPUTATION",
  NO_ACTION_NEEDED: "NO_ACTION_NEEDED",
} as const;
export type ThresholdAction = (typeof ThresholdAction)[keyof typeof ThresholdAction];

export const AnomalyType = {
  NULL_DEPTH: "NULL_DEPTH",
  DUPLICATE_DEPTH: "DUPLICATE_DEPTH",
  DEPTH_GAP: "DEPTH_GAP",
  UNIT_MISMATCH: "UNIT_MISMATCH",
  NULL_CLUSTER: "NULL_CLUSTER",
  IMPOSSIBLE_VALUE: "IMPOSSIBLE_VALUE",
  EXTREME_SPIKE: "EXTREME_SPIKE",
  FLATLINE: "FLATLINE",
} as const;
export type AnomalyType = (typeof AnomalyType)[keyof typeof AnomalyType];
