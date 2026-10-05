from datetime import datetime, timezone
import json
from typing import Any, Dict, List
from sqlalchemy.orm import Session
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
from backend.app.services.ai_analyzer import AIAnalysisOutput
from backend.app.services.parser import ParsedLAS
from backend.app.services.petro_utils import (
    convert_depth_to_feet,
    downsample_curve_series,
    generate_unique_api_no,
    infer_basin,
    sanitize_well_and_file_name,
)
from backend.app.services.quality_engine import QualityAnalysisResult
from backend.app.services.standardiser import CustomAliasEntry, standardise_mnemonic


def commit_las_file_transaction(
    db: Session,
    user: User,
    parsed: ParsedLAS,
    qa: QualityAnalysisResult,
    ai: AIAnalysisOutput,
    raw_file_name: str,
    content: str,
    server_aliases: List[CustomAliasEntry],
) -> Dict[str, Any]:
    """
    Executes the complete transactional ingestion of a parsed LAS file:
    - Upserts Operator and Field metadata
    - Creates or updates Well scoped to authenticated user
    - Persists LASFile record with raw header
    - Downsamples and inserts Curve records
    - Persists QualityReport and Anomaly records
    - Emits ActivityLog audit entry
    """
    operator_name = parsed.wellInfo.company or "Unknown Operator"
    field_name = parsed.wellInfo.field or "Uploaded Field"
    country = parsed.wellInfo.country or "Unknown"
    basin = infer_basin(parsed.wellInfo.location, field_name)
    depth_unit = parsed.wellInfo.depthUnit or "FT"

    well_name, file_name = sanitize_well_and_file_name(raw_file_name, parsed.wellInfo.wellName)
    api_no = generate_unique_api_no(parsed.wellInfo.apiUwi, well_name, user.id, db)

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
    now = datetime.now(timezone.utc)

    if well:
        well.name = well_name
        well.operatorName = operator_name
        well.fieldName = field_name
        well.basin = basin
        well.country = country
        well.latitude = parsed.wellInfo.latitude or 0.0
        well.longitude = parsed.wellInfo.longitude or 0.0
        well.tdFt = convert_depth_to_feet(parsed.wellInfo.stopDepth, depth_unit)
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
            tdFt=convert_depth_to_feet(parsed.wellInfo.stopDepth, depth_unit),
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
        curveCount=len(parsed.curves) + (1 if parsed.depthCurve else 0),
        pointCount=parsed.totalPoints,
        status="PROCESSED",
        uploadedById=user.id,
        ownerId=user.id,
    )
    db.add(las_file)
    db.flush()

    # Downsampled curve data
    curve_objs = {}
    for summary in qa.curveSummaries:
        c_meta = next((c for c in parsed.curves if c.mnemonic == summary.mnemonic), None)
        std = standardise_mnemonic(summary.mnemonic, summary.unit, server_aliases)
        raw_vals = parsed.data.curves.get(summary.mnemonic, [])

        sampled = downsample_curve_series(
            depths=parsed.data.depth,
            values=raw_vals,
            null_value=parsed.wellInfo.nullValue,
            max_points=3000,
        )

        status_str = (
            "VALID"
            if summary.status == "EXCELLENT"
            else ("STANDARDISED" if summary.status == "GOOD" else "WARNING")
        )
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
