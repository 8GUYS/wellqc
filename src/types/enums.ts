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
  USER: "USER",
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
  SPLINE: "SPLINE",
  RANDOM_FOREST: "RANDOM_FOREST",
  GRADIENT_BOOSTING: "GRADIENT_BOOSTING",
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
  DUPLICATE_CURVE: "DUPLICATE_CURVE",
  NON_STANDARD_MNEMONIC: "NON_STANDARD_MNEMONIC",
  UNIT_MISMATCH: "UNIT_MISMATCH",
  UNIT_INFERRED: "UNIT_INFERRED",
  NULL_CLUSTER: "NULL_CLUSTER",
  IMPOSSIBLE_VALUE: "IMPOSSIBLE_VALUE",
  OUT_OF_TYPICAL_RANGE: "OUT_OF_TYPICAL_RANGE",
  EXTREME_SPIKE: "EXTREME_SPIKE",
  CYCLE_SKIP: "CYCLE_SKIP",
  FLATLINE: "FLATLINE",
  MISSING_CORE_CURVE: "MISSING_CORE_CURVE",
} as const;
export type AnomalyType = (typeof AnomalyType)[keyof typeof AnomalyType];

// ─── Payment & Billing Enums ──────────────────────────────────────────────────

export const PaymentStatus = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  ABANDONED: "ABANDONED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
export const TransactionStatus = PaymentStatus;
export type TransactionStatus = PaymentStatus;

export const PaymentChannel = {
  CARD: "card",
  BANK_TRANSFER: "bank_transfer",
  USSD: "ussd",
  MOBILE_MONEY: "mobile_money",
  QR: "qr",
  EFT: "eft",
} as const;
export type PaymentChannel = (typeof PaymentChannel)[keyof typeof PaymentChannel];

export const BillingInterval = {
  MONTHLY: "monthly",
  ANNUALLY: "annually",
  ONE_TIME: "one-time",
} as const;
export type BillingInterval = (typeof BillingInterval)[keyof typeof BillingInterval];

// ─── File & Asset Operational Statuses ────────────────────────────────────────

export const LASFileStatus = {
  PENDING: "PENDING",
  PROCESSED: "PROCESSED",
  FAILED: "FAILED",
  COMMITTED: "COMMITTED",
} as const;
export type LASFileStatus = (typeof LASFileStatus)[keyof typeof LASFileStatus];

export const UploadStatus = {
  READY: "ready",
  SAVING: "saving",
  SAVED: "saved",
  ERROR: "error",
  PROCESSING: "processing",
  PENDING: "pending",
} as const;
export type UploadStatus = (typeof UploadStatus)[keyof typeof UploadStatus];

export const CurveStatus = {
  VALID: "VALID",
  WARNING: "WARNING",
  CORRUPTED: "CORRUPTED",
  FLAGGED: "FLAGGED",
} as const;
export type CurveStatus = (typeof CurveStatus)[keyof typeof CurveStatus];

export const AnomalyStatus = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
  IGNORED: "IGNORED",
  REVIEWED: "REVIEWED",
} as const;
export type AnomalyStatus = (typeof AnomalyStatus)[keyof typeof AnomalyStatus];

// ─── Stratigraphy & Multi-Well Comparison Enums ───────────────────────────────

export const FormationMarkerSource = {
  INTERPRETER: "INTERPRETER",
  BIOSTRATIGRAPHY: "BIOSTRATIGRAPHY",
  CORE: "CORE",
  SEISMIC: "SEISMIC",
  ESTIMATED: "ESTIMATED",
  VERIFIED: "VERIFIED",
} as const;
export type FormationMarkerSource = (typeof FormationMarkerSource)[keyof typeof FormationMarkerSource];

export const StratigraphicContinuity = {
  HIGH: "HIGH",
  MODERATE: "MODERATE",
  LOW: "LOW",
  DISCONTINUOUS: "DISCONTINUOUS",
} as const;
export type StratigraphicContinuity = (typeof StratigraphicContinuity)[keyof typeof StratigraphicContinuity];

export const ComparisonMatchGrade = {
  EXCELLENT_MATCH: "EXCELLENT_MATCH",
  GOOD_MATCH: "GOOD_MATCH",
  MODERATE_MATCH: "MODERATE_MATCH",
  POOR_MATCH: "POOR_MATCH",
} as const;
export type ComparisonMatchGrade = (typeof ComparisonMatchGrade)[keyof typeof ComparisonMatchGrade];

export const CurveAvailability = {
  BOTH: "BOTH",
  WELL_A_ONLY: "WELL_A_ONLY",
  WELL_B_ONLY: "WELL_B_ONLY",
} as const;
export type CurveAvailability = (typeof CurveAvailability)[keyof typeof CurveAvailability];

// ─── Governance & Audit Action Enums ──────────────────────────────────────────

export const ActivityAction = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  REGISTER: "REGISTER",
  UPLOAD_LAS: "UPLOAD_LAS",
  COMMIT_WELL: "COMMIT_WELL",
  EXPORT_LAS: "EXPORT_LAS",
  EXPORT_CSV: "EXPORT_CSV",
  EXPORT_PDF: "EXPORT_PDF",
  QA_REPAIR: "QA_REPAIR",
  STANDARDISE: "STANDARDISE",
  PAYMENT_INITIALIZE: "PAYMENT_INITIALIZE",
  PAYMENT_SUCCESS: "PAYMENT_SUCCESS",
  ADMIN_VERIFY_EMAIL: "ADMIN_VERIFY_EMAIL",
  ADMIN_UPDATE_USER: "ADMIN_UPDATE_USER",
  ADMIN_DELETE_USER: "ADMIN_DELETE_USER",
} as const;
export type ActivityAction = (typeof ActivityAction)[keyof typeof ActivityAction];
