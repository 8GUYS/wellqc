from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user
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
)

router = APIRouter(prefix="/api/wells", tags=["wells"])

def _extract_curve_summaries(
    latest_report: Optional[QualityReport],
    latest_las_file: Optional[LASFile],
) -> List[Dict[str, Any]]:
    if latest_report and latest_report.reportJson:
        try:
            parsed = json.loads(latest_report.reportJson)
            if isinstance(parsed, dict) and isinstance(parsed.get("curveSummaries"), list) and parsed["curveSummaries"]:
                return parsed["curveSummaries"]
        except Exception:
            pass

    if not latest_las_file or not latest_las_file.curves:
        return []

    summaries = []
    for curve in latest_las_file.curves:
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
    latest_las_file = well.lasFiles[0] if well.lasFiles else None
    latest_report = latest_las_file.reports[0] if (latest_las_file and latest_las_file.reports) else None
    curve_summaries = _extract_curve_summaries(latest_report, latest_las_file)

    anomaly_cnt = 0
    if latest_report:
        anomaly_cnt = len(latest_report.anomalies) if latest_report.anomalies is not None else latest_report.anomalyCount

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
        "latestReportId": latest_report.id if latest_report else None,
        "curveCount": latest_las_file.curveCount if latest_las_file else 0,
        "pointCount": latest_las_file.pointCount if latest_las_file else 0,
        "anomalyCount": anomaly_cnt,
        "curveSummaries": curve_summaries,
        "createdAt": well.createdAt.isoformat() if well.createdAt else "",
        "updatedAt": well.updatedAt.isoformat() if well.updatedAt else "",
    }


@router.get("")
def list_wells(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        wells = (
            db.query(Well)
            .filter(Well.ownerId == current_user.id)
            .order_by(desc(Well.updatedAt))
            .all()
        )
        return {"wells": [_to_well_list_item(w) for w in wells]}
    except Exception as e:
        return {"wells": [], "error": "Database is not available yet."}


@router.post("")
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
        userRole=current_user.role,
        userId=current_user.id,
        action="CREATE_WELL",
        targetType="WELL",
        targetId=well.id,
        details=f"Created or updated well asset {well.name} ({well.apiNo}).",
    )
    db.add(log)
    db.commit()
    db.refresh(well)

    return {"well": _to_well_list_item(well)}


@router.get("/{id}")
def get_well_detail(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    well = (
        db.query(Well)
        .filter(Well.id == id, Well.ownerId == current_user.id)
        .first()
    )
    if not well:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Well not found.",
        )

    latest_las_file = well.lasFiles[0] if well.lasFiles else None
    latest_report = latest_las_file.reports[0] if (latest_las_file and latest_las_file.reports) else None
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
        "aiSummary": latest_report.aiSummary if latest_report else "Upload and commit a LAS file to generate a petrophysical summary.",
        "recommendations": recs,
        "curvesData": curves_matrix,
        "curvesMatrix": curves_matrix,
        "startDepth": start_depth,
        "stopDepth": stop_depth,
        "depthUnit": depth_unit,
        "curveSummaries": curve_summaries,
        "anomalies": anomalies_list,
    }


@router.delete("/{id}")
def delete_well(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    well = (
        db.query(Well)
        .filter(Well.id == id, Well.ownerId == current_user.id)
        .first()
    )
    if not well:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Well not found or access is not permitted.",
        )

    well_name = well.name
    db.delete(well)

    # Activity log
    log = ActivityLog(
        userName="Well Management",
        userRole=current_user.role,
        userId=current_user.id,
        action="DELETE_WELL",
        targetType="WELL",
        targetId=id,
        details=f"Deleted well asset {well_name} and its uploaded LAS history.",
    )
    db.add(log)
    db.commit()

    return {"success": True, "message": f"Well {well_name} deleted successfully."}
