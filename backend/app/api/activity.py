from datetime import datetime, timezone
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.models.models import ActivityLog, User

router = APIRouter(prefix="/api/activity", tags=["activity"])

def _relative_time(dt: datetime) -> str:
    now = datetime.now(timezone.utc)
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
def get_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        activities = (
            db.query(ActivityLog)
            .filter(ActivityLog.userId == current_user.id)
            .order_by(desc(ActivityLog.createdAt))
            .limit(100)
            .all()
        )

        return {
            "activities": [
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
                for a in activities
            ]
        }
    except Exception as e:
        return {"activities": [], "error": str(e)}
