from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload, defer
from sqlalchemy import desc, asc, or_
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.core.security import normalize_role
from backend.app.core.rate_limit import RateLimitDependency
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
from backend.app.schemas.well import (
    CreateWellRequest,
    WellDetailResponse,
    WellListItem,
    BulkDeleteWellsRequest,
    BulkDeleteWellsResponse,
)

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/wells", tags=["wells"])

_wells_cache: Dict[str, Tuple[float, Any]] = {}
CACHE_TTL_SECONDS = 30.0

def invalidate_wells_cache():
    _wells_cache.clear()

def _extract_curve_summaries(
    latest_report: Optional[QualityReport],
    latest_las_file: Optional[LASFile],
) -> List[Dict[str, Any]]:
    if not latest_las_file:
        return []

    curves = getattr(latest_las_file, "curves", None)
    if not curves:
        return []

    summaries = []
    for curve in curves:
        health_score = 100
        null_pct = curve.nullPercentage or 0.0
        if null_pct > 50:
            health_score -= 40
        elif null_pct > 20:
            health_score -= 20
        elif null_pct > 5:
            health_score -= 10
        health_score = max(0, min(100, health_score))

        status_str = "EXCELLENT" if curve.status == "VALID" else ("GOOD" if curve.status == "STANDARDISED" else "POOR")
        summaries.append({
            "mnemonic": curve.originalMnemonic,
            "standardMnemonic": curve.standardMnemonic or "UNKNOWN",
            "unit": curve.unit or "",
            "nullCount": curve.nullCount or 0,
            "totalPoints": curve.totalPoints or 0,
            "nullPercentage": null_pct,
            "minVal": curve.minVal,
            "maxVal": curve.maxVal,
            "meanVal": curve.meanVal,
            "healthScore": health_score,
            "status": status_str,
            "anomalies": [],
        })
    return summaries

