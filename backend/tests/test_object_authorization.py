"""
Test suite for Object-Level Server-Side Authorization.

Tests that:
1. Two distinct user accounts (User Alpha and User Beta) cannot read, modify,
   or delete each other's records.
2. Cross-account access attempts are denied with HTTP 403 Forbidden or HTTP 404 Not Found.
3. Client-supplied IDs, user IDs, or roles are not trusted.
4. Administrative access is preserved and non-admins cannot perform administrative actions.
"""

import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.core.database import Base, get_db
from backend.app.core.security import create_session_token, hash_password
from backend.app.models.models import User, Well, LASFile, Curve, QualityReport, Anomaly, CustomAlias

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
        passwordHash=hash_password("TestPassword123!"),
        role=role,
        department="Subsurface Analytics",
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
    return {"id": user.id, "email": user.email, "name": user.name, "token": token, "cookies": {"wellqc_session": token}}

# ─────────────────────────────────────────────────────────────────────────────
# 1. WELL OBJECT-LEVEL AUTHORIZATION TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_user_cannot_read_another_users_well():
    """Negative test: User Beta cannot access a well owned by User Alpha."""
    db = TestingSessionLocal()
    try:
        user_alpha = create_test_user(db, "user-alpha-id", "alpha@example.com", "User Alpha")
        user_beta = create_test_user(db, "user-beta-id", "beta@example.com", "User Beta")

        # User Alpha creates a well
        well_alpha = Well(
            id="well-alpha-uuid",
            apiNo="API-ALPHA-001",
            name="Alpha Exploration Well",
            operatorName="Shell Nigeria",
            fieldName="Bonga",
            basin="Niger Delta Basin",
            country="Nigeria",
            latitude=4.5,
            longitude=6.5,
            tdFt=12000.0,
            qualityScore=85,
            qualityGrade="GOOD",
            ownerId=user_alpha["id"],
        )
        db.add(well_alpha)
        db.commit()
    finally:
        db.close()

    client = TestClient(app)

    # User Alpha CAN read their own well
    res_alpha = client.get("/api/wells/well-alpha-uuid", cookies=user_alpha["cookies"])
    assert res_alpha.status_code == 200
    assert res_alpha.json()["well"]["id"] == "well-alpha-uuid"

    # User Beta CANNOT read User Alpha's well (Cross-account access denied)
    res_beta = client.get("/api/wells/well-alpha-uuid", cookies=user_beta["cookies"])
    assert res_beta.status_code == 403
    assert "restricted" in res_beta.json()["detail"].lower()


def test_user_cannot_see_another_users_well_in_list():
    """Negative test: User Beta does not see User Alpha's wells in GET /api/wells."""
    db = TestingSessionLocal()
    try:
        user_alpha = create_test_user(db, "user-alpha-id", "alpha@example.com", "User Alpha")
        user_beta = create_test_user(db, "user-beta-id", "beta@example.com", "User Beta")

        well_alpha = Well(
            id="well-alpha-secret",
            apiNo="API-ALPHA-SECRET",
            name="Alpha Confidential Well",
            operatorName="Chevron",
            fieldName="Agbami",
            basin="Niger Delta Basin",
            country="Nigeria",
            latitude=3.5,
            longitude=5.5,
            ownerId=user_alpha["id"],
        )
        db.add(well_alpha)
        db.commit()
    finally:
        db.close()

    client = TestClient(app)

    # User Beta lists wells
    res_beta = client.get("/api/wells", cookies=user_beta["cookies"])
    assert res_beta.status_code == 200
    wells = res_beta.json().get("wells", [])
    well_ids = [w["id"] for w in wells]
    assert "well-alpha-secret" not in well_ids


