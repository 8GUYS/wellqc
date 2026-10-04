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

def create_test_user(db, user_id: str, email: str, name: str, role: str = "PETROPHYSICIST") -> dict:
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

@pytest.mark.parametrize("role", ["PETROPHYSICIST", "VIEWER", "DATA_ENGINEER", "GEOSCIENTIST"])
def test_non_admin_roles_denied_access_to_all_admin_endpoints(role):
    """Every non-admin role must receive 403 Forbidden on all admin endpoints."""
    db = TestingSessionLocal()
    try:
        user = create_test_user(db, f"user-{role.lower()}-id", f"{role.lower()}@test.com", f"Test {role}", role=role)
        target = create_test_user(db, "target-user-id", "target@test.com", "Target User", role="VIEWER")
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
        user1 = create_test_user(db, "u1-id", "u1@corp.com", "User One", role="VIEWER")
        user2 = create_test_user(db, "u2-id", "u2@corp.com", "User Two", role="PETROPHYSICIST")
    finally:
        db.close()

    client = TestClient(app)

    # 1. Admin lists users
    res_list = client.get("/api/admin/users", cookies=admin["cookies"])
    assert res_list.status_code == 200
    users = res_list.json()["users"]
    assert len(users) == 3

    # 2. Admin promotes User One to GEOSCIENTIST
    res_patch = client.patch(
        "/api/admin/users",
        cookies=admin["cookies"],
        json={"userId": user1["id"], "role": "GEOSCIENTIST"},
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["user"]["role"] == "GEOSCIENTIST"

    # Verify in DB
    db = TestingSessionLocal()
    try:
        updated = db.query(User).filter(User.id == user1["id"]).first()
        assert updated.role == "GEOSCIENTIST"
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
        json={"userId": admin["id"], "role": "PETROPHYSICIST"},
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
