from datetime import datetime, timezone
import json
import secrets
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user_optional, get_current_user
from backend.app.models.models import ActivityLog, User, Well, QualityReport, Anomaly
from backend.app.services.cleaner import clean_las_log_data, CleaningOptions
from backend.app.services.parser import parse_las_content, ParsedLAS, LASParseError
from backend.app.services.quality_engine import analyze_well_log_quality
from backend.app.api.standardisation import _get_user_aliases

router = APIRouter(prefix="/api/qa-engine", tags=["qa-engine"])


class QARepairRequest(BaseModel):
    wellId: Optional[str] = None
    wellName: Optional[str] = "Well Log"
    rawLasText: Optional[str] = None
    rawLas: Optional[Dict[str, Any]] = None
    despiking: bool = True
    outlierClipping: bool = True
    duplicateDepthPruning: bool = True
    imputationStrategy: str = "NONE"


@router.get("")
def get_qa_engine_overview(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Returns active QA rules configuration and live evaluation stats
    across the authenticated user's well logs.
    """
    rules = [
        {
            "ruleId": "RULE_DUPLICATE_DEPTH",
            "ruleName": "Duplicate Depth Index Rows",
            "description": "Flags non-monotonic or repeating identical depth indices.",
            "enabled": True,
            "threshold": 0,
            "unit": "steps",
            "severity": "CRITICAL",
        },
        {
            "ruleId": "RULE_IMPOSSIBLE_VALUE",
            "ruleName": "Physical Boundary Limits (GR, RHOB, NPHI, etc.)",
            "description": "Flags readings exceeding physical thermodynamic limits.",
            "enabled": True,
            "threshold": 0,
            "unit": "samples",
            "severity": "CRITICAL",
        },
        {
            "ruleId": "RULE_EXTREME_SPIKE",
            "ruleName": "Extreme Sensor Spikes (Z-Score > 4.5σ)",
            "description": "Detects high-frequency electrical telemetry noise and transit spikes.",
            "enabled": True,
            "threshold": 4.5,
            "unit": "sigma",
            "severity": "WARNING",
        },
        {
            "ruleId": "RULE_NULL_CLUSTER",
            "ruleName": "Contiguous Missing Data Runs & Null Clusters",
            "description": "Flags telemetry dropouts and extensive sensor dead-zones.",
            "enabled": True,
            "threshold": 10,
            "unit": "samples",
            "severity": "WARNING",
        },
    ]

    # Query evaluations from the user's database wells if available
    eval_results = []
    total_wells = 0
    try:
        if current_user:
            query = db.query(Well)
            if current_user.role not in ("ADMIN", "SUPERVISOR"):
                query = query.filter(Well.ownerId == current_user.id)
            user_wells = query.all()
            total_wells = len(user_wells)

            # Count anomalies by type from latest reports
            anom_counts: Dict[str, int] = {
                "DUPLICATE_DEPTH": 0,
                "IMPOSSIBLE_VALUE": 0,
                "EXTREME_SPIKE": 0,
                "NULL_CLUSTER": 0,
            }
            wells_affected: Dict[str, set] = {
                "DUPLICATE_DEPTH": set(),
                "IMPOSSIBLE_VALUE": set(),
                "EXTREME_SPIKE": set(),
                "NULL_CLUSTER": set(),
            }

            for w in user_wells:
                for rep in w.reports:
                    for a in rep.anomalies:
                        t = a.anomalyType or ""
                        if t in anom_counts:
                            anom_counts[t] += 1
                            wells_affected[t].add(w.id)

            eval_results = [
                {
                    "ruleId": "RULE_DUPLICATE_DEPTH",
                    "ruleName": "Duplicate Depth Index Rows",
                    "wellsAffected": len(wells_affected["DUPLICATE_DEPTH"]),
                    "anomaliesRaised": anom_counts["DUPLICATE_DEPTH"],
                    "severity": "CRITICAL",
                },
                {
                    "ruleId": "RULE_IMPOSSIBLE_VALUE",
                    "ruleName": "Physical Boundary Limits",
                    "wellsAffected": len(wells_affected["IMPOSSIBLE_VALUE"]),
                    "anomaliesRaised": anom_counts["IMPOSSIBLE_VALUE"],
                    "severity": "CRITICAL",
                },
                {
                    "ruleId": "RULE_EXTREME_SPIKE",
                    "ruleName": "Extreme Sensor Spikes",
                    "wellsAffected": len(wells_affected["EXTREME_SPIKE"]),
                    "anomaliesRaised": anom_counts["EXTREME_SPIKE"],
                    "severity": "WARNING",
                },
                {
                    "ruleId": "RULE_NULL_CLUSTER",
                    "ruleName": "Contiguous Missing Data Runs",
                    "wellsAffected": len(wells_affected["NULL_CLUSTER"]),
                    "anomaliesRaised": anom_counts["NULL_CLUSTER"],
                    "severity": "WARNING",
                },
            ]
    except Exception:
        pass

    return {
        "rules": rules,
        "totalWells": total_wells,
        "lastEvaluated": datetime.now(timezone.utc).isoformat(),
        "evaluationResults": eval_results,
    }


@router.post("/repair")
def repair_anomalies(
    req: QARepairRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Executes user-approved automated anomaly repair actions:
    - Despiking (median despiking)
    - Physical boundary clamping (GR, RHOB, NPHI, etc.)
    - Duplicate-depth repairs (pruning duplicate depth indices)
    Persists an immutable audit log entry for transparency and returns verified cleaned data.
    """
    server_aliases = _get_user_aliases(db, current_user)
    target_las: Optional[ParsedLAS] = None
    well_name = req.wellName or "Well Log"
    well_id = req.wellId or "upload-session"

    # 1. Resolve raw LAS from request payload or database
    if req.rawLasText:
        try:
            target_las = parse_las_content(req.rawLasText, custom_aliases=server_aliases)
            if target_las.wellInfo.wellName:
                well_name = target_las.wellInfo.wellName
        except LASParseError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"LAS parsing failed: {str(exc)}",
            )
    elif req.rawLas:
        try:
            target_las = ParsedLAS.model_validate(req.rawLas)
            if target_las.wellInfo.wellName:
                well_name = target_las.wellInfo.wellName
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid ParsedLAS data: {str(exc)}",
            )
    elif req.wellId and req.wellId not in ("upload-session", "active-upload"):
        db_well = db.query(Well).filter(Well.id == req.wellId).first()
        if db_well:
            well_name = db_well.name
            if db_well.lasFiles:
                latest = db_well.lasFiles[0]
                if latest.rawHeader:
                    try:
                        target_las = parse_las_content(latest.rawHeader, custom_aliases=server_aliases)
                    except Exception:
                        target_las = None
                if (not target_las or not target_las.data.depth) and latest.curves:
                    depth_vals: List[float] = []
                    curve_vals: Dict[str, List[float]] = {}
                    for c in latest.curves:
                        try:
                            pts = json.loads(c.dataJson) if c.dataJson else []
                        except Exception:
                            pts = []
                        if not depth_vals and pts:
                            depth_vals = [float(p.get("depth", 0.0)) for p in pts if isinstance(p, dict) and "depth" in p]
                        vals = [float(p.get("value", -999.25)) for p in pts if isinstance(p, dict) and "value" in p]
                        curve_vals[c.originalMnemonic.upper()] = vals
                    if depth_vals:
                        if not target_las:
                            from backend.app.services.parser import LASWellInfo
                            target_las = ParsedLAS(
                                version="2.0",
                                wrap=False,
                                wellInfo=LASWellInfo(
                                    wellName=db_well.name,
                                    company=db_well.operatorName or "",
                                    field=db_well.fieldName or "",
                                    startDepth=latest.startDepth or (depth_vals[0] if depth_vals else 0.0),
                                    stopDepth=latest.stopDepth or (depth_vals[-1] if depth_vals else 0.0),
                                    step=latest.step or 0.5,
                                    nullValue=-999.25,
                                    depthUnit=latest.depthUnit or db_well.depthUnit or "FT",
                                ),
                                curves=[],
                                data={"depth": depth_vals, "curves": curve_vals},
                                totalPoints=len(depth_vals),
                            )
                        else:
                            target_las.data.depth = depth_vals
                            target_las.data.curves = curve_vals
                            target_las.totalPoints = len(depth_vals)

    if not target_las:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target well log data is required. Provide rawLasText, rawLas, or a valid wellId.",
        )

    # 2. Configure approved repair options
    options = CleaningOptions(
        despiking=bool(req.despiking),
        outlierClipping=bool(req.outlierClipping),
        duplicateDepthPruning=bool(req.duplicateDepthPruning),
        flatlineHandling=False,
        depthGapInterpolation=False,
        unitStandardization=False,
        imputationStrategy="NONE",
    )

    initial_qa = analyze_well_log_quality(target_las, custom_aliases=server_aliases)

    clean_result = clean_las_log_data(
        target_las,
        initial_qa=initial_qa,
        options=options,
        custom_aliases=server_aliases,
    )

    report = clean_result.verificationReport
    user_name = current_user.name if current_user else "Lead Petrophysicist"
    user_role = current_user.role if current_user else "PETROPHYSICIST"
    user_id = current_user.id if current_user else None

    # 3. Create Audit Trail Entry in PostgreSQL
    audit_cert_id = f"WQC-CERT-{secrets.token_hex(4).upper()}"
    log_details = (
        f"Verified petrophysical repair executed for {well_name}: "
        f"{report.outliersRemovedCount} boundary limits clamped, "
        f"{report.spikesDespikedCount} spikes despiked, "
        f"{report.duplicateDepthsPrunedCount} duplicate depths pruned. "
        f"Quality score improved from {report.originalQualityScore}% ({report.originalGrade}) "
        f"to {report.cleanedQualityScore}% ({report.cleanedGrade}). [Cert: {audit_cert_id}]"
    )

    try:
        activity = ActivityLog(
            userId=user_id,
            userName=user_name,
            userRole=user_role,
            action="REPAIR_ANOMALIES",
            targetType="WELL",
            targetId=well_id,
            details=log_details,
            createdAt=datetime.now(timezone.utc),
        )
        db.add(activity)
        db.commit()
    except Exception:
        db.rollback()

    return {
        "success": True,
        "message": f"Successfully executed verified petrophysical repairs for {well_name}.",
        "wellName": well_name,
        "wellId": well_id,
        "originalScore": report.originalQualityScore,
        "cleanedScore": report.cleanedQualityScore,
        "scoreDelta": report.scoreImprovement,
        "originalGrade": report.originalGrade,
        "cleanedGrade": report.cleanedGrade,
        "isVerifiedClean": report.isVerifiedClean,
        "verificationReport": report.model_dump(),
        "cleanedLas": clean_result.cleanedLas.model_dump(),
        "cleanedQa": clean_result.cleanedQa.model_dump(),
        "cleanedLasText": clean_result.cleanedLasText,
        "cleanedCsvText": clean_result.cleanedCsvText,
        "auditCertificateId": audit_cert_id,
        "auditLogEntry": {
            "certificateId": audit_cert_id,
            "userName": user_name,
            "userRole": user_role,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": log_details,
            "actionsApplied": {
                "despiking": req.despiking,
                "outlierClipping": req.outlierClipping,
                "duplicateDepthPruning": req.duplicateDepthPruning,
            },
        },
    }
