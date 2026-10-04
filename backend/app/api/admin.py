from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_admin_user
from backend.app.models.models import User

router = APIRouter(prefix="/api/admin", tags=["admin"])

VALID_ROLES = ["ADMIN", "PETROPHYSICIST", "DATA_ENGINEER", "GEOSCIENTIST", "VIEWER"]

class UpdateRoleRequest(BaseModel):
    userId: str
    role: str

class DeleteUserRequest(BaseModel):
    userId: str

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

    db.delete(target_user)
    db.commit()

    return {"success": True}
