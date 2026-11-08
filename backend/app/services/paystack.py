"""
Paystack Payment Gateway Service.

Provides secure, PCI-DSS compliant payment processing for WellQC:
- Server-side plan & price catalog (strict defense against client-side price tampering)
- Transaction initialization with unique cryptographic reference tracking
- HMAC-SHA512 webhook signature verification
- Idempotent payment processing & subscription tier provisioning
- Safe developer sandbox fallback for offline testing
"""

import hmac
import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import httpx
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.models.models import User, PaymentTransaction, ActivityLog, now_utc
from backend.app.schemas.payment import PlanDefinition


# ============================================================================
# Authoritative Plan & Pricing Catalog (Server-Side Source of Truth)
# ============================================================================

PLANS_CATALOG: Dict[str, Dict[str, Any]] = {
    "PRO_MONTHLY": {
        "id": "PRO_MONTHLY",
        "name": "WellQC Pro",
        "badge": "Most Popular",
        "description": "Unlimited petrophysical quality assurance, automated repair, and NUPRC certification for active subsurface teams.",
        "amount_ngn": 7500000,  # ₦75,000.00 (in kobo)
        "amount_usd": 4900,     # $49.00 (in cents)
        "display_price_ngn": "₦75,000 / month",
        "display_price_usd": "$49 / month",
        "interval": "monthly",
        "target_tier": "PRO",
        "features": [
            "Unlimited LAS 2.0 / 3.0 File Ingestion",
            "Full API RP 66 Mnemonic Standardisation",
            "4-Step QA Engine & Non-Destructive Repair",
            "Spline, KNN & Linear Gap Imputation",
            "Form WQC-08-A NUPRC Compliance Certificates",
            "Cryptographic SHA-256 Verification Stamp",
            "Multi-Well Wireline Offset Correlation",
        ],
        "popular": True,
    },
    "ENTERPRISE_ANNUAL": {
        "id": "ENTERPRISE_ANNUAL",
        "name": "WellQC Enterprise",
        "badge": "Corporate Fleet",
        "description": "Dedicated basin-scale petrophysical workflows, custom dictionaries, priority SLA, and multi-tenant fleet administration.",
        "amount_ngn": 4500000000,  # ₦45,000,000.00 (in kobo)
        "amount_usd": 4500000,     # $45,000.00 (in cents)
        "display_price_ngn": "₦45,000,000 / year",
        "display_price_usd": "$45,000 / year",
        "interval": "annually",
        "target_tier": "ENTERPRISE",
        "features": [
            "Everything in Pro included",
            "Unlimited Fleet & Field Multi-Tenant Seats",
            "Custom Corporate Mnemonic Dictionary Aliases",
            "Dedicated NUPRC Regulatory Audit Pipeline",
            "Enterprise SAML 2.0 & Azure Active Directory SSO",
            "Direct Cloud Storage Sync (AWS S3 & Azure Blob)",
            "Dedicated Petrophysical SRE Support & 99.95% SLA",
        ],
        "popular": False,
    },
    "SINGLE_CHECK": {
        "id": "SINGLE_CHECK",
        "name": "Single Well Inspection Pack",
        "badge": "Ad-Hoc Pass",
        "description": "Single well LAS inspection, complete automated repair pass, and certified NUPRC export.",
        "amount_ngn": 2500000,  # ₦25,000.00 (in kobo)
        "amount_usd": 1900,     # $19.00 (in cents)
        "display_price_ngn": "₦25,000 / pass",
        "display_price_usd": "$19 / pass",
        "interval": "one-time",
        "target_tier": "PRO",
        "features": [
            "1 Certified Cleaned LAS Export",
            "Official Form WQC-08-A Certificate",
            "1-Month Cloud Storage & Audit Lineage",
            "Full Multi-Track Wireline Viewer Access",
        ],
        "popular": False,
    },
}


def get_plan_catalog() -> List[PlanDefinition]:
    """Return all active plan definitions for public and authenticated view."""
    plans = []
    for plan in PLANS_CATALOG.values():
        plans.append(
            PlanDefinition(
                id=plan["id"],
                name=plan["name"],
                badge=plan.get("badge"),
                description=plan["description"],
                amount_ngn=plan["amount_ngn"],
                amount_usd=plan["amount_usd"],
                display_price_ngn=plan["display_price_ngn"],
                display_price_usd=plan["display_price_usd"],
                interval=plan["interval"],
                features=plan["features"],
                popular=plan.get("popular", False),
            )
        )
    return plans


def normalize_plan_id(plan_id: str) -> str:
    """Normalize aliases like 'PRO' to canonical 'PRO_MONTHLY'."""
    p = (plan_id or "").strip().upper()
    if p in ("PRO", "PRO_MONTHLY"):
        return "PRO_MONTHLY"
    if p in ("ENTERPRISE", "ENTERPRISE_ANNUAL"):
        return "ENTERPRISE_ANNUAL"
    if p in ("SINGLE_CHECK", "PASS", "CREDITS"):
        return "SINGLE_CHECK"
    return p


