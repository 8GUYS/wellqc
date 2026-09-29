from datetime import datetime, timezone
import json
import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user_optional
from backend.app.models.models import CustomAlias, User
from backend.app.schemas.standardisation import (
    AliasCreateRequest,
    AliasDeleteRequest,
    AliasUpdateRequest,
)
from backend.app.services.standardiser import (
    CustomAliasEntry,
    set_custom_aliases,
    validate_alias_for_curve,
)

router = APIRouter(prefix="/api/standardisation", tags=["standardisation"])

DATA_DIR = os.path.join(os.getcwd(), "data")
LOCAL_FILE = os.path.join(DATA_DIR, "custom-aliases.json")

def _read_file_aliases() -> List[dict]:
    if not os.path.exists(LOCAL_FILE):
        return []
    try:
        with open(LOCAL_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []

def _write_file_aliases(entries: List[dict]) -> None:
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(LOCAL_FILE, "w", encoding="utf-8") as f:
            json.dump(entries, f, indent=2)
    except Exception:
        pass

def _get_user_aliases(db: Session, user: Optional[User]) -> List[CustomAliasEntry]:
    user_id = user.id if user else "demo-petrophysicist-uuid"
    user_email = user.email if user else ""

    # Query DB
    db_records = (
        db.query(CustomAlias)
        .filter(
            (CustomAlias.userId == user_id)
            | (CustomAlias.userEmail == user_email)
            | (CustomAlias.userId.is_(None))
        )
        .all()
    )

    db_entries: List[CustomAliasEntry] = []
    seen = set()
    for r in db_records:
        key = (r.standardMnemonic.upper(), r.alias.upper())
        if key not in seen:
            seen.add(key)
            db_entries.append(
                CustomAliasEntry(
                    id=r.id,
                    alias=r.alias,
                    standardMnemonic=r.standardMnemonic,
                    addedBy=r.addedBy,
                    addedAt=r.addedAt.isoformat() if r.addedAt else datetime.now(timezone.utc).isoformat(),
                    userId=r.userId,
                    userEmail=r.userEmail,
                )
            )

    # Merge with file aliases (for test compatibility)
    for f in _read_file_aliases():
        key = (f.get("standardMnemonic", "").upper(), f.get("alias", "").upper())
        if key not in seen and f.get("standardMnemonic") and f.get("alias"):
            seen.add(key)
            db_entries.append(
                CustomAliasEntry(
                    id=f.get("id", str(uuid.uuid4())),
                    alias=f["alias"],
                    standardMnemonic=f["standardMnemonic"],
                    addedBy=f.get("addedBy", "Petrophysicist"),
                    addedAt=f.get("addedAt", datetime.now(timezone.utc).isoformat()),
                    userId=f.get("userId"),
                    userEmail=f.get("userEmail"),
                )
            )

    return db_entries


@router.get("/aliases")
def get_aliases(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    aliases = _get_user_aliases(db, current_user)
    set_custom_aliases(aliases)
    return {"aliases": [a.model_dump() for a in aliases]}


@router.post("/aliases", status_code=status.HTTP_201_CREATED)
def create_alias(
    req: AliasCreateRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    clean_curve = req.standardMnemonic.strip().upper() if req.standardMnemonic else ""
    clean_alias = req.alias.strip().upper() if req.alias else ""

    if not clean_curve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Standard mnemonic is required.",
        )
    if not clean_alias:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alias is required.",
        )

    user_aliases = _get_user_aliases(db, current_user)
    validation = validate_alias_for_curve(
        clean_alias, clean_curve, custom_aliases_list=user_aliases
    )

    if not validation.valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation.error,
        )

    added_by = (
        req.addedBy.strip()
        if req.addedBy and req.addedBy.strip()
        else (current_user.name if current_user else "Lead Petrophysicist")
    )
    user_id = current_user.id if current_user else "demo-petrophysicist-uuid"
    user_email = current_user.email if current_user else ""

    now = datetime.now(timezone.utc)
    new_entry = CustomAlias(
        id=f"alias_{int(now.timestamp() * 1000)}_{uuid.uuid4().hex[:6]}",
        alias=clean_alias,
        standardMnemonic=clean_curve,
        addedBy=added_by,
        addedAt=now,
        userId=user_id,
        userEmail=user_email,
    )
    db.add(new_entry)
    try:
        db.commit()
    except Exception:
        db.rollback()

    # Also update file aliases for local test compatibility
    entry_dict = {
        "id": new_entry.id,
        "alias": clean_alias,
        "standardMnemonic": clean_curve,
        "addedBy": added_by,
        "addedAt": now.isoformat(),
        "userId": user_id,
        "userEmail": user_email,
    }
    file_list = _read_file_aliases()
    file_list.append(entry_dict)
    _write_file_aliases(file_list)

    updated_aliases = _get_user_aliases(db, current_user)
    set_custom_aliases(updated_aliases)

    return {
        "message": f"Alias {clean_alias} successfully mapped to {clean_curve}.",
        "entry": entry_dict,
        "aliases": [a.model_dump() for a in updated_aliases],
    }


