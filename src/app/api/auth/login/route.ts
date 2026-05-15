import { NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/auth";
import { createSessionToken, sessionCookieName, sessionCookieOptions } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String((body as { email?: string }).email ?? "");
  const password = String((body as { password?: string }).password ?? "");
  if (!email || !password) return NextResponse.json({ error: "メールアドレスとパスワードを入力してください" }, { status: 400 });
  const user = await verifyCredentials(email, password);
  if (!user) return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
  const token = await createSessionToken(user.id, user.role);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieName, token, sessionCookieOptions);
  return res;
}
