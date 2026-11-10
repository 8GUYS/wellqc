from enum import Enum


class AnomalySeverity(str, Enum):
    """Severity classification for petrophysical anomalies."""
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


class QualityGrade(str, Enum):
    """Quality grade categories for well logs."""
    EXCELLENT = "EXCELLENT"
    GOOD = "GOOD"
    POOR = "POOR"
    CRITICAL = "CRITICAL"
    UNKNOWN = "UNKNOWN"


class UserRole(str, Enum):
    """User access control roles."""
    ADMIN = "ADMIN"
    USER = "USER"


class SubscriptionTier(str, Enum):
    """SaaS billing and quota tiers."""
    FREE = "FREE"
    PRO = "PRO"
    ENTERPRISE = "ENTERPRISE"


class WellStatus(str, Enum):
    """Operational borehole status."""
    ACTIVE = "ACTIVE"
    DRILLING = "DRILLING"
    SHUT_IN = "SHUT_IN"
    COMPLETED = "COMPLETED"
    ABANDONED = "ABANDONED"


class DiagnosticCause(str, Enum):
    """Physical or telemetry root-cause diagnostic for null intervals."""
    CASING_SHOE_BOUNDARY = "CASING_SHOE_BOUNDARY"
    BOREHOLE_WASHOUT = "BOREHOLE_WASHOUT"
    OFF_BOTTOM_WINDOW = "OFF_BOTTOM_WINDOW"
    TELEMETRY_DROPOUT = "TELEMETRY_DROPOUT"
    UNKNOWN_SENSOR_GAP = "UNKNOWN_SENSOR_GAP"


class ImputationStrategy(str, Enum):
    """Supported mathematical imputation and repair algorithms."""
    KNN = "KNN"
    LINEAR = "LINEAR"
    SPLINE = "SPLINE"
    RANDOM_FOREST = "RANDOM_FOREST"
    GRADIENT_BOOSTING = "GRADIENT_BOOSTING"
    ROW_DROPPING = "ROW_DROPPING"


class ThresholdAction(str, Enum):
    """Automated repair recommendation based on missing data percentage."""
    DROP_ROWS = "DROP_ROWS"
    APPLY_IMPUTATION = "APPLY_IMPUTATION"
    NO_ACTION_NEEDED = "NO_ACTION_NEEDED"


class AnomalyType(str, Enum):
    """Standardized catalog of petrophysical anomalies."""
    NULL_DEPTH = "NULL_DEPTH"
    DUPLICATE_DEPTH = "DUPLICATE_DEPTH"
    DEPTH_GAP = "DEPTH_GAP"
    DUPLICATE_CURVE = "DUPLICATE_CURVE"
    NON_STANDARD_MNEMONIC = "NON_STANDARD_MNEMONIC"
    UNIT_MISMATCH = "UNIT_MISMATCH"
    UNIT_INFERRED = "UNIT_INFERRED"
    NULL_CLUSTER = "NULL_CLUSTER"
    IMPOSSIBLE_VALUE = "IMPOSSIBLE_VALUE"
    OUT_OF_TYPICAL_RANGE = "OUT_OF_TYPICAL_RANGE"
    EXTREME_SPIKE = "EXTREME_SPIKE"
    CYCLE_SKIP = "CYCLE_SKIP"
    FLATLINE = "FLATLINE"
    MISSING_CORE_CURVE = "MISSING_CORE_CURVE"


# ─── Payment & Billing Enums ──────────────────────────────────────────────────

class PaymentStatus(str, Enum):
    """Paystack transaction settlement status."""
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    ABANDONED = "ABANDONED"

TransactionStatus = PaymentStatus


class PaymentChannel(str, Enum):
    """Payment channels supported by Paystack."""
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    USSD = "ussd"
    MOBILE_MONEY = "mobile_money"
    QR = "qr"
    EFT = "eft"


class BillingInterval(str, Enum):
    """Subscription billing cadence."""
    MONTHLY = "monthly"
    ANNUALLY = "annually"
    ONE_TIME = "one-time"


# ─── File & Asset Operational Statuses ────────────────────────────────────────

class LASFileStatus(str, Enum):
    """LAS file parsing and persistence lifecycle status."""
    PENDING = "PENDING"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"
    COMMITTED = "COMMITTED"


class UploadStatus(str, Enum):
    """Frontend upload workspace queue status."""
    READY = "ready"
    SAVING = "saving"
    SAVED = "saved"
    ERROR = "error"
    PROCESSING = "processing"
    PENDING = "pending"


class CurveStatus(str, Enum):
    """Individual curve channel integrity status."""
    VALID = "VALID"
    WARNING = "WARNING"
    CORRUPTED = "CORRUPTED"
    FLAGGED = "FLAGGED"


class AnomalyStatus(str, Enum):
    """Log anomaly resolution state."""
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"
    IGNORED = "IGNORED"
    REVIEWED = "REVIEWED"


# ─── Stratigraphy & Multi-Well Comparison Enums ───────────────────────────────

class FormationMarkerSource(str, Enum):
    """Provenance and source methodology for formation tops."""
    INTERPRETER = "INTERPRETER"
    BIOSTRATIGRAPHY = "BIOSTRATIGRAPHY"
    CORE = "CORE"
    SEISMIC = "SEISMIC"
    ESTIMATED = "ESTIMATED"
    VERIFIED = "VERIFIED"


class StratigraphicContinuity(str, Enum):
    """Pairwise curve cross-correlation continuity grade."""
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    LOW = "LOW"
    DISCONTINUOUS = "DISCONTINUOUS"


class ComparisonMatchGrade(str, Enum):
    """Overall multi-well stratigraphic alignment grade."""
    EXCELLENT_MATCH = "EXCELLENT_MATCH"
    GOOD_MATCH = "GOOD_MATCH"
    MODERATE_MATCH = "MODERATE_MATCH"
    POOR_MATCH = "POOR_MATCH"


class CurveAvailability(str, Enum):
    """Curve presence classification across comparison pairs."""
    BOTH = "BOTH"
    WELL_A_ONLY = "WELL_A_ONLY"
    WELL_B_ONLY = "WELL_B_ONLY"


# ─── Governance & Audit Action Enums ──────────────────────────────────────────

class ActivityAction(str, Enum):
    """Audit trail activity action tags."""
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    REGISTER = "REGISTER"
    UPLOAD_LAS = "UPLOAD_LAS"
    COMMIT_WELL = "COMMIT_WELL"
    EXPORT_LAS = "EXPORT_LAS"
    EXPORT_CSV = "EXPORT_CSV"
    EXPORT_PDF = "EXPORT_PDF"
    QA_REPAIR = "QA_REPAIR"
    STANDARDISE = "STANDARDISE"
    PAYMENT_INITIALIZE = "PAYMENT_INITIALIZE"
    PAYMENT_SUCCESS = "PAYMENT_SUCCESS"
    ADMIN_VERIFY_EMAIL = "ADMIN_VERIFY_EMAIL"
    ADMIN_UPDATE_USER = "ADMIN_UPDATE_USER"
    ADMIN_DELETE_USER = "ADMIN_DELETE_USER"
