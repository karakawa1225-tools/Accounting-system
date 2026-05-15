import { NextResponse } from "next/server";
import { getLibsqlClient } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = getLibsqlClient();
    await client.execute({ sql: "SELECT 1", args: [] });
    return NextResponse.json({ ok: true, status: "healthy" }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ ok: false, status: "unhealthy", error: message }, { status: 503 });
  }
}
