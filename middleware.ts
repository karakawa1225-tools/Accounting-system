import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/session";

const LOGIN = "/login";

/** 認証なしで許可する API（それ以外の /api/* はログイン必須） */
function isPublicApi(path: string) {
  return path === "/api/health" || path === "/api/auth/login";
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/api")) {
    if (isPublicApi(path)) return NextResponse.next();
    const token = req.cookies.get(sessionCookieName)?.value;
    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const token = req.cookies.get(sessionCookieName)?.value;
  const session = await verifySessionToken(token);

  if (path === "/") return NextResponse.next();
  if (path === LOGIN) return session ? NextResponse.redirect(new URL("/dashboard", req.url)) : NextResponse.next();
  if (!session) return NextResponse.redirect(new URL(LOGIN, req.url));

  const adminOnly = ["/admin/company", "/admin/users"];
  if (adminOnly.some((p) => path === p || path.startsWith(`${p}/`))) {
    if (session.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|csv-templates|.*\\..*).*)"],
};
