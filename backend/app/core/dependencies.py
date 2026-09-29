from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.security import read_session_token
from backend.app.models.models import User
from backend.app.core.config import settings

def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db),
) -> Optional[User]:
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
    if not user:
        # Fallback to session user so demo login and stateless sessions work seamlessly
        user = User(
            id=session_data["id"],
            email=session_data.get("email", ""),
            name=session_data.get("name", "User"),
            role=session_data.get("role", "PETROPHYSICIST"),
            department=session_data.get("department", "Subsurface"),
            tier=session_data.get("tier", "FREE"),
            freeChecksUsed=session_data.get("freeChecksUsed", 0),
        )
    return user

def get_current_user(
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> User:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
        )
    return current_user

def get_current_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required.",
        )
    return current_user
