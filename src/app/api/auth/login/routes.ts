import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json() as { email?: string; password?: string };
    const user = email ? await db.user.findUnique({ where: { email: email.trim().toLowerCase() } }) : null;
    if (!user || !password || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Incorrect email address or password." }, { status: 401 });
    }
    const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department || "" } });
    response.cookies.set("wellqc_session", createSession({ id: user.id, name: user.name, email: user.email, role: user.role, department: user.department || "" }), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ error: "Unable to sign in." }, { status: 500 });
  }
}
