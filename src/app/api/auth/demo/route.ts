import { NextResponse } from "next/server";
import { getCurrentUser, createSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || "login";

    const currentUser = await getCurrentUser();

    if (action === "reset" && currentUser) {
      // Reset user to FREE tier with 2/2 checks used to test Paystack pay button again
      try {
        await db.user.update({
          where: { id: currentUser.id },
          data: {
            tier: "FREE",
            freeChecksUsed: 2,
          },
        });
      } catch (e) {
        console.warn("DB reset error (fallback to cookie):", e);
      }

      const resetSession = createSession({
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        role: currentUser.role,
        department: currentUser.department,
        tier: "FREE",
        freeChecksUsed: 2,
        ndaAcceptedAt: currentUser.ndaAcceptedAt,
      });

      const response = NextResponse.json({
        ok: true,
        message: "Reset user to FREE Starter tier (2/2 checks used).",
        tier: "FREE",
        freeChecksUsed: 2,
      });

      response.cookies.set("wellqc_session", resetSession, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });

      return response;
    }

    // Default: Quick demo login
    const demoUser = {
      id: currentUser?.id || "demo-petrophysicist-uuid",
      email: currentUser?.email || "demo.petrophysicist@wellqc.com",
      name: currentUser?.name || "Demo Petrophysicist",
      role: "PETROPHYSICIST",
      department: "Subsurface Analytics",
      tier: "FREE",
      freeChecksUsed: 2,
      ndaAcceptedAt: new Date().toISOString(),
    };

    const session = createSession(demoUser);

    const response = NextResponse.json({
      ok: true,
      user: demoUser,
      message: "Logged in as Demo Petrophysicist with 2/2 checks used (Ready for Paystack upgrade).",
    });

    response.cookies.set("wellqc_session", session, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Demo auth error:", error);
    return NextResponse.json({ error: "Failed demo auth." }, { status: 500 });
  }
}
