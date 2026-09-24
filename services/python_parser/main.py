"""
WellQC Python Parser Service — Sprint 4, CE2.

Owns every imputation/benchmark-heavy numerical operation (KNN, spline,
mean/median/linear + the ground-truth benchmarking suite). LAS parsing and
quality scoring stay in TypeScript (src/lib/las/parser.ts) for instant
client-side feedback; this service receives already-parsed LAS JSON.

/parse-las is included as a secondary, optional entry point: it lets the
service accept a raw .las file directly (via lasio) for batch jobs or as an
independent cross-check against the TS parser — it is NOT on the primary
upload path.
"""

from __future__ import annotations

import io
import math
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .diagnostics import diagnose_missing_value_causes
from .imputation import benchmark_imputation_methods, drop_missing_rows, run_single_strategy
from .models import (
    BenchmarkRequest,
    DiagnoseRequest,
    DropRowsRequest,
    DropRowsResponse,
    ImputationBenchmarkResult,
    ImputeRequest,
    ImputeResponse,
    MissingValueDiagnostic,
)

app = FastAPI(title="WellQC Python Parser Service", version="0.2.0")

# Tighten allow_origins to the deployed Next.js origin(s) before shipping to prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _json_safe(value: float) -> Optional[float]:
    """lasio represents LAS null markers as NaN; Starlette's JSONResponse
    uses allow_nan=False, so NaN must become None (-> JSON null) before
    it reaches the response."""
    return None if math.isnan(value) else value


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/diagnose", response_model=list[MissingValueDiagnostic])
def diagnose(req: DiagnoseRequest):
    return diagnose_missing_value_causes(
        depth=req.las.depth,
        curves=req.las.curves,
        curve_meta=req.las.curveMeta,
        well_info=req.las.wellInfo,
    )


@app.post("/impute", response_model=ImputeResponse)
def impute(req: ImputeRequest):
    if req.targetMnemonic not in req.las.curves:
        raise HTTPException(status_code=422, detail=f"Unknown curve mnemonic: {req.targetMnemonic}")

    values = run_single_strategy(
        curves=req.las.curves,
        target_mnemonic=req.targetMnemonic,
        strategy=req.strategy,
        null_value=req.las.wellInfo.nullValue,
        k=req.k,
    )
    return ImputeResponse(curveMnemonic=req.targetMnemonic, strategy=req.strategy, values=values)


@app.post("/benchmark", response_model=ImputationBenchmarkResult)
def benchmark(req: BenchmarkRequest):
    if req.targetMnemonic not in req.las.curves:
        raise HTTPException(status_code=422, detail=f"Unknown curve mnemonic: {req.targetMnemonic}")

    return benchmark_imputation_methods(
        depth=req.las.depth,
        curves=req.las.curves,
        target_mnemonic=req.targetMnemonic,
        null_value=req.las.wellInfo.nullValue,
    )


@app.post("/drop-rows", response_model=DropRowsResponse)
def drop_rows(req: DropRowsRequest):
    result = drop_missing_rows(
        depth=req.las.depth,
        curves=req.las.curves,
        null_value=req.las.wellInfo.nullValue,
        target_mnemonic=req.targetMnemonic,
    )
    return DropRowsResponse(**result)


@app.post("/parse-las")
async def parse_las(file: UploadFile = File(...)):
    """
    Secondary path: parse a raw .las file with lasio and return it in the
    same shape as ParsedLAS (src/lib/las/parser.ts) so it's a drop-in
    substitute if you ever need server-side/batch parsing instead of the
    browser-based TS parser.
    """
    try:
        import lasio  # imported lazily so /health etc. work even if lasio isn't installed yet
    except ImportError as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="lasio is not installed on this service") from exc

    raw = await file.read()
    try:
        las = lasio.read(io.StringIO(raw.decode("utf-8", errors="replace")))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to parse LAS file: {exc}") from exc

    null_value = float(las.well.NULL.value) if "NULL" in las.well else -999.25

    def _json_safe(value: float) -> float:
        """lasio represents LAS null markers as NaN, which JSON can't carry
        and which downstream endpoints (/benchmark, /diagnose, etc.) don't
        expect either — they detect missing data via null_value instead.
        So NaN is swapped for the file's own null marker."""
        return null_value if math.isnan(value) else value

    depth_curve = las.curves[0]  # LAS convention: first curve is the index (depth)
    depth = [_json_safe(float(v)) for v in depth_curve.data]

    curves = {}
    curve_meta = []
    for curve in las.curves:
        curves[curve.mnemonic] = [_json_safe(float(v)) for v in curve.data]
        curve_meta.append({"mnemonic": curve.mnemonic})

    return {
        "depth": depth,
        "curves": curves,
        "curveMeta": curve_meta,
        "wellInfo": {
            "nullValue": null_value,
            "startDepth": float(depth[0]) if depth else 0.0,
            "stopDepth": float(depth[-1]) if depth else 0.0,
            "depthUnit": depth_curve.unit or "ft",
        },
    }