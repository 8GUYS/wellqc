/**
 * Paystack Client & Pricing Definitions for WellQC Studio.
 */

export interface PlanDefinition {
  id: string;
  name: string;
  badge?: string;
  description: string;
  amount_ngn: number;
  amount_usd: number;
  display_price_ngn: string;
  display_price_usd: string;
  interval: "monthly" | "annually" | "one-time";
  features: string[];
  popular?: boolean;
}

export interface PlansResponse {
  plans: PlanDefinition[];
  paystack_public_key?: string | null;
}

export interface InitializePaymentResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
  amount: number;
  currency: string;
  plan_id: string;
}

export interface PaymentVerificationResponse {
  status: "SUCCESS" | "PENDING" | "FAILED" | "ABANDONED";
  reference: string;
  amount: number;
  currency: string;
  plan: string;
  paid_at?: string | null;
  tier: string;
  message: string;
}

/**
 * Fetch authoritative plans from the FastAPI backend.
 */
export async function getPlansCatalog(): Promise<PlansResponse> {
  const res = await fetch("/api/payments/plans", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load pricing plans (${res.status})`);
  }
  return res.json();
}

/**
 * Initialize a Paystack transaction session.
 */
export async function initializePayment(
  planId: string,
  currency: "NGN" | "USD" = "NGN",
  callbackUrl?: string
): Promise<InitializePaymentResponse> {
  const res = await fetch("/api/payments/initialize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: planId,
      currency,
      callback_url: callbackUrl,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Payment initialization failed (${res.status})`);
  }

  return res.json();
}

/**
 * Verify a Paystack transaction reference after checkout redirect.
 */
export async function verifyPaymentReference(
  reference: string
): Promise<PaymentVerificationResponse> {
  const res = await fetch(`/api/payments/verify/${encodeURIComponent(reference)}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Payment verification failed (${res.status})`);
  }

  return res.json();
}

