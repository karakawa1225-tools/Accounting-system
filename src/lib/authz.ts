import { cookies } from "next/headers";
import { sessionCookieName, verifySessionToken } from "@/lib/session";

export async function getCurrentSessionToken() {
  const jar = await cookies();
  return jar.get(sessionCookieName)?.value;
}

export async function getCurrentSession() {
  const token = await getCurrentSessionToken();
  return verifySessionToken(token);
}

export async function requireAdmin(): Promise<{ userId: string; role: "admin" }> {
  const session = await getCurrentSession();
  if (!session) throw new Error("ログインが必要です");
  if (session.role !== "admin") throw new Error("この操作には管理者権限が必要です");
  return { userId: session.userId, role: "admin" };
}
