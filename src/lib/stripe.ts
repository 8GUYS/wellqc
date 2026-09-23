// Payment Gateway Helper — Bridged to Paystack for Nigeria & International payments
import { PAYSTACK_PLANS } from "./paystack";

export interface CheckoutSessionOptions {
  userId: string;
  userEmail: string;
  plan?: string;
  returnUrl?: string;
}

export function getStripeCheckoutUrl({ userId, userEmail, plan = "pro_monthly" }: CheckoutSessionOptions): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const params = new URLSearchParams({
    client_reference_id: userId,
    customer_email: userEmail,
    plan,
    success_url: `${baseUrl}/dashboard?payment=success`,
    cancel_url: `${baseUrl}/dashboard?payment=cancelled`,
  });

  return `/api/paystack/initialize?${params.toString()}`;
}

export { PAYSTACK_PLANS };