def test_user_cannot_update_another_users_well():
    """Negative test: User Beta cannot overwrite or update a well asset owned by User Alpha."""
    db = TestingSessionLocal()
    try:
        user_alpha = create_test_user(db, "user-alpha-id", "alpha@example.com", "User Alpha")
        user_beta = create_test_user(db, "user-beta-id", "beta@example.com", "User Beta")

        well_alpha = Well(
            id="well-alpha-target",
            apiNo="API-TARGET-001",
            name="Original Alpha Well",
            operatorName="TotalEnergies",
            fieldName="Egina",
            basin="Niger Delta Basin",
            country="Nigeria",
            latitude=3.0,
            longitude=6.0,
            ownerId=user_alpha["id"],
        )
        db.add(well_alpha)
        db.commit()
    finally:
        db.close()

    client = TestClient(app)

    # User Beta attempts to overwrite User Alpha's well using its API number
    res_beta = client.post(
        "/api/wells",
        cookies=user_beta["cookies"],
        json={
            "name": "Hacked Well Name",
            "apiNo": "API-TARGET-001",
            "operatorName": "Attacker Corp",
        },
    )
    assert res_beta.status_code == 403
    assert "permission" in res_beta.json()["detail"].lower()

    # Verify User Alpha's well was NOT modified in the database
    db = TestingSessionLocal()
    try:
        well_check = db.query(Well).filter(Well.apiNo == "API-TARGET-001").first()
        assert well_check.name == "Original Alpha Well"
        assert well_check.ownerId == user_alpha["id"]
    finally:
        db.close()


def test_user_cannot_delete_another_users_well():
    """Negative test: User Beta cannot delete a well owned by User Alpha."""
    db = TestingSessionLocal()
    try:
        user_alpha = create_test_user(db, "user-alpha-id", "alpha@example.com", "User Alpha")
        user_beta = create_test_user(db, "user-beta-id", "beta@example.com", "User Beta")

        well_alpha = Well(
            id="well-alpha-delete-target",
            apiNo="API-DEL-001",
            name="Alpha To Be Protected",
            operatorName="ExxonMobil",
            fieldName="Erha",
            basin="Niger Delta Basin",
            country="Nigeria",
            latitude=5.0,
            longitude=4.0,
            ownerId=user_alpha["id"],
        )
        db.add(well_alpha)
        db.commit()
    finally:
        db.close()

    client = TestClient(app)

    # User Beta tries to delete User Alpha's well
    res_beta = client.delete("/api/wells/well-alpha-delete-target", cookies=user_beta["cookies"])
    assert res_beta.status_code == 403
    assert "restricted" in res_beta.json()["detail"].lower()

    # Verify well still exists in database
    db = TestingSessionLocal()
    try:
        well_still_exists = db.query(Well).filter(Well.id == "well-alpha-delete-target").first()
        assert well_still_exists is not None
    finally:
        db.close()

    # User Alpha CAN delete their own well
    res_alpha = client.delete("/api/wells/well-alpha-delete-target", cookies=user_alpha["cookies"])
    assert res_alpha.status_code == 200
    assert res_alpha.json()["success"] is True

    # Verify well is now deleted
    db = TestingSessionLocal()
    try:
        well_gone = db.query(Well).filter(Well.id == "well-alpha-delete-target").first()
        assert well_gone is None
    finally:
        db.close()


