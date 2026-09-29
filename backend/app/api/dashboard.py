from datetime import datetime, timedelta, timezone
import json
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.models.models import (
    ActivityLog,
    Anomaly,
    Curve,
    LASFile,
    QualityReport,
    User,
    Well,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

def _grade_for_score(score: float) -> str:
    if score >= 90:
        return "EXCELLENT"
    if score >= 75:
        return "GOOD"
    if score >= 50:
        return "POOR"
    if score > 0:
        return "CRITICAL"
    return "UNVALIDATED"

def _format_data_size(kb: float) -> str:
    if kb >= 1024 * 1024:
        return f"{kb / 1024 / 1024:.1f} GB"
    if kb >= 1024:
        return f"{kb / 1024:.1f} MB"
    return f"{round(kb)} KB"

def _relative_time(dt: datetime) -> str:
    now = datetime.now(timezone.utc)
    # Ensure dt is offset-aware
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    seconds = max(0, int((now - dt).total_seconds()))
    if seconds < 60:
        return "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} min ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hr ago"
    days = hours // 24
    return f"{days} day{'s' if days != 1 else ''} ago"


@router.get("")
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        now = datetime.now(timezone.utc)
        start_of_today = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        seven_days_ago = start_of_today - timedelta(days=6)

        user_wells = db.query(Well).filter(Well.ownerId == current_user.id).all()
        well_ids = [w.id for w in user_wells]

        total_wells = len(user_wells)

        las_files_uploaded = (
            db.query(LASFile).filter(LASFile.wellId.in_(well_ids)).count()
            if well_ids
            else 0
        )

        curves_analysed = (
            db.query(Curve)
            .join(LASFile, Curve.lasFileId == LASFile.id)
            .filter(LASFile.wellId.in_(well_ids))
            .count()
            if well_ids
            else 0
        )

        anomalies_found = (
            db.query(Anomaly)
            .join(QualityReport, Anomaly.qualityReportId == QualityReport.id)
            .filter(QualityReport.wellId.in_(well_ids))
            .count()
            if well_ids
            else 0
        )

        errors_detected = (
            db.query(Anomaly)
            .join(QualityReport, Anomaly.qualityReportId == QualityReport.id)
            .filter(
                QualityReport.wellId.in_(well_ids),
                Anomaly.severity.in_(["CRITICAL", "WARNING"]),
            )
            .count()
            if well_ids
            else 0
        )

        avg_score_res = (
            db.query(func.avg(QualityReport.overallScore))
            .filter(QualityReport.wellId.in_(well_ids))
            .scalar()
            if well_ids
            else 0.0
        )
        avg_score = float(avg_score_res or 0.0)

        uploaded_today = (
            db.query(LASFile)
            .filter(LASFile.wellId.in_(well_ids), LASFile.createdAt >= start_of_today)
            .count()
            if well_ids
            else 0
        )

        cleaned_today_sum = (
            db.query(func.sum(LASFile.fileSizeKb))
            .filter(LASFile.wellId.in_(well_ids), LASFile.createdAt >= start_of_today)
            .scalar()
            if well_ids
            else 0.0
        )
        cleaned_today_kb = float(cleaned_today_sum or 0.0)

        # 7 days reports & files for trend
        recent_reports = (
            db.query(QualityReport)
            .filter(QualityReport.wellId.in_(well_ids), QualityReport.createdAt >= seven_days_ago)
            .all()
            if well_ids
            else []
        )

        recent_files = (
            db.query(LASFile)
            .filter(LASFile.wellId.in_(well_ids), LASFile.createdAt >= seven_days_ago)
            .all()
            if well_ids
            else []
        )

        # Trend calculation
        trend = []
        for i in range(7):
            d = seven_days_ago + timedelta(days=i)
            d_str = d.strftime("%Y-%m-%d")
            reports_for_day = [
                r for r in recent_reports
                if (r.createdAt.strftime("%Y-%m-%d") if r.createdAt else "") == d_str
            ]
            files_for_day = [
                f for f in recent_files
                if (f.createdAt.strftime("%Y-%m-%d") if f.createdAt else "") == d_str
            ]
            d_avg_score = (
                round(sum(r.overallScore for r in reports_for_day) / len(reports_for_day))
                if reports_for_day
                else 0
            )
            d_anomalies = sum(r.anomalyCount for r in reports_for_day)

            trend.append({
                "date": d.strftime("%b %d"),
                "avgScore": d_avg_score,
                "filesUploaded": len(files_for_day),
                "anomalies": d_anomalies,
            })

        # Field performance
        by_field: Dict[str, Dict[str, Any]] = {}
        for w in user_wells:
            f = w.fieldName
            if f not in by_field:
                by_field[f] = {"total": 0, "wells": 0}
            by_field[f]["total"] += w.qualityScore
            by_field[f]["wells"] += 1

        field_performance = []
        for f, data in by_field.items():
            f_score = round(data["total"] / data["wells"]) if data["wells"] > 0 else 0
            field_performance.append({
                "field": f,
                "score": f_score,
                "wells": data["wells"],
                "status": _grade_for_score(f_score),
            })
        field_performance.sort(key=lambda x: x["score"], reverse=True)

        # Problem wells
        prob_wells = [
            w for w in user_wells
            if w.qualityScore < 75 or w.qualityGrade in ("POOR", "CRITICAL")
        ]
        prob_wells.sort(key=lambda x: x.qualityScore)
        prob_wells_res = []
        for w in prob_wells[:5]:
            first_report = w.reports[0] if w.reports else None
            first_anom = first_report.anomalies[0] if (first_report and first_report.anomalies) else None
            prob_wells_res.append({
                "id": w.id,
                "name": w.name,
                "api": w.apiNo,
                "score": w.qualityScore,
                "grade": w.qualityGrade,
                "issue": first_anom.description if first_anom else "Quality score is below the accepted threshold.",
            })

        # Missing curves calculation
        missing_curves_count = 0
        for r in recent_reports:
            if r.reportJson:
                try:
                    p = json.loads(r.reportJson)
                    missing_curves_count += len(p.get("missingStandardCurves", []))
                except Exception:
                    pass

        # Recent activities
        recent_activity_records = (
            db.query(ActivityLog)
            .filter(ActivityLog.userId == current_user.id)
            .order_by(desc(ActivityLog.createdAt))
            .limit(5)
            .all()
        )
        recent_activity = [
            {
                "id": a.id,
                "userName": a.userName,
                "userRole": a.userRole,
                "action": a.action,
                "target": a.targetType or "PLATFORM",
                "details": a.details,
                "timestamp": _relative_time(a.createdAt),
                "ip": a.ipAddress,
            }
            for a in recent_activity_records
        ]

        return {
            "totalWells": total_wells,
            "lasFilesUploaded": las_files_uploaded,
            "averageQualityScore": round(avg_score),
            "averageQualityGrade": _grade_for_score(avg_score),
            "curvesAnalysed": curves_analysed,
            "errorsDetected": errors_detected,
            "missingCurves": missing_curves_count,
            "anomaliesFound": anomalies_found,
            "cleanedTodayLabel": _format_data_size(cleaned_today_kb),
            "uploadedToday": uploaded_today,
            "trend": trend,
            "fieldPerformance": field_performance[:6],
            "problemWells": prob_wells_res,
            "recentActivity": recent_activity,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load dashboard data: {e}",
        )
