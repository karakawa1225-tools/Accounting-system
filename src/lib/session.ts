import { SignJWT, jwtVerify } from "jose";

const SESSION_COOKIE = "accounting_session";

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export type SessionRole = "admin" | "user";

export async function createSessionToken(userId: string, role: SessionRole = "admin") {
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string | undefined): Promise<{ userId: string; role: SessionRole } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (typeof payload.sub !== "string") return null;
    const roleRaw = payload.role;
    const role: SessionRole = roleRaw === "user" ? "user" : "admin";
    return { userId: payload.sub, role };
  } catch {
    return null;
  }
}

export const sessionCookieName = SESSION_COOKIE;
export const sessionCookieOptions = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};
