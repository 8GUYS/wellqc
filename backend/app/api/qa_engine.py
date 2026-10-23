from datetime import datetime, timezone
import json
import secrets
from typing import Any, Dict, List, Optional, Tuple, Set
from fastapi import APIRouter, Depends, HTTPException, Query, status
import numpy as np
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user_optional, get_current_user
from backend.app.core.security import normalize_role
from backend.app.models.models import ActivityLog, User, Well, QualityReport, Anomaly
from backend.app.services.cleaner import clean_las_log_data, CleaningOptions, ApprovedFix
from backend.app.services.imputation import recommend_for_gaps
from backend.app.services.parser import parse_las_content, ParsedLAS, LASParseError
from backend.app.services.quality_engine import analyze_well_log_quality
from backend.app.api.standardisation import _get_user_aliases

router = APIRouter(prefix="/api/qa-engine", tags=["qa-engine"])

VALID_FILL_METHODS = {"NONE", "KNN", "LINEAR", "SPLINE", "RANDOM_FOREST", "GRADIENT_BOOSTING", "AUTO"}


class QARepairRequest(BaseModel):
    wellId: Optional[str] = None
    wellName: Optional[str] = "Well Log"
    rawLasText: Optional[str] = None
    rawLas: Optional[Dict[str, Any]] = None
    despiking: bool = True
    outlierClipping: bool = True
    duplicateDepthPruning: bool = True
    duplicateAction: Optional[str] = "REMOVE_SECOND"
    impossibleAction: Optional[str] = "REMOVE"
    imputationStrategy: str = "NONE"
    approvedFixes: Optional[List[ApprovedFix]] = None


class GapQueryItem(BaseModel):
    curve: str
    depthStart: float
    depthEnd: float


class GapRecommendationRequest(BaseModel):
    wellId: Optional[str] = None
    wellName: Optional[str] = "Well Log"
    rawLasText: Optional[str] = None
    rawLas: Optional[Dict[str, Any]] = None
    gaps: List[GapQueryItem]


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
            "ruleName": "Sonic Sensor Spikes (IQR Step Fence)",
            "description": "Flags readings whose jump to both neighbours exceeds 3.0×IQR in the same direction on sonic (DT) curves.",
            "enabled": True,
            "threshold": 3.0,
            "unit": "IQR",
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
            query = db.query(Well.id)
            if normalize_role(current_user.role) != "ADMIN":
                query = query.filter(Well.ownerId == current_user.id)
            user_well_ids = [w[0] for w in query.all()]
            total_wells = len(user_well_ids)

            anom_counts: Dict[str, int] = {
                "DUPLICATE_DEPTH": 0,
                "IMPOSSIBLE_VALUE": 0,
                "EXTREME_SPIKE": 0,
                "NULL_CLUSTER": 0,
            }
            wells_affected: Dict[str, int] = {
                "DUPLICATE_DEPTH": 0,
                "IMPOSSIBLE_VALUE": 0,
                "EXTREME_SPIKE": 0,
                "NULL_CLUSTER": 0,
            }

            if user_well_ids:
                agg = (
                    db.query(
                        Anomaly.anomalyType,
                        func.count(Anomaly.id),
                        func.count(func.distinct(QualityReport.wellId)),
                    )
                    .join(QualityReport, Anomaly.qualityReportId == QualityReport.id)
                    .filter(QualityReport.wellId.in_(user_well_ids))
                    .group_by(Anomaly.anomalyType)
                    .all()
                )
                for anom_type, total_anoms, wells_aff in agg:
                    if anom_type in anom_counts:
                        anom_counts[anom_type] = total_anoms
                        wells_affected[anom_type] = wells_aff

            eval_results = [
                {
                    "ruleId": "RULE_DUPLICATE_DEPTH",
                    "ruleName": "Duplicate Depth Index Rows",
                    "wellsAffected": wells_affected["DUPLICATE_DEPTH"],
                    "anomaliesRaised": anom_counts["DUPLICATE_DEPTH"],
                    "severity": "CRITICAL",
                },
                {
                    "ruleId": "RULE_IMPOSSIBLE_VALUE",
                    "ruleName": "Physical Boundary Limits",
                    "wellsAffected": wells_affected["IMPOSSIBLE_VALUE"],
                    "anomaliesRaised": anom_counts["IMPOSSIBLE_VALUE"],
                    "severity": "CRITICAL",
                },
                {
                    "ruleId": "RULE_EXTREME_SPIKE",
                    "ruleName": "Extreme Sensor Spikes",
                    "wellsAffected": wells_affected["EXTREME_SPIKE"],
                    "anomaliesRaised": anom_counts["EXTREME_SPIKE"],
                    "severity": "WARNING",
                },
                {
                    "ruleId": "RULE_NULL_CLUSTER",
                    "ruleName": "Contiguous Missing Data Runs",
                    "wellsAffected": wells_affected["NULL_CLUSTER"],
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


def _resolve_target_las(
    well_id: Optional[str],
    well_name_req: Optional[str],
    raw_las_text: Optional[str],
    raw_las: Optional[Dict[str, Any]],
    server_aliases: Any,
    db: Session,
    current_user: Optional[User] = None,
) -> Tuple[ParsedLAS, str, str]:
    well_name = well_name_req or "Well Log"
    resolved_id = well_id or "upload-session"
    target_las: Optional[ParsedLAS] = None

    effective_raw_text = raw_las_text
    db_well: Optional[Well] = None

    # Check ownership BEFORE reading anything from a saved well
    if not effective_raw_text and not raw_las and well_id and well_id not in ("upload-session", "active-upload", "direct-upload"):
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to use this well.",
            )
        db_well = db.query(Well).filter(Well.id == well_id).first()
        if db_well:
            is_admin = (normalize_role(current_user.role) == "ADMIN")
            is_owner = (db_well.ownerId == current_user.id)
            if not is_admin and not is_owner:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to use this well.",
                )
            if db_well.lasFiles:
                latest = db_well.lasFiles[0]
                if getattr(latest, "rawContent", None):
                    effective_raw_text = latest.rawContent

    if effective_raw_text:
        try:
            target_las = parse_las_content(effective_raw_text, custom_aliases=server_aliases)
            if target_las.wellInfo.wellName:
                well_name = target_las.wellInfo.wellName
        except LASParseError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"LAS parsing failed: {str(exc)}",
            )
    elif raw_las:
        try:
            target_las = ParsedLAS.model_validate(raw_las)
            if target_las.wellInfo.wellName:
                well_name = target_las.wellInfo.wellName
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid ParsedLAS data: {str(exc)}",
            )
    elif db_well:
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

    return target_las, well_name, resolved_id


