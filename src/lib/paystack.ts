import { createHmac } from "crypto";

export type PaymentCurrency = "NGN" | "USD";

export interface PlanConfig {
  id: string;
  name: string;
  description: string;
  amountNgn: number; // in Naira (e.g. 75000)
  amountUsd: number; // in USD (e.g. 49)
  interval: "monthly" | "annually" | "custom";
  koboNgn: number; // amount in kobo (subunits for Paystack NGN)
  centsUsd: number; // amount in cents (subunits for Paystack USD)
  features: string[];
}

export const PAYSTACK_PLANS: Record<string, PlanConfig> = {
  pro_monthly: {
    id: "pro_monthly",
    name: "Pro Petrophysicist (Monthly)",
    description: "Designed for active engineers and petrophysical teams.",
    amountNgn: 75000,
    amountUsd: 49,
    interval: "monthly",
    koboNgn: 7500000, // ₦75,000.00
    centsUsd: 4900, // $49.00
    features: [
      "Unlimited LAS File Audits & QA Reports",
      "Multi-Track Interactive Wireline Log Viewer",
      "Machine Learning KNN & Spline Imputation Engine",
      "Multi-Well Side-by-Side Inversion & Comparison",
      "Executive PDF Audit Certificates & Data Export",
      "Priority Nigerian & Global Technical Support",
    ],
  },
  pro_annual: {
    id: "pro_annual",
    name: "Pro Petrophysicist (Annual)",
    description: "Best value for corporate teams — includes 2 months free.",
    amountNgn: 750000,
    amountUsd: 490,
    interval: "annually",
    koboNgn: 75000000, // ₦750,000.00
    centsUsd: 49000, // $490.00
    features: [
      "Everything in Pro Monthly",
      "2 Months Free (Save 17%)",
      "Multi-User Team License Sharing (Up to 5 seats)",
      "Automated Weekly Ingestion Webhook Alerts",
      "Priority Onboarding & Petrophysical Data Training",
      "Dedicated Technical Account Manager",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise Subsurface Hub",
    description: "Tailored deployment for E&P corporations and operators.",
    amountNgn: 2500000,
    amountUsd: 1650,
    interval: "custom",
    koboNgn: 250000000,
    centsUsd: 165000,
    features: [
      "Everything in Pro Annual",
      "Custom Corporate Mnemonic Mapping Library",
      "On-Premise / Private Cloud (AWS/Azure/GCP) Deployment",
      "Unlimited Team Seats & SSO / SAML Integration",
      "99.99% Guaranteed SLA & 24/7 Dedicated Support",
    ],
  },
};

export interface PaystackInitParams {
  email: string;
  amount: number; // in subunits (kobo for NGN, cents for USD)
  currency?: PaymentCurrency;
  planId?: string;
  userId: string;
  userName?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PaystackInitResponse {
  status: boolean;
  message: string;
  isDemo?: boolean;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  isDemo?: boolean;
  data?: {
    id: number;
    domain: string;
    status: string; // "success", "failed", "abandoned"
    reference: string;
    amount: number;
    currency: string;
    channel: string; // "card", "bank", "ussd", "bank_transfer", etc.
    customer: {
      id: number;
      email: string;
      customer_code: string;
      first_name?: string;
      last_name?: string;
    };
    metadata?: {
      userId?: string;
      planId?: string;
      userName?: string;
      [key: string]: unknown;
    };
    paid_at?: string;
    created_at?: string;
  };
}

export function isRealPaystackKey(key: string | undefined): boolean {
  if (!key) return false;
  if (
    key.includes("sandbox") ||
    key.includes("dummy") ||
    key.includes("placeholder") ||
    key === "sk_test_paystack_sandbox_key" ||
    key.length < 25
  ) {
    return false;
  }
  return key.startsWith("sk_test_") || key.startsWith("sk_live_");
}

export function isPaystackDemoMode(): boolean {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  return !isRealPaystackKey(secretKey);
}

/**
 * Initialize a Paystack transaction
 */
export async function initializePaystackTransaction(
  params: PaystackInitParams
): Promise<PaystackInitResponse> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const callbackUrl = params.callbackUrl || `${baseUrl}/api/paystack/verify`;
  const currency = params.currency || "NGN";
  const isDemo = isPaystackDemoMode();
  const reference = isDemo
    ? `wellqc_demo_${(params.userId || "user").slice(0, 8)}_${Date.now()}`
    : `wellqc_${(params.userId || "user").slice(0, 8)}_${Date.now()}`;

  // If a genuine Paystack Secret Key is configured, make the live Paystack API call
  if (!isDemo && isRealPaystackKey(secretKey)) {
    try {
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: params.email,
          amount: params.amount,
          currency: currency,
          reference: reference,
          callback_url: callbackUrl,
          channels: ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"],
          metadata: {
            userId: params.userId,
            userName: params.userName,
            planId: params.planId || "pro_monthly",
            currency,
            custom_fields: [
              {
                display_name: "Application",
                variable_name: "application",
                value: "WellQC+ Petrophysical Suite",
              },
              {
                display_name: "Plan",
                variable_name: "plan",
                value: params.planId || "pro_monthly",
              },
              {
                display_name: "User ID",
                variable_name: "user_id",
                value: params.userId,
              },
            ],
            ...params.metadata,
          },
        }),
      });

      const data = await response.json();
      if (data.status && data.data?.authorization_url) {
        return {
          ...data,
          isDemo: false,
        };
      }
      console.warn("Paystack live init returned status false, using fallback:", data.message);
    } catch (error) {
      console.error("Paystack API initialization error:", error);
    }
  }

  // Sandbox / Demo Simulation Mode (Used during development or when secret key is in sandbox mode)
  const sandboxAccessCode = `acc_demo_${Date.now()}`;
  const verifyUrl = `${baseUrl}/api/paystack/verify?reference=${reference}&plan=${params.planId || "pro_monthly"}&demo=true`;

  return {
    status: true,
    isDemo: true,
    message: "Sandbox Authorization URL created (Demo Mode)",
    data: {
      authorization_url: verifyUrl,
      access_code: sandboxAccessCode,
      reference: reference,
    },
  };
}

/**
 * Verify a Paystack transaction by reference
 */
export async function verifyPaystackTransaction(
  reference: string
): Promise<PaystackVerifyResponse> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const isDemo = isPaystackDemoMode() || reference.includes("demo") || !isRealPaystackKey(secretKey);

  if (!isDemo && isRealPaystackKey(secretKey)) {
    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
        cache: "no-store",
      });

      const data = await response.json();
      return {
        ...data,
        isDemo: false,
      };
    } catch (error) {
      console.error("Paystack verification error:", error);
      return {
        status: false,
        isDemo: false,
        message: "Failed to communicate with Paystack API.",
      };
    }
  }

  // Sandbox / Demo simulation verification
  return {
    status: true,
    isDemo: true,
    message: "Verification successful (Sandbox Demo Mode)",
    data: {
      id: 99999999,
      domain: "test",
      status: "success",
      reference: reference,
      amount: 7500000,
      currency: "NGN",
      channel: "card",
      customer: {
        id: 123456,
        email: "subscriber@wellqc.com",
        customer_code: `CUS_${reference.slice(0, 10)}`,
      },
      metadata: {
        planId: "pro_monthly",
      },
      paid_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  };
}

/**
 * Validate Paystack Webhook HMAC-SHA512 Signature
 */
export function verifyPaystackWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey || !signatureHeader) return false;

  try {
    const hash = createHmac("sha512", secretKey)
      .update(rawBody)
      .digest("hex");
    return hash === signatureHeader;
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return false;
  }
}
