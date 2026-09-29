from datetime import datetime, timezone
import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user, get_current_user_optional
from backend.app.core.security import (
    create_session_token,
    hash_password,
    verify_password,
)
from backend.app.models.models import User, ActivityLog
from backend.app.schemas.auth import (
    DemoAuthRequest,
    LoginRequest,
    RegisterRequest,
    UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

def _format_user(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "department": user.department or "",
        "tier": user.tier or "FREE",
        "freeChecksUsed": user.freeChecksUsed or 0,
        "ndaAcceptedAt": user.ndaAcceptedAt.isoformat() if user.ndaAcceptedAt else None,
    }

def _set_session_cookie(response: Response, user_dict: dict) -> None:
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

def _delete_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
    )


@router.post("/login")
def login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    safe_email = req.email.strip().lower() if req.email else ""
    user = db.query(User).filter(User.email == safe_email).first() if safe_email else None
    
    if not user or not req.password or not verify_password(req.password, user.passwordHash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email address or password.",
        )
    
    user_dict = _format_user(user)
    _set_session_cookie(response, user_dict)
    
    # Log activity
    log = ActivityLog(
        userId=user.id,
        userName=user.name,
        userRole=user.role,
        action="LOGIN",
        targetType="USER",
        targetId=user.id,
        details="User logged in successfully.",
    )
    db.add(log)
    db.commit()

    return {"user": user_dict}


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    safe_name = req.name.strip() if req.name else ""
    safe_email = req.email.strip().lower() if req.email else ""
    valid_roles = ["ADMIN", "PETROPHYSICIST", "DATA_ENGINEER", "GEOSCIENTIST", "VIEWER"]
    role_cand = (req.role or "").strip().upper()
    safe_role = role_cand if role_cand in valid_roles else "PETROPHYSICIST"

    email_regex = r"^\S+@\S+\.\S+$"
    if (
        not safe_name
        or not safe_email
        or not re.match(email_regex, safe_email)
        or not req.password
        or len(req.password) < 8
        or not req.acceptedNda
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter a name, a valid email address, a password of at least 8 characters, and accept the confidentiality agreement.",
        )

    existing = db.query(User).filter(User.email == safe_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    now = datetime.now(timezone.utc)
    new_user = User(
        name=safe_name,
        email=safe_email,
        passwordHash=hash_password(req.password),
        role=safe_role,
        ndaAcceptedAt=now,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    user_dict = _format_user(new_user)
    _set_session_cookie(response, user_dict)

    # Activity log
    log = ActivityLog(
        userId=new_user.id,
        userName=new_user.name,
        userRole=new_user.role,
        action="LOGIN",
        targetType="USER",
        targetId=new_user.id,
        details="User registered new account and accepted NDA.",
    )
    db.add(log)
    db.commit()

    return {"user": user_dict}


@router.post("/logout")
def logout(response: Response):
    _delete_session_cookie(response)
    return {"success": True}


@router.get("/me")
def me(current_user: Optional[User] = Depends(get_current_user_optional)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in.")
    return {"user": _format_user(current_user)}


@router.post("/demo")
def demo_auth(
    response: Response,
    req: Optional[DemoAuthRequest] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    action = (req.action if req and req.action else "login")
    
    if action == "reset" and current_user:
        current_user.tier = "FREE"
        current_user.freeChecksUsed = 2
        db.commit()
        db.refresh(current_user)

        user_dict = _format_user(current_user)
        _set_session_cookie(response, user_dict)

        return {
            "ok": True,
            "message": "Reset user to FREE Starter tier (2/2 checks used).",
            "tier": "FREE",
            "freeChecksUsed": 2,
        }

    # Ensure demo user exists in database so foreign keys succeed
    demo_email = "demo.petrophysicist@wellqc.com"
    demo_user = db.query(User).filter(User.email == demo_email).first()
    if not demo_user:
        demo_user = User(
            id="demo-petrophysicist-uuid",
            email=demo_email,
            name="Demo Petrophysicist",
            passwordHash=hash_password("DemoPassword123!"),
            role="PETROPHYSICIST",
            department="Subsurface Analytics",
            tier="FREE",
            freeChecksUsed=2,
            ndaAcceptedAt=datetime.now(timezone.utc),
        )
        db.add(demo_user)
        db.commit()
        db.refresh(demo_user)
    elif demo_user.freeChecksUsed is None:
        demo_user.freeChecksUsed = 2
        db.commit()
        db.refresh(demo_user)

    demo_user_dict = _format_user(demo_user)
    _set_session_cookie(response, demo_user_dict)

    return {
        "ok": True,
        "user": demo_user_dict,
        "message": "Logged in as Demo Petrophysicist with 2/2 checks used (Ready for Paystack upgrade).",
    }


@router.get("/nda")
def get_nda(current_user: User = Depends(get_current_user)):
    return {
        "ndaAccepted": bool(current_user.ndaAcceptedAt),
        "ndaAcceptedAt": current_user.ndaAcceptedAt.isoformat() if current_user.ndaAcceptedAt else None,
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
            "department": current_user.department,
        },
    }


@router.post("/nda")
def accept_nda(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    current_user.ndaAcceptedAt = now
    db.commit()
    db.refresh(current_user)

    user_dict = _format_user(current_user)
    _set_session_cookie(response, user_dict)

    return {
        "success": True,
        "ndaAccepted": True,
        "ndaAcceptedAt": now.isoformat(),
    }
