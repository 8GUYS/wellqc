"""
Pydantic schemas for the WellQC Python Parser Service.

These mirror the TypeScript types in src/lib/las/imputation-engine.ts 1:1
so the Next.js app can deserialize responses without any field mapping.
"""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

ImputationStrategy = Literal["KNN", "LINEAR", "MEAN", "MEDIAN", "SPLINE", "ROW_DROPPING"]

MissingValueCause = Literal[
    "CASING_SHOE_BOUNDARY",
    "BOREHOLE_WASHOUT",
    "TELEMETRY_DROPOUT",
    "OFF_BOTTOM_WINDOW",
    "UNKNOWN_SENSOR_GAP",
]

ThresholdAction = Literal["DROP_ROWS", "APPLY_IMPUTATION", "NO_ACTION_NEEDED"]


# ---------------------------------------------------------------------------
# Inbound: the shape of ParsedLAS the Next.js app already produces
# (src/lib/las/parser.ts). The service is a consumer of this, not a producer
# — LAS files are still parsed client/server-side in TS.
# ---------------------------------------------------------------------------

class WellInfo(BaseModel):
    nullValue: float
    startDepth: float
    stopDepth: float
    depthUnit: str = "ft"


class CurveMeta(BaseModel):
    mnemonic: str


class LASPayload(BaseModel):
    """Mirrors ParsedLAS. curves is Record<string, number[]> keyed by mnemonic."""

    depth: List[float]
    curves: Dict[str, List[float]] = Field(..., description="mnemonic -> values, aligned to depth")
    curveMeta: List[CurveMeta] = Field(..., description="mirrors las.curves")
    wellInfo: WellInfo


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


# ---------------------------------------------------------------------------
# Outbound
# ---------------------------------------------------------------------------

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