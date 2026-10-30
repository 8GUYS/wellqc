import numpy as np
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
    FormationMarker,
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
    CompareWellsRequest,
    FormationMarkerItem,
    SaveFormationMarkersRequest,
)
from backend.app.services.comparison import compare_two_wells, WellComparisonResult
from backend.app.services.standardiser import standardise_mnemonic

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


def _extract_curves_matrix(well: Well) -> Tuple[Dict[str, Any], float, float, str]:
    """Extract depth array and curves dict from the well's latest LAS file."""
    latest_las_file = None
    if well.lasFiles:
        sorted_las = sorted(
            well.lasFiles,
            key=lambda lf: lf.createdAt or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        latest_las_file = sorted_las[0]

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

            # Extract depth array from first curve with valid points
            if not depth_array and pts:
                depth_array = [float(p.get("depth", 0.0)) for p in pts if isinstance(p, dict) and "depth" in p]

            vals = [float(p.get("value", -999.25)) for p in pts if isinstance(p, dict) and "value" in p]
            orig_upper = c.originalMnemonic.upper()
            curves_dict[orig_upper] = vals
            if c.standardMnemonic and c.standardMnemonic.upper() != orig_upper:
                curves_dict[c.standardMnemonic.upper()] = vals
            else:
                try:
                    std_res = standardise_mnemonic(c.originalMnemonic, c.unit or "")
                    if std_res and std_res.standard_mnemonic and std_res.standard_mnemonic.upper() != orig_upper:
                        curves_dict[std_res.standard_mnemonic.upper()] = vals
                except Exception:
                    pass

    curves_matrix = {
        "depth": depth_array,
        "curves": curves_dict,
        "nullValue": latest_las_file.nullValue if latest_las_file else None,
    }
    return curves_matrix, start_depth, stop_depth, depth_unit


@router.post("/compare")
def compare_wells_endpoint(
    payload: CompareWellsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    primary_id = (payload.primary_well_id or "").strip()
    offset_id = (payload.offset_well_id or "").strip()

    if not primary_id or not offset_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both primary_well_id and offset_well_id are required.",
        )

    # Fetch both wells
    wells = (
        db.query(Well)
        .options(
            selectinload(Well.owner),
            selectinload(Well.formationMarkers),
            selectinload(Well.lasFiles).selectinload(LASFile.curves),
        )
        .filter(
            or_(
                Well.id == primary_id,
                Well.apiNo == primary_id,
                Well.name == primary_id,
                Well.id == offset_id,
                Well.apiNo == offset_id,
                Well.name == offset_id,
            )
        )
        .all()
    )

    well_a = next((w for w in wells if w.id == primary_id or w.apiNo == primary_id or w.name == primary_id), None)
    well_b = next((w for w in wells if w.id == offset_id or w.apiNo == offset_id or w.name == offset_id), None)

    if not well_a:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Primary well '{primary_id}' not found.",
        )
    if not well_b:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Offset comparison well '{offset_id}' not found.",
        )

    # RBAC check: ADMIN or well owner
    is_admin = (normalize_role(current_user.role) == "ADMIN")
    if not is_admin:
        if well_a.ownerId != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: You do not own primary well '{well_a.name}'.",
            )
        if well_b.ownerId != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: You do not own offset well '{well_b.name}'.",
            )

    matrix_a, _, _, unit_a = _extract_curves_matrix(well_a)
    matrix_b, _, _, unit_b = _extract_curves_matrix(well_b)

    markers_a_list = [
        {"formationName": m.formationName, "topDepth": m.topDepth, "source": m.source}
        for m in (well_a.formationMarkers or [])
    ]
    markers_b_list = [
        {"formationName": m.formationName, "topDepth": m.topDepth, "source": m.source}
        for m in (well_b.formationMarkers or [])
    ]

    num_pts = min(1000, max(50, payload.num_resample_points or 400))
    result = compare_two_wells(
        well_a_id=well_a.id,
        well_a_name=well_a.name,
        curves_data_a=matrix_a,
        well_b_id=well_b.id,
        well_b_name=well_b.name,
        curves_data_b=matrix_b,
        depth_unit=unit_a or unit_b or "FT",
        num_resample_points=num_pts,
        db_markers_a=markers_a_list,
        db_markers_b=markers_b_list,
    )

    return result.model_dump()


