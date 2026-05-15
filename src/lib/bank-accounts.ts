import { and, asc, eq, isNull, or } from "drizzle-orm";
import type { Database } from "@/db";
import { accounts } from "@/db/schema";
import { SYSTEM_ACCOUNT_CODES } from "@/lib/system-accounts";

const EXCLUDED_CODES = new Set<string>([SYSTEM_ACCOUNT_CODES.AR, SYSTEM_ACCOUNT_CODES.OPENING]);

/** 入出金で選択できる銀行口座（有効な資産勘定・売掛・期首調整を除く） */
export async function getSelectableBankAccounts(db: Database) {
  const rows = await db
    .select({ id: accounts.id, code: accounts.code, name: accounts.name })
    .from(accounts)
    .where(and(eq(accounts.category, "asset"), or(eq(accounts.isActive, true), isNull(accounts.isActive))))
    .orderBy(asc(accounts.code), asc(accounts.name));

  return rows.filter((r) => !r.code || !EXCLUDED_CODES.has(r.code));
}
