from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class CreateWellRequest(BaseModel):
    name: Optional[str] = None
    apiNo: Optional[str] = None
    operatorName: Optional[str] = None
    fieldName: Optional[str] = None
    basin: Optional[str] = None
    country: Optional[str] = None
    tdFt: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

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
    createdAt: str
    updatedAt: str

class WellDetailResponse(BaseModel):
    well: WellListItem
    aiSummary: str
    recommendations: List[str]
    curvesData: List[Dict[str, Any]]
    curveSummaries: List[Dict[str, Any]]
    anomalies: List[Dict[str, Any]]
