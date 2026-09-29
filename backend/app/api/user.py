from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.core.security import hash_password, verify_password, create_session_token
from backend.app.core.config import settings
from backend.app.models.models import ActivityLog, User

router = APIRouter(prefix="/api/user", tags=["user"])

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    currentPassword: Optional[str] = None
    newPassword: Optional[str] = None


@router.get("/profile")
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    activity_logs = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.userId == current_user.id,
            ActivityLog.action.in_(["UPGRADE_SUBSCRIPTION", "LOGIN", "NDA_ACCEPTED"]),
        )
        .order_by(desc(ActivityLog.createdAt))
        .limit(10)
        .all()
    )

    # Format payment records from UPGRADE_SUBSCRIPTION activity logs
    payment_records = []
    for log in activity_logs:
        if log.action == "UPGRADE_SUBSCRIPTION":
            is_annual = "Annual" in log.details
            is_ngn = "₦" in log.details or "$" not in log.details
            amount = ("₦750,000" if is_ngn else "$490") if is_annual else ("₦75,000" if is_ngn else "$49")
            match = re.search(r"Ref:\s*([^\s.]+)", log.details)
            ref = match.group(1) if match else (current_user.stripeSubscriptionId or "PSTK_REF_DIRECT")
            payment_records.append({
                "id": log.id,
                "reference": ref,
                "planName": "Pro Petrophysicist (Annual)" if is_annual else "Pro Petrophysicist (Monthly)",
                "amount": amount,
                "channel": "Card / Paystack" if "Card" in log.details else "Transfer / USSD",
                "status": "SUCCESS",
                "date": log.createdAt.isoformat() if log.createdAt else "",
            })

    return {
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
            "department": current_user.department or "Subsurface Analytics",
            "tier": current_user.tier or "FREE",
            "freeChecksUsed": current_user.freeChecksUsed or 0,
            "maxFreeChecks": 2,
            "totalFilesUploaded": len(current_user.lasFiles),
            "ndaAcceptedAt": current_user.ndaAcceptedAt.isoformat() if current_user.ndaAcceptedAt else None,
            "createdAt": current_user.createdAt.isoformat() if current_user.createdAt else "",
        },
        "paymentRecords": payment_records,
        "recentActivity": [
            {
                "id": l.id,
                "action": l.action,
                "details": l.details,
                "createdAt": l.createdAt.isoformat() if l.createdAt else "",
                "ipAddress": l.ipAddress,
            }
            for l in activity_logs
        ],
    }


@router.put("/profile")
def update_profile(
    req: UpdateProfileRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.name is not None and req.name.strip():
        current_user.name = req.name.strip()
    if req.department is not None:
        current_user.department = req.department.strip()

    if req.role is not None and req.role.strip():
        requested_role = req.role.strip().upper()
        valid_roles = ["PETROPHYSICIST", "DATA_ENGINEER", "GEOSCIENTIST", "VIEWER", "ADMIN"]
        if requested_role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role specified.",
            )
        if requested_role == "ADMIN" and current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Privilege escalation restricted: Users cannot self-assign the Administrator (ADMIN) role.",
            )
        current_user.role = requested_role

    if req.newPassword:
        if not req.currentPassword:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required to set a new password.",
            )
        if not verify_password(req.currentPassword, current_user.passwordHash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect.",
            )
        if len(req.newPassword) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 8 characters.",
            )
        current_user.passwordHash = hash_password(req.newPassword)

    current_user.updatedAt = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)

    # Refresh session cookie
    user_dict = {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "department": current_user.department or "",
        "tier": current_user.tier or "FREE",
        "freeChecksUsed": current_user.freeChecksUsed or 0,
        "ndaAcceptedAt": current_user.ndaAcceptedAt.isoformat() if current_user.ndaAcceptedAt else None,
    }
    token = create_session_token(user_dict)
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
        path="/",
    )

    return {
        "user": user_dict,
        "message": "Profile updated successfully.",
    }
