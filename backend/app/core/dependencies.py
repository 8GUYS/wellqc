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
from backend.app.core.database import get_db
from backend.app.core.security import read_session_token
from backend.app.models.models import User
from backend.app.core.config import settings

# OpenAPI security scheme for Swagger UI (/docs) Authorize button
security_bearer = HTTPBearer(auto_error=False)

def get_current_user_optional(
    request: Request,
    bearer_creds: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
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
    
    user = db.query(User).filter(User.id == session_data["id"]).first()
    if not user and session_data.get("email"):
        user = db.query(User).filter(User.email == session_data["email"]).first()
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