def test_bulk_delete_wells_authorization():
    """Test bulk deletion of wells: authorization and mass deletion."""
    db = TestingSessionLocal()
    try:
        user_alpha = create_test_user(db, "user-alpha-bulk", "alpha-bulk@example.com", "User Alpha Bulk")
        user_beta = create_test_user(db, "user-beta-bulk", "beta-bulk@example.com", "User Beta Bulk")
        # Create two wells for Alpha
        w1 = Well(
            id="well-bulk-1",
            apiNo="API-BULK-001",
            name="BULK_WELL_1",
            operatorName="Alpha Corp",
            fieldName="Deep Water",
            basin="Niger Delta",
            country="Nigeria",
            latitude=5.1,
            longitude=4.1,
            ownerId=user_alpha["id"],
        )
        w2 = Well(
            id="well-bulk-2",
            apiNo="API-BULK-002",
            name="BULK_WELL_2",
            operatorName="Alpha Corp",
            fieldName="Deep Water",
            basin="Niger Delta",
            country="Nigeria",
            latitude=5.2,
            longitude=4.2,
            ownerId=user_alpha["id"],
        )
        db.add_all([w1, w2])
        db.commit()
    finally:
        db.close()

    client = TestClient(app)

    # 1. User Beta cannot bulk delete User Alpha's wells
    res_beta = client.post(
        "/api/wells/bulk-delete",
        json={"wellIds": ["well-bulk-1", "well-bulk-2"]},
        cookies=user_beta["cookies"],
    )
    assert res_beta.status_code == 403

    # 2. Empty payload returns 400
    res_empty = client.post(
        "/api/wells/bulk-delete",
        json={"wellIds": []},
        cookies=user_alpha["cookies"],
    )
    assert res_empty.status_code == 400

    # 3. User Alpha CAN bulk delete their own wells
    res_alpha = client.post(
        "/api/wells/bulk-delete",
        json={"wellIds": ["well-bulk-1", "well-bulk-2"]},
        cookies=user_alpha["cookies"],
    )
    assert res_alpha.status_code == 200
    data = res_alpha.json()
    assert data["success"] is True
    assert data["deletedCount"] == 2
    assert "well-bulk-1" in data["deletedIds"]
    assert "well-bulk-2" in data["deletedIds"]

    # Verify both wells are deleted from DB
    db = TestingSessionLocal()
    try:
        remaining = db.query(Well).filter(Well.id.in_(["well-bulk-1", "well-bulk-2"])).all()
        assert len(remaining) == 0
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# 2. LAS APPLY-FIXES OBJECT-LEVEL AUTHORIZATION TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_user_cannot_apply_fixes_to_another_users_well():
    """Negative test: User Beta cannot execute /api/las/apply-fixes on User Alpha's well."""
    db = TestingSessionLocal()
    try:
        user_alpha = create_test_user(db, "user-alpha-id", "alpha@example.com", "User Alpha")
        user_beta = create_test_user(db, "user-beta-id", "beta@example.com", "User Beta")

        well_alpha = Well(
            id="well-alpha-fix-target",
            apiNo="API-FIX-001",
            name="Alpha Fix Well",
            operatorName="Eni",
            fieldName="Abo",
            basin="Niger Delta Basin",
            country="Nigeria",
            latitude=5.5,
            longitude=5.5,
            ownerId=user_alpha["id"],
        )
        db.add(well_alpha)
        db.commit()
    finally:
        db.close()

    client = TestClient(app)

    # User Beta attempts to apply fixes to User Alpha's well
    res_beta = client.post(
        "/api/las/apply-fixes",
        cookies=user_beta["cookies"],
        json={
            "wellId": "well-alpha-fix-target",
            "approvedFixes": [
                {
                    "anomalyId": "anom-1",
                    "anomalyType": "SPIKE",
                    "curveMnemonic": "GR",
                    "depthStart": 1000.0,
                    "depthEnd": 1010.0,
                    "optionId": "DESPIKE_MEDIAN",
                    "optionLabel": "Despike with Median Filter",
                }
            ],
        },
    )
    assert res_beta.status_code == 403
    assert "restricted" in res_beta.json()["detail"].lower()


# ─────────────────────────────────────────────────────────────────────────────
# 3. CUSTOM ALIASES TENANT ISOLATION TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_user_cannot_view_or_modify_another_users_custom_aliases():
    """Negative test: Custom mnemonic aliases created by User Alpha are inaccessible to User Beta."""
    db = TestingSessionLocal()
    try:
        user_alpha = create_test_user(db, "user-alpha-id", "alpha@example.com", "User Alpha")
        user_beta = create_test_user(db, "user-beta-id", "beta@example.com", "User Beta")
    finally:
        db.close()

    client = TestClient(app)

    # User Alpha creates a custom alias
    res_create = client.post(
        "/api/standardisation/aliases",
        cookies=user_alpha["cookies"],
        json={
            "standardMnemonic": "GR",
            "alias": "GAMMA_ALPHA_EXCLUSIVE",
            "addedBy": "Alpha Specialist",
        },
    )
    assert res_create.status_code == 201

    # User Beta lists aliases -> User Alpha's alias MUST NOT be visible
    res_beta_list = client.get("/api/standardisation/aliases", cookies=user_beta["cookies"])
    assert res_beta_list.status_code == 200
    beta_aliases = [a["alias"] for a in res_beta_list.json().get("aliases", [])]
    assert "GAMMA_ALPHA_EXCLUSIVE" not in beta_aliases

    # User Beta attempts to edit User Alpha's alias -> denied (404)
    res_beta_edit = client.put(
        "/api/standardisation/aliases",
        cookies=user_beta["cookies"],
        json={
            "standardMnemonic": "GR",
            "oldAlias": "GAMMA_ALPHA_EXCLUSIVE",
            "newAlias": "GAMMA_HIJACKED",
        },
    )
    assert res_beta_edit.status_code == 404

    # User Beta attempts to delete User Alpha's alias -> denied (404)
    res_beta_del = client.delete(
        "/api/standardisation/aliases?standardMnemonic=GR&alias=GAMMA_ALPHA_EXCLUSIVE",
        cookies=user_beta["cookies"],
    )
    assert res_beta_del.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# 4. PROFILE & ROLE ESCALATION PROTECTION TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_user_cannot_escalate_role_via_profile():
    """Negative test: A non-admin user cannot self-assign the ADMIN role."""
    db = TestingSessionLocal()
    try:
        user_beta = create_test_user(db, "user-beta-id", "beta@example.com", "User Beta", role="PETROPHYSICIST")
    finally:
        db.close()

    client = TestClient(app)

    # User Beta attempts to upgrade their own role to ADMIN
    res_escalate = client.put(
        "/api/user/profile",
        cookies=user_beta["cookies"],
        json={"role": "ADMIN"},
    )
    assert res_escalate.status_code == 403
    assert "privilege escalation restricted" in res_escalate.json()["detail"].lower()


