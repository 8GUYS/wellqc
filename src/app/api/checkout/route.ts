import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { initializePaystackTransaction, PAYSTACK_PLANS, PaymentCurrency } from "@/lib/paystack";

function getBaseUrl(request: Request): string {
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !appUrl.includes("localhost:3000")) {
    return appUrl;
  }
  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  const baseUrl = getBaseUrl(request);
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.redirect(`${baseUrl}/login?returnUrl=/pricing`);
    }

    const { searchParams } = new URL(request.url);
    const planParam = searchParams.get("plan") || "pro_monthly";
    const currency = (searchParams.get("currency") || "NGN") as PaymentCurrency;

    const planKey = planParam === "pro" ? "pro_monthly" : planParam;
    const plan = PAYSTACK_PLANS[planKey] || PAYSTACK_PLANS.pro_monthly;
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
    console.error("Checkout processing error:", error);
    return NextResponse.redirect(`${baseUrl}/pricing?error=checkout_failed`);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const planParam = body.planId || body.plan || "pro_monthly";
    const currency = (body.currency || "NGN") as PaymentCurrency;

    const planKey = planParam === "pro" ? "pro_monthly" : planParam;
    const plan = PAYSTACK_PLANS[planKey] || PAYSTACK_PLANS.pro_monthly;
    const amountInSubunits = currency === "USD" ? plan.centsUsd : plan.koboNgn;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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

    return NextResponse.json({
      status: true,
      authorizationUrl: paystackRes.data?.authorization_url,
      reference: paystackRes.data?.reference,
      accessCode: paystackRes.data?.access_code,
      plan: plan.name,
    });
  } catch (error) {
    console.error("Checkout POST error:", error);
    return NextResponse.json(
      { error: "Failed to process checkout session." },
      { status: 500 }
    );
  }
}
