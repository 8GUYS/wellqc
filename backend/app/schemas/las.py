from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from backend.app.services.cleaner import CleaningOptions
from backend.app.services.parser import ParsedLAS

class CommitLASRequest(BaseModel):
    fileName: Optional[str] = None
    content: Optional[str] = None
    lasText: Optional[str] = None

class CleanRequest(BaseModel):
    content: Optional[str] = None
    options: Optional[CleaningOptions] = None

class ApprovedFixPayload(BaseModel):
    anomalyId: str
    anomalyType: str
    curveMnemonic: str
    depthStart: float
    depthEnd: float
    optionId: str
    optionLabel: str
    description: Optional[str] = None

class ApplyFixesRequest(BaseModel):
    wellId: str
    approvedFixes: List[ApprovedFixPayload] = []
    rawLasContent: Optional[str] = None
    rawLas: Optional[ParsedLAS] = None

class AnalyzeLASRequest(BaseModel):
    content: Optional[str] = None
    lasText: Optional[str] = None

class QARequest(BaseModel):
    parsed: ParsedLAS