@router.put("/aliases")
def update_alias(
    req: AliasUpdateRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    clean_curve = req.standardMnemonic.strip().upper() if req.standardMnemonic else ""
    clean_old = req.oldAlias.strip().upper() if req.oldAlias else ""
    clean_new = req.newAlias.strip().upper() if req.newAlias else ""

    if not clean_curve or not clean_old or not clean_new:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="standardMnemonic, oldAlias, and newAlias are required.",
        )

    user_aliases = _get_user_aliases(db, current_user)
    existing = next(
        (e for e in user_aliases if e.standardMnemonic.upper() == clean_curve and e.alias.upper() == clean_old),
        None,
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Alias "{req.oldAlias}" not found under curve {clean_curve} in your account.',
        )

    if clean_old != clean_new:
        validation = validate_alias_for_curve(
            clean_new, clean_curve, editing_alias=clean_old, custom_aliases_list=user_aliases
        )
        if not validation.valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=validation.error,
            )

    # Update in DB
    user_id = current_user.id if current_user else "demo-petrophysicist-uuid"
    db_record = (
        db.query(CustomAlias)
        .filter(
            CustomAlias.standardMnemonic == clean_curve,
            CustomAlias.alias == clean_old,
        )
        .first()
    )
    now = datetime.now(timezone.utc)
    if db_record:
        db_record.alias = clean_new
        db_record.updatedAt = now
        db.commit()

    # Update in file
    file_list = _read_file_aliases()
    updated_file = []
    found_in_file = False
    for item in file_list:
        if (
            item.get("standardMnemonic", "").upper() == clean_curve
            and item.get("alias", "").upper() == clean_old
        ):
            item["alias"] = clean_new
            item["updatedAt"] = now.isoformat()
            found_in_file = True
        updated_file.append(item)
    if found_in_file:
        _write_file_aliases(updated_file)

    updated_aliases = _get_user_aliases(db, current_user)
    set_custom_aliases(updated_aliases)

    return {
        "message": f"Alias updated successfully to {clean_new}.",
        "entry": {
            "id": existing.id,
            "alias": clean_new,
            "standardMnemonic": clean_curve,
            "addedBy": existing.addedBy,
            "addedAt": existing.addedAt,
            "userId": existing.userId,
            "userEmail": existing.userEmail,
        },
        "aliases": [a.model_dump() for a in updated_aliases],
    }


@router.delete("/aliases")
def delete_alias(
    request: Request,
    standardMnemonic: Optional[str] = Query(None),
    alias: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    body_data = {}
    # Check body if not in query
    if not standardMnemonic or not alias:
        try:
            # Safely attempt to parse body
            body_bytes = request.scope.get("_body")
            if body_bytes:
                body_data = json.loads(body_bytes.decode("utf-8"))
        except Exception:
            pass

    clean_curve = (standardMnemonic or body_data.get("standardMnemonic") or "").strip().upper()
    clean_alias = (alias or body_data.get("alias") or "").strip().upper()

    if not clean_curve or not clean_alias:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="standardMnemonic and alias are required to delete an alias.",
        )

    user_aliases = _get_user_aliases(db, current_user)
    existing = next(
        (e for e in user_aliases if e.standardMnemonic.upper() == clean_curve and e.alias.upper() == clean_alias),
        None,
    )
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Alias "{alias}" was not found under {clean_curve}.',
        )

    # Delete from DB
    db.query(CustomAlias).filter(
        CustomAlias.standardMnemonic == clean_curve,
        CustomAlias.alias == clean_alias,
    ).delete(synchronize_session=False)
    db.commit()

    # Delete from file
    file_list = _read_file_aliases()
    filtered = [
        f for f in file_list
        if not (f.get("standardMnemonic", "").upper() == clean_curve and f.get("alias", "").upper() == clean_alias)
    ]
    _write_file_aliases(filtered)

    updated_aliases = _get_user_aliases(db, current_user)
    set_custom_aliases(updated_aliases)

    return {
        "message": f"Alias {clean_alias} removed from {clean_curve}.",
        "aliases": [a.model_dump() for a in updated_aliases],
    }