def _is_null_val(v: Any, null_val: float) -> bool:
    if v is None:
        return True
    try:
        fv = float(v)
        if np.isnan(fv):
            return True
        return abs(fv - null_val) < 1e-4 or abs(fv - (-999.25)) < 1e-4
    except (ValueError, TypeError):
        return True


def _build_change_report(
    orig_las: ParsedLAS,
    cleaned_las: ParsedLAS,
    approved_fixes: Optional[List[ApprovedFix]] = None,
) -> Dict[str, Any]:
    orig_depths = orig_las.data.depth
    cleaned_depths = cleaned_las.data.depth
    rows_before = len(orig_depths)
    rows_after = len(cleaned_depths)

    null_val = orig_las.wellInfo.nullValue if orig_las.wellInfo.nullValue is not None else -999.25
    step = abs(orig_las.wellInfo.step) if orig_las.wellInfo.step else 0.5
    half_step = 0.5 * step if step > 0 else 1e-4

    matched_pairs: List[Tuple[int, int]] = []
    removed_orig_indices: Set[int] = set()

    # 1. Match rows: If same count match by position, otherwise match by depth rounded to 6 decimals (first occurrence)
    if rows_before == rows_after:
        matched_pairs = [(i, i) for i in range(rows_before)]
        rows_removed = 0
    else:
        cleaned_depth_map: Dict[float, int] = {}
        for cj, cd in enumerate(cleaned_depths):
            key = round(float(cd), 6)
            if key not in cleaned_depth_map:
                cleaned_depth_map[key] = cj

        used_cleaned: Set[int] = set()
        for oi, od in enumerate(orig_depths):
            key = round(float(od), 6)
            cj = cleaned_depth_map.get(key)
            if cj is not None and cj not in used_cleaned:
                matched_pairs.append((oi, cj))
                used_cleaned.add(cj)
            else:
                removed_orig_indices.add(oi)

        rows_removed = len(removed_orig_indices)

    # 2. Count changed values for every curve and matched row
    cleaned_curve_map = {k.upper(): k for k in cleaned_las.data.curves.keys()}
    changed_points: Set[Tuple[str, int]] = set()

    for c_name, orig_vals in orig_las.data.curves.items():
        c_upper = c_name.upper()
        clean_key = cleaned_curve_map.get(c_upper)
        if not clean_key:
            continue
        clean_vals = cleaned_las.data.curves.get(clean_key, [])

        for oi, cj in matched_pairs:
            if oi < len(orig_vals) and cj < len(clean_vals):
                vo = orig_vals[oi]
                vc = clean_vals[cj]
                null_o = _is_null_val(vo, null_val)
                null_c = _is_null_val(vc, null_val)

                if null_o and null_c:
                    continue
                elif null_o != null_c:
                    changed_points.add((c_upper, oi))
                else:
                    try:
                        if abs(float(vo) - float(vc)) > 1e-9:
                            changed_points.add((c_upper, oi))
                    except (ValueError, TypeError):
                        if str(vo) != str(vc):
                            changed_points.add((c_upper, oi))

    values_changed_by_curve: Dict[str, int] = {}
    for c_upper, _ in changed_points:
        values_changed_by_curve[c_upper] = values_changed_by_curve.get(c_upper, 0) + 1
    total_values_changed = sum(values_changed_by_curve.values())

    # 3. Count per approved fix
    counted_changed_points: Set[Tuple[str, int]] = set()
    counted_removed_rows: Set[int] = set()
    fix_results: List[Dict[str, Any]] = []

    if approved_fixes:
        for fix in approved_fixes:
            lo = min(fix.depthStart, fix.depthEnd) - half_step
            hi = max(fix.depthStart, fix.depthEnd) + half_step

            count = 0
            if fix.problem == "DUPLICATE_DEPTH":
                lost_in_range = [
                    oi for oi in range(rows_before)
                    if lo <= orig_depths[oi] <= hi and oi in removed_orig_indices
                ]
                count = len(lost_in_range)
                for oi in lost_in_range:
                    counted_removed_rows.add(oi)
            elif (fix.method or "").upper() == "DELETE_ROW":
                del_in_range = [
                    oi for oi in range(rows_before)
                    if lo <= orig_depths[oi] <= hi and oi in removed_orig_indices
                ]
                count = len(del_in_range)
                for oi in del_in_range:
                    counted_removed_rows.add(oi)
            else:
                c_upper = fix.curve.upper()
                changed_in_range = [
                    oi for oi in range(rows_before)
                    if lo <= orig_depths[oi] <= hi and (c_upper, oi) in changed_points
                ]
                count = len(changed_in_range)
                for oi in changed_in_range:
                    counted_changed_points.add((c_upper, oi))

            fix_results.append({
                "problem": fix.problem,
                "curve": fix.curve,
                "depthStart": fix.depthStart,
                "depthEnd": fix.depthEnd,
                "method": fix.method or "",
                "samplesChanged": count,
            })

    # 4. Report the rest
    uncovered_changes = [pt for pt in changed_points if pt not in counted_changed_points]
    other_changes_dict: Dict[str, List[int]] = {}
    for c_upper, oi in uncovered_changes:
        other_changes_dict.setdefault(c_upper, []).append(oi)

    other_changes: List[Dict[str, Any]] = []
    for c_upper, ois in other_changes_dict.items():
        depths = [orig_depths[oi] for oi in ois]
        other_changes.append({
            "curve": c_upper,
            "samplesChanged": len(ois),
            "depthFrom": min(depths),
            "depthTo": max(depths),
        })

    uncovered_removed = [oi for oi in removed_orig_indices if oi not in counted_removed_rows]
    other_rows_removed = len(uncovered_removed)

    return {
        "rowsBefore": rows_before,
        "rowsAfter": rows_after,
        "rowsRemoved": rows_removed,
        "valuesChangedByCurve": values_changed_by_curve,
        "totalValuesChanged": total_values_changed,
        "fixResults": fix_results,
        "otherChanges": other_changes,
        "otherRowsRemoved": other_rows_removed,
    }


