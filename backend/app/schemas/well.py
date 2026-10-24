from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Any, Dict
from backend.app.core.security import detect_sql_injection, sanitize_text, validate_safe_identifier

class CreateWellRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    apiNo: Optional[str] = Field(None, max_length=80)
    operatorName: Optional[str] = Field(None, max_length=120)
    fieldName: Optional[str] = Field(None, max_length=120)
    basin: Optional[str] = Field(None, max_length=120)
    country: Optional[str] = Field(None, max_length=100)
    tdFt: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        threat = detect_sql_injection(v, "well_name")
        if threat:
            raise ValueError(f"Malicious input detected in well name: {threat}")
        return validate_safe_identifier(v, "Well name", max_len=120)

    @field_validator("apiNo")
    @classmethod
    def validate_api_no(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        threat = detect_sql_injection(v, "api_number")
        if threat:
            raise ValueError(f"Malicious input detected in API number: {threat}")
        return validate_safe_identifier(v, "API Number", max_len=80)

    @field_validator("operatorName", "fieldName", "basin", "country")
    @classmethod
    def sanitize_field_texts(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        threat = detect_sql_injection(v, "metadata_field")
        if threat:
            raise ValueError(f"Malicious input detected in well metadata: {threat}")
        return sanitize_text(v, max_length=120)

class CurveHealthSummaryItem(BaseModel):
    mnemonic: str
    standardMnemonic: str
    unit: str
    nullCount: int
    totalPoints: int
    nullPercentage: float
    minVal: Optional[float] = None
    maxVal: Optional[float] = None
    meanVal: Optional[float] = None
    healthScore: int
    status: str
    anomalies: List[Any] = []

class WellListItem(BaseModel):
    id: str
    apiNo: str
    name: str
    operatorName: str
    fieldName: str
    basin: str
    country: str
    latitude: float
    longitude: float
    elevFt: float
    tdFt: float
    depthUnit: str
    status: str
    qualityScore: int
    qualityGrade: str
    latestLasFileName: Optional[str] = None
    latestLasFileId: Optional[str] = None
    latestReportId: Optional[str] = None
    curveCount: int = 0
    pointCount: int = 0
    anomalyCount: int = 0
    curveSummaries: List[Dict[str, Any]] = []
    ownerId: Optional[str] = None
    uploaderName: Optional[str] = None
    uploaderEmail: Optional[str] = None
    latestLasFileCreatedAt: Optional[str] = None
    createdAt: str
    updatedAt: str

class WellDetailResponse(BaseModel):
    well: WellListItem
    aiSummary: str
    recommendations: List[str]
    curvesData: List[Dict[str, Any]]
    curveSummaries: List[Dict[str, Any]]
    anomalies: List[Dict[str, Any]]

class BulkDeleteWellsRequest(BaseModel):
    wellIds: List[str] = Field(..., max_length=100)

    @field_validator("wellIds")
    @classmethod
    def validate_ids(cls, v: List[str]) -> List[str]:
        cleaned = []
        for wid in v:
            threat = detect_sql_injection(wid, "well_id")
            if threat:
                raise ValueError(f"Malicious identifier detected: {threat}")
            cleaned.append(validate_safe_identifier(wid, "Well ID", max_len=64))
        return cleaned

class BulkDeleteWellsResponse(BaseModel):
    success: bool
    deletedCount: int
    deletedIds: List[str]
    message: str
