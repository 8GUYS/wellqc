"""
Pydantic Schemas for Paystack Payments & Subscriptions.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class InitializePaymentRequest(BaseModel):
    plan_id: str = Field(..., description="Target plan identifier (e.g. PRO_MONTHLY, ENTERPRISE_ANNUAL)")
    currency: str = Field(default="NGN", description="Currency: NGN or USD")
    callback_url: Optional[str] = Field(default=None, description="Optional custom return URL")

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        cur = (v or "").strip().upper()
        if cur not in ("NGN", "USD"):
            raise ValueError("Currency must be either 'NGN' or 'USD'.")
        return cur

    @field_validator("plan_id")
    @classmethod
    def validate_plan_id(cls, v: str) -> str:
        plan = (v or "").strip().upper()
        if plan not in ("PRO_MONTHLY", "ENTERPRISE_ANNUAL", "SINGLE_CHECK", "PRO", "ENTERPRISE"):
            raise ValueError("Invalid plan_id specified.")
        return plan


class InitializePaymentResponse(BaseModel):
    authorization_url: str
    access_code: str
    reference: str
    amount: int
    currency: str
    plan_id: str


class PaymentVerificationResponse(BaseModel):
    status: str
    reference: str
    amount: int
    currency: str
    plan: str
    paid_at: Optional[str] = None
    tier: str
    message: str


class PlanFeature(BaseModel):
    text: str
    highlighted: bool = False


class PlanDefinition(BaseModel):
    id: str
    name: str
    badge: Optional[str] = None
    description: str
    amount_ngn: int  # in kobo
    amount_usd: int  # in cents
    display_price_ngn: str
    display_price_usd: str
    interval: str  # monthly, annually, one-time
    features: List[str]
    popular: bool = False


class PlansCatalogResponse(BaseModel):
    plans: List[PlanDefinition]
    paystack_public_key: Optional[str] = None