def test_non_admin_cannot_access_admin_endpoints():
    """Negative test: Non-admin users cannot access administrative endpoints."""
    db = TestingSessionLocal()
    try:
        user_alpha = create_test_user(db, "user-alpha-id", "alpha@example.com", "User Alpha", role="PETROPHYSICIST")
        user_beta = create_test_user(db, "user-beta-id", "beta@example.com", "User Beta", role="PETROPHYSICIST")
        admin_user = create_test_user(db, "admin-id", "admin@example.com", "System Admin", role="ADMIN")
    finally:
        db.close()

    client = TestClient(app)

    # User Alpha attempts to list all users via admin endpoint
    res_list = client.get("/api/admin/users", cookies=user_alpha["cookies"])
    assert res_list.status_code == 403

    # User Alpha attempts to change User Beta's role via admin endpoint
    res_patch = client.patch(
        "/api/admin/users",
        cookies=user_alpha["cookies"],
        json={"userId": "user-beta-id", "role": "ADMIN"},
    )
    assert res_patch.status_code == 403

    # User Alpha attempts to delete User Beta via admin endpoint
    res_delete = client.request(
        "DELETE",
        "/api/admin/users",
        cookies=user_alpha["cookies"],
        json={"userId": "user-beta-id"},
    )
    assert res_delete.status_code == 403

    # System Admin CAN access admin endpoints (Existing functionality preserved)
    res_admin_list = client.get("/api/admin/users", cookies=admin_user["cookies"])
    assert res_admin_list.status_code == 200
    assert len(res_admin_list.json()["users"]) >= 3


# ─────────────────────────────────────────────────────────────────────────────
# 5. ADMIN CROSS-TENANT AUDIT ACCESS (PRESERVED FUNCTIONALITY)
# ─────────────────────────────────────────────────────────────────────────────

def test_admin_can_access_and_manage_all_wells():
    """Positive test: Preserves existing functionality where administrators can view all wells."""
    db = TestingSessionLocal()
    try:
        user_alpha = create_test_user(db, "user-alpha-id", "alpha@example.com", "User Alpha")
        admin_user = create_test_user(db, "admin-id", "admin@example.com", "System Admin", role="ADMIN")

        well_alpha = Well(
            id="well-alpha-admin-test",
            apiNo="API-ALPHA-ADM",
            name="Alpha Managed Well",
            operatorName="Shell",
            fieldName="Bonga",
            basin="Niger Delta Basin",
            country="Nigeria",
            latitude=4.0,
            longitude=6.0,
            ownerId=user_alpha["id"],
        )
        db.add(well_alpha)
        db.commit()
    finally:
        db.close()

    client = TestClient(app)

    # Admin CAN read User Alpha's well
    res_admin_read = client.get("/api/wells/well-alpha-admin-test", cookies=admin_user["cookies"])
    assert res_admin_read.status_code == 200
    assert res_admin_read.json()["well"]["id"] == "well-alpha-admin-test"

    # Admin CAN list all wells including User Alpha's well
    res_admin_list = client.get("/api/wells", cookies=admin_user["cookies"])
    assert res_admin_list.status_code == 200
    all_well_ids = [w["id"] for w in res_admin_list.json()["wells"]]
    assert "well-alpha-admin-test" in all_well_ids


# ─────────────────────────────────────────────────────────────────────────────
# 6. QUALITY ENGINE SAVED WELL CROSS-TENANT OWNERSHIP AUTHORIZATION
# ─────────────────────────────────────────────────────────────────────────────