@router.post("/repair")
def repair_anomalies(
    req: QARepairRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Executes user-approved automated anomaly repair actions:
    - Despiking (two-point neighbour mean replacement on sonic DT)
    - Physical boundary handling (REMOVE to null, CLIP to limit, or DELETE_ROW)
    - Duplicate-depth repairs (REMOVE_SECOND or COMPARE_ROWS)
    - Null cluster imputation (LINEAR, SPLINE, RANDOM_FOREST, GRADIENT_BOOSTING, KNN, AUTO)
    Persists an immutable audit log entry for transparency and returns verified cleaned data.
    """
    if req.imputationStrategy not in VALID_FILL_METHODS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown fill method '{req.imputationStrategy}'. Allowed methods are: {', '.join(sorted(VALID_FILL_METHODS))}.",
        )

    server_aliases = _get_user_aliases(db, current_user)
    target_las, well_name, well_id = _resolve_target_las(
        req.wellId, req.wellName, req.rawLasText, req.rawLas, server_aliases, db, current_user
    )

    # Configure approved repair options
    options = CleaningOptions(
        despiking=bool(req.despiking),
        outlierClipping=bool(req.outlierClipping),
        duplicateDepthPruning=bool(req.duplicateDepthPruning),
        duplicateAction=req.duplicateAction if req.duplicateAction in ("REMOVE_SECOND", "COMPARE_ROWS") else "REMOVE_SECOND",
        impossibleAction=req.impossibleAction if req.impossibleAction in ("REMOVE", "CLIP", "DELETE_ROW") else "REMOVE",
        approvedFixes=req.approvedFixes,
        flatlineHandling=False,
        depthGapInterpolation=False,
        unitStandardization=False,
        imputationStrategy=req.imputationStrategy,
    )

    initial_qa = analyze_well_log_quality(target_las, custom_aliases=server_aliases)

    clean_result = clean_las_log_data(
        target_las,
        initial_qa=initial_qa,
        options=options,
        custom_aliases=server_aliases,
    )

    report = clean_result.verificationReport
    user_name = current_user.name if current_user else "Subsurface Engineer"
    user_role = normalize_role(current_user.role) if current_user else "USER"
    user_id = current_user.id if current_user else None

    # Construct precise audit description with real counts
    audit_cert_id = f"WQC-CERT-{secrets.token_hex(4).upper()}"
    parts = []
    if report.outliersRemovedCount:
        parts.append(f"{report.outliersRemovedCount} impossible values nulled")
    if getattr(report, "outliersClippedCount", 0):
        parts.append(f"{report.outliersClippedCount} impossible values clipped")
    if getattr(report, "outlierRowsDeletedCount", 0):
        parts.append(f"{report.outlierRowsDeletedCount} rows deleted ({report.goodReadingsLostInDeletedRows} readings lost)")
    if report.spikesDespikedCount:
        parts.append(f"{report.spikesDespikedCount} spikes despiked")
    if report.duplicateDepthsPrunedCount:
        parts.append(f"{report.duplicateDepthsPrunedCount} duplicate depths pruned")
    if report.nullsImputedCount:
        parts.append(f"{report.nullsImputedCount} null values filled")

    actions_summary = ", ".join(parts) if parts else "No anomalies modified"
    log_details = (
        f"Verified petrophysical repair executed for {well_name}: {actions_summary}. "
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

    change_report = _build_change_report(target_las, clean_result.cleanedLas, req.approvedFixes)

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
        "changeReport": change_report,
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
                "duplicateAction": req.duplicateAction or "REMOVE_SECOND",
                "impossibleAction": req.impossibleAction or "REMOVE",
                "imputationStrategy": req.imputationStrategy,
                "approvedCount": len(req.approvedFixes) if req.approvedFixes is not None else "ALL",
            },
        },
    }


@router.post("/rank-gaps")
def rank_gaps_for_clusters(
    req: GapRecommendationRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Evaluates requested null clusters across benchmark gap buckets (5, 10, 20, 50, 100 samples)
    and returns per-gap winning methods with NRMSE ranking and justifications.
    """
    server_aliases = _get_user_aliases(db, current_user)
    target_las, _, _ = _resolve_target_las(
        req.wellId, req.wellName, req.rawLasText, req.rawLas, server_aliases, db, current_user
    )

    depth_arr = np.array(target_las.data.depth, dtype=float)
    if depth_arr.size == 0 or not req.gaps:
        return {"recommendations": []}

    step = abs(target_las.wellInfo.step) if target_las.wellInfo.step else 0.5
    tol = step * 0.5 if step > 0 else 1e-4
    null_val = target_las.wellInfo.nullValue if target_las.wellInfo.nullValue is not None else -999.25

    gaps_to_run: List[Tuple[str, int, int, float, float]] = []
    for g in req.gaps:
        lo, hi = sorted((g.depthStart, g.depthEnd))
        idx = np.flatnonzero((depth_arr >= lo - tol) & (depth_arr <= hi + tol))
        if idx.size:
            s, e = int(idx[0]), int(idx[-1]) + 1
            gaps_to_run.append((g.curve, s, e, g.depthStart, g.depthEnd))

    query_gaps = [(c, s, e) for c, s, e, _, _ in gaps_to_run]
    try:
        picks = recommend_for_gaps(depth_arr.tolist(), target_las.data.curves, null_val, query_gaps)
    except Exception:
        picks = {}

    recommendations = []
    for c, s, e, d_start, d_end in gaps_to_run:
        info = picks.get((c, s, e), {})
        best_method = info.get("method", "LINEAR")
        bucket = info.get("bucket", 10)
        reason = info.get("reason", "Linear interpolation selected as baseline.")
        ranking_raw = info.get("ranking", [])
        ranking = [{"method": m, "nrmse": float(score)} for m, score in ranking_raw]
        recommendations.append({
            "curve": c,
            "depthStart": d_start,
            "depthEnd": d_end,
            "bestMethod": best_method,
            "bucket": bucket,
            "reason": reason,
            "ranking": ranking,
        })

    return {"recommendations": recommendations}

