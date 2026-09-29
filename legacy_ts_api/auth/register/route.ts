import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { name, email, password, role, acceptedNda } = await request.json() as { name?: string; email?: string; password?: string; role?: string; acceptedNda?: boolean };
    const safeName = name?.trim();
    const safeEmail = email?.trim().toLowerCase();
    const validRoles = ["ADMIN", "PETROPHYSICIST", "DATA_ENGINEER", "GEOSCIENTIST", "VIEWER"];
    const safeRole = role && validRoles.includes(role.toUpperCase().trim()) ? role.toUpperCase().trim() : "PETROPHYSICIST";

    if (!safeName || !safeEmail || !/^\S+@\S+\.\S+$/.test(safeEmail) || !password || password.length < 8 || !acceptedNda) {
      return NextResponse.json({ error: "Enter a name, a valid email address, a password of at least 8 characters, and accept the confidentiality agreement." }, { status: 400 });
    }
    const existing = await db.user.findUnique({ where: { email: safeEmail } });
    if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

    const user = await db.user.create({
      data: { name: safeName, email: safeEmail, passwordHash: await hashPassword(password), role: safeRole, ndaAcceptedAt: new Date() },
    });
    const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department || "" } }, { status: 201 });
    response.cookies.set("wellqc_session", createSession({ id: user.id, name: user.name, email: user.email, role: user.role, department: user.department || "" }), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    console.error("Registration failed", error);
    return NextResponse.json({ error: "Unable to create your account." }, { status: 500 });
  }
}

