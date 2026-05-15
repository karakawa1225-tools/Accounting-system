"use server";

import { revalidatePath } from "next/cache";
import { eq, asc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/authz";

export async function listStaffUsers() {
  await requireAdmin();
  const db = getDb();
  return db.select().from(users).orderBy(asc(users.email));
}

export async function createStaffUser(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  if (!email) throw new Error("メールアドレスは必須です");
  if (password.length < 8) throw new Error("パスワードは8文字以上にしてください");

  const db = getDb();
  const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (dup) throw new Error("このメールアドレスは既に登録されています");

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ email, passwordHash, role: "user", displayName });
  revalidatePath("/admin/users");
}

export async function updateStaffUser(formData: FormData) {
  const { userId: actorId } = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("ユーザーが不正です");

  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const roleRaw = String(formData.get("role") ?? "").trim();
  const role = roleRaw === "admin" ? "admin" : "user";
  const newPassword = String(formData.get("newPassword") ?? "");

  const db = getDb();
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new Error("ユーザーが見つかりません");

  if (target.role === "admin" && role === "user") {
    const [cnt] = await db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(users)
      .where(eq(users.role, "admin"));
    if ((cnt?.c ?? 0) <= 1) throw new Error("最後の管理者の権限を外すことはできません");
  }

  if (target.id === actorId && role === "user") {
    const [cnt] = await db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(users)
      .where(eq(users.role, "admin"));
    if ((cnt?.c ?? 0) <= 1) throw new Error("管理者が0人になるため変更できません");
  }

  if (newPassword.length > 0 && newPassword.length < 8) throw new Error("パスワードは8文字以上にしてください");
  const passwordHash =
    newPassword.length > 0 ? await bcrypt.hash(newPassword, 10) : target.passwordHash;

  await db
    .update(users)
    .set({
      displayName,
      role,
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));
  revalidatePath("/admin/users");
}

export async function deleteStaffUser(formData: FormData) {
  const { userId: actorId } = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("ユーザーが不正です");
  if (id === actorId) throw new Error("自分自身は削除できません");

  const db = getDb();
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new Error("ユーザーが見つかりません");
  if (target.role === "admin") {
    const [cnt] = await db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(users)
      .where(eq(users.role, "admin"));
    if ((cnt?.c ?? 0) <= 1) throw new Error("最後の管理者は削除できません");
  }

  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/admin/users");
}
