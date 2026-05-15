import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import type { SessionRole } from "@/lib/session";

export async function verifyCredentials(email: string, password: string) {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const [row] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.passwordHash);
  if (!ok) return null;
  const role: SessionRole = row.role === "user" ? "user" : "admin";
  return { id: row.id, email: row.email, role };
}
