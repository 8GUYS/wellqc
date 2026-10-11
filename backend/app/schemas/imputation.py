from __future__ import annotations
from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field

from backend.app.schemas.enums import (
    DiagnosticCause as MissingValueCause,
    ImputationStrategy,
    ThresholdAction,
)

class WellInfoPayload(BaseModel):
    nullValue: Optional[float] = None
    startDepth: float = 0.0
    stopDepth: float = 0.0
    depthUnit: str = "ft"

class CurveMetaPayload(BaseModel):
    mnemonic: str

class LASPayload(BaseModel):
    depth: List[float]
    curves: Dict[str, List[float]] = Field(..., description="mnemonic -> values, aligned to depth")
    curveMeta: List[CurveMetaPayload] = Field(..., description="mirrors las.curves")
    wellInfo: WellInfoPayload

class DiagnoseRequest(BaseModel):
    las: LASPayload

class ImputeRequest(BaseModel):
    las: LASPayload
    targetMnemonic: str
    strategy: ImputationStrategy
    k: int = 5  # only used for KNN

class BenchmarkRequest(BaseModel):
    las: LASPayload
    targetMnemonic: str

class DropRowsRequest(BaseModel):
    las: LASPayload
    targetMnemonic: Optional[str] = None

class MissingValueDiagnostic(BaseModel):
    curveMnemonic: str
    totalPoints: int
    nullCount: int
    nullPercentage: float
    primaryCause: MissingValueCause
    causeDescription: str
    recommendedStrategy: ImputationStrategy
    recommendedThresholdAction: ThresholdAction

class ImputeResponse(BaseModel):
    curveMnemonic: str
    strategy: ImputationStrategy
    values: List[float]

class ImputationBenchmarkMetric(BaseModel):
    strategy: ImputationStrategy
    strategyLabel: str
    rmse: float
    mae: float
    r2Score: float
    varianceRatio: float
    executionTimeMs: float
    rank: int
    isRecommended: bool
    notes: str

class ImputationBenchmarkResult(BaseModel):
    curveMnemonic: str
    totalNullCount: int
    nullPercentage: float
    testedSampleCount: int
    metrics: List[ImputationBenchmarkMetric]
    bestStrategy: ImputationStrategy
    recommendationReason: str

class DropRowsResponse(BaseModel):
    depth: List[float]
    curves: Dict[str, List[float]]
    totalPoints: int
    startDepth: float
    stopDepth: float