def _to_well_list_item(well: Well) -> Dict[str, Any]:
    latest_las_file = None
    if well.lasFiles:
        sorted_las = sorted(
            well.lasFiles,
            key=lambda lf: lf.createdAt or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        latest_las_file = sorted_las[0]

    latest_report = None
    if latest_las_file and latest_las_file.reports:
        sorted_reports = sorted(
            latest_las_file.reports,
            key=lambda r: r.createdAt or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        latest_report = sorted_reports[0]
    elif well.reports:
        sorted_reports = sorted(
            well.reports,
            key=lambda r: r.createdAt or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        latest_report = sorted_reports[0]

    curve_summaries = _extract_curve_summaries(latest_report, latest_las_file)

    anomaly_cnt = 0
    if latest_report:
        anomaly_cnt = latest_report.anomalyCount if latest_report.anomalyCount is not None else 0

    uploader_name = None
    uploader_email = None
    if well.owner:
        uploader_name = well.owner.name
        uploader_email = well.owner.email
    elif latest_las_file and latest_las_file.uploadedBy:
        uploader_name = latest_las_file.uploadedBy.name
        uploader_email = latest_las_file.uploadedBy.email
    elif well.lasFiles:
        for lf in well.lasFiles:
            if lf.uploadedBy:
                uploader_name = lf.uploadedBy.name
                uploader_email = lf.uploadedBy.email
                break

    return {
        "id": well.id,
        "apiNo": well.apiNo,
        "name": well.name,
        "operatorName": well.operatorName,
        "fieldName": well.fieldName,
        "basin": well.basin,
        "country": well.country,
        "latitude": well.latitude,
        "longitude": well.longitude,
        "elevFt": well.elevFt,
        "tdFt": well.tdFt,
        "depthUnit": well.depthUnit,
        "status": well.status,
        "qualityScore": well.qualityScore,
        "qualityGrade": well.qualityGrade,
        "latestLasFileName": latest_las_file.originalName if latest_las_file else None,
        "latestLasFileId": latest_las_file.id if latest_las_file else None,
        "latestLasFileCreatedAt": latest_las_file.createdAt.isoformat() if latest_las_file and latest_las_file.createdAt else None,
        "latestReportId": latest_report.id if latest_report else None,
        "curveCount": latest_las_file.curveCount if latest_las_file else 0,
        "pointCount": latest_las_file.pointCount if latest_las_file else 0,
        "anomalyCount": anomaly_cnt,
        "curveSummaries": curve_summaries,
        "ownerId": well.ownerId,
        "uploaderName": uploader_name,
        "uploaderEmail": uploader_email,
        "createdAt": well.createdAt.isoformat() if well.createdAt else "",
        "updatedAt": well.updatedAt.isoformat() if well.updatedAt else "",
    }


@router.get("")
def list_wells(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cache_key = f"{current_user.id}:{normalize_role(current_user.role)}"
    now = datetime.now(timezone.utc).timestamp()
    if cache_key in _wells_cache:
        cached_ts, cached_data = _wells_cache[cache_key]
        if now - cached_ts < CACHE_TTL_SECONDS:
            return cached_data

    try:
        query = db.query(Well).options(
            selectinload(Well.owner),
            selectinload(Well.lasFiles).options(
                defer(LASFile.rawContent),
                defer(LASFile.rawHeader),
            ).selectinload(LASFile.curves).options(
                defer(Curve.dataJson),
            ),
            selectinload(Well.lasFiles).selectinload(LASFile.uploadedBy),
            selectinload(Well.lasFiles).selectinload(LASFile.reports).options(
                defer(QualityReport.reportJson),
                defer(QualityReport.aiSummary),
                defer(QualityReport.recommendations),
            ),
            selectinload(Well.reports).options(
                defer(QualityReport.reportJson),
                defer(QualityReport.aiSummary),
                defer(QualityReport.recommendations),
            ),
        )
        if normalize_role(current_user.role) == "ADMIN":
            wells = query.order_by(desc(Well.updatedAt)).all()
        else:
            wells = (
                query.filter(Well.ownerId == current_user.id)
                .order_by(desc(Well.updatedAt))
                .all()
            )
        result = {"wells": [_to_well_list_item(w) for w in wells]}
        _wells_cache[cache_key] = (now, result)
        return result
    except Exception as e:
        logger.error(f"Error listing wells: {e}", exc_info=True)
        return {"wells": [], "error": f"Database error: {str(e)}"}


@router.post("", dependencies=[Depends(RateLimitDependency(max_requests=30, window_seconds=60, action="create_well"))])
def create_well(
    req: CreateWellRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = (req.name or "").strip()
    api_no = (req.apiNo or "").strip()

    if not name or not api_no:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Well name and API/UWI are required.",
        )

    operator_name = (req.operatorName or "").strip() or "Unknown Operator"
    field_name = (req.fieldName or "").strip() or "Unassigned Field"
    basin = (req.basin or "").strip() or "Uploaded Wells"
    country = (req.country or "").strip() or "Unknown"

    # Upsert Operator
    op = db.query(Operator).filter(Operator.name == operator_name).first()
    if not op:
        op = Operator(name=operator_name)
        db.add(op)
        db.flush()

    # Upsert Field
    fld = db.query(Field).filter(Field.name == field_name).first()
    if not fld:
        fld = Field(name=field_name, basin=basin, country=country)
        db.add(fld)
        db.flush()
    else:
        fld.basin = basin
        fld.country = country

    # Upsert Well
    well = db.query(Well).filter(Well.apiNo == api_no).first()
    now = datetime.now(timezone.utc)
    if well:
        is_admin = (normalize_role(current_user.role) == "ADMIN")
        is_owner = (well.ownerId == current_user.id)
        if not is_admin and not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to modify a well asset owned by another user.",
            )
        well.name = name
        well.operatorName = operator_name
        well.fieldName = field_name
        well.basin = basin
        well.country = country
        well.latitude = req.latitude or 0.0
        well.longitude = req.longitude or 0.0
        well.tdFt = req.tdFt or 0.0
        well.updatedAt = now
    else:
        well = Well(
            apiNo=api_no,
            name=name,
            operatorName=operator_name,
            fieldName=field_name,
            basin=basin,
            country=country,
            latitude=req.latitude or 0.0,
            longitude=req.longitude or 0.0,
            tdFt=req.tdFt or 0.0,
            qualityScore=0,
            qualityGrade="UNVALIDATED",
            ownerId=current_user.id,
        )
        db.add(well)
        db.flush()

    # Activity log
    log = ActivityLog(
        userName="Well Management",
        userRole=normalize_role(current_user.role),
        userId=current_user.id,
        action="CREATE_WELL",
        targetType="WELL",
        targetId=well.id,
        details=f"Created or updated well asset {well.name} ({well.apiNo}).",
    )
    db.add(log)
    db.commit()
    db.refresh(well)
    invalidate_wells_cache()

    return {"well": _to_well_list_item(well)}


@router.get("/{id}")
def get_well_detail(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clean_id = (id or "").strip()
    if not clean_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid well ID, API number, or Name is required.",
        )

    # Allow query by internal UUID, API/UWI number, or well name
    well = (
        db.query(Well)
        .options(
            selectinload(Well.owner),
            selectinload(Well.lasFiles).selectinload(LASFile.uploadedBy),
            selectinload(Well.lasFiles).selectinload(LASFile.reports),
            selectinload(Well.lasFiles).selectinload(LASFile.curves),
            selectinload(Well.reports),
        )
        .filter(
            or_(
                Well.id == clean_id,
                Well.apiNo == clean_id,
                Well.name == clean_id,
            )
        )
        .first()
    )
    if not well:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Well with ID, API number, or Name '{clean_id}' not found.",
        )

    # Permission check: ADMIN or owner
    is_admin = (normalize_role(current_user.role) == "ADMIN")
    is_owner = (well.ownerId == current_user.id)
    if not is_admin and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this well is restricted to its owner or system administrators.",
        )

    # Sort LAS files by createdAt descending to always resolve the latest upload
    latest_las_file = None
    if well.lasFiles:
        sorted_las = sorted(
            well.lasFiles,
            key=lambda lf: lf.createdAt or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        latest_las_file = sorted_las[0]

    # Resolve latest quality report from LAS file or direct well report
    latest_report = None
    if latest_las_file and latest_las_file.reports:
        sorted_reports = sorted(
            latest_las_file.reports,
            key=lambda r: r.createdAt or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        latest_report = sorted_reports[0]
    elif well.reports:
        sorted_reports = sorted(
            well.reports,
            key=lambda r: r.createdAt or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        latest_report = sorted_reports[0]

    curve_summaries = _extract_curve_summaries(latest_report, latest_las_file)

    # Build curves data for chart visualization and multi-track wireline viewer
    curves_data = []
    depth_array: List[float] = []
    curves_dict: Dict[str, List[float]] = {}
    start_depth = latest_las_file.startDepth if latest_las_file and latest_las_file.startDepth is not None else 0.0
    stop_depth = latest_las_file.stopDepth if latest_las_file and latest_las_file.stopDepth is not None else (well.tdFt or 0.0)
    depth_unit = latest_las_file.depthUnit if latest_las_file and latest_las_file.depthUnit else (well.depthUnit or "FT")

    if latest_las_file and latest_las_file.curves:
        for c in latest_las_file.curves:
            try:
                pts = json.loads(c.dataJson) if c.dataJson else []
            except Exception:
                pts = []
            curves_data.append({
                "mnemonic": c.originalMnemonic,
                "standardMnemonic": c.standardMnemonic,
                "unit": c.unit,
                "points": pts,
            })

            # Extract depth array from first curve with valid points
            if not depth_array and pts:
                depth_array = [float(p.get("depth", 0.0)) for p in pts if isinstance(p, dict) and "depth" in p]

            # Populate curve arrays for Wireline Log Viewer
            vals = [float(p.get("value", -999.25)) for p in pts if isinstance(p, dict) and "value" in p]
            curves_dict[c.originalMnemonic.upper()] = vals
            if c.standardMnemonic and c.standardMnemonic.upper() != c.originalMnemonic.upper():
                curves_dict[c.standardMnemonic.upper()] = vals

    # Recommendations parsing
    recs: List[str] = []
    if latest_report and latest_report.recommendations:
        try:
            parsed_recs = json.loads(latest_report.recommendations)
            if isinstance(parsed_recs, list):
                recs = [str(r) for r in parsed_recs]
            elif isinstance(parsed_recs, str):
                recs = [parsed_recs]
        except Exception:
            recs = [r.strip() for r in latest_report.recommendations.split("\n") if r.strip()]

    # Anomalies
    anomalies_list = []
    if latest_report and latest_report.anomalies:
        for a in latest_report.anomalies:
            anomalies_list.append({
                "curveMnemonic": a.curveMnemonic,
                "depthStart": a.depthStart,
                "depthEnd": a.depthEnd,
                "anomalyType": a.anomalyType,
                "severity": a.severity,
                "description": a.description,
                "suggestedCorrection": a.suggestedCorrection,
            })

    curves_matrix = {
        "depth": depth_array,
        "curves": curves_dict,
    }

    return {
        "well": _to_well_list_item(well),
        "aiSummary": latest_report.aiSummary if latest_report and latest_report.aiSummary else "Upload and commit a LAS file to generate a petrophysical summary.",
        "recommendations": recs,
        "curvesData": curves_matrix,
        "curvesMatrix": curves_matrix,
        "startDepth": start_depth,
        "stopDepth": stop_depth,
        "depthUnit": depth_unit,
        "curveSummaries": curve_summaries,
        "anomalies": anomalies_list,
    }


@router.post("/bulk-delete", response_model=BulkDeleteWellsResponse, summary="Bulk Delete Wells")
@router.delete("/bulk-delete", response_model=BulkDeleteWellsResponse, include_in_schema=False)
def bulk_delete_wells(
    payload: Optional[BulkDeleteWellsRequest] = None,
    ids: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_ids = []
    if payload and payload.wellIds:
        target_ids.extend(payload.wellIds)
    if ids:
        target_ids.extend([i.strip() for i in ids.split(",") if i.strip()])

    if not target_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No well IDs provided for bulk deletion.",
        )

    clean_ids = [w_id.strip() for w_id in target_ids if w_id and w_id.strip()]
    if not clean_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid well IDs provided for bulk deletion.",
        )

    wells = (
        db.query(Well)
        .filter(
            or_(
                Well.id.in_(clean_ids),
                Well.apiNo.in_(clean_ids),
                Well.name.in_(clean_ids),
            )
        )
        .all()
    )

    if not wells:
        return {
            "success": True,
            "deletedCount": 0,
            "deletedIds": [],
            "message": "No matching wells found to delete.",
        }

    is_admin = (normalize_role(current_user.role) == "ADMIN")
    deleted_ids = []
    deleted_names = []

    for well in wells:
        is_owner = (well.ownerId == current_user.id)
        if not is_admin and not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: you do not have permission to delete well '{well.name}' ({well.id}).",
            )
        deleted_ids.append(well.id)
        deleted_names.append(well.name)
        db.delete(well)

    if deleted_ids:
        log = ActivityLog(
            userName="Well Management",
            userRole=normalize_role(current_user.role),
            userId=current_user.id,
            action="BULK_DELETE_WELLS",
            targetType="WELL",
            targetId=",".join(deleted_ids[:10]),
            details=f"Bulk deleted {len(deleted_ids)} well asset(s): {', '.join(deleted_names[:5])}{'...' if len(deleted_names) > 5 else ''}",
        )
        db.add(log)
        db.commit()

    invalidate_wells_cache()

    return {
        "success": True,
        "deletedCount": len(deleted_ids),
        "deletedIds": deleted_ids,
        "message": f"Successfully deleted {len(deleted_ids)} well asset(s).",
    }


@router.delete("/{id}")
def delete_well(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clean_id = (id or "").strip()
    well = (
        db.query(Well)
        .filter(
            or_(
                Well.id == clean_id,
                Well.apiNo == clean_id,
                Well.name == clean_id,
            )
        )
        .first()
    )
    if not well:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Well with ID, API number, or Name '{clean_id}' not found.",
        )

    is_admin = (normalize_role(current_user.role) == "ADMIN")
    is_owner = (well.ownerId == current_user.id)
    if not is_admin and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to delete this well is restricted to its owner or system administrators.",
        )

    well_name = well.name
    db.delete(well)

    # Activity log
    log = ActivityLog(
        userName="Well Management",
        userRole=normalize_role(current_user.role),
        userId=current_user.id,
        action="DELETE_WELL",
        targetType="WELL",
        targetId=well.id,
        details=f"Deleted well asset {well_name} and its uploaded LAS history.",
    )
    db.add(log)
    db.commit()

    invalidate_wells_cache()

    return {"success": True, "message": f"Well {well_name} deleted successfully."}
