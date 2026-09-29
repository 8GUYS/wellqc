from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.models.models import Anomaly, QualityReport, User, Well

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

ANOMALY_COLORS = {
    "EXTREME_SPIKE": "#f59e0b",
    "IMPOSSIBLE_VALUE": "#ef4444",
    "FLATLINE": "#06b6d4",
    "DEPTH_GAP": "#3b82f6",
    "UNIT_MISMATCH": "#8b5cf6",
    "NULL_CLUSTER": "#ec4899",
    "DUPLICATE_DEPTH": "#14b8a6",
}

@router.get("")
def get_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        wells = (
            db.query(Well)
            .filter(Well.ownerId == current_user.id)
            .all()
        )
        well_ids = [w.id for w in wells]

        # Anomaly distribution
        anomalies_counts = (
            db.query(
                Anomaly.anomalyType,
                func.count(Anomaly.id).label("count"),
            )
            .join(QualityReport, Anomaly.qualityReportId == QualityReport.id)
            .filter(QualityReport.wellId.in_(well_ids))
            .group_by(Anomaly.anomalyType)
            .order_by(desc("count"))
            .all()
            if well_ids
            else []
        )

        # Operator scores
        operators_map: Dict[str, Dict[str, Any]] = {}
        for w in wells:
            op = w.operatorName
            if op not in operators_map:
                operators_map[op] = {"totalScore": 0, "wells": 0, "files": 0}
            operators_map[op]["totalScore"] += w.qualityScore
            operators_map[op]["wells"] += 1
            operators_map[op]["files"] += len(w.lasFiles)

        operator_scores = [
            {
                "operator": op,
                "score": round(data["totalScore"] / data["wells"]) if data["wells"] > 0 else 0,
                "files": data["files"],
            }
            for op, data in operators_map.items()
        ]
        operator_scores.sort(key=lambda x: x["score"], reverse=True)

        anomaly_distribution = [
            {
                "name": anom_type.replace("_", " "),
                "value": count,
                "color": ANOMALY_COLORS.get(anom_type, "#64748b"),
            }
            for anom_type, count in anomalies_counts
        ]

        return {
            "operatorScores": operator_scores,
            "anomalyDistribution": anomaly_distribution,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load analytics: {e}",
        )
