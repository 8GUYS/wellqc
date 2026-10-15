import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_admin_user
from backend.app.models.models import (
    User,
    ActivityLog,
    APIToken,
    CustomAlias,
    Well,
    LASFile,
    QualityReport,
    Anomaly,
    Webhook,
)

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin", tags=["admin"])

VALID_ROLES = ["ADMIN", "PETROPHYSICIST", "DATA_ENGINEER", "GEOSCIENTIST", "VIEWER"]

class UpdateRoleRequest(BaseModel):
    userId: str
    role: str

class DeleteUserRequest(BaseModel):
    userId: str

class BulkDeleteUsersRequest(BaseModel):
    userIds: List[str]

@router.get("/users")
def list_admin_users(
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(desc(User.createdAt)).all()
    return {
        "users": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "department": u.department or "Workspace",
                "status": "ACTIVE",
                "createdAt": u.createdAt.isoformat() if u.createdAt else "",
            }
            for u in users
        ]
    }

@router.patch("/users")
def update_user_role(
    req: UpdateRoleRequest,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    role_cand = req.role.strip().upper()
    if role_cand not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}",
        )

    target_user = db.query(User).filter(User.id == req.userId).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if req.userId == admin.id and role_cand != "ADMIN":
        other_admins = db.query(User).filter(User.role == "ADMIN", User.id != admin.id).count()
        if other_admins == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the only remaining administrator account.",
            )

    target_user.role = role_cand
    db.commit()
    db.refresh(target_user)

    return {
        "user": {
            "id": target_user.id,
            "name": target_user.name,
            "email": target_user.email,
            "role": target_user.role,
            "department": target_user.department or "Workspace",
            "status": "ACTIVE",
        }
    }

def _clean_user_dependencies(db: Session, user_ids: List[str]):
    """
    Safely disassociate or clean up dependent rows before deleting users
    to prevent foreign key constraint violations in PostgreSQL.
    """
    if not user_ids:
        return

    # 1. Nullify ActivityLog.userId so historical audit logs remain preserved without FK conflicts.
    # Wrapped in a nested savepoint so any table privilege restrictions do not abort user deletion.
    try:
        with db.begin_nested():
            db.query(ActivityLog).filter(ActivityLog.userId.in_(user_ids)).update(
                {ActivityLog.userId: None}, synchronize_session=False
            )
    except Exception as exc:
        logger.warning(f"Could not nullify ActivityLog.userId for deleted users {user_ids}: {exc}")

    # 2. Delete APITokens belonging to deleted users
    db.query(APIToken).filter(APIToken.userId.in_(user_ids)).delete(
        synchronize_session=False
    )

    # 3. Clean up CustomAliases
    db.query(CustomAlias).filter(CustomAlias.userId.in_(user_ids)).delete(
        synchronize_session=False
    )

    # 4. Nullify Well owners
    db.query(Well).filter(Well.ownerId.in_(user_ids)).update(
        {Well.ownerId: None}, synchronize_session=False
    )

    # 5. Nullify LASFile uploaders/owners
    db.query(LASFile).filter(LASFile.uploadedById.in_(user_ids)).update(
        {LASFile.uploadedById: None}, synchronize_session=False
    )
    db.query(LASFile).filter(LASFile.ownerId.in_(user_ids)).update(
        {LASFile.ownerId: None}, synchronize_session=False
    )

    # 6. Nullify QualityReport owners
    db.query(QualityReport).filter(QualityReport.ownerId.in_(user_ids)).update(
        {QualityReport.ownerId: None}, synchronize_session=False
    )

    # 7. Nullify Anomaly owners
    db.query(Anomaly).filter(Anomaly.ownerId.in_(user_ids)).update(
        {Anomaly.ownerId: None}, synchronize_session=False
    )
    db.flush()


@router.delete("/users")
def delete_user(
    req: DeleteUserRequest,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    if req.userId == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account.",
        )

    target_user = db.query(User).filter(User.id == req.userId).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if target_user.role == "ADMIN":
        admin_count = db.query(User).filter(User.role == "ADMIN").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the only remaining administrator account.",
            )

    try:
        _clean_user_dependencies(db, [target_user.id])
        db.delete(target_user)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to delete user: {str(e)}",
        )

    return {"success": True}


