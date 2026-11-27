"""
Public Enterprise Lead Capture & Contact Inquiry Endpoints.

Persists incoming technical demo bookings and contact inquiries to `ActivityLog`
for admin audit visibility and dispatches transactional email notifications
via `backend.app.services.email` (EmailJS / Resend / Dev Logger).
"""

import logging
import re
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.database import get_db, set_rls_context
from backend.app.core.dependencies import get_current_user, get_current_user_optional
from backend.app.core.rate_limit import RateLimitDependency, get_client_ip
from backend.app.models.models import ActivityLog, User
from backend.app.schemas.enums import ActivityAction
from backend.app.services.email import (
    get_effective_email_config,
    resolve_lead_notification_email,
    send_contact_inquiry_emails,
    send_demo_request_emails,
)

logger = logging.getLogger("wellqc.leads")

router = APIRouter(prefix="/api/leads", tags=["leads"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_email(raw_email: str, field_label: str = "Email") -> str:
    cleaned = (raw_email or "").strip().lower()
    if not cleaned or len(cleaned) > 254 or not _EMAIL_RE.match(cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Please provide a valid {field_label.lower()}.",
        )
    return cleaned


class DemoRequestPayload(BaseModel):
    fullName: str = Field(..., min_length=1, max_length=120)
    workEmail: str = Field(..., min_length=3, max_length=254)
    company: str = Field(..., min_length=1, max_length=150)
    jobTitle: Optional[str] = Field(default="", max_length=120)
    fleetSize: Optional[str] = Field(default="< 50 Wells", max_length=80)
    primaryObjective: Optional[str] = Field(default="NUPRC Regulatory Compliance Filing", max_length=160)
    timeframe: Optional[str] = Field(default="This Week", max_length=80)
    notes: Optional[str] = Field(default="", max_length=2000)


class ContactInquiryPayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3, max_length=254)
    company: Optional[str] = Field(default="", max_length=150)
    message: str = Field(..., min_length=1, max_length=2000)


@router.post(
    "/demo",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimitDependency(max_requests=5, window_seconds=60, action="lead_demo"))],
)
def submit_demo_request(
    payload: DemoRequestPayload,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    full_name = payload.fullName.strip()
    work_email = _validate_email(payload.workEmail, "Corporate work email")
    company = payload.company.strip()
    job_title = (payload.jobTitle or "").strip()
    fleet_size = (payload.fleetSize or "< 50 Wells").strip()
    primary_objective = (payload.primaryObjective or "NUPRC Regulatory Compliance Filing").strip()
    timeframe = (payload.timeframe or "This Week").strip()
    notes = (payload.notes or "").strip()

    if not full_name or not company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name and company name are required.",
        )

    # Pre-resolve email configuration and destination admin email while DB session is active
    email_cfg = get_effective_email_config(db=db, request=request)
    admin_email = resolve_lead_notification_email(db=db, config=email_cfg)

    client_ip = get_client_ip(request)
    details = (
        f"Demo requested by {full_name} <{work_email}> from {company}"
        + (f" ({job_title})" if job_title else "")
        + f". Fleet: {fleet_size}. Focus: {primary_objective}."
        + (f" Notes: {notes[:300]}" if notes else "")
    )

    lead_id: Optional[str] = None
    try:
        if current_user is not None:
            set_rls_context(db, current_user)
        log_entry = ActivityLog(
            userId=current_user.id if current_user else None,
            userName=f"{full_name} ({company})"[:120],
            userRole=(current_user.role if current_user else "VISITOR"),
            action=ActivityAction.DEMO_REQUEST.value,
            targetType="ENTERPRISE_LEAD",
            targetId=work_email,
            details=details,
            ipAddress=client_ip,
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        lead_id = log_entry.id
    except Exception as db_exc:
        db.rollback()
        logger.warning(f"Non-critical: Unable to persist demo request in ActivityLog: {db_exc}")

    background_tasks.add_task(
        send_demo_request_emails,
        full_name=full_name,
        work_email=work_email,
        company=company,
        job_title=job_title,
        fleet_size=fleet_size,
        primary_objective=primary_objective,
        timeframe=timeframe,
        notes=notes,
        admin_email=admin_email,
        config=email_cfg,
    )

    return {
        "success": True,
        "leadId": lead_id,
        "message": "Technical demonstration request received.",
    }


@router.post(
    "/contact",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimitDependency(max_requests=5, window_seconds=60, action="lead_contact"))],
)
def submit_contact_inquiry(
    payload: ContactInquiryPayload,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    name = payload.name.strip()
    email = _validate_email(payload.email, "Work email")
    company = (payload.company or "").strip()
    message = payload.message.strip()

    if not name or not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name and message are required.",
        )

    email_cfg = get_effective_email_config(db=db, request=request)
    admin_email = resolve_lead_notification_email(db=db, config=email_cfg)

    client_ip = get_client_ip(request)
    details = (
        f"Contact inquiry from {name} <{email}>"
        + (f" ({company})" if company else "")
        + f": {message[:400]}"
    )

    inquiry_id: Optional[str] = None
    try:
        if current_user is not None:
            set_rls_context(db, current_user)
        log_entry = ActivityLog(
            userId=current_user.id if current_user else None,
            userName=(f"{name} ({company})" if company else name)[:120],
            userRole=(current_user.role if current_user else "VISITOR"),
            action=ActivityAction.CONTACT_INQUIRY.value,
            targetType="SUPPORT_INQUIRY",
            targetId=email,
            details=details,
            ipAddress=client_ip,
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        inquiry_id = log_entry.id
    except Exception as db_exc:
        db.rollback()
        logger.warning(f"Non-critical: Unable to persist contact inquiry in ActivityLog: {db_exc}")

    background_tasks.add_task(
        send_contact_inquiry_emails,
        name=name,
        email=email,
        company=company,
        message=message,
        admin_email=admin_email,
        config=email_cfg,
    )

    return {
        "success": True,
        "inquiryId": inquiry_id,
        "message": "Your message has been sent to our technical support team.",
    }


@router.get("")
def list_leads(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Admin-only endpoint to retrieve all captured demo bookings and contact inquiries.
    """
    user_role = (current_user.role or "").upper()
    if user_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Lead logs are restricted to platform administrators.",
        )

    logs = (
        db.query(ActivityLog)
        .filter(
            (ActivityLog.targetType.in_(["LEAD", "ENTERPRISE_LEAD", "SUPPORT_INQUIRY"]))
            | (
                ActivityLog.action.in_(
                    [
                        ActivityAction.DEMO_REQUEST.value,
                        ActivityAction.CONTACT_INQUIRY.value,
                    ]
                )
            )
        )
        .order_by(ActivityLog.createdAt.desc())
        .limit(200)
        .all()
    )

    return {
        "leads": [
            {
                "id": log.id,
                "userName": log.userName,
                "userRole": log.userRole,
                "action": log.action,
                "targetType": log.targetType,
                "targetId": log.targetId,
                "details": log.details,
                "createdAt": log.createdAt.isoformat() if log.createdAt else "",
                "ip": log.ipAddress,
            }
            for log in logs
        ]
    }

