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

router = APIRouter(prefix="/api/las", tags=["las"])

def _infer_basin(location: Optional[str], field_name: str) -> str:
    haystack = f"{location or ''} {field_name}".upper()
    if "NIGER" in haystack or "DELTA" in haystack or "OML" in haystack or "OPL" in haystack:
        return "Niger Delta Basin"
    if "PERMIAN" in haystack or "MIDLAND" in haystack or "DELAWARE" in haystack:
        return "Permian Basin"
    if "NORTH SEA" in haystack or "BRENT" in haystack or "FORTIES" in haystack:
        return "North Sea Basin"
    if "GULF" in haystack or "GOM" in haystack:
        return "Gulf of Mexico"
    return "Uploaded Wells Basin"

def _convert_depth_to_feet(depth: float, unit: str) -> float:
    return depth * 3.28084 if unit.upper() == "M" else depth


@router.post("/check")
def check_limit(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tier = current_user.tier or "FREE"
    checks_used = current_user.freeChecksUsed or 0

    if tier == "FREE" and checks_used >= 2:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Free limit reached. You have used your 2 free LAS log file checks.",
        )

    updated_checks = checks_used
    if tier == "FREE":
        current_user.freeChecksUsed = checks_used + 1
        db.commit()
        db.refresh(current_user)
        updated_checks = current_user.freeChecksUsed

    return {
        "allowed": True,
        "tier": tier,
        "freeChecksUsed": updated_checks,
        "maxFreeChecks": 2,
        "remainingChecks": max(0, 2 - updated_checks) if tier == "FREE" else None,
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
        "limitReached": tier == "FREE" and checks_used >= 2,
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

    operator_name = parsed.wellInfo.company or "Unknown Operator"
    field_name = parsed.wellInfo.field or "Uploaded Field"
    country = parsed.wellInfo.country or "Unknown"
    basin = _infer_basin(parsed.wellInfo.location, field_name)
    depth_unit = parsed.wellInfo.depthUnit or "FT"

    # Sanitize file_name and well_name: never allow bare digits like "2" or "2.las"
    file_name = (req.fileName or "").strip()
    clean_stem = file_name.rsplit(".", 1)[0].strip() if "." in file_name else file_name
    clean_stem = clean_stem.strip("\"' /\\")

    raw_wn = (parsed.wellInfo.wellName or "").strip()
    raw_wn = re.sub(r"\s+", " ", raw_wn).strip()

    if not raw_wn or raw_wn.isdigit() or raw_wn.upper() in ("UNKNOWN", "UNKNOWN_WELL", "NULL", "2"):
        if clean_stem and not clean_stem.isdigit() and clean_stem.upper() not in ("UNKNOWN", "NULL", "2"):
            well_name = clean_stem
        else:
            well_name = raw_wn or clean_stem or "Uploaded Well"
    else:
        well_name = raw_wn

    if not file_name or clean_stem.isdigit() or clean_stem.upper() in ("UNKNOWN", "NULL", "2"):
        file_name = f"{well_name}.las"

    # Determine unique API number: avoid generic API-12345 colliding across users
    raw_api = (parsed.wellInfo.apiUwi or "").strip()
    if not raw_api or raw_api in ("API-12345", "API-", "UNKNOWN", "NULL"):
        safe_slug = re.sub(r"[^A-Za-z0-9]", "", well_name).upper()[:10] or "WELL"
        u_hash = hashlib.md5(f"{user.id}-{well_name}".encode()).hexdigest()[:6].upper()
        api_no = f"API-{safe_slug}-{u_hash}"
    else:
        api_no = raw_api

    # Upsert Operator
    op = db.query(Operator).filter(Operator.name == operator_name).first()
    if not op:
        op = Operator(name=operator_name)
        db.add(op)
        db.flush()

    # Upsert Field
    fld = db.query(Field).filter(Field.name == field_name).first()
    if not fld:
        fld = Field(name=field_name, basin=basin, country=country, region=parsed.wellInfo.location or None)
        db.add(fld)
        db.flush()
    else:
        fld.basin = basin
        fld.country = country

    # Upsert Well scoped to current user
    well = db.query(Well).filter(Well.apiNo == api_no, Well.ownerId == user.id).first()
    if not well:
        # Check if apiNo is already taken by another user; if so, assign unique suffix
        conflict = db.query(Well).filter(Well.apiNo == api_no).first()
        if conflict:
            api_no = f"{api_no}-{secrets.token_hex(2).upper()}"

    now = datetime.now(timezone.utc)
    if well:
        well.name = well_name
        well.operatorName = operator_name
        well.fieldName = field_name
        well.basin = basin
        well.country = country
        well.latitude = parsed.wellInfo.latitude or 0.0
        well.longitude = parsed.wellInfo.longitude or 0.0
        well.tdFt = _convert_depth_to_feet(parsed.wellInfo.stopDepth, depth_unit)
        well.depthUnit = depth_unit
        well.qualityScore = qa.overallScore
        well.qualityGrade = qa.qualityGrade
        well.status = "ACTIVE"
        well.ownerId = user.id
        well.updatedAt = now
    else:
        well = Well(
            apiNo=api_no,
            name=well_name,
            operatorName=operator_name,
            fieldName=field_name,
            basin=basin,
            country=country,
            latitude=parsed.wellInfo.latitude or 0.0,
            longitude=parsed.wellInfo.longitude or 0.0,
            tdFt=_convert_depth_to_feet(parsed.wellInfo.stopDepth, depth_unit),
            depthUnit=depth_unit,
            qualityScore=qa.overallScore,
            qualityGrade=qa.qualityGrade,
            status="ACTIVE",
            ownerId=user.id,
        )
        db.add(well)
        db.flush()

    # Create LASFile record
    las_file = LASFile(
        wellId=well.id,
        originalName=file_name,
        fileSizeKb=round(len(content.encode("utf-8")) / 1024.0, 2),
        lasVersion=parsed.version,
        startDepth=parsed.wellInfo.startDepth,
        stopDepth=parsed.wellInfo.stopDepth,
        stepDepth=parsed.wellInfo.step,
        nullValue=parsed.wellInfo.nullValue,
        depthUnit=depth_unit,
        rawHeader=parsed.rawHeader,
        curveCount=len(parsed.curves),
        pointCount=parsed.totalPoints,
        status="PROCESSED",
        uploadedById=user.id,
        ownerId=user.id,
    )
    db.add(las_file)
    db.flush()

    # Downsampled curve data
    max_pts = 3000
    total_pts = len(parsed.data.depth)
    step_ds = max(1, math.ceil(total_pts / max_pts)) if total_pts > max_pts else 1

    curve_objs = {}
    for summary in qa.curveSummaries:
        c_meta = next((c for c in parsed.curves if c.mnemonic == summary.mnemonic), None)
        std = standardise_mnemonic(summary.mnemonic, summary.unit, server_aliases)
        raw_vals = parsed.data.curves.get(summary.mnemonic, [])

        sampled = []
        for i in range(0, total_pts, step_ds):
            sampled.append({
                "depth": parsed.data.depth[i],
                "value": raw_vals[i] if i < len(raw_vals) else parsed.wellInfo.nullValue,
            })
        if step_ds > 1 and total_pts > 0 and (total_pts - 1) % step_ds != 0:
            sampled.append({
                "depth": parsed.data.depth[-1],
                "value": raw_vals[-1] if raw_vals else parsed.wellInfo.nullValue,
            })

        status_str = "VALID" if summary.status == "EXCELLENT" else ("STANDARDISED" if summary.status == "GOOD" else "WARNING")
        curve_rec = Curve(
            lasFileId=las_file.id,
            originalMnemonic=summary.mnemonic,
            standardMnemonic=summary.standardMnemonic,
            unit=c_meta.unit if c_meta else summary.unit,
            description=c_meta.description if c_meta else std.matchedName,
            nullCount=summary.nullCount,
            totalPoints=summary.totalPoints,
            nullPercentage=summary.nullPercentage,
            confidence=std.confidence,
            minVal=summary.minVal,
            maxVal=summary.maxVal,
            meanVal=summary.meanVal,
            status=status_str,
            dataJson=json.dumps(sampled),
            ownerId=user.id,
        )
        db.add(curve_rec)
        db.flush()
        curve_objs[summary.mnemonic] = curve_rec

    # Create QualityReport
    report = QualityReport(
        wellId=well.id,
        lasFileId=las_file.id,
        overallScore=qa.overallScore,
        qualityGrade=qa.qualityGrade,
        completenessScore=qa.completenessScore,
        consistencyScore=qa.consistencyScore,
        anomalyCount=qa.anomalyCount,
        aiSummary=ai.summary,
        recommendations=json.dumps(ai.recommendations),
        reportJson=json.dumps(qa.model_dump()),
        ownerId=user.id,
    )
    db.add(report)
    db.flush()

    # Create Anomalies
    for a in qa.anomalies:
        c_obj = curve_objs.get(a.curveMnemonic)
        anom_rec = Anomaly(
            qualityReportId=report.id,
            curveId=c_obj.id if c_obj else None,
            curveMnemonic=a.curveMnemonic,
            depthStart=a.depthStart,
            depthEnd=a.depthEnd,
            anomalyType=a.anomalyType,
            severity=a.severity,
            description=a.description,
            suggestedCorrection=a.suggestedCorrection,
            status="OPEN",
            ownerId=user.id,
        )
        db.add(anom_rec)

    # Activity log
    log = ActivityLog(
        userName=user.name,
        userRole=user.role,
        userId=user.id,
        action="UPLOAD_LAS",
        targetType="WELL",
        targetId=well.id,
        details=f"Uploaded and committed LAS file {file_name} for well {well.name} (Score: {qa.overallScore}/100, Grade: {qa.qualityGrade}).",
    )
    db.add(log)
    db.commit()

    return {
        "message": f"Successfully parsed and committed {file_name} for well {well.name}.",
        "well": {
            "id": well.id,
            "name": well.name,
            "apiNo": well.apiNo,
            "qualityScore": well.qualityScore,
            "qualityGrade": well.qualityGrade,
        },
        "wellId": well.id,
        "lasFileId": las_file.id,
        "reportId": report.id,
        "wellName": well.name,
        "overallScore": qa.overallScore,
        "qualityGrade": qa.qualityGrade,
        "anomalyCount": qa.anomalyCount,
    }


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
        if db_well and db_well.lasFiles:
            latest_file = db_well.lasFiles[0]
            if latest_file.rawHeader:
                target_las = parse_las_content(latest_file.rawHeader)

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
