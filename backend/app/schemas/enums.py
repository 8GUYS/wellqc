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
    PETROPHYSICIST = "PETROPHYSICIST"
    DATA_ENGINEER = "DATA_ENGINEER"
    GEOSCIENTIST = "GEOSCIENTIST"
    VIEWER = "VIEWER"


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
    MEAN = "MEAN"
    MEDIAN = "MEDIAN"
    SPLINE = "SPLINE"
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
    UNIT_MISMATCH = "UNIT_MISMATCH"
    NULL_CLUSTER = "NULL_CLUSTER"
    IMPOSSIBLE_VALUE = "IMPOSSIBLE_VALUE"
    EXTREME_SPIKE = "EXTREME_SPIKE"
    FLATLINE = "FLATLINE"
