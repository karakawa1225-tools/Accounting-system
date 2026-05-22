import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { accounts, companies, users } from "../src/db/schema";
import { SYSTEM_ACCOUNT_CODES } from "../src/lib/system-accounts";

const DEFAULT_ADMIN_EMAIL = "admin@example.com";

async function ensureAccount(code: string, name: string, category: "asset" | "liability" | "revenue" | "expense" | "equity") {
  const db = getDb();
  const [existing] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, code)).limit(1);
  if (existing) return;
  const now = Date.now();
  await (db as unknown as { $client: { execute: (args: { sql: string; args: unknown[] }) => Promise<unknown> } }).$client.execute({
    sql: "insert into accounts (id, code, name, category, is_active, created_at, updated_at) values (?, ?, ?, ?, 1, ?, ?)",
    args: [crypto.randomUUID(), code, name, category, now, now],
  });
}

async function ensureDefaultCompany() {
  const db = getDb();
  const [row] = await db.select({ id: companies.id }).from(companies).limit(1);
  if (row) return;
  await db.insert(companies).values({ name: "会社名未設定" });
}

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      "SEED_ADMIN_PASSWORD を設定してください。例: SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='強力なパスワード' npm run db:seed"
    );
  }
  if (process.env.NODE_ENV === "production" && password.length < 12) {
    throw new Error("本番の管理者パスワードは12文字以上にしてください。");
  }
  const db = getDb();

  await ensureDefaultCompany();

  await ensureAccount(SYSTEM_ACCOUNT_CODES.AR, "売掛金（施工部）", "asset");
  await ensureAccount(SYSTEM_ACCOUNT_CODES.SALES, "売上高（施工部）", "revenue");
  await ensureAccount(SYSTEM_ACCOUNT_CODES.AR_KIKO, "売掛金（機工部）", "asset");
  await ensureAccount(SYSTEM_ACCOUNT_CODES.SALES_KIKO, "売上高（機工部）", "revenue");
  await ensureAccount(SYSTEM_ACCOUNT_CODES.BANK, "普通預金", "asset");
  await ensureAccount(SYSTEM_ACCOUNT_CODES.AP, "買掛金", "liability");
  await ensureAccount(SYSTEM_ACCOUNT_CODES.PURCHASES, "仕入高", "expense");
  await ensureAccount(SYSTEM_ACCOUNT_CODES.AP_GAICHU, "未払外注費", "liability");
  await ensureAccount(SYSTEM_ACCOUNT_CODES.GAICHU, "外注費", "expense");
  await ensureAccount(SYSTEM_ACCOUNT_CODES.OPENING, "期首貸借調整", "equity");

  const passwordHash = await bcrypt.hash(password, 12);
  await db
    .insert(users)
    .values({ email, passwordHash, role: "admin" })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, role: "admin", updatedAt: new Date() },
    });

  console.log("Seed completed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
