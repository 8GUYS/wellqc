"""
Payments & Subscriptions API Router (Paystack).

Provides secure endpoints for:
- Viewing authoritative plan catalog & pricing
- Initializing checkout sessions with server-side price validation
- Verifying transactions post-checkout
- Processing signed Paystack webhooks (HMAC-SHA512)
"""

import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Header, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.core.config import settings
from backend.app.core.security import create_session_token, normalize_role
from backend.app.models.models import User, PaymentTransaction
from backend.app.schemas.payment import (
    InitializePaymentRequest,
    InitializePaymentResponse,
    PaymentVerificationResponse,
    PlansCatalogResponse,
)
from backend.app.services.paystack import (
    get_plan_catalog,
    initialize_paystack_transaction,
    verify_paystack_transaction,
    verify_webhook_signature,
    process_successful_payment,
)

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.get("/plans", response_model=PlansCatalogResponse)
def get_plans():
    """
    Returns the authoritative public plans catalog and Paystack public key.
    """
    plans = get_plan_catalog()
    return PlansCatalogResponse(
        plans=plans,
        paystack_public_key=settings.PAYSTACK_PUBLIC_KEY or None,
    )


@router.get("/history")
def get_user_payment_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the authenticated user's historical payment transactions and active subscription tier.
    """
    transactions = (
        db.query(PaymentTransaction)
        .filter(PaymentTransaction.userId == current_user.id)
        .order_by(desc(PaymentTransaction.createdAt))
        .all()
    )
    return {
        "currentTier": current_user.tier or "FREE",
        "transactions": [
            {
                "id": t.id,
                "reference": t.reference,
                "amount": t.amount,
                "currency": t.currency,
                "plan": t.plan,
                "status": t.status,
                "channel": t.channel or "standard",
                "paidAt": t.paidAt.isoformat() if t.paidAt else None,
                "createdAt": t.createdAt.isoformat() if t.createdAt else "",
            }
            for t in transactions
        ],
    }


@router.post("/initialize", response_model=InitializePaymentResponse)
async def initialize_payment(
    request_data: InitializePaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Initializes a secure Paystack checkout session for the authenticated user.
    Enforces server-side price lookup to prevent client-side price tampering.
    """
    try:
        result = await initialize_paystack_transaction(
            db=db,
            user=current_user,
            plan_id=request_data.plan_id,
            currency=request_data.currency,
            callback_url=request_data.callback_url,
        )
        return InitializePaymentResponse(**result)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to initialize payment checkout: {str(exc)}",
        )


@router.get("/verify/{reference}", response_model=PaymentVerificationResponse)
async def verify_payment(
    reference: str,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verifies a transaction reference and immediately unlocks the corresponding subscription tier.
    """
    try:
        verification = await verify_paystack_transaction(
            db=db,
            reference=reference,
            requesting_user_id=current_user.id,
        )
        if verification.get("status") == "SUCCESS":
            # Refresh user in DB and issue refreshed session cookie with updated tier
            db.refresh(current_user)
            user_dict = {
                "id": current_user.id,
                "name": current_user.name,
                "email": current_user.email,
                "role": normalize_role(current_user.role),
                "department": current_user.department or "",
                "tier": current_user.tier or "PRO",
                "freeChecksUsed": current_user.freeChecksUsed or 0,
                "ndaAcceptedAt": current_user.ndaAcceptedAt.isoformat() if current_user.ndaAcceptedAt else None,
            }
            cookie_user = {k: v for k, v in user_dict.items() if k != "avatarUrl" or not str(v or "").startswith("data:")}
            token = create_session_token(cookie_user)
            response.set_cookie(
                key=settings.SESSION_COOKIE_NAME,
                value=token,
                max_age=settings.SESSION_MAX_AGE_SECONDS,
                httponly=True,
                samesite="lax",
                secure=settings.ENVIRONMENT == "production",
                path="/",
            )
        return PaymentVerificationResponse(**verification)
    except PermissionError as pe:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(pe),
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment verification failed: {str(exc)}",
        )


@router.post("/webhook")
async def paystack_webhook(
    request: Request,
    x_paystack_signature: Optional[str] = Header(None, alias="x-paystack-signature"),
    db: Session = Depends(get_db),
):
    """
    Public webhook receiver for Paystack events.
    Strictly verifies HMAC-SHA512 signature before processing any data mutation.
    """
    raw_body = await request.body()

    # Reject forged or unsigned requests in production
    is_valid = verify_webhook_signature(raw_body, x_paystack_signature)
    if not is_valid:
        # In test environments or when explicitly testing, allow if signature matches mock
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing Paystack webhook signature.",
        )

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed JSON webhook payload.",
        )

    event_type = payload.get("event")

    # Handle successful charge settlement
    if event_type == "charge.success":
        data = payload.get("data", {})
        reference = data.get("reference")
        channel = data.get("channel")
        customer_code = data.get("customer", {}).get("customer_code")

        if reference:
            try:
                process_successful_payment(
                    db=db,
                    reference=reference,
                    channel=channel,
                    customer_code=customer_code,
                    event_payload=data,
                )
            except ValueError:
                # Transaction might have been created externally or belongs to another system
                pass

    return {"status": True, "message": "Webhook processed successfully."}
