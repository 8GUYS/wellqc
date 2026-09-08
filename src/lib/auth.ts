import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";

const scrypt = promisify(scryptCallback);
const sessionSecret = process.env.AUTH_SECRET || "wellqc-local-development-secret";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  tier?: string;
  freeChecksUsed?: number;
  ndaAcceptedAt?: string | null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey);
}

export function createSession(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser & { exp: number };
    if (!parsed.id || !parsed.email || !parsed.name || !parsed.exp || parsed.exp < Date.now()) return null;
    return {
      id: parsed.id,
      email: parsed.email,
      name: parsed.name,
      role: parsed.role,
      department: parsed.department,
      tier: parsed.tier || "FREE",
      freeChecksUsed: parsed.freeChecksUsed || 0,
      ndaAcceptedAt: parsed.ndaAcceptedAt || null,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const sessionUser = readSession((await cookies()).get("wellqc_session")?.value);
  if (!sessionUser) return null;

  try {
    const { db } = await import("./db");
    const freshUser = await db.user.findUnique({
      where: { id: sessionUser.id },
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

    if (freshUser) {
      return {
        ...sessionUser,
        role: freshUser.role,
        department: freshUser.department || sessionUser.department,
        tier: freshUser.tier,
        freeChecksUsed: freshUser.freeChecksUsed,
        ndaAcceptedAt: freshUser.ndaAcceptedAt ? freshUser.ndaAcceptedAt.toISOString() : null,
      };
    }
  } catch {
    // Fall back to session token data if DB connection fails
  }

  return sessionUser;
}
