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
    create_email_verification_token,
    read_email_verification_token,
    create_password_reset_token,
    read_password_reset_token,
    normalize_role,
)
from backend.app.models.models import User, ActivityLog
from backend.app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    UserOut,
    VerifyEmailRequest,
    ResendVerificationRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from backend.app.services.email import send_verification_email, send_password_reset_email
from backend.app.core.rate_limit import RateLimitDependency

router = APIRouter(prefix="/api/auth", tags=["auth"])

def _format_user(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": normalize_role(user.role),
        "department": user.department or "",
        "avatarUrl": getattr(user, "avatarUrl", None) or "",
        "tier": user.tier or "FREE",
        "freeChecksUsed": user.freeChecksUsed or 0,
        "ndaAcceptedAt": user.ndaAcceptedAt.isoformat() if user.ndaAcceptedAt else None,
        "isEmailVerified": bool(getattr(user, "isEmailVerified", False)),
        "emailVerifiedAt": user.emailVerifiedAt.isoformat() if getattr(user, "emailVerifiedAt", None) else None,
    }

def _set_session_cookie(response: Response, user_dict: dict) -> str:
    # Avoid packing heavy base64 data URLs into the 4KB browser cookie token
    cookie_user = {k: v for k, v in user_dict.items() if k != "avatarUrl" or not str(v or "").startswith("data:")}
    token = create_session_token(cookie_user)
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
        path="/",
    )
    return token

def _delete_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
    )


@router.post("/login", dependencies=[Depends(RateLimitDependency(max_requests=10, window_seconds=60, action="login"))])
def login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    safe_email = req.email.strip().lower() if req.email else ""
    user = db.query(User).filter(User.email == safe_email).first() if safe_email else None
    
    if not user or not req.password or not verify_password(req.password, user.passwordHash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email address or password.",
        )
    
    # Enforce email verification check
    if settings.REQUIRE_EMAIL_VERIFICATION and not getattr(user, "isEmailVerified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your email address has not been verified yet. Please check your inbox or request a new verification link.",
        )
    
    user_dict = _format_user(user)
    token = _set_session_cookie(response, user_dict)
    
    # Log activity
    log = ActivityLog(
        userId=user.id,
        userName=user.name,
        userRole=normalize_role(user.role),
        action="LOGIN",
        targetType="USER",
        targetId=user.id,
        details="User logged in successfully.",
    )
    db.add(log)
    db.commit()

    return {"user": user_dict, "token": token}


@router.post("/register", status_code=status.HTTP_201_CREATED, dependencies=[Depends(RateLimitDependency(max_requests=10, window_seconds=60, action="register"))])
def register(req: RegisterRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    safe_name = req.name.strip() if req.name else ""
    safe_email = req.email.strip().lower() if req.email else ""
    role_cand = (req.role or "").strip().upper()
    if role_cand == "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator accounts cannot be self-registered. Contact an existing administrator for elevated access.",
        )
    safe_role = "USER"

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
        isEmailVerified=not settings.REQUIRE_EMAIL_VERIFICATION,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate secure verification token
    verification_token = create_email_verification_token(
        user_id=new_user.id,
        email=new_user.email,
    )

    # Dispatch verification email via transactional service (EmailJS, Resend, or dev logger)
    try:
        send_verification_email(
            email=new_user.email,
            name=new_user.name,
            token=verification_token,
            db=db,
            request=request,
        )
    except Exception as email_err:
        import logging
        logging.getLogger("wellqc.auth").warning(f"Verification email dispatch warning: {email_err}")

    user_dict = _format_user(new_user)

    # Activity log
    log = ActivityLog(
        userId=new_user.id,
        userName=new_user.name,
        userRole=normalize_role(new_user.role),
        action="REGISTER",
        targetType="USER",
        targetId=new_user.id,
        details="User registered new account; verification email dispatched.",
    )
    db.add(log)
    db.commit()

    if settings.REQUIRE_EMAIL_VERIFICATION:
        return {
            "user": user_dict,
            "requiresVerification": True,
            "message": "Account created. A verification link has been sent to your email.",
            "verificationToken": verification_token if settings.ENVIRONMENT == "development" else None,
        }

    token = _set_session_cookie(response, user_dict)
    return {"user": user_dict, "token": token, "requiresVerification": False}