def test_cross_user_qa_engine_saved_well_access_denied():
    """
    Verifies that a second non-admin user cannot run repair or rank-gaps on another
    user's saved well and receives 403 Forbidden. Owner and Admin can proceed.
    """
    db = TestingSessionLocal()
    try:
        user_alpha = create_test_user(db, "user-alpha-qa", "alpha_qa@example.com", "User Alpha")
        user_beta = create_test_user(db, "user-beta-qa", "beta_qa@example.com", "User Beta")
        admin_user = create_test_user(db, "admin-qa", "admin_qa@example.com", "System Admin", role="ADMIN")

        well_alpha = Well(
            id="well-alpha-qa-test",
            apiNo="API-ALPHA-QA",
            name="Alpha QA Well",
            operatorName="Shell",
            fieldName="Bonga",
            basin="Niger Delta Basin",
            country="Nigeria",
            latitude=4.0,
            longitude=6.0,
            ownerId=user_alpha["id"],
        )
        db.add(well_alpha)
        db.flush()

        las_content = (
            "~VERSION\n"
            "VERS. 2.0 : CWLS\n"
            "WRAP. NO  : One line per depth step\n"
            "~WELL\n"
            "WELL. Alpha QA Well : Well Name\n"
            "NULL. -999.25       : Null Value\n"
            "~CURVE\n"
            "DEPT.FT : Depth\n"
            "GR.GAPI : Gamma Ray\n"
            "~A\n"
            "1000.0  50.0\n"
            "1000.5  55.0\n"
            "1001.0  -999.25\n"
            "1001.5  60.0\n"
            "1002.0  62.0\n"
        )

        las_file = LASFile(
            id="las-alpha-qa-1",
            wellId=well_alpha.id,
            originalName="alpha_qa.las",
            fileSizeKb=1.0,
            lasVersion="2.0",
            startDepth=1000.0,
            stopDepth=1002.0,
            stepDepth=0.5,
            nullValue=-999.25,
            depthUnit="FT",
            rawHeader="~VERSION\nVERS. 2.0: CWLS\n~WELL\nWELL. Alpha QA Well:\n~CURVE\nDEPT.FT:\nGR.GAPI:\n~A\n",
            rawContent=las_content,
            curveCount=2,
            pointCount=5,
            status="PROCESSED",
            ownerId=user_alpha["id"],
        )
        db.add(las_file)
        db.commit()
    finally:
        db.close()

    client = TestClient(app)

    repair_payload = {"wellId": "well-alpha-qa-test"}
    rank_gaps_payload = {
        "wellId": "well-alpha-qa-test",
        "gaps": [{"curve": "GR", "depthStart": 1000.5, "depthEnd": 1001.5}],
    }

    # 1. User Beta (non-owner, non-admin) -> 403 Forbidden
    res_beta_repair = client.post("/api/qa-engine/repair", json=repair_payload, cookies=user_beta["cookies"])
    assert res_beta_repair.status_code == 403
    assert "permission" in res_beta_repair.json()["detail"].lower()

    res_beta_rank = client.post("/api/qa-engine/rank-gaps", json=rank_gaps_payload, cookies=user_beta["cookies"])
    assert res_beta_rank.status_code == 403
    assert "permission" in res_beta_rank.json()["detail"].lower()

    # 2. Unauthenticated user -> 403 Forbidden
    res_anon_repair = client.post("/api/qa-engine/repair", json=repair_payload)
    assert res_anon_repair.status_code == 403

    res_anon_rank = client.post("/api/qa-engine/rank-gaps", json=rank_gaps_payload)
    assert res_anon_rank.status_code == 403

    # 3. User Alpha (Owner) -> 200 OK
    res_alpha_repair = client.post("/api/qa-engine/repair", json=repair_payload, cookies=user_alpha["cookies"])
    assert res_alpha_repair.status_code == 200
    assert "cleanedLas" in res_alpha_repair.json()

    res_alpha_rank = client.post("/api/qa-engine/rank-gaps", json=rank_gaps_payload, cookies=user_alpha["cookies"])
    assert res_alpha_rank.status_code == 200
    assert "recommendations" in res_alpha_rank.json()

    # 4. Admin User -> 200 OK
    res_admin_repair = client.post("/api/qa-engine/repair", json=repair_payload, cookies=admin_user["cookies"])
    assert res_admin_repair.status_code == 200

    res_admin_rank = client.post("/api/qa-engine/rank-gaps", json=rank_gaps_payload, cookies=admin_user["cookies"])
    assert res_admin_rank.status_code == 200
