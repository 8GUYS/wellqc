from datetime import datetime, timezone
import hashlib
import json
import math
import re
import secrets
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user, get_current_user_optional
from backend.app.models.models import (
    ActivityLog,
    Anomaly,
    Curve,
    Field,
    LASFile,
    Operator,
    QualityReport,
    User,
    Well,
)
from backend.app.schemas.las import (
    AnalyzeLASRequest,
    ApplyFixesRequest,
    CleanRequest,
    CommitLASRequest,
    QARequest,
)
from backend.app.schemas.imputation import (
    BenchmarkRequest,
    DiagnoseRequest,
    DropRowsRequest,
    DropRowsResponse,
    ImputationBenchmarkResult,
    ImputeRequest,
    ImputeResponse,
    MissingValueDiagnostic,
)
from backend.app.services.ai_analyzer import generate_ai_analysis
from backend.app.services.cleaner import clean_las_log_data, CleaningOptions
from backend.app.services.diagnostics import diagnose_missing_value_causes
from backend.app.services.imputation import (
    benchmark_imputation_methods,
    drop_missing_rows,
    run_single_strategy,
)
from backend.app.services.parser import parse_las_content, ParsedLAS, LASParseError
from backend.app.services.quality_engine import analyze_well_log_quality
from backend.app.services.standardiser import (
    CustomAliasEntry,
    get_custom_aliases,
    standardise_mnemonic,
)
from backend.app.api.standardisation import _get_user_aliases
from backend.app.services.ingestion_service import commit_las_file_transaction

router = APIRouter(prefix="/api/las", tags=["las"])


def _parse_or_400(content: str, aliases: Optional[List[CustomAliasEntry]] = None) -> ParsedLAS:
    try:
        return parse_las_content(content, custom_aliases=aliases)
    except LASParseError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post("/check")
