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
    const checksUsed = user.freeChecksUsed ?? 0;

    // Strict freemium limit check: max 2 free log checks
    if (tier === "FREE" && checksUsed >= 2) {
      return NextResponse.json(
        {
          error: "Free limit reached. You have used your 2 free LAS log file checks.",
          limitReached: true,
          freeChecksUsed: checksUsed,
          maxFreeChecks: 2,
          tier,
        },
        { status: 402 } // Payment Required
      );
    }

    // Increment usage count for free tier user upon performing a log check
    let updatedChecksUsed = checksUsed;
    if (tier === "FREE") {
      const updatedUser = await db.user.update({
        where: { id: user.id },
        data: { freeChecksUsed: { increment: 1 } },
        select: { freeChecksUsed: true, tier: true },
      });
      updatedChecksUsed = updatedUser.freeChecksUsed;
    }

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
