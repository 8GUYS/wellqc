import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const tier = user.tier || "FREE";
    // eslint-disable-next-line prefer-const -- reassigned inside the freemium block below once it is uncommented
    let updatedChecksUsed = user.freeChecksUsed ?? 0;

    // Atomic freemium check-and-increment (Commented out for free testing - uncomment when payment option is implemented)
    /*
    if (tier === "FREE") {
      const consumed = await db.user.updateMany({
        where: { id: user.id, tier: "FREE", freeChecksUsed: { lt: 2 } },
        data: { freeChecksUsed: { increment: 1 } },
      });

      if (consumed.count === 0) {
        return NextResponse.json(
          {
            error: "Free limit reached. You have used your 2 free LAS log file checks.",
            limitReached: true,
            freeChecksUsed: updatedChecksUsed,
            maxFreeChecks: 2,
            tier,
          },
          { status: 402 } // Payment Required
        );
      }

      const refreshedUser = await db.user.findUnique({
        where: { id: user.id },
        select: { freeChecksUsed: true },
      });
      updatedChecksUsed = refreshedUser?.freeChecksUsed ?? updatedChecksUsed + 1;
    }
    */

    return NextResponse.json({
      allowed: true,
      tier,
      freeChecksUsed: updatedChecksUsed,
      maxFreeChecks: 2,
      remainingChecks: tier === "FREE" ? Math.max(0, 2 - updatedChecksUsed) : null,
    });
  } catch (error) {
    console.error("Error verifying log check limit:", error);
    return NextResponse.json(
      { error: "Failed to verify log check limit." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const tier = user.tier || "FREE";
    const checksUsed = user.freeChecksUsed ?? 0;

    return NextResponse.json({
      tier,
      freeChecksUsed: checksUsed,
      maxFreeChecks: 2,
      limitReached: tier === "FREE" && checksUsed >= 2,
      remainingChecks: tier === "FREE" ? Math.max(0, 2 - checksUsed) : null,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch usage status." }, { status: 500 });
  }
}
