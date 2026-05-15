import { NextResponse } from "next/server";
import { sessionCookieName, sessionCookieOptions } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieName, "", { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
