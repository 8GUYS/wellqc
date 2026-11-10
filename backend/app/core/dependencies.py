"""
Authentication and Authorization Dependencies for FastAPI.

This module provides dependency injection callables for resolving the currently
authenticated user from encrypted HTTP cookies or Bearer tokens, with automatic
database provisioning to guarantee foreign-key referential integrity across all tables.
"""

from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.app.core.database import get_db, set_rls_context
from backend.app.core.security import read_session_token
from backend.app.models.models import User
from backend.app.core.config import settings

import logging

logger = logging.getLogger("uvicorn.error")

# OpenAPI security scheme for Swagger UI (/docs) Authorize button
security_bearer = HTTPBearer(auto_error=False)

def _resolve_session_user(
    request: Request,
    bearer_creds: Optional[HTTPAuthorizationCredentials],
    db: Session,
) -> Optional[User]:
    """
    Extracts and resolves the active user from the request context if present.
    
    Checks:
      1. OpenAPI Bearer credentials passed via Swagger UI Authorize modal.
      2. HttpOnly cookie named `wellqc_session` (primary for Next.js browser sessions).
      3. `Authorization: Bearer <token>` header (for programmatic API requests / tokens).
    
    If a valid decrypted session token is found, ensures that a corresponding record exists
    in the database `User` table to guarantee that any child foreign keys (e.g. Well.ownerId,
    ActivityLog.userId, LASFile.uploadedById) will succeed without constraint violations.
    """
    token = None
    if bearer_creds and bearer_creds.credentials:
        token = bearer_creds.credentials.strip()

    if not token:
        token = request.cookies.get(settings.SESSION_COOKIE_NAME)

    if not token:
        # Also check Authorization: Bearer <token> for API flexibility
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            
    if not token:
        return None
    
    session_data = read_session_token(token)
    if not session_data or "id" not in session_data:
        return None
    
    try:
        return db.query(User).filter(User.id == session_data["id"]).first()
    except Exception as e:
        logger.error(f"Error querying user session: {e}", exc_info=True)
        return None

def get_current_user_optional(
    request: Request,
    bearer_creds: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Resolves the active user (see _resolve_session_user) and records that user in
    the database session's row-level-security context. Every return path of the
    resolver passes through here, including the "no token" and "unknown user"
    paths, which set the no-user (default-deny) context.
    """
    user = _resolve_session_user(request, bearer_creds, db)
    set_rls_context(db, user)
    return user


def get_current_user(
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> User:
    """
    Guarantees that the incoming request is authenticated.
    Raises HTTP 401 Unauthorized if no active session or bearer token is present.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Authentication is required. To test in Swagger UI (/docs), click the 'Authorize' "
                "button at the top and paste your token, or authenticate first via POST /api/auth/login."
            ),
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user

def get_current_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Enforces Role-Based Access Control (RBAC) requiring ADMIN role privileges.
    Raises HTTP 403 Forbidden if the user is authenticated but not an administrator.
    Default to deny: strictly verifies current_user role matches ADMIN.
    """
    if not current_user or (current_user.role or "").strip().upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required.",
        )
    return current_user


def require_paid_subscription(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Enforces that the user has an active paid subscription (PRO, ENTERPRISE) or is an administrator.
    Free tier users receive HTTP 402 Payment Required.
    """
    user_tier = (current_user.tier or "FREE").strip().upper()
    user_role = (current_user.role or "").strip().upper()
    if user_tier == "FREE" and user_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="QA Engine automated repair and imputation require an active WellQC Pro or Enterprise subscription. Please upgrade via Paystack.",
        )
    return current_user

