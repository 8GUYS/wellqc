import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { initializePaystackTransaction, PAYSTACK_PLANS, PaymentCurrency, isPaystackDemoMode } from "@/lib/paystack";

function getBaseUrl(request: Request): string {
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !appUrl.includes("localhost:3000")) {
    return appUrl;
  }
  return `${protocol}://${host}`;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          error: "Authentication required to initialize payment. Please sign in or use a demo account.",
          isDemo: isPaystackDemoMode(),
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const planId = (body.planId || body.plan || "pro_monthly") as string;
    const currency = (body.currency || "NGN") as PaymentCurrency;

    const plan = PAYSTACK_PLANS[planId] || PAYSTACK_PLANS.pro_monthly;
    const amountInSubunits = currency === "USD" ? plan.centsUsd : plan.koboNgn;

    const baseUrl = getBaseUrl(request);
    const callbackUrl = `${baseUrl}/api/paystack/verify?plan=${plan.id}&currency=${currency}`;

    const paystackRes = await initializePaystackTransaction({
      email: user.email,
      amount: amountInSubunits,
      currency,
      planId: plan.id,
      userId: user.id,
      userName: user.name,
      callbackUrl,
      metadata: {
        department: user.department,
        currentTier: user.tier || "FREE",
      },
    });

    if (!paystackRes.status || !paystackRes.data) {
      return NextResponse.json(
        { error: paystackRes.message || "Failed to initialize Paystack transaction." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: true,
      isDemo: paystackRes.isDemo || isPaystackDemoMode(),
      authorizationUrl: paystackRes.data.authorization_url,
      accessCode: paystackRes.data.access_code,
      reference: paystackRes.data.reference,
      plan: {
        id: plan.id,
        name: plan.name,
        currency,
        amount: currency === "USD" ? `$${plan.amountUsd}` : `₦${plan.amountNgn.toLocaleString()}`,
      },
    });
  } catch (error) {
    console.error("Paystack Initialize error:", error);
    return NextResponse.json(
      { error: "Server error initializing Paystack payment." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const baseUrl = getBaseUrl(request);
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(`${baseUrl}/login?returnUrl=/pricing`);
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("plan") || "pro_monthly";
    const currency = (searchParams.get("currency") || "NGN") as PaymentCurrency;

    const plan = PAYSTACK_PLANS[planId] || PAYSTACK_PLANS.pro_monthly;
    const amountInSubunits = currency === "USD" ? plan.centsUsd : plan.koboNgn;

    const callbackUrl = `${baseUrl}/api/paystack/verify?plan=${plan.id}&currency=${currency}`;

    const paystackRes = await initializePaystackTransaction({
      email: user.email,
      amount: amountInSubunits,
      currency,
      planId: plan.id,
      userId: user.id,
      userName: user.name,
      callbackUrl,
    });

    if (paystackRes.status && paystackRes.data?.authorization_url) {
      return NextResponse.redirect(paystackRes.data.authorization_url);
    }

    return NextResponse.redirect(`${baseUrl}/pricing?error=init_failed`);
  } catch (error) {
    console.error("Paystack GET Initialize error:", error);
    return NextResponse.redirect(`${baseUrl}/pricing?error=init_failed`);
  }
}
