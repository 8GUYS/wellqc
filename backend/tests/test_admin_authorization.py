"""
Dedicated Security & RBAC Test Suite: Admin Authorization & Default-to-Deny Enforcement.

Tests prove:
1. Unauthenticated users cannot call admin functions (HTTP 401 Unauthorized).
2. Normal / non-admin users (PETROPHYSICIST, VIEWER, DATA_ENGINEER, GEOSCIENTIST)
   cannot call admin functions (HTTP 403 Forbidden).
3. Public self-registration cannot self-assign the ADMIN role (HTTP 403 Forbidden).
4. Authenticated non-admin users cannot promote themselves to ADMIN via profile updates (HTTP 403 Forbidden).
5. Forged/stale tokens for non-existent users do not auto-provision admin accounts (HTTP 401 Unauthorized).
6. Legitimate administrators can manage users, update roles, and delete accounts.
7. Safeguards prevent self-deletion or lockout of the last remaining administrator.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.core.database import Base, get_db
from backend.app.core.security import create_session_token, hash_password
from backend.app.models.models import User

# In-memory SQLite with StaticPool so all connections share the same in-memory DB during tests
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(autouse=True)
def setup_test_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)

def create_test_user(db, user_id: str, email: str, name: str, role: str = "USER") -> dict:
    user = User(
        id=user_id,
        email=email,
        name=name,
        passwordHash=hash_password("StrongPassword123!"),
        role=role,
        department="Operations",
        tier="PRO",
        freeChecksUsed=0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    user_dict = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "department": user.department,
        "tier": user.tier,
        "freeChecksUsed": user.freeChecksUsed,
        "ndaAcceptedAt": None,
    }
    token = create_session_token(user_dict)
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "token": token,
        "cookies": {"wellqc_session": token},
        "headers": {"Authorization": f"Bearer {token}"},
    }

# ─────────────────────────────────────────────────────────────────────────────
# 1. UNAUTHENTICATED REQUESTS ARE DENIED (401)
# ─────────────────────────────────────────────────────────────────────────────

def test_unauthenticated_cannot_list_users():
    """Unauthenticated calls to GET /api/admin/users must return 401."""
    client = TestClient(app)
    res = client.get("/api/admin/users")
    assert res.status_code == 401
    assert "authentication is required" in res.json()["detail"].lower()

def test_unauthenticated_cannot_patch_user_role():
    """Unauthenticated calls to PATCH /api/admin/users must return 401."""
    client = TestClient(app)
    res = client.patch("/api/admin/users", json={"userId": "some-id", "role": "ADMIN"})
    assert res.status_code == 401
    assert "authentication is required" in res.json()["detail"].lower()

def test_unauthenticated_cannot_delete_user():
    """Unauthenticated calls to DELETE /api/admin/users must return 401."""
    client = TestClient(app)
    res = client.request("DELETE", "/api/admin/users", json={"userId": "some-id"})
    assert res.status_code == 401
    assert "authentication is required" in res.json()["detail"].lower()

# ─────────────────────────────────────────────────────────────────────────────
# 2. ALL NON-ADMIN ROLES ARE DENIED (403 FORBIDDEN - DEFAULT TO DENY)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("role", ["USER", "PETROPHYSICIST", "VIEWER", "DATA_ENGINEER", "GEOSCIENTIST"])
def test_non_admin_roles_denied_access_to_all_admin_endpoints(role):
    """Every non-admin role must receive 403 Forbidden on all admin endpoints."""
    db = TestingSessionLocal()
    try:
        user = create_test_user(db, f"user-{role.lower()}-id", f"{role.lower()}@test.com", f"Test {role}", role=role)
        target = create_test_user(db, "target-user-id", "target@test.com", "Target User", role="USER")
    finally:
        db.close()

    client = TestClient(app)

    # 1. GET /api/admin/users
    res_get = client.get("/api/admin/users", cookies=user["cookies"])
    assert res_get.status_code == 403
    assert "administrative privileges required" in res_get.json()["detail"].lower()

    # 2. PATCH /api/admin/users
    res_patch = client.patch(
        "/api/admin/users",
        cookies=user["cookies"],
        json={"userId": target["id"], "role": "ADMIN"},
    )
    assert res_patch.status_code == 403
    assert "administrative privileges required" in res_patch.json()["detail"].lower()

    # 3. DELETE /api/admin/users
    res_del = client.request(
        "DELETE",
        "/api/admin/users",
        cookies=user["cookies"],
        json={"userId": target["id"]},
    )
    assert res_del.status_code == 403
    assert "administrative privileges required" in res_del.json()["detail"].lower()

# ─────────────────────────────────────────────────────────────────────────────
# 3. PRIVILEGE ESCALATION ATTEMPTS BLOCKED
# ─────────────────────────────────────────────────────────────────────────────

def test_public_registration_cannot_grant_admin_role():
    """Negative test: Attempting to self-register as ADMIN is rejected with 403."""
    client = TestClient(app)
    res = client.post(
        "/api/auth/register",
        json={
            "name": "Attacker",
            "email": "attacker@evilcorp.com",
            "password": "Password123!",
            "role": "ADMIN",
            "acceptedNda": True,
        },
    )
    assert res.status_code == 403
    assert "administrator accounts cannot be self-registered" in res.json()["detail"].lower()

    # Verify no user with this email exists in the database
    db = TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == "attacker@evilcorp.com").first()
        assert user is None
    finally:
        db.close()

def test_profile_update_cannot_self_promote_to_admin():
    """Negative test: Non-admin cannot escalate their own role to ADMIN."""
    db = TestingSessionLocal()
    try:
        user = create_test_user(db, "normal-user-id", "normal@example.com", "Normal User", role="PETROPHYSICIST")
    finally:
        db.close()

    client = TestClient(app)
    res = client.put(
        "/api/user/profile",
        cookies=user["cookies"],
        json={"role": "ADMIN"},
    )
    assert res.status_code == 403
    assert "privilege escalation restricted" in res.json()["detail"].lower()

    # Verify in DB that role was not changed
    db = TestingSessionLocal()
    try:
        db_user = db.query(User).filter(User.id == "normal-user-id").first()
        assert db_user.role == "PETROPHYSICIST"
    finally:
        db.close()

def test_ghost_token_does_not_auto_provision_admin_user():
    """Negative test: A signed token for a non-existent user must NOT auto-provision in DB."""
    # Fabricate a token for a user that is not in the database
    ghost_payload = {
        "id": "ghost-admin-uuid",
        "email": "ghost@nowhere.com",
        "name": "Ghost Admin",
        "role": "ADMIN",
    }
    ghost_token = create_session_token(ghost_payload)

    client = TestClient(app)
    res = client.get("/api/admin/users", cookies={"wellqc_session": ghost_token})
    # Since ghost user is not in the DB, dependencies.py returns None -> 401 Unauthorized
    assert res.status_code == 401

    # Verify that the ghost user was NOT inserted into the DB
    db = TestingSessionLocal()
    try:
        ghost_in_db = db.query(User).filter(User.id == "ghost-admin-uuid").first()
        assert ghost_in_db is None
    finally:
        db.close()

# ─────────────────────────────────────────────────────────────────────────────
# 4. LEGITIMATE ADMIN ACTIONS SUCCEED
# ─────────────────────────────────────────────────────────────────────────────

def test_admin_can_manage_users_and_roles():
    """Positive test: Verified admin can list users, update roles, and delete accounts."""
    db = TestingSessionLocal()
    try:
        admin = create_test_user(db, "admin-user-id", "admin@corp.com", "Admin User", role="ADMIN")
        user1 = create_test_user(db, "u1-id", "u1@corp.com", "User One", role="USER")
        user2 = create_test_user(db, "u2-id", "u2@corp.com", "User Two", role="USER")
    finally:
        db.close()

    client = TestClient(app)

    # 1. Admin lists users
    res_list = client.get("/api/admin/users", cookies=admin["cookies"])
    assert res_list.status_code == 200
    users = res_list.json()["users"]
    assert len(users) == 3

    # 2. Admin promotes User One to ADMIN
    res_patch = client.patch(
        "/api/admin/users",
        cookies=admin["cookies"],
        json={"userId": user1["id"], "role": "ADMIN"},
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["user"]["role"] == "ADMIN"

    # Verify in DB
    db = TestingSessionLocal()
    try:
        updated = db.query(User).filter(User.id == user1["id"]).first()
        assert updated.role == "ADMIN"
    finally:
        db.close()

    # 3. Admin deletes User Two
    res_del = client.request(
        "DELETE",
        "/api/admin/users",
        cookies=admin["cookies"],
        json={"userId": user2["id"]},
    )
    assert res_del.status_code == 200
    assert res_del.json()["success"] is True

    # Verify User Two deleted from DB
    db = TestingSessionLocal()
    try:
        deleted = db.query(User).filter(User.id == user2["id"]).first()
        assert deleted is None
    finally:
        db.close()

# ─────────────────────────────────────────────────────────────────────────────
# 5. ADMIN SAFETY & ACCIDENTAL LOCKOUT PREVENTION
# ─────────────────────────────────────────────────────────────────────────────

def test_admin_cannot_delete_own_account():
    """Safety test: An admin cannot delete their own account."""
    db = TestingSessionLocal()
    try:
        admin = create_test_user(db, "solo-admin-id", "solo@corp.com", "Solo Admin", role="ADMIN")
    finally:
        db.close()

    client = TestClient(app)
    res = client.request(
        "DELETE",
        "/api/admin/users",
        cookies=admin["cookies"],
        json={"userId": admin["id"]},
    )
    assert res.status_code == 400
    assert "cannot delete your own account" in res.json()["detail"].lower()

def test_admin_cannot_demote_only_remaining_admin():
    """Safety test: An admin cannot demote themselves if they are the only admin."""
    db = TestingSessionLocal()
    try:
        admin = create_test_user(db, "only-admin-id", "only@corp.com", "Only Admin", role="ADMIN")
    finally:
        db.close()

    client = TestClient(app)
    res = client.patch(
        "/api/admin/users",
        cookies=admin["cookies"],
        json={"userId": admin["id"], "role": "USER"},
    )
    assert res.status_code == 400
    assert "only remaining administrator" in res.json()["detail"].lower()

def test_admin_cannot_set_invalid_role():
    """Validation test: Attempting to assign a non-existent role returns 400."""
    db = TestingSessionLocal()
    try:
        admin = create_test_user(db, "adm-id", "adm@corp.com", "Admin", role="ADMIN")
        user = create_test_user(db, "reg-id", "reg@corp.com", "Regular", role="VIEWER")
    finally:
        db.close()

    client = TestClient(app)
    res = client.patch(
        "/api/admin/users",
        cookies=admin["cookies"],
        json={"userId": user["id"], "role": "SUPERUSER_ROOT"},
    )
    assert res.status_code == 400
    assert "invalid role" in res.json()["detail"].lower()


def test_admin_can_get_and_update_email_settings(monkeypatch):
    """Admins can retrieve and save EmailJS settings, with secrets sourced strictly from environment variables."""
    from backend.app.core.config import settings
    monkeypatch.setattr(settings, "EMAILJS_PRIVATE_KEY", "priv_key_secret")

    db = TestingSessionLocal()
    try:
        admin = create_test_user(db, "adm-email-1", "adm-email@corp.com", "Admin Email", role="ADMIN")
    finally:
        db.close()

    client = TestClient(app)
    # 1. Get settings
    get_res = client.get("/api/admin/email-settings", cookies=admin["cookies"])
    assert get_res.status_code == 200
    data = get_res.json()
    assert "provider" in data

    # 2. Update settings to EmailJS
    post_res = client.post(
        "/api/admin/email-settings",
        cookies=admin["cookies"],
        json={
            "provider": "EMAILJS",
            "emailjs_service_id": "service_test123",
            "emailjs_template_id": "template_test456",
            "emailjs_public_key": "pub_key_test789",
            "emailjs_private_key": "priv_key_secret",
            "resend_from_email": "WellQC <test@wellqc.com>",
        },
    )
    assert post_res.status_code == 200
    assert post_res.json()["success"] is True

    # 3. Retrieve and verify masked key and service id
    verify_res = client.get("/api/admin/email-settings", cookies=admin["cookies"])
    assert verify_res.status_code == 200
    v_data = verify_res.json()
    assert v_data["provider"] == "EMAILJS"
    assert v_data["emailjs_service_id"] == "service_test123"
    assert v_data["emailjs_private_key_configured"] is True

    # 4. Verify secrets are NOT persisted to the database SystemSetting table
    import json
    from backend.app.models.models import SystemSetting
    db_verify = TestingSessionLocal()
    try:
        setting = db_verify.query(SystemSetting).filter(SystemSetting.key == "email_settings").first()
        assert setting is not None
        stored_dict = json.loads(setting.value)
        assert "emailjs_private_key" not in stored_dict
        assert "resend_api_key" not in stored_dict
    finally:
        db_verify.close()


def test_non_admin_cannot_access_email_settings():
    """Non-admin users receive 403 Forbidden when attempting to view or modify email settings."""
    db = TestingSessionLocal()
    try:
        user = create_test_user(db, "reg-no-email", "viewer-no-email@corp.com", "Regular Viewer", role="VIEWER")
    finally:
        db.close()

    client = TestClient(app)
    get_res = client.get("/api/admin/email-settings", cookies=user["cookies"])
    assert get_res.status_code == 403

    post_res = client.post(
        "/api/admin/email-settings",
        cookies=user["cookies"],
        json={"provider": "EMAILJS"},
    )
    assert post_res.status_code == 403


def test_admin_can_bulk_delete_users():
    """Administrator can bulk select and delete multiple user accounts in one action."""
    db = TestingSessionLocal()
    try:
        admin = create_test_user(db, "admin-bulk-1", "admin-bulk@corp.com", "Chief Admin", role="ADMIN")
        user1 = create_test_user(db, "u-bulk-1", "u1@corp.com", "Analyst 1", role="USER")
        user2 = create_test_user(db, "u-bulk-2", "u2@corp.com", "Analyst 2", role="USER")
        user3 = create_test_user(db, "u-bulk-3", "u3@corp.com", "Analyst 3", role="USER")
    finally:
        db.close()

    client = TestClient(app)

    # 1. Bulk delete 3 users
    del_res = client.post(
        "/api/admin/users/bulk-delete",
        cookies=admin["cookies"],
        json={"userIds": ["u-bulk-1", "u-bulk-2", "u-bulk-3"]},
    )
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert del_data["success"] is True
    assert del_data["deletedCount"] == 3
    assert set(del_data["deletedIds"]) == {"u-bulk-1", "u-bulk-2", "u-bulk-3"}

    # 2. Verify users no longer exist in db
    db2 = TestingSessionLocal()
    try:
        remaining = db2.query(User).all()
        assert len(remaining) == 1
        assert remaining[0].id == "admin-bulk-1"
    finally:
        db2.close()


def test_bulk_delete_validations():
    """Verify authorization, self-delete prevention, and admin account protections."""
    db = TestingSessionLocal()
    try:
        admin = create_test_user(db, "admin-guard-1", "guard@corp.com", "Solo Admin", role="ADMIN")
        reg_user = create_test_user(db, "reg-guard-1", "reg@corp.com", "Regular User", role="USER")
    finally:
        db.close()

    client = TestClient(app)

    # 1. Non-admin receives 403 Forbidden
    unauth_res = client.post(
        "/api/admin/users/bulk-delete",
        cookies=reg_user["cookies"],
        json={"userIds": ["admin-guard-1"]},
    )
    assert unauth_res.status_code == 403

    # 2. Admin cannot delete only their own account (prevents accidental lockout)
    self_del = client.post(
        "/api/admin/users/bulk-delete",
        cookies=admin["cookies"],
        json={"userIds": ["admin-guard-1"]},
    )
    assert self_del.status_code == 400
    assert "cannot delete your own" in self_del.json()["detail"].lower()

    # 3. Empty list is rejected
    empty_res = client.post(
        "/api/admin/users/bulk-delete",
        cookies=admin["cookies"],
        json={"userIds": []},
    )
    assert empty_res.status_code == 400

