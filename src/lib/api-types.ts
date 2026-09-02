export interface WellListItem {
  id: string;
  apiNo: string;
  name: string;
  operatorName: string;
  fieldName: string;
  basin: string;
  country: string;
  latitude: number;
  longitude: number;
  elevFt: number;
  tdFt: number;
  depthUnit: string;
  status: string;
  qualityScore: number;
  qualityGrade: string;
  latestLasFileName: string | null;
  latestLasFileId: string | null;
  latestReportId: string | null;
  curveCount: number;
  pointCount: number;
  anomalyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityListItem {
  id: string;
  userName: string;
  userRole: string;
  action: string;
  target: string;
  details: string;
  timestamp: string;
  ip: string;
}

export interface DashboardSummary {
  totalWells: number;
  lasFilesUploaded: number;
  averageQualityScore: number;
  averageQualityGrade: string;
  curvesAnalysed: number;
  errorsDetected: number;
  missingCurves: number;
  anomaliesFound: number;
  cleanedTodayLabel: string;
  uploadedToday: number;
  trend: Array<{
    date: string;
    avgScore: number;
    filesUploaded: number;
    anomalies: number;
  }>;
  fieldPerformance: Array<{
    field: string;
    score: number;
    wells: number;
    status: string;
  }>;
  problemWells: Array<{
    id: string;
    name: string;
    api: string;
    score: number;
    grade: string;
    issue: string;
  }>;
  recentActivity: ActivityListItem[];
}

export interface WellDetailResponse {
  well: WellListItem;
  aiSummary: string;
  recommendations: string[];
  curvesData: {
    depth: number[];
    curves: Record<string, number[]>;
  };
  anomalies: Array<{
    curveMnemonic: string;
    depthStart: number;
    depthEnd: number;
    anomalyType: string;
    severity: "CRITICAL" | "WARNING" | "INFO";
    description: string;
    suggestedCorrection: string;
  }>;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

/** Response shape from GET /api/analytics */
export interface AnalyticsResponse {
  operatorScores: Array<{
    operator: string;
    score: number;
    files: number;
  }>;
  anomalyDistribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}

// ─── Upload / LAS Pre-Check ───────────────────────────────────────────────────

/** Anomaly flag returned during LAS upload pre-check */
export interface UploadAnomalyItem {
  curveMnemonic: string;
  depthStart: number;
  depthEnd: number;
  anomalyType: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  description: string;
  suggestedCorrection: string;
}

/** Standardised curve mapping returned during LAS upload pre-check */
export interface UploadCurveMapping {
  rawMnemonic: string;
  standardMnemonic: string;
  confidence: number;
  unit: string;
  unitMismatch: boolean;
}

/** Full pre-check result from POST /api/las (before DB commit) */
export interface LASUploadPreCheckResult {
  wellName: string;
  company: string;
  field: string;
  apiUwi: string;
  startDepth: number;
  stopDepth: number;
  step: number;
  depthUnit: string;
  totalPoints: number;
  curveCount: number;
  overallScore: number;
  qualityGrade: "EXCELLENT" | "GOOD" | "POOR" | "CRITICAL";
  completenessScore: number;
  consistencyScore: number;
  anomalyCount: number;
  criticalCount: number;
  warningCount: number;
  curveMappings: UploadCurveMapping[];
  anomalies: UploadAnomalyItem[];
  aiSummary: string;
  recommendations: string[];
}

/** Response from POST /api/las after successful DB commit */
export interface LASCommitResponse {
  wellId: string;
  lasFileId: string;
  reportId: string;
  message: string;
}

// ─── Standardisation Dictionary ───────────────────────────────────────────────

/** A single entry in the mnemonic alias dictionary */
export interface StandardCurveEntry {
  standardMnemonic: string;
  description: string;
  unit: string;
  minValue: number;
  maxValue: number;
  aliases: string[];
}

/** Response from GET /api/standardisation */
export interface StandardisationDictionaryResponse {
  standardCurves: StandardCurveEntry[];
  customAliases: Array<{
    id: string;
    rawMnemonic: string;
    standardMnemonic: string;
    addedBy: string;
    addedAt: string;
  }>;
}

// ─── QA Engine ────────────────────────────────────────────────────────────────

/** Threshold configuration for a single QA rule */
export interface QARuleConfig {
  ruleId: string;
  ruleName: string;
  description: string;
  enabled: boolean;
  threshold: number;
  unit: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
}

/** Live evaluation result for one QA rule against current wells */
export interface QARuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  wellsAffected: number;
  anomaliesRaised: number;
  severity: "CRITICAL" | "WARNING" | "INFO";
}

/** Response from GET /api/qa-engine */
export interface QAEngineResponse {
  rules: QARuleConfig[];
  lastEvaluated: string | null;
  evaluationResults: QARuleEvaluationResult[];
}

// ─── Well Comparison ──────────────────────────────────────────────────────────

/** QA summary block for one well within a comparison */
export interface ComparisonWellSummary {
  wellId: string;
  wellName: string;
  apiNo: string;
  operatorName: string;
  overallScore: number;
  qualityGrade: "EXCELLENT" | "GOOD" | "POOR" | "CRITICAL";
  completenessScore: number;
  consistencyScore: number;
  anomalyCount: number;
  criticalCount: number;
  warningCount: number;
  curvesData: {
    depth: number[];
    curves: Record<string, number[]>;
  };
}

/** Response from GET /api/comparison?wellIds=id1,id2,... */
export interface WellComparisonResponse {
  wells: ComparisonWellSummary[];
}

// ─── Reports & Exports ────────────────────────────────────────────────────────

/** Metadata for one available report export */
export interface ReportManifestItem {
  reportId: string;
  wellId: string;
  wellName: string;
  lasFileName: string;
  overallScore: number;
  qualityGrade: "EXCELLENT" | "GOOD" | "POOR" | "CRITICAL";
  anomalyCount: number;
  generatedAt: string;
}

/** Response from GET /api/reports */
export interface ReportsListResponse {
  reports: ReportManifestItem[];
  totalReports: number;
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────

/** User record returned in the Admin panel */
export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "PETROPHYSICIST" | "DATA_ENGINEER" | "GEOSCIENTIST" | "VIEWER";
  ndaAcceptedAt: string | null;
  createdAt: string;
  wellCount: number;
}

/** API token record */
export interface AdminAPIToken {
  id: string;
  name: string;
  tokenPreview: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

/** Webhook configuration record */
export interface AdminWebhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  lastFiredAt: string | null;
}

/** Response from GET /api/admin */
export interface AdminPanelResponse {
  users: AdminUserRecord[];
  apiTokens: AdminAPIToken[];
  webhooks: AdminWebhook[];
}

// ─── User Profile & Billing ───────────────────────────────────────────────────

/** User profile details returned by GET /api/user/profile */
export interface UserProfileDetails {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  tier: "FREE" | "PRO" | "ENTERPRISE";
  freeChecksUsed: number;
  maxFreeChecks: number;
  totalFilesUploaded: number;
  ndaAcceptedAt: string | null;
  createdAt: string;
}

/** Paystack payment transaction record */
export interface PaymentRecord {
  id: string;
  reference: string;
  planName: string;
  amount: string;
  channel: string;
  status: string;
  date: string;
}

/** Full response from GET /api/user/profile */
export interface UserProfileResponse {
  user: UserProfileDetails;
  paymentRecords: PaymentRecord[];
  recentActivity: ActivityListItem[];
}