def check_limit(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tier = current_user.tier or "FREE"
    checks_used = current_user.freeChecksUsed or 0

    return {
        "allowed": True,
        "tier": tier,
        "freeChecksUsed": checks_used,
        "maxFreeChecks": 2,
        "remainingChecks": max(0, 2 - checks_used) if tier == "FREE" else None,
    }


@router.get("/check")
def get_check_status(current_user: User = Depends(get_current_user)):
    tier = current_user.tier or "FREE"
    checks_used = current_user.freeChecksUsed or 0
    return {
        "tier": tier,
        "freeChecksUsed": checks_used,
        "maxFreeChecks": 2,
        "remainingChecks": max(0, 2 - checks_used) if tier == "FREE" else None,
        "limitReached": False,
    }


@router.post("/analyze")
def analyze_las_endpoint(
    req: AnalyzeLASRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    content = (req.content or req.lasText or "").strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LAS file content is required.",
        )

    server_aliases = _get_user_aliases(db, current_user)
    parsed = _parse_or_400(content, server_aliases)
    qa = analyze_well_log_quality(parsed, server_aliases)
    ai = generate_ai_analysis(parsed, qa)

    return {
        "parsed": parsed.model_dump(),
        "qa": qa.model_dump(),
        "ai": ai.model_dump(),
        "warnings": parsed.warnings,
    }


@router.post("/qa")
def rerun_qa_endpoint(
    req: QARequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    server_aliases = _get_user_aliases(db, current_user)
    qa = analyze_well_log_quality(req.parsed, server_aliases)
    return qa.model_dump()


@router.post("")
def handle_las(
    req: CommitLASRequest,
    action: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    content = (req.content or req.lasText or "").strip()
    file_name = (req.fileName or "").strip() or "uploaded-well-log.las"

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LAS file content is required.",
        )

    server_aliases = _get_user_aliases(db, current_user)
    parsed = _parse_or_400(content, server_aliases)
    qa = analyze_well_log_quality(parsed, server_aliases)
    ai = generate_ai_analysis(parsed, qa)

    # ── Pre-check mode: return in-memory QA & AI analysis without DB write ──
    if action == "precheck":
        curve_mappings = []
        for c in parsed.curves:
            std = standardise_mnemonic(c.mnemonic, c.unit, server_aliases)
            curve_mappings.append({
                "rawMnemonic": c.mnemonic,
                "standardMnemonic": std.standardMnemonic,
                "confidence": std.confidence,
                "unit": c.unit,
                "unitMismatch": std.unitMismatch,
            })

        anomalies_list = [
            {
                "curveMnemonic": a.curveMnemonic,
                "depthStart": a.depthStart,
                "depthEnd": a.depthEnd,
                "anomalyType": a.anomalyType,
                "severity": a.severity,
                "description": a.description,
                "suggestedCorrection": a.suggestedCorrection,
            }
            for a in qa.anomalies
        ]

        return {
            "wellName": parsed.wellInfo.wellName,
            "company": parsed.wellInfo.company,
            "field": parsed.wellInfo.field,
            "apiUwi": parsed.wellInfo.apiUwi,
            "startDepth": parsed.wellInfo.startDepth,
            "stopDepth": parsed.wellInfo.stopDepth,
            "step": parsed.wellInfo.step,
            "depthUnit": parsed.wellInfo.depthUnit,
            "totalPoints": parsed.totalPoints,
            "curveCount": len(parsed.curves) + (1 if parsed.depthCurve else 0),
            "warnings": parsed.warnings,
            "overallScore": qa.overallScore,
            "qualityGrade": qa.qualityGrade,
            "completenessScore": qa.completenessScore,
            "consistencyScore": qa.consistencyScore,
            "anomalyCount": qa.anomalyCount,
            "criticalCount": qa.criticalCount,
            "warningCount": qa.warningCount,
            "curveMappings": curve_mappings,
            "anomalies": anomalies_list,
            "aiSummary": ai.summary,
            "recommendations": ai.recommendations,
            "curveSummaries": [c.model_dump() for c in qa.curveSummaries],
        }

    user = current_user
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required to upload LAS files to the database.",
        )

    return commit_las_file_transaction(
        db=db,
        user=user,
        parsed=parsed,
        qa=qa,
        ai=ai,
        raw_file_name=file_name,
        content=content,
        server_aliases=server_aliases,
    )


@router.post("/clean")
def clean_las(
    req: CleanRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    content = (req.content or "").strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LAS file content is required for cleaning.",
        )

    server_aliases = _get_user_aliases(db, current_user)
    parsed = _parse_or_400(content, server_aliases)
    initial_qa = analyze_well_log_quality(parsed, custom_aliases=server_aliases)
    result = clean_las_log_data(
        parsed,
        initial_qa,
        req.options or CleaningOptions(),
        custom_aliases=server_aliases,
    )

    return {
        "success": True,
        "cleanedLas": result.cleanedLas.model_dump(),
        "cleanedQa": result.cleanedQa.model_dump(),
        "verificationReport": result.verificationReport.model_dump(),
        "cleanedLasText": result.cleanedLasText,
        "cleanedCsvText": result.cleanedCsvText,
    }


@router.post("/apply-fixes")
def apply_fixes(
    req: ApplyFixesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not req.wellId:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target wellId is required.",
        )
    if not req.approvedFixes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No approved fixes were provided.",
        )

    server_aliases = _get_user_aliases(db, current_user)
    target_las: Optional[ParsedLAS] = None
    if req.rawLas:
        target_las = req.rawLas
    elif req.rawLasContent:
        target_las = _parse_or_400(req.rawLasContent, server_aliases)
    elif req.wellId not in ("upload-session", "benchmark-01"):
        db_well = db.query(Well).filter(Well.id == req.wellId).first()
        if db_well:
            is_admin = current_user.role in ("ADMIN", "SUPERVISOR")
            is_owner = (db_well.ownerId == current_user.id)
            if not is_admin and not is_owner:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access to apply fixes to this well is restricted to its owner or system administrators.",
                )
            if db_well.lasFiles:
                latest_file = db_well.lasFiles[0]
                if latest_file.rawHeader:
                    target_las = _parse_or_400(latest_file.rawHeader, server_aliases)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Well with ID '{req.wellId}' not found.",
            )

    if not target_las:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Could not find or reconstruct target LAS data for applying fixes.",
        )

    opt_duplicateDepthPruning = False
    opt_depthGapInterpolation = False
    opt_despiking = False
    opt_outlierClipping = False
    opt_flatlineHandling = False
    opt_unitStandardization = False
    imputation_strategy = "NONE"

    for f in req.approvedFixes:
        op = f.optionId
        anom_type = (f.anomalyType or "").upper()

        if op in ("DEDUPLICATE_KEEP_FIRST", "AVERAGE_DUPLICATES", "DEDUPLICATE_PRIMARY_CHANNEL"):
            opt_duplicateDepthPruning = True
        elif op in ("UNIFORM_STEP_RESAMPLE", "CUBIC_SPLINE_INTERPOLATION"):
            opt_depthGapInterpolation = True
        elif op in ("MEDIAN_DESPIKING", "GRADIENT_THRESHOLD_CLIP", "NULLIFY_FOR_IMPUTATION"):
            opt_despiking = True
        elif op in ("PHYSICAL_LIMIT_CLIP", "SIGMA_CLIP", "CLIP_TO_PHYSICAL_RANGE"):
            opt_outlierClipping = True
        elif op in ("NULLIFY_STUCK_INTERVAL", "INTERPOLATE_STUCK_INTERVAL"):
            opt_flatlineHandling = True
        elif op in ("AUTO_CONVERT_STANDARDIZE",):
            opt_unitStandardization = True
        elif op in ("KNN_IMPUTATION", "NULLIFY_AND_KNN_IMPUTE"):
            imputation_strategy = "KNN"
        elif op in ("LINEAR_INTERPOLATION", "NULLIFY_FOR_IMPUTATION", "INTERPOLATE_STUCK_INTERVAL"):
            if imputation_strategy == "NONE":
                imputation_strategy = "LINEAR"
        elif op in ("MEDIAN_IMPUTATION",):
            imputation_strategy = "MEDIAN"
        elif op == "AUTO_RECOMMENDED_FIX":
            if anom_type == "DUPLICATE_DEPTH":
                opt_duplicateDepthPruning = True
            elif anom_type == "DEPTH_GAP":
                opt_depthGapInterpolation = True
            elif anom_type == "EXTREME_SPIKE":
                opt_despiking = True
            elif anom_type in ("IMPOSSIBLE_VALUE", "OUTLIER_VALUE"):
                opt_outlierClipping = True
            elif anom_type == "FLATLINE":
                opt_flatlineHandling = True
            elif anom_type in ("UNIT_MISMATCH", "UNIT_INFERRED"):
                opt_unitStandardization = True
            elif anom_type == "NULL_CLUSTER":
                imputation_strategy = "KNN"

    if opt_depthGapInterpolation and imputation_strategy == "NONE":
        imputation_strategy = "LINEAR"

    cleaning_options = CleaningOptions(
        despiking=opt_despiking,
        outlierClipping=opt_outlierClipping,
        unitStandardization=opt_unitStandardization,
        duplicateDepthPruning=opt_duplicateDepthPruning,
        flatlineHandling=opt_flatlineHandling,
        depthGapInterpolation=opt_depthGapInterpolation,
        imputationStrategy=imputation_strategy,
    )

    clean_result = clean_las_log_data(
        target_las,
        options=cleaning_options,
        custom_aliases=server_aliases,
    )

    # Activity log
    log = ActivityLog(
        userName=current_user.name,
        userRole=current_user.role,
        userId=current_user.id,
        action="RUN_QA",
        targetType="WELL",
        targetId=req.wellId,
        details=f"Applied {len(req.approvedFixes)} verified QC fixes to well {req.wellId}. Score improved to {clean_result.cleanedQa.overallScore}/100.",
    )
    db.add(log)
    db.commit()

    return {
        "success": True,
        "message": f"Successfully applied {len(req.approvedFixes)} anomaly fixes.",
        "cleanedLas": clean_result.cleanedLas.model_dump(),
        "cleanedQa": clean_result.cleanedQa.model_dump(),
        "verificationReport": clean_result.verificationReport.model_dump(),
        "cleanedLasText": clean_result.cleanedLasText,
        "cleanedCsvText": clean_result.cleanedCsvText,
    }


