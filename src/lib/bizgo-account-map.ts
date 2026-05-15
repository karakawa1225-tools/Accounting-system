import { asc, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { accounts } from "@/db/schema";

export type AccountPick = { id: string; name: string; code: string | null };

function norm(s: string) {
  return s.trim().replace(/\s+/g, "").toLowerCase();
}

/** BizGO の「区分」文字列を勘定科目マスタに照合（名称・コード・完全一致優先） */
export async function resolveAccountIdFromBizgoCategory(db: Database, categoryLabel: string): Promise<string | null> {
  const label = categoryLabel.trim();
  if (!label) return null;

  const rows = await db
    .select({ id: accounts.id, name: accounts.name, code: accounts.code })
    .from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(asc(accounts.code), asc(accounts.name));

  const nLabel = norm(label);
  for (const a of rows) {
    if (norm(a.name) === nLabel) return a.id;
    if (a.code && norm(a.code) === nLabel) return a.id;
  }
  for (const a of rows) {
    if (norm(a.name).includes(nLabel) || nLabel.includes(norm(a.name))) return a.id;
  }
  return null;
}

export async function loadActiveAccountsForDisplay(db: Database): Promise<AccountPick[]> {
  return db
    .select({ id: accounts.id, name: accounts.name, code: accounts.code })
    .from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(asc(accounts.code), asc(accounts.name));
}
