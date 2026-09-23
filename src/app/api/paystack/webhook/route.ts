import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { verifyPaystackWebhookSignature, PAYSTACK_PLANS } from "@/lib/paystack";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const headersList = await headers();
    const signature = headersList.get("x-paystack-signature");

    // If a Paystack Secret Key is configured, verify HMAC signature
    if (process.env.PAYSTACK_SECRET_KEY) {
      const isValid = verifyPaystackWebhookSignature(rawBody, signature);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
      }
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const data = payload.data;

    // Handle successful payment events
    if (event === "charge.success") {
      const reference = data.reference;
      const metadata = data.metadata || {};
      const userId = metadata.userId || metadata.user_id;
      const planId = metadata.planId || metadata.plan || "pro_monthly";
      const customerEmail = data.customer?.email;

      const plan = PAYSTACK_PLANS[planId] || PAYSTACK_PLANS.pro_monthly;

      if (userId) {
        // Upgrade by user ID
        await db.user.update({
          where: { id: userId },
          data: {
            tier: "PRO",
            stripeCustomerId: data.customer?.customer_code || undefined,
            stripeSubscriptionId: reference,
          },
        });

        await db.activityLog.create({
          data: {
            userName: metadata.userName || "User",
            userRole: "PETROPHYSICIST",
            userId: userId,
            action: "UPGRADE_SUBSCRIPTION",
            targetType: "USER",
            targetId: userId,
            details: `Paystack Webhook: Charge succeeded for ${plan.name} (${data.channel || "card/transfer"}). Ref: ${reference}`,
          },
        });
      } else if (customerEmail) {
        // Fallback: Upgrade by customer email
        const user = await db.user.findUnique({
          where: { email: customerEmail },
        });

        if (user) {
          await db.user.update({
            where: { id: user.id },
            data: {
              tier: "PRO",
              stripeCustomerId: data.customer?.customer_code || undefined,
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
              details: `Paystack Webhook: Charge succeeded for ${plan.name}. Ref: ${reference}`,
            },
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paystack Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failure." },
      { status: 500 }
    );
  }
}
