"""
Paystack Payment Gateway & Subscription Security Test Suite.

Tests cover:
1. Plans catalog retrieval and server-side pricing integrity.
2. Unauthenticated access denial (401 Unauthorized) on payment initialization.
3. Server-side authoritative checkout initialization (preventing price tampering).
4. Paystack HMAC-SHA512 webhook signature verification.
5. Replay attack & idempotency defense on webhooks.
6. Tier upgrade fulfillment upon successful charge.
7. Verification endpoint ownership enforcement.
"""

import hmac
import hashlib
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.core.database import Base, get_db
from backend.app.core.config import settings
from backend.app.core.security import create_session_token, hash_password
from backend.app.models.models import User, PaymentTransaction
from backend.app.services.paystack import (
    PLANS_CATALOG,
    verify_webhook_signature,
    process_successful_payment,
)

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


@pytest.fixture
def client():
    return TestClient(app)


def create_test_user(db, email="geologist@shell.com", role="USER", tier="FREE"):
    user = User(
        email=email,
        name="Kelechi Nnamdi",
        passwordHash=hash_password("Password123!"),
        role=role,
        tier=tier,
        isEmailVerified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth_cookie(user: User):
    token = create_session_token({"id": user.id, "email": user.email, "role": user.role})
    return {settings.SESSION_COOKIE_NAME: token}


# ============================================================================
# 1. Plan Catalog Tests
# ============================================================================

def test_get_plans_catalog(client):
    """Verify that plans catalog exposes authoritative pricing without exposing secrets."""
    response = client.get("/api/payments/plans")
    assert response.status_code == 200
    data = response.json()
    assert "plans" in data
    assert len(data["plans"]) >= 2

    plan_ids = [p["id"] for p in data["plans"]]
    assert "PRO_MONTHLY" in plan_ids
    assert "ENTERPRISE_ANNUAL" in plan_ids

    # Verify Pro Monthly price
    pro = next(p for p in data["plans"] if p["id"] == "PRO_MONTHLY")
    assert pro["amount_ngn"] == 7500000
    assert pro["amount_usd"] == 4900
    assert "₦75,000" in pro["display_price_ngn"]


# ============================================================================
# 2. Authentication & Authorization Enforcement
# ============================================================================

def test_initialize_payment_requires_authentication(client):
    """Unauthenticated users must receive 401 Unauthorized."""
    response = client.post(
        "/api/payments/initialize",
        json={"plan_id": "PRO_MONTHLY", "currency": "NGN"},
    )
    assert response.status_code == 401


def test_initialize_payment_invalid_plan(client):
    """Client cannot submit an invalid or fabricated plan ID."""
    db = TestingSessionLocal()
    user = create_test_user(db)
    cookies = auth_cookie(user)

    response = client.post(
        "/api/payments/initialize",
        json={"plan_id": "HACK_FREE_PRO", "currency": "NGN"},
        cookies=cookies,
    )
    assert response.status_code in (400, 422)


def test_initialize_payment_invalid_currency(client):
    """Currency must be restricted to NGN or USD."""
    db = TestingSessionLocal()
    user = create_test_user(db)
    cookies = auth_cookie(user)

    response = client.post(
        "/api/payments/initialize",
        json={"plan_id": "PRO_MONTHLY", "currency": "EUR"},
        cookies=cookies,
    )
    assert response.status_code in (400, 422)


def test_initialize_payment_authenticated_success(client):
    """Authenticated user successfully creates a pending transaction with server price."""
    db = TestingSessionLocal()
    user = create_test_user(db)
    cookies = auth_cookie(user)

    response = client.post(
        "/api/payments/initialize",
        json={"plan_id": "PRO_MONTHLY", "currency": "NGN"},
        cookies=cookies,
    )
    assert response.status_code == 200
    data = response.json()
    assert "authorization_url" in data
    assert "reference" in data
    assert data["amount"] == 7500000
    assert data["currency"] == "NGN"

    # Verify transaction record exists in DB with PENDING status
    db.expire_all()
    tx = db.query(PaymentTransaction).filter(PaymentTransaction.reference == data["reference"]).first()
    assert tx is not None
    assert tx.userId == user.id
    assert tx.status == "PENDING"
    assert tx.plan == "PRO_MONTHLY"


# ============================================================================
# 3. HMAC-SHA512 Webhook Signature Tests
# ============================================================================

def test_webhook_signature_validation():
    """Verify HMAC-SHA512 signature checking algorithm."""
    test_secret = "test_paystack_secret_key_123456789"
    original_secret = settings.PAYSTACK_SECRET_KEY
    settings.PAYSTACK_SECRET_KEY = test_secret

    try:
        payload = b'{"event":"charge.success","data":{"reference":"wqc_test_123"}}'
        valid_signature = hmac.new(test_secret.encode("utf-8"), payload, hashlib.sha512).hexdigest()

        # Valid signature passes
        assert verify_webhook_signature(payload, valid_signature) is True

        # Tampered payload fails
        tampered_payload = b'{"event":"charge.success","data":{"reference":"wqc_test_999"}}'
        assert verify_webhook_signature(tampered_payload, valid_signature) is False

        # Forged signature fails
        assert verify_webhook_signature(payload, "invalid_forged_hash") is False

        # Missing signature fails
        assert verify_webhook_signature(payload, None) is False
    finally:
        settings.PAYSTACK_SECRET_KEY = original_secret


def test_webhook_endpoint_rejects_invalid_signature(client):
    """POST /api/payments/webhook must return 401 when signature header is missing or wrong."""
    response = client.post(
        "/api/payments/webhook",
        json={"event": "charge.success", "data": {}},
        headers={"x-paystack-signature": "bogus_signature"},
    )
    assert response.status_code == 401


# ============================================================================
# 4. Webhook Processing, Idempotency & Tier Upgrade
# ============================================================================

def test_webhook_charge_success_upgrades_user_tier(client):
    """Receiving a valid charge.success event upgrades user tier from FREE to PRO."""
    db = TestingSessionLocal()
    user = create_test_user(db, tier="FREE")
    test_secret = "sk_test_paystack_secret_for_tests"
    settings.PAYSTACK_SECRET_KEY = test_secret

    try:
        # Create a pending transaction
        ref = "wqc_ref_test_upgrade_12345"
        tx = PaymentTransaction(
            userId=user.id,
            reference=ref,
            amount=7500000,
            currency="NGN",
            plan="PRO_MONTHLY",
            status="PENDING",
        )
        db.add(tx)
        db.commit()

        webhook_body = json.dumps({
            "event": "charge.success",
            "data": {
                "reference": ref,
                "amount": 7500000,
                "currency": "NGN",
                "channel": "card",
                "customer": {
                    "customer_code": "CUS_12345abc",
                    "email": user.email,
                },
            },
        }).encode("utf-8")

        signature = hmac.new(test_secret.encode("utf-8"), webhook_body, hashlib.sha512).hexdigest()

        response = client.post(
            "/api/payments/webhook",
            content=webhook_body,
            headers={
                "x-paystack-signature": signature,
                "content-type": "application/json",
            },
        )
        assert response.status_code == 200

        # Verify DB mutations
        db.expire_all()
        db_user = db.query(User).filter(User.id == user.id).first()
        assert db_user.tier == "PRO"
        assert db_user.paystackCustomerCode == "CUS_12345abc"

        db_tx = db.query(PaymentTransaction).filter(PaymentTransaction.reference == ref).first()
        assert db_tx.status == "SUCCESS"
        assert db_tx.channel == "card"
        assert db_tx.paidAt is not None

        # IDEMPOTENCY CHECK: Replay the identical webhook call
        replay_response = client.post(
            "/api/payments/webhook",
            content=webhook_body,
            headers={
                "x-paystack-signature": signature,
                "content-type": "application/json",
            },
        )
        assert replay_response.status_code == 200
        # Tier remains PRO, no errors thrown
        db.refresh(db_user)
        assert db_user.tier == "PRO"
    finally:
        settings.PAYSTACK_SECRET_KEY = ""


# ============================================================================
# 5. Payment Verification Endpoint & Tenant Isolation
# ============================================================================

def test_verify_payment_ownership_isolation(client):
    """A user cannot verify another tenant's payment reference."""
    db = TestingSessionLocal()
    owner = create_test_user(db, email="owner@agip.com")
    intruder = create_test_user(db, email="intruder@external.com")

    ref = "wqc_ref_secret_owner_999"
    tx = PaymentTransaction(
        userId=owner.id,
        reference=ref,
        amount=7500000,
        currency="NGN",
        plan="PRO_MONTHLY",
        status="PENDING",
    )
    db.add(tx)
    db.commit()

    # Intruder tries to verify owner's reference
    intruder_cookies = auth_cookie(intruder)
    response = client.get(f"/api/payments/verify/{ref}", cookies=intruder_cookies)
    assert response.status_code == 403


# ============================================================================
# 6. QA Engine Paywall Gatekeeper Enforcement
# ============================================================================

def test_qa_engine_paywall_enforcement(client):
    """
    Users on FREE tier MUST be blocked from accessing QA Engine rules,
    automated repairs, and gap rankings with HTTP 402 Payment Required.
    Once upgraded to PRO (or for ADMIN users), access is granted.
    """
    db = TestingSessionLocal()
    free_user = create_test_user(db, email="free.user@basin.com", tier="FREE", role="USER")
    pro_user = create_test_user(db, email="pro.user@basin.com", tier="PRO", role="USER")
    admin_user = create_test_user(db, email="admin@wellqc.io", tier="FREE", role="ADMIN")

    free_cookies = auth_cookie(free_user)
    pro_cookies = auth_cookie(pro_user)
    admin_cookies = auth_cookie(admin_user)

    # 1. Unauthenticated -> 401 Unauthorized
    anon_resp = client.get("/api/qa-engine")
    assert anon_resp.status_code == 401

    # 2. FREE tier user -> 402 Payment Required
    free_overview = client.get("/api/qa-engine", cookies=free_cookies)
    assert free_overview.status_code == 402
    assert "subscription" in free_overview.json()["detail"].lower()

    free_repair = client.post(
        "/api/qa-engine/repair",
        json={"rawLasText": "~VERSION\nVERS. 2.0: CWLS\n~WELL\nNULL. -999.25:\n~CURVE\nDEPT.M:\nGR.GAPI:\n~A\n100.0 45.0\n"},
        cookies=free_cookies,
    )
    assert free_repair.status_code == 402
    assert "subscription" in free_repair.json()["detail"].lower()

    free_rank = client.post(
        "/api/qa-engine/rank-gaps",
        json={"gaps": [{"curve": "GR", "depthStart": 100.0, "depthEnd": 101.0}]},
        cookies=free_cookies,
    )
    assert free_rank.status_code == 402

    # 3. PRO tier user -> 200 OK
    pro_overview = client.get("/api/qa-engine", cookies=pro_cookies)
    assert pro_overview.status_code == 200
    assert "rules" in pro_overview.json()

    # 4. ADMIN user (bypasses paywall) -> 200 OK
    admin_overview = client.get("/api/qa-engine", cookies=admin_cookies)
    assert admin_overview.status_code == 200

