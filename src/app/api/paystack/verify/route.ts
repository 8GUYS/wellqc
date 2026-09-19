import { NextResponse } from "next/server";
import { getCurrentUser, createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyPaystackTransaction, PAYSTACK_PLANS } from "@/lib/paystack";

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
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    const planParam = searchParams.get("plan") || "pro_monthly";

    if (!reference) {
      return NextResponse.redirect(`${baseUrl}/dashboard?payment=error&message=Missing_Transaction_Reference`);
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(`${baseUrl}/login?returnUrl=${encodeURIComponent(`/dashboard?payment=success&reference=${reference}`)}`);
    }

    // Verify transaction with Paystack API or sandbox
    const verification = await verifyPaystackTransaction(reference);

    if (!verification.status || verification.data?.status !== "success") {
      return NextResponse.redirect(
        `${baseUrl}/dashboard?payment=failed&message=${encodeURIComponent(verification.message || "Payment verification failed")}`
      );
    }

    const planId = verification.data?.metadata?.planId || planParam;
    const plan = PAYSTACK_PLANS[planId] || PAYSTACK_PLANS.pro_monthly;

    // Try upgrading user in database with graceful fallback
    try {
      await db.user.update({
        where: { id: user.id },
        data: {
          tier: "PRO",
          freeChecksUsed: 0,
          stripeCustomerId: verification.data?.customer?.customer_code || `pstk_cus_${Date.now()}`,
          stripeSubscriptionId: reference,
        },
      });

      await db.activityLog.create({
        data: {
          userName: user.name,
          userRole: user.role,
          userId: user.id,
          action: "UPGRADE_SUBSCRIPTION",
          targetType: "USER",
          targetId: user.id,
          details: `Subscribed to ${plan.name} via Paystack (${verification.data?.channel || "Card/Transfer/USSD"}). Ref: ${reference}. Unlimited LAS audits active.`,
        },
      });
    } catch (dbErr) {
      console.warn("Database user update failed during Paystack verify GET (continuing with session cookie upgrade):", dbErr);
    }

    // Set updated PRO session cookie
    const updatedSession = createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      tier: "PRO",
      freeChecksUsed: 0,
      ndaAcceptedAt: user.ndaAcceptedAt,
    });

    const response = NextResponse.redirect(
      `${baseUrl}/dashboard?payment=success&tier=PRO&plan=${encodeURIComponent(plan.name)}&reference=${encodeURIComponent(reference)}`
    );

    response.cookies.set("wellqc_session", updatedSession, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Paystack Verify GET error:", error);
    return NextResponse.redirect(
      `${baseUrl}/dashboard?payment=error&message=Internal_Verification_Error`
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const reference = body.reference;
    const planParam = body.planId || "pro_monthly";

    if (!reference) {
      return NextResponse.json({ error: "Transaction reference is required." }, { status: 400 });
    }

    const verification = await verifyPaystackTransaction(reference);

    if (!verification.status || verification.data?.status !== "success") {
      return NextResponse.json(
        { error: verification.message || "Payment verification failed." },
        { status: 400 }
      );
    }

    const planId = verification.data?.metadata?.planId || planParam;
    const plan = PAYSTACK_PLANS[planId] || PAYSTACK_PLANS.pro_monthly;

    try {
      await db.user.update({
        where: { id: user.id },
        data: {
          tier: "PRO",
          freeChecksUsed: 0,
          stripeCustomerId: verification.data?.customer?.customer_code || `pstk_cus_${Date.now()}`,
          stripeSubscriptionId: reference,
        },
      });

      await db.activityLog.create({
        data: {
          userName: user.name,
          userRole: user.role,
          userId: user.id,
          action: "UPGRADE_SUBSCRIPTION",
          targetType: "USER",
          targetId: user.id,
          details: `Subscribed to ${plan.name} via Paystack. Ref: ${reference}. Unlimited LAS checks enabled.`,
        },
      });
    } catch (dbErr) {
      console.warn("Database user update failed during Paystack verify POST (continuing with session cookie upgrade):", dbErr);
    }

    // Update session cookie with PRO tier
    const updatedSession = createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      tier: "PRO",
      freeChecksUsed: 0,
      ndaAcceptedAt: user.ndaAcceptedAt,
    });

    const response = NextResponse.json({
      status: true,
      message: "Subscription successfully upgraded to PRO.",
      tier: "PRO",
      plan: plan.name,
      reference,
      channel: verification.data?.channel || "card",
      isDemo: verification.isDemo || reference.includes("demo"),
    });

    response.cookies.set("wellqc_session", updatedSession, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Paystack Verify POST error:", error);
    return NextResponse.json(
      { error: "Failed to verify transaction." },
      { status: 500 }
    );
  }
}