@router.get("/verify-email")
def verify_email(token: str, response: Response, db: Session = Depends(get_db)):
    """
    Verify a user's email address using a cryptographically signed HMAC token.
    On successful verification, sets isEmailVerified=True and establishes a session cookie.
    """
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token is missing.",
        )

    payload = read_email_verification_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The verification link is invalid or has expired. Please request a new verification email.",
        )

    user_id = payload.get("sub")
    token_email = (payload.get("email") or "").lower()

    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.email.lower() != token_email:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The account associated with this verification link was not found.",
        )

    now = datetime.now(timezone.utc)
    user.isEmailVerified = True
    user.emailVerifiedAt = now

    # Activity log
    log = ActivityLog(
        userId=user.id,
        userName=user.name,
        userRole=user.role,
        action="EMAIL_VERIFIED",
        targetType="USER",
        targetId=user.id,
        details=f"Email address {user.email} verified successfully via token.",
    )
    db.add(log)
    db.commit()
    db.refresh(user)

    user_dict = _format_user(user)
    session_token = _set_session_cookie(response, user_dict)

    return {
        "success": True,
        "message": "Your email address has been verified successfully. Welcome to WellQC!",
        "user": user_dict,
        "token": session_token,
    }


@router.post("/resend-verification", dependencies=[Depends(RateLimitDependency(max_requests=10, window_seconds=60, action="resend_verification"))])
def resend_verification(req: ResendVerificationRequest, request: Request, db: Session = Depends(get_db)):
    """
    Resend a verification email to the user if their account is not yet verified.
    Returns generic response to prevent user enumeration attacks.
    """
    safe_email = req.email.strip().lower() if req.email else ""
    if not safe_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide an email address.",
        )

    user = db.query(User).filter(User.email == safe_email).first()
    if user and not getattr(user, "isEmailVerified", False):
        new_token = create_email_verification_token(user.id, user.email)
        send_verification_email(user.email, user.name, new_token, db=db, request=request)

    return {
        "success": True,
        "message": "If an unverified account exists with this email address, a fresh verification link has been sent.",
    }


@router.post("/forgot-password", dependencies=[Depends(RateLimitDependency(max_requests=10, window_seconds=60, action="forgot_password"))])
def forgot_password(req: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """
    Initiate self-service password reset.
    Returns generic response to prevent user enumeration attacks.
    If the account exists, issues signed HMAC reset token and dispatches email.
    """
    safe_email = req.email.strip().lower() if req.email else ""
    if not safe_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid corporate email address.",
        )

    reset_token = None
    user = db.query(User).filter(User.email == safe_email).first()
    if user:
        reset_token = create_password_reset_token(user.id, user.email)
        try:
            send_password_reset_email(user.email, user.name, reset_token, db=db, request=request)
        except Exception as email_err:
            import logging
            logging.getLogger("wellqc.auth").warning(f"Password reset email dispatch warning: {email_err}")

        # Log activity
        log = ActivityLog(
            userId=user.id,
            userName=user.name,
            userRole=user.role,
            action="PASSWORD_RESET_REQUESTED",
            targetType="USER",
            targetId=user.id,
            details=f"Password reset link generated and dispatched for {user.email}.",
        )
        db.add(log)
        db.commit()

    resp_data = {
        "success": True,
        "message": "If an account exists with this email address, password reset instructions have been dispatched.",
    }
    # Return resetToken in development mode for automated testing and local debugging convenience
    if settings.ENVIRONMENT != "production" and reset_token:
        resp_data["resetToken"] = reset_token

    return resp_data


@router.post("/reset-password", dependencies=[Depends(RateLimitDependency(max_requests=10, window_seconds=60, action="reset_password"))])
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Validate password reset token and update user's password.
    Enforces minimum 8 character password constraint and cryptographic token validity.
    """
    new_password = req.get_password()
    if not new_password or len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long.",
        )

    payload = read_password_reset_token(req.token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The password reset link is invalid or has expired. Please request a new one.",
        )

    user_id = payload.get("sub")
    token_email = (payload.get("email") or "").lower()

    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.email.lower() != token_email:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The account associated with this reset link was not found.",
        )

    # Update password hash
    user.passwordHash = hash_password(new_password)

    # Activity log
    log = ActivityLog(
        userId=user.id,
        userName=user.name,
        userRole=user.role,
        action="PASSWORD_RESET_COMPLETED",
        targetType="USER",
        targetId=user.id,
        details=f"Password successfully reset via token for user {user.email}.",
    )
    db.add(log)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": "Your password has been reset successfully. You may now log in with your new password.",
    }


@router.post("/logout")
def logout(response: Response):
    _delete_session_cookie(response)
    return {"success": True}


@router.get("/me")
def me(current_user: Optional[User] = Depends(get_current_user_optional)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in.")
    return {"user": _format_user(current_user)}


@router.get("/nda")
def get_nda(current_user: User = Depends(get_current_user)):
    return {
        "ndaAccepted": bool(current_user.ndaAcceptedAt),
        "ndaAcceptedAt": current_user.ndaAcceptedAt.isoformat() if current_user.ndaAcceptedAt else None,
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": normalize_role(current_user.role),
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
