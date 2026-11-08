"""
Payments & Subscriptions API Router (Paystack).

Provides secure endpoints for:
- Viewing authoritative plan catalog & pricing
- Initializing checkout sessions with server-side price validation
- Verifying transactions post-checkout
- Processing signed Paystack webhooks (HMAC-SHA512)
"""

import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.core.config import settings
from backend.app.models.models import User
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
