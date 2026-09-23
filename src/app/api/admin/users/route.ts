import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const VALID_ROLES = ["ADMIN", "PETROPHYSICIST", "DATA_ENGINEER", "GEOSCIENTIST", "VIEWER"] as const;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        department: u.department || "Workspace",
        status: "ACTIVE",
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to load admin users", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load users.", users: [] },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    if (admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

    const { userId, role } = await request.json();
    if (!userId || !role) return NextResponse.json({ error: "userId and role are required." }, { status: 400 });
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true, department: true },
    });

    return NextResponse.json({ user: { ...updated, department: updated.department || "Workspace", status: "ACTIVE" } });
  } catch (error) {
    console.error("Failed to update user role", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update role." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    if (admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });
    if (userId === admin.id) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    }

    await db.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete user", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete user." }, { status: 500 });
  }
}
