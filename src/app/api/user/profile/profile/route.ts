import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, hashPassword, verifyPassword, createSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        tier: true,
        freeChecksUsed: true,
        ndaAcceptedAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        createdAt: true,
        updatedAt: true,
        lasFiles: {
          select: { id: true },
        },
        activityLogs: {
          where: {
            action: { in: ["UPGRADE_SUBSCRIPTION", "LOGIN", "NDA_ACCEPTED"] },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            action: true,
            details: true,
            createdAt: true,
            ipAddress: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    // Format billing history records from subscription logs and metadata
    const paymentRecords = user.activityLogs
      .filter((log) => log.action === "UPGRADE_SUBSCRIPTION")
      .map((log) => {
        const isAnnual = log.details.includes("Annual");
        const isNgn = log.details.includes("₦") || !log.details.includes("$");
        const amount = isAnnual ? (isNgn ? "₦750,000" : "$490") : (isNgn ? "₦75,000" : "$49");
        const refMatch = log.details.match(/Ref:\s*([^\s.]+)/);
        const ref = refMatch ? refMatch[1] : user.stripeSubscriptionId || "PSTK_REF_DIRECT";

        return {
          id: log.id,
          reference: ref,
          planName: isAnnual ? "Pro Petrophysicist (Annual)" : "Pro Petrophysicist (Monthly)",
          amount,
          channel: log.details.includes("Card") ? "Card / Paystack" : "Transfer / USSD",
          status: "SUCCESS",
          date: log.createdAt,
        };
      });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || "Subsurface Analytics",
        tier: user.tier || "FREE",
        freeChecksUsed: user.freeChecksUsed ?? 0,
        maxFreeChecks: 2,
        totalFilesUploaded: user.lasFiles.length,
        ndaAcceptedAt: user.ndaAcceptedAt ? user.ndaAcceptedAt.toISOString() : null,
        createdAt: user.createdAt.toISOString(),
      },
      paymentRecords,
      recentActivity: user.activityLogs,
    });
  } catch (error) {
    console.error("Failed to load user profile:", error);
    return NextResponse.json(
      { error: "Failed to load user profile data." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const body = await request.json();
    const { name, department, role, currentPassword, newPassword } = body;

    const existingUser = await db.user.findUnique({
      where: { id: sessionUser.id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (name && typeof name === "string") updateData.name = name.trim();
    if (department && typeof department === "string") updateData.department = department.trim();

    if (role && typeof role === "string") {
      const requestedRole = role.trim().toUpperCase();
      const validRoles = ["PETROPHYSICIST", "DATA_ENGINEER", "GEOSCIENTIST", "VIEWER", "ADMIN"];

      if (!validRoles.includes(requestedRole)) {
        return NextResponse.json({ error: "Invalid role specified." }, { status: 400 });
      }

      // Security Check: Non-admin users CANNOT self-escalate role to ADMIN
      if (requestedRole === "ADMIN" && existingUser.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Privilege escalation restricted: Users cannot self-assign the Administrator (ADMIN) role." },
          { status: 403 }
        );
      }

      updateData.role = requestedRole;
    }

    // If password change is requested
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to set a new password." },
          { status: 400 }
        );
      }

      const isValidPassword = await verifyPassword(currentPassword, existingUser.passwordHash);
      if (!isValidPassword) {
        return NextResponse.json(
          { error: "Current password provided is incorrect." },
          { status: 400 }
        );
      }

      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return NextResponse.json(
          { error: "New password must be at least 6 characters long." },
          { status: 400 }
        );
      }

      updateData.passwordHash = await hashPassword(newPassword);
    }

    const updated = await db.user.update({
      where: { id: sessionUser.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        tier: true,
        freeChecksUsed: true,
        updatedAt: true,
      },
    });

    // Log the profile update action
    await db.activityLog.create({
      data: {
        userId: sessionUser.id,
        userName: updated.name,
        userRole: updated.role,
        action: "UPDATE_PROFILE",
        targetType: "USER",
        targetId: sessionUser.id,
        details: "Updated user profile details and settings.",
      },
    });

    // Refresh session cookie with updated user name, role, department
    const sessionToken = createSession({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      department: updated.department || "Subsurface Analytics",
      tier: updated.tier,
      freeChecksUsed: updated.freeChecksUsed,
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
      message: "Profile updated successfully.",
      user: updated,
    });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile details." },
      { status: 500 }
    );
  }
}
