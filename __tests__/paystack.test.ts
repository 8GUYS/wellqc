/**
 * Frontend Paystack Client Unit Tests.
 */

import {
  getPlansCatalog,
  initializePayment,
  verifyPaymentReference,
} from "@/lib/paystack";

describe("Paystack Frontend Client & Pricing", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetches the plans catalog from backend API", async () => {
    const mockPlansResponse = {
      plans: [
        {
          id: "PRO_MONTHLY",
          name: "WellQC Pro",
          badge: "Most Popular",
          description: "Unlimited petrophysical quality assurance.",
          amount_ngn: 7500000,
          amount_usd: 4900,
          display_price_ngn: "₦75,000 / month",
          display_price_usd: "$49 / month",
          interval: "monthly",
          features: ["Unlimited LAS file ingestion", "NUPRC Form WQC-08-A"],
          popular: true,
        },
      ],
      paystack_public_key: "pk_test_123456",
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPlansResponse,
    });

    const result = await getPlansCatalog();
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0].id).toBe("PRO_MONTHLY");
    expect(result.plans[0].amount_ngn).toBe(7500000);
    expect(result.paystack_public_key).toBe("pk_test_123456");
  });

  it("initializes a Paystack transaction with correct payload", async () => {
    const mockInitResponse = {
      authorization_url: "https://checkout.paystack.com/access_code_123",
      access_code: "access_code_123",
      reference: "wqc_ref_test_999",
      amount: 7500000,
      currency: "NGN",
      plan_id: "PRO_MONTHLY",
    };

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockInitResponse,
    });
    global.fetch = fetchMock;

    const result = await initializePayment("PRO_MONTHLY", "NGN", "http://localhost:3000/payment/verify");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/payments/initialize",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: "PRO_MONTHLY",
          currency: "NGN",
          callback_url: "http://localhost:3000/payment/verify",
        }),
      })
    );

    expect(result.authorization_url).toBe("https://checkout.paystack.com/access_code_123");
    expect(result.reference).toBe("wqc_ref_test_999");
  });

  it("handles payment initialization error gracefully", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: "Invalid plan specified." }),
    });

    await expect(initializePayment("INVALID_PLAN", "NGN")).rejects.toThrow(
      "Invalid plan specified."
    );
  });

  it("verifies payment reference successfully", async () => {
    const mockVerifyResponse = {
      status: "SUCCESS",
      reference: "wqc_ref_test_999",
      amount: 7500000,
      currency: "NGN",
      plan: "PRO_MONTHLY",
      tier: "PRO",
      message: "Payment verified successfully.",
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockVerifyResponse,
    });

    const result = await verifyPaymentReference("wqc_ref_test_999");
    expect(result.status).toBe("SUCCESS");
    expect(result.tier).toBe("PRO");
    expect(result.reference).toBe("wqc_ref_test_999");
  });
});

