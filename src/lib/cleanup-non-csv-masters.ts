import { eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { accountDivisions, accounts, openingBalanceLines, transactions, type AccountCategory } from "@/db/schema";
import { resolveYDivisionForCategory } from "@/lib/account-division-resolve";
import { isAllowedAccountCode, isCsvStyleDivisionCode } from "@/lib/csv-master-policy";

export type CleanupMastersResult = {
  divisionsDeleted: number;
  divisionsReassignedAccounts: number;
  accountsDeleted: number;
  accountsDeactivated: number;
  accountsReassignedDivision: number;
};

export async function cleanupNonCsvMasters(db: Database): Promise<CleanupMastersResult> {
  const result: CleanupMastersResult = {
    divisionsDeleted: 0,
    divisionsReassignedAccounts: 0,
    accountsDeleted: 0,
    accountsDeactivated: 0,
    accountsReassignedDivision: 0,
  };

  const allDivisions = await db.select().from(accountDivisions);
  const yDivisions = allDivisions.filter((d) => isCsvStyleDivisionCode(d.code));
  const fallbackByCategory = new Map<AccountCategory, string>();
  for (const cat of ["asset", "liability", "equity", "revenue", "expense"] as AccountCategory[]) {
    const id = await resolveYDivisionForCategory(db, cat);
    if (id) fallbackByCategory.set(cat, id);
  }

  for (const div of allDivisions) {
    if (isCsvStyleDivisionCode(div.code)) continue;
    const targetId =
      fallbackByCategory.get(div.statementCategory as AccountCategory) ?? yDivisions[0]?.id ?? null;
    if (!targetId) {
      continue;
    }
    const refs = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.accountDivisionId, div.id));
    if (refs.length) {
      await db
        .update(accounts)
        .set({ accountDivisionId: targetId, updatedAt: new Date() })
        .where(eq(accounts.accountDivisionId, div.id));
      result.divisionsReassignedAccounts += refs.length;
    }
    await db.delete(accountDivisions).where(eq(accountDivisions.id, div.id));
    result.divisionsDeleted += 1;
  }

  const allAccounts = await db.select().from(accounts);
  const divisionById = new Map(allDivisions.map((d) => [d.id, d]));

  for (const acc of allAccounts) {
    if (isAllowedAccountCode(acc.code)) {
      const yDiv = await resolveYDivisionForCategory(db, acc.category);
      if (yDiv && acc.accountDivisionId !== yDiv) {
        const divRow = acc.accountDivisionId ? divisionById.get(acc.accountDivisionId) : undefined;
        if (!divRow || !isCsvStyleDivisionCode(divRow.code)) {
          await db.update(accounts).set({ accountDivisionId: yDiv, updatedAt: new Date() }).where(eq(accounts.id, acc.id));
          result.accountsReassignedDivision += 1;
        }
      }
      continue;
    }

    const [{ c }] = await db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(transactions)
      .where(eq(transactions.accountId, acc.id));

    if (c > 0) {
      await db.update(accounts).set({ isActive: false, updatedAt: new Date() }).where(eq(accounts.id, acc.id));
      result.accountsDeactivated += 1;
    } else {
      await db.delete(openingBalanceLines).where(eq(openingBalanceLines.accountId, acc.id));
      try {
        await db.delete(accounts).where(eq(accounts.id, acc.id));
        result.accountsDeleted += 1;
      } catch {
        await db.update(accounts).set({ isActive: false, updatedAt: new Date() }).where(eq(accounts.id, acc.id));
        result.accountsDeactivated += 1;
      }
    }
  }

  return result;
}