# ── Heavy numerical operations unified from python_parser ──

@router.post("/diagnose", response_model=List[MissingValueDiagnostic])
def diagnose(req: DiagnoseRequest):
    return diagnose_missing_value_causes(
        depth=req.las.depth,
        curves=req.las.curves,
        curve_meta=req.las.curveMeta,
        well_info=req.las.wellInfo,
    )


@router.post("/impute", response_model=ImputeResponse)
def impute(req: ImputeRequest):
    if req.targetMnemonic not in req.las.curves:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown curve mnemonic: {req.targetMnemonic}",
        )

    values = run_single_strategy(
        curves=req.las.curves,
        target_mnemonic=req.targetMnemonic,
        strategy=req.strategy,
        null_value=req.las.wellInfo.nullValue,
        k=req.k,
    )
    return ImputeResponse(
        curveMnemonic=req.targetMnemonic, strategy=req.strategy, values=values
    )


@router.post("/benchmark", response_model=ImputationBenchmarkResult)
def benchmark(req: BenchmarkRequest):
    if req.targetMnemonic not in req.las.curves:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown curve mnemonic: {req.targetMnemonic}",
        )

    return benchmark_imputation_methods(
        depth=req.las.depth,
        curves=req.las.curves,
        target_mnemonic=req.targetMnemonic,
        null_value=req.las.wellInfo.nullValue,
    )


@router.post("/drop-rows", response_model=DropRowsResponse)
def drop_rows(req: DropRowsRequest):
    result = drop_missing_rows(
        depth=req.las.depth,
        curves=req.las.curves,
        null_value=req.las.wellInfo.nullValue,
        target_mnemonic=req.targetMnemonic,
    )
    return DropRowsResponse(**result)