@router.get("/{id}/markers")
def get_well_formation_markers(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clean_id = (id or "").strip()
    well = (
        db.query(Well)
        .options(
            selectinload(Well.formationMarkers),
            selectinload(Well.lasFiles).selectinload(LASFile.curves),
        )
        .filter(or_(Well.id == clean_id, Well.apiNo == clean_id, Well.name == clean_id))
        .first()
    )
    if not well:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Well '{clean_id}' not found.",
        )

    # Permission check: ADMIN or owner
    is_admin = (normalize_role(current_user.role) == "ADMIN")
    if not is_admin and well.ownerId != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to well owner or administrators.",
        )

    if well.formationMarkers:
        return {
            "markers": [
                {
                    "id": m.id,
                    "wellId": m.wellId,
                    "formationName": m.formationName,
                    "topDepth": m.topDepth,
                    "bottomDepth": m.bottomDepth,
                    "source": m.source,
                    "pickedBy": m.pickedBy,
                    "notes": m.notes,
                }
                for m in well.formationMarkers
            ]
        }

    # Algorithmic estimation fallback
    matrix, _, _, _ = _extract_curves_matrix(well)
    from backend.app.services.comparison import _estimate_formations
    depths = np.array(matrix.get("depth", []))
    if len(depths) == 0:
        td = float(well.tdFt or 10000.0)
        elev = float(well.elevFt or 0.0)
        depths = np.linspace(elev, td, 100)
    curves = {k: np.array(v) for k, v in matrix.get("curves", {}).items()}
    estimated = _estimate_formations(depths, curves)

    return {
        "markers": [
            {
                "id": None,
                "wellId": well.id,
                "formationName": f"{fname} Formation",
                "topDepth": top_depth,
                "bottomDepth": None,
                "source": "ESTIMATED",
                "pickedBy": "Algorithmic Niger Delta Model",
                "notes": "Estimated from log depth span and Gamma Ray baseline.",
            }
            for fname, top_depth in estimated.items()
            if top_depth is not None
        ]
    }


@router.post("/{id}/markers")
def save_well_formation_markers(
    id: str,
    payload: SaveFormationMarkersRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clean_id = (id or "").strip()
    well = (
        db.query(Well)
        .options(selectinload(Well.formationMarkers))
        .filter(or_(Well.id == clean_id, Well.apiNo == clean_id, Well.name == clean_id))
        .first()
    )
    if not well:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Well '{clean_id}' not found.",
        )

    # Permission check: ADMIN or owner
    is_admin = (normalize_role(current_user.role) == "ADMIN")
    if not is_admin and well.ownerId != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to well owner or administrators.",
        )

    # Replace existing markers with updated picks
    db.query(FormationMarker).filter(FormationMarker.wellId == well.id).delete()
    db.flush()

    saved_items = []
    for m in payload.markers:
        new_marker = FormationMarker(
            wellId=well.id,
            formationName=m.formationName,
            topDepth=m.topDepth,
            bottomDepth=m.bottomDepth,
            source=m.source or "VERIFIED",
            pickedBy=m.pickedBy or current_user.name or current_user.email,
            notes=m.notes,
            ownerId=current_user.id,
        )
        db.add(new_marker)
        saved_items.append(new_marker)

    # Audit activity log
    log = ActivityLog(
        userName=current_user.name or "Petrophysicist",
        userRole=normalize_role(current_user.role),
        userId=current_user.id,
        action="UPDATE_FORMATION_MARKERS",
        targetType="WELL",
        targetId=well.id,
        details=f"Updated {len(saved_items)} formation marker tops for well {well.name}.",
    )
    db.add(log)
    db.commit()

    return {
        "success": True,
        "count": len(saved_items),
        "message": f"Successfully saved {len(saved_items)} formation markers for well {well.name}.",
    }


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
        "aiSummary": latest_report.aiSummary if latest_report and latest_report.aiSummary else "Upload a LAS file to generate a petrophysical summary.",
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