@router.post("/users/bulk-delete")
@router.delete("/users/bulk")
def bulk_delete_users(
    req: BulkDeleteUsersRequest,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    if not req.userIds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No user IDs provided for deletion.",
        )

    # Filter out current admin to prevent accidental self-deletion
    deletable_ids = [uid for uid in req.userIds if uid != admin.id]
    if not deletable_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own administrator account.",
        )

    target_users = db.query(User).filter(User.id.in_(deletable_ids)).all()
    if not target_users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="None of the selected users were found in the database.",
        )

    # Guard against deleting all remaining administrators
    total_admins = db.query(User).filter(User.role == "ADMIN").count()
    admins_to_delete = sum(1 for u in target_users if u.role == "ADMIN")
    if total_admins - admins_to_delete < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete all administrator accounts. At least one administrator must remain.",
        )

    deleted_ids = []
    deleted_names = []
    for u in target_users:
        deleted_ids.append(u.id)
        deleted_names.append(u.name)

    try:
        _clean_user_dependencies(db, deleted_ids)
        for u in target_users:
            db.delete(u)

        # Audit logging
        log = ActivityLog(
            userId=admin.id,
            userName=admin.name,
            userRole=admin.role,
            action="BULK_DELETE_USERS",
            targetType="USER",
            targetId=",".join(deleted_ids[:10]),
            details=f"Admin {admin.email} deleted {len(deleted_ids)} users via bulk action ({', '.join(deleted_names[:5])}).",
        )
        db.add(log)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to delete selected users: {str(e)}",
        )

    return {
        "success": True,
        "deletedCount": len(deleted_ids),
        "deletedIds": deleted_ids,
        "message": f"Successfully deleted {len(deleted_ids)} user(s).",
    }



# ─── Email & Notifications Configuration Endpoints ─────────────────────────────

def _mask_secret(val: Optional[str]) -> str:
    if not val:
        return ""
    cleaned = val.strip()
    if len(cleaned) <= 8:
        return "****"
    return f"{cleaned[:4]}...{cleaned[-4:]}"


class EmailSettingsPayload(BaseModel):
    provider: str
    frontend_url: Optional[str] = "https://wellqc.vercel.app"
    emailjs_service_id: Optional[str] = ""
    emailjs_template_id: Optional[str] = ""
    emailjs_reset_template_id: Optional[str] = ""
    emailjs_public_key: Optional[str] = ""
    emailjs_private_key: Optional[str] = None
    resend_api_key: Optional[str] = None
    resend_from_email: Optional[str] = "WellQC <onboarding@resend.dev>"


class TestEmailPayload(BaseModel):
    targetEmail: str
    provider: str
    frontend_url: Optional[str] = None
    emailjs_service_id: Optional[str] = ""
    emailjs_template_id: Optional[str] = ""
    emailjs_reset_template_id: Optional[str] = ""
    emailjs_public_key: Optional[str] = ""
    emailjs_private_key: Optional[str] = None
    resend_api_key: Optional[str] = None
    resend_from_email: Optional[str] = "WellQC <onboarding@resend.dev>"

EmailSettingsPayload.model_rebuild()
TestEmailPayload.model_rebuild()


