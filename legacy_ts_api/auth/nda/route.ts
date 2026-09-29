import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, createSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    return NextResponse.json({
      ndaAccepted: !!user.ndaAcceptedAt,
      ndaAcceptedAt: user.ndaAcceptedAt || null,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch NDA acceptance status." },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const acceptedAt = new Date();

    // 1. Update user record in Prisma Database
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: { ndaAcceptedAt: acceptedAt },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        tier: true,
        freeChecksUsed: true,
        ndaAcceptedAt: true,
      },
    });

    // 2. Log activity in Database
    await db.activityLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: "NDA_ACCEPTED",
        targetType: "USER",
        targetId: user.id,
        details: `Accepted Subsurface Data Processing & Non-Disclosure Agreement (NDA) on ${acceptedAt.toUTCString()}.`,
      },
    });

    // 3. Refresh session cookie
    const sessionToken = createSession({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      department: updatedUser.department || "Subsurface Analytics",
      tier: updatedUser.tier,
      freeChecksUsed: updatedUser.freeChecksUsed,
      ndaAcceptedAt: updatedUser.ndaAcceptedAt ? updatedUser.ndaAcceptedAt.toISOString() : null,
    });

    const cookieStore = await cookies();
    cookieStore.set("wellqc_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return NextResponse.json({
      status: true,
      message: "Subsurface NDA accepted successfully.",
      ndaAcceptedAt: updatedUser.ndaAcceptedAt?.toISOString(),
    });
  } catch (error) {
    console.error("NDA acceptance error:", error);
    return NextResponse.json(
      { error: "Failed to record NDA acceptance." },
      { status: 500 }
    );
  }
}