# ============================================================================
# Core Payment Operations
# ============================================================================

def generate_payment_reference() -> str:
    """Generate a collision-resistant unique Paystack transaction reference."""
    return f"wqc_{uuid.uuid4().hex[:18]}"


async def initialize_paystack_transaction(
    db: Session,
    user: User,
    plan_id: str,
    currency: str = "NGN",
    callback_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Initializes a checkout transaction with Paystack.
    Enforces server-side price lookup to prevent client-side price tampering.
    """
    canonical_plan = normalize_plan_id(plan_id)
    plan = PLANS_CATALOG.get(canonical_plan)
    if not plan:
        raise ValueError(f"Invalid plan identifier: {plan_id}")

    currency = (currency or "NGN").strip().upper()
    if currency not in ("NGN", "USD"):
        raise ValueError("Currency must be either 'NGN' or 'USD'.")

    # Authoritative amount calculation
    amount = plan["amount_ngn"] if currency == "NGN" else plan["amount_usd"]
    reference = generate_payment_reference()

    # Determine default callback URL
    resolved_callback = callback_url or f"{settings.FRONTEND_URL}/payment/verify"

    # Persist initial pending transaction record in database
    transaction = PaymentTransaction(
        userId=user.id,
        reference=reference,
        amount=amount,
        currency=currency,
        plan=canonical_plan,
        status="PENDING",
        metadataPayload=json.dumps({
            "plan_id": canonical_plan,
            "plan_name": plan["name"],
            "user_email": user.email,
            "user_id": user.id,
            "currency": currency,
        }),
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    secret_key = (settings.PAYSTACK_SECRET_KEY or "").strip()

    # Dev / Sandbox Fallback: If no live secret key is configured, provide safe mock checkout
    if not secret_key:
        mock_auth_url = (
            f"{resolved_callback}?reference={reference}&mock=true&plan={canonical_plan}"
        )
        return {
            "authorization_url": mock_auth_url,
            "access_code": f"mock_code_{uuid.uuid4().hex[:12]}",
            "reference": reference,
            "amount": amount,
            "currency": currency,
            "plan_id": canonical_plan,
        }

    # Live Paystack API Call
    url = f"{settings.PAYSTACK_BASE_URL}/transaction/initialize"
    headers = {
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "email": user.email,
        "amount": amount,
        "currency": currency,
        "reference": reference,
        "callback_url": resolved_callback,
        "metadata": {
            "user_id": user.id,
            "plan_id": canonical_plan,
            "plan_name": plan["name"],
            "custom_fields": [
                {
                    "display_name": "WellQC Plan",
                    "variable_name": "plan_id",
                    "value": canonical_plan,
                },
                {
                    "display_name": "User ID",
                    "variable_name": "user_id",
                    "value": user.id,
                },
            ],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.post(url, headers=headers, json=payload)

        data = response.json()
        if not response.is_success or not data.get("status"):
            error_msg = data.get("message", "Paystack initialization failed.")
            transaction.status = "FAILED"
            db.commit()
            raise RuntimeError(f"Paystack Error: {error_msg}")

        result_data = data["data"]
        return {
            "authorization_url": result_data["authorization_url"],
            "access_code": result_data["access_code"],
            "reference": reference,
            "amount": amount,
            "currency": currency,
            "plan_id": canonical_plan,
        }
    except httpx.RequestError as exc:
        transaction.status = "FAILED"
        db.commit()
        raise RuntimeError(f"Failed to communicate with Paystack API: {exc}")


def verify_webhook_signature(raw_body: bytes, signature_header: Optional[str]) -> bool:
    """
    Validates the Paystack HMAC-SHA512 webhook signature.
    Rejects any forged or untrusted webhook deliveries.
    """
    secret = (settings.PAYSTACK_SECRET_KEY or "").strip()
    if not secret or not signature_header:
        # In local dev test environments with mock webhook tests, handle gracefully if explicit mock secret
        return False

    computed = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(computed.lower(), signature_header.strip().lower())


def process_successful_payment(
    db: Session,
    reference: str,
    channel: Optional[str] = None,
    customer_code: Optional[str] = None,
    event_payload: Optional[Dict[str, Any]] = None,
) -> PaymentTransaction:
    """
    Atomically updates payment transaction and upgrades the user's tier.
    Idempotent: Re-processing an already successful transaction will not duplicate actions.
    """
    transaction = (
        db.query(PaymentTransaction)
        .filter(PaymentTransaction.reference == reference)
        .first()
    )

    if not transaction:
        raise ValueError(f"Transaction with reference '{reference}' not found.")

    # Idempotency check: Already processed
    if transaction.status == "SUCCESS":
        return transaction

    transaction.status = "SUCCESS"
    transaction.paidAt = now_utc()
    if channel:
        transaction.channel = channel
    if customer_code:
        transaction.paystackCustomerCode = customer_code
    if event_payload:
        transaction.metadataPayload = json.dumps(event_payload)

    # Entitlement provisioning: Upgrade user subscription tier
    user = db.query(User).filter(User.id == transaction.userId).first()
    if user:
        plan_meta = PLANS_CATALOG.get(transaction.plan, {})
        target_tier = plan_meta.get("target_tier", "PRO")

        # Upgrade tier
        user.tier = target_tier
        if customer_code:
            user.paystackCustomerCode = customer_code

        # Add audit activity log
        audit = ActivityLog(
            userId=user.id,
            userName=user.name,
            userRole=user.role,
            action="SUBSCRIPTION_UPGRADE",
            targetType="PAYMENT",
            targetId=transaction.reference,
            details=f"Upgraded account tier to {target_tier} via Paystack ({transaction.currency} {transaction.amount / 100:,.2f})",
        )
        db.add(audit)

    db.commit()
    db.refresh(transaction)
    return transaction


async def verify_paystack_transaction(
    db: Session,
    reference: str,
    requesting_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Verifies a Paystack transaction reference either directly or via Paystack REST API.
    """
    transaction = (
        db.query(PaymentTransaction)
        .filter(PaymentTransaction.reference == reference)
        .first()
    )

    if not transaction:
        raise ValueError(f"No transaction found for reference: {reference}")

    # Tenant boundary enforcement: If called by an authenticated user, verify ownership
    if requesting_user_id and transaction.userId != requesting_user_id:
        raise PermissionError("You do not have permission to verify this transaction.")

    # If already verified in database, return immediately
    if transaction.status == "SUCCESS":
        user = db.query(User).filter(User.id == transaction.userId).first()
        return {
            "status": "SUCCESS",
            "reference": transaction.reference,
            "amount": transaction.amount,
            "currency": transaction.currency,
            "plan": transaction.plan,
            "paid_at": transaction.paidAt.isoformat() if transaction.paidAt else None,
            "tier": user.tier if user else "PRO",
            "message": "Payment verified successfully.",
        }

    secret_key = (settings.PAYSTACK_SECRET_KEY or "").strip()

    # Dev / Mock Mode Verification Fallback
    if not secret_key:
        updated = process_successful_payment(
            db, reference, channel="sandbox_mock", event_payload={"mode": "mock"}
        )
        user = db.query(User).filter(User.id == updated.userId).first()
        return {
            "status": "SUCCESS",
            "reference": updated.reference,
            "amount": updated.amount,
            "currency": updated.currency,
            "plan": updated.plan,
            "paid_at": updated.paidAt.isoformat() if updated.paidAt else None,
            "tier": user.tier if user else "PRO",
            "message": "Mock payment verified successfully.",
        }

    # Live Paystack Verification
    url = f"{settings.PAYSTACK_BASE_URL}/transaction/verify/{reference}"
    headers = {"Authorization": f"Bearer {secret_key}"}

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(url, headers=headers)

        data = response.json()
        if not response.is_success or not data.get("status"):
            error_msg = data.get("message", "Payment verification failed on gateway.")
            return {
                "status": "FAILED",
                "reference": reference,
                "amount": transaction.amount,
                "currency": transaction.currency,
                "plan": transaction.plan,
                "paid_at": None,
                "tier": "FREE",
                "message": error_msg,
            }

        res_data = data.get("data", {})
        gateway_status = res_data.get("status")

        if gateway_status == "success":
            channel = res_data.get("channel")
            customer_code = res_data.get("customer", {}).get("customer_code")
            updated = process_successful_payment(
                db,
                reference=reference,
                channel=channel,
                customer_code=customer_code,
                event_payload=res_data,
            )
            user = db.query(User).filter(User.id == updated.userId).first()
            return {
                "status": "SUCCESS",
                "reference": updated.reference,
                "amount": updated.amount,
                "currency": updated.currency,
                "plan": updated.plan,
                "paid_at": updated.paidAt.isoformat() if updated.paidAt else None,
                "tier": user.tier if user else "PRO",
                "message": "Payment verified and subscription activated successfully.",
            }
        else:
            transaction.status = gateway_status.upper() if gateway_status else "FAILED"
            db.commit()
            return {
                "status": transaction.status,
                "reference": reference,
                "amount": transaction.amount,
                "currency": transaction.currency,
                "plan": transaction.plan,
                "paid_at": None,
                "tier": "FREE",
                "message": f"Payment is currently {gateway_status}.",
            }
    except httpx.RequestError as exc:
        raise RuntimeError(f"Error communicating with Paystack verification endpoint: {exc}")