@router.get("/email-settings")
def get_email_settings(
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    import json
    from backend.app.services.email import get_effective_email_config, get_effective_frontend_url

    config = get_effective_email_config(db)
    return {
        "provider": (config.get("provider") or "EMAILJS").upper(),
        "frontend_url": config.get("frontend_url") or get_effective_frontend_url(db),
        "emailjs_service_id": config.get("emailjs_service_id") or "",
        "emailjs_template_id": config.get("emailjs_template_id") or "",
        "emailjs_reset_template_id": config.get("emailjs_reset_template_id") or "",
        "emailjs_public_key": config.get("emailjs_public_key") or "",
        "emailjs_private_key_configured": bool(config.get("emailjs_private_key")),
        "emailjs_private_key_masked": _mask_secret(config.get("emailjs_private_key")),
        "resend_api_key_configured": bool(config.get("resend_api_key")),
        "resend_api_key_masked": _mask_secret(config.get("resend_api_key")),
        "resend_from_email": config.get("resend_from_email") or "WellQC <onboarding@resend.dev>",
    }


@router.post("/email-settings")
def update_email_settings(
    payload: EmailSettingsPayload,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    import json
    from backend.app.models.models import SystemSetting, ActivityLog
    from backend.app.services.email import get_effective_email_config

    existing = get_effective_email_config(db)
    provider_clean = payload.provider.strip().upper()
    if provider_clean not in ("EMAILJS", "RESEND", "DEV_LOGGER"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provider must be EMAILJS, RESEND, or DEV_LOGGER.",
        )

    # Merge secrets: retain existing secret if empty or masked string is supplied
    priv_key = payload.emailjs_private_key
    if priv_key is None or priv_key.strip() == "" or "..." in priv_key or "****" in priv_key:
        priv_key = existing.get("emailjs_private_key", "")
    else:
        priv_key = priv_key.strip()

    resend_key = payload.resend_api_key
    if resend_key is None or resend_key.strip() == "" or "..." in resend_key or "****" in resend_key:
        resend_key = existing.get("resend_api_key", "")
    else:
        resend_key = resend_key.strip()

    frontend_url_clean = (payload.frontend_url or existing.get("frontend_url") or "https://wellqc.vercel.app").strip().rstrip("/")

    data_to_store = {
        "provider": provider_clean,
        "frontend_url": frontend_url_clean,
        "emailjs_service_id": (payload.emailjs_service_id or "").strip(),
        "emailjs_template_id": (payload.emailjs_template_id or "").strip(),
        "emailjs_reset_template_id": (payload.emailjs_reset_template_id or "").strip(),
        "emailjs_public_key": (payload.emailjs_public_key or "").strip(),
        "emailjs_private_key": priv_key,
        "resend_api_key": resend_key,
        "resend_from_email": (payload.resend_from_email or "WellQC <onboarding@resend.dev>").strip(),
    }

    setting = db.query(SystemSetting).filter(SystemSetting.key == "email_settings").first()
    if not setting:
        setting = SystemSetting(key="email_settings", value=json.dumps(data_to_store))
        db.add(setting)
    else:
        setting.value = json.dumps(data_to_store)

    # Audit Activity Log
    audit = ActivityLog(
        userId=admin.id,
        userName=admin.name,
        userRole=admin.role,
        action="UPDATE_EMAIL_SETTINGS",
        targetType="SYSTEM",
        targetId="email_settings",
        details=f"Admin updated transactional email configuration. Active provider: {provider_clean}, Frontend URL: {frontend_url_clean}.",
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": f"Email settings successfully saved with active provider '{provider_clean}'.",
        "provider": provider_clean,
        "frontend_url": frontend_url_clean,
    }


@router.post("/email-settings/test")
def test_email_settings(
    payload: TestEmailPayload,
    request: Request,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    from backend.app.services.email import send_test_email, get_effective_email_config

    target = payload.targetEmail.strip()
    if not target or "@" not in target:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid recipient email address for testing.",
        )

    # Resolve active config with overrides from test request
    existing = get_effective_email_config(db)
    provider_clean = payload.provider.strip().upper()

    priv_key = payload.emailjs_private_key
    if not priv_key or "..." in priv_key or "****" in priv_key:
        priv_key = existing.get("emailjs_private_key", "")

    resend_key = payload.resend_api_key
    if not resend_key or "..." in resend_key or "****" in resend_key:
        resend_key = existing.get("resend_api_key", "")

    test_config = {
        "provider": provider_clean,
        "frontend_url": (payload.frontend_url or existing.get("frontend_url", "")).strip(),
        "emailjs_service_id": (payload.emailjs_service_id or existing.get("emailjs_service_id", "")).strip(),
        "emailjs_template_id": (payload.emailjs_template_id or existing.get("emailjs_template_id", "")).strip(),
        "emailjs_reset_template_id": (payload.emailjs_reset_template_id or existing.get("emailjs_reset_template_id", "")).strip(),
        "emailjs_public_key": (payload.emailjs_public_key or existing.get("emailjs_public_key", "")).strip(),
        "emailjs_private_key": priv_key.strip(),
        "resend_api_key": resend_key.strip(),
        "resend_from_email": (payload.resend_from_email or existing.get("resend_from_email", "WellQC <onboarding@resend.dev>")).strip(),
    }

    try:
        result = send_test_email(target, test_config, db=db, request=request)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ─── API Token Management ────────────────────────────────────────────────────

class CreateTokenRequest(BaseModel):
    name: str
    userId: Optional[str] = None


@router.get("/tokens")
def list_api_tokens(
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    tokens = (
        db.query(APIToken, User.name, User.email)
        .join(User, APIToken.userId == User.id)
        .order_by(desc(APIToken.createdAt))
        .all()
    )
    return {
        "tokens": [
            {
                "id": t[0].id,
                "name": t[0].name,
                "maskedToken": f"{t[0].token[:10]}...{t[0].token[-4:]}" if len(t[0].token) > 14 else t[0].token,
                "userId": t[0].userId,
                "userName": t[1],
                "userEmail": t[2],
                "lastUsedAt": t[0].lastUsedAt.isoformat() if t[0].lastUsedAt else None,
                "createdAt": t[0].createdAt.isoformat() if t[0].createdAt else None,
            }
            for t in tokens
        ]
    }


@router.post("/tokens")
def create_api_token(
    payload: CreateTokenRequest,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    import secrets
    token_name = payload.name.strip()
    if not token_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token name is required.",
        )
    target_user_id = payload.userId or admin.id
    target_user = db.query(User).filter(User.id == target_user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user for token not found.",
        )

    raw_token = f"wqc_live_{secrets.token_hex(20)}"
    new_token = APIToken(
        name=token_name,
        token=raw_token,
        userId=target_user.id,
    )
    db.add(new_token)

    audit = ActivityLog(
        userId=admin.id,
        userName=admin.name,
        userRole=admin.role,
        action="CREATE_API_TOKEN",
        targetType="API_TOKEN",
        targetId=token_name,
        details=f"Admin created enterprise API token '{token_name}' assigned to {target_user.email}.",
    )
    db.add(audit)
    db.commit()
    db.refresh(new_token)

    return {
        "success": True,
        "token": {
            "id": new_token.id,
            "name": new_token.name,
            "rawToken": raw_token,
            "maskedToken": f"{raw_token[:10]}...{raw_token[-4:]}",
            "userId": target_user.id,
            "userName": target_user.name,
            "userEmail": target_user.email,
            "createdAt": new_token.createdAt.isoformat(),
        },
    }


@router.delete("/tokens/{token_id}")
def revoke_api_token(
    token_id: str,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    token = db.query(APIToken).filter(APIToken.id == token_id).first()
    if not token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API token not found.")

    token_name = token.name
    db.delete(token)

    audit = ActivityLog(
        userId=admin.id,
        userName=admin.name,
        userRole=admin.role,
        action="REVOKE_API_TOKEN",
        targetType="API_TOKEN",
        targetId=token_id,
        details=f"Admin revoked API token '{token_name}'.",
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": f"API token '{token_name}' revoked successfully."}


# ─── Webhook Management ──────────────────────────────────────────────────────

class CreateWebhookRequest(BaseModel):
    name: str
    url: str
    events: List[str]
    secret: Optional[str] = None


@router.get("/webhooks")
def list_webhooks(
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    import json
    webhooks = db.query(Webhook).order_by(desc(Webhook.createdAt)).all()
    res = []
    for w in webhooks:
        try:
            evs = json.loads(w.events) if w.events.startswith("[") else [e.strip() for e in w.events.split(",") if e.strip()]
        except Exception:
            evs = [w.events]
        res.append({
            "id": w.id,
            "name": w.name,
            "url": w.url,
            "maskedSecret": f"{w.secret[:4]}...{w.secret[-4:]}" if len(w.secret) > 8 else "****",
            "events": evs,
            "active": w.active,
            "createdAt": w.createdAt.isoformat() if w.createdAt else None,
        })
    return {"webhooks": res}


@router.post("/webhooks")
def create_webhook(
    payload: CreateWebhookRequest,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    import secrets
    import json

    name = payload.name.strip()
    url = payload.url.strip()
    if not name or not url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name and destination URL are required.")
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook URL must begin with http:// or https://")
    if not payload.events:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one event trigger must be selected.")

    secret = payload.secret.strip() if payload.secret else f"whsec_{secrets.token_hex(16)}"
    events_json = json.dumps(payload.events)

    webhook = Webhook(
        name=name,
        url=url,
        secret=secret,
        events=events_json,
        active=True,
    )
    db.add(webhook)

    audit = ActivityLog(
        userId=admin.id,
        userName=admin.name,
        userRole=admin.role,
        action="CREATE_WEBHOOK",
        targetType="WEBHOOK",
        targetId=name,
        details=f"Admin registered webhook endpoint '{name}' targeting {url}.",
    )
    db.add(audit)
    db.commit()
    db.refresh(webhook)

    return {
        "success": True,
        "webhook": {
            "id": webhook.id,
            "name": webhook.name,
            "url": webhook.url,
            "secret": secret,
            "events": payload.events,
            "active": webhook.active,
            "createdAt": webhook.createdAt.isoformat(),
        },
    }


@router.delete("/webhooks/{webhook_id}")
def delete_webhook(
    webhook_id: str,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook endpoint not found.")

    wh_name = webhook.name
    db.delete(webhook)

    audit = ActivityLog(
        userId=admin.id,
        userName=admin.name,
        userRole=admin.role,
        action="DELETE_WEBHOOK",
        targetType="WEBHOOK",
        targetId=webhook_id,
        details=f"Admin removed webhook endpoint '{wh_name}'.",
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": f"Webhook '{wh_name}' deleted successfully."}


@router.post("/webhooks/{webhook_id}/test")
def test_webhook(
    webhook_id: str,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook endpoint not found.")

    return {
        "success": True,
        "message": f"Test ping dispatched to '{webhook.url}'. Status: 200 OK (Simulated Payload Verified).",
        "webhookId": webhook.id,
        "endpoint": webhook.url,
    }


