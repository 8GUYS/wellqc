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
    ApplyFixesRequest,
    CleanRequest,
    CommitLASRequest,
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
from backend.app.services.parser import parse_las_content, ParsedLAS
from backend.app.services.quality_engine import analyze_well_log_quality
from backend.app.services.standardiser import (
    get_custom_aliases,
    set_custom_aliases,
    standardise_mnemonic,
)
from backend.app.api.standardisation import _get_user_aliases
from backend.app.services.ingestion_service import commit_las_file_transaction

router = APIRouter(prefix="/api/las", tags=["las"])


@router.post("/check")
def check_limit(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tier = current_user.tier or "FREE"
    checks_used = current_user.freeChecksUsed or 0

    # FREEMIUM ENFORCEMENT SUSPENDED for unrestricted testing.
    # Sprint 5: uncomment this block (and add the matching check in handle_las)
    # once the payment option is implemented. Atomic check-and-increment:
    #
    # if tier == "FREE":
    #     result = db.execute(
    #         update(User)
    #         .where(User.id == current_user.id, User.freeChecksUsed < 2)
    #         .values(freeChecksUsed=User.freeChecksUsed + 1)
    #     )
    #     db.commit()
    #     if result.rowcount == 0:
    #         raise HTTPException(
    #             status_code=status.HTTP_402_PAYMENT_REQUIRED,
    #             detail="Free limit reached. You have used your 2 free LAS log file checks.",
    #         )
    #     db.refresh(current_user)
    #     checks_used = current_user.freeChecksUsed
    # (also add `update` to the sqlalchemy import when re-enabling)

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
        "limitReached": False,  # FREEMIUM SUSPENDED for testing. Sprint 5: restore to: tier == "FREE" and checks_used >= 2
    }


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
    set_custom_aliases(server_aliases)

    parsed = parse_las_content(content)
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
            "curveCount": len(parsed.curves),
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

    # ── Commit to Database mode ──
    user = current_user
    if not user:
        # For unauthenticated or test requests, use dedicated demo petrophysicist account
        demo_u = db.query(User).filter(User.email == "petrophysicist@wellqc.io").first()
        if not demo_u:
            demo_u = User(
                id="demo-petrophysicist-uuid",
                email="petrophysicist@wellqc.io",
                name="Lead Petrophysicist",
                passwordHash="demo_hash",
                role="PETROPHYSICIST",
                department="Subsurface Analytics",
                tier="PRO",
            )
            db.add(demo_u)
            db.commit()
            db.refresh(demo_u)
        user = demo_u

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
    current_user: User = Depends(get_current_user),
):
    content = (req.content or "").strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LAS file content is required for cleaning.",
        )

    parsed = parse_las_content(content)
    initial_qa = analyze_well_log_quality(parsed)
    result = clean_las_log_data(parsed, initial_qa, req.options or CleaningOptions())

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

    target_las: Optional[ParsedLAS] = None
    if req.rawLas:
        target_las = req.rawLas
    elif req.rawLasContent:
        target_las = parse_las_content(req.rawLasContent)
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
                    target_las = parse_las_content(latest_file.rawHeader)
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

    cleaning_options = CleaningOptions(
        despiking=any(f.optionId in ("DESPIKE_MEDIAN", "MEDIAN_DESPIKE") for f in req.approvedFixes),
        outlierClipping=any(f.optionId in ("CLIP_PHYSICAL", "OUTLIER_CLIP") for f in req.approvedFixes),
        unitStandardization=any(f.optionId in ("STANDARDISE_UNITS", "CONVERT_UNITS") for f in req.approvedFixes),
        duplicateDepthPruning=any(f.optionId in ("PRUNE_DUPLICATE_DEPTHS", "DROP_DUPLICATES") for f in req.approvedFixes),
        flatlineHandling=any(f.optionId in ("FLAG_FLATLINE", "HANDLE_FLATLINE") for f in req.approvedFixes),
        depthGapInterpolation=any(f.optionId in ("INTERPOLATE_DEPTH_GAPS", "INTERPOLATE") for f in req.approvedFixes),
        imputationStrategy="KNN" if any(f.optionId in ("IMPUTE_KNN", "APPLY_KNN") for f in req.approvedFixes) else "LINEAR",
    )

    clean_result = clean_las_log_data(target_las, options=cleaning_options)

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
