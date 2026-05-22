import { and, asc, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import type { Database } from "@/db";
import { accounts, openingBalanceLines, transactions } from "@/db/schema";
import { OPENING_JOURNAL_SUMMARY } from "@/lib/opening-balance-constants";
import { getSystemAccounts } from "@/lib/system-accounts";

export { OPENING_JOURNAL_SUMMARY };

/** 期首残高行から仕訳を再生成する（全会計期間開始日分を一括置換） */
export async function regenerateOpeningJournalForFiscal(db: Database, fiscalPeriodStart: string) {
  const sys = await getSystemAccounts(db);
  const obRows = await db
    .select()
    .from(openingBalanceLines)
    .where(eq(openingBalanceLines.fiscalPeriodStart, fiscalPeriodStart));
  const nonZero = obRows.filter((r) => r.balanceMinor !== 0);

  await db.transaction(async (tx) => {
    const existingGroups = await tx
      .select({ eg: transactions.entryGroupId })
      .from(transactions)
      .where(
        and(
          eq(transactions.transactionDate, fiscalPeriodStart),
          eq(transactions.summary, OPENING_JOURNAL_SUMMARY),
          eq(transactions.kind, "journal"),
          isNotNull(transactions.entryGroupId)
        )
      );
    const egs = [...new Set(existingGroups.map((r) => r.eg).filter(Boolean))] as string[];
    if (egs.length) await tx.delete(transactions).where(inArray(transactions.entryGroupId, egs));

    if (nonZero.length === 0) return;

    const entryGroupId = crypto.randomUUID();
    let sumDebit = 0;
    let sumCredit = 0;
    const lines: (typeof transactions.$inferInsert)[] = [];

    for (const p of nonZero) {
      const b = p.balanceMinor;
      if (b > 0) {
        sumDebit += b;
        lines.push({
          entryGroupId,
          transactionDate: fiscalPeriodStart,
          accountId: p.accountId,
          amountMinor: b,
          debitAmountMinor: b,
          creditAmountMinor: 0,
          summary: OPENING_JOURNAL_SUMMARY,
          kind: "journal",
        });
      } else {
        const c = -b;
        sumCredit += c;
        lines.push({
          entryGroupId,
          transactionDate: fiscalPeriodStart,
          accountId: p.accountId,
          amountMinor: c,
          debitAmountMinor: 0,
          creditAmountMinor: c,
          summary: OPENING_JOURNAL_SUMMARY,
          kind: "journal",
        });
      }
    }

    const diff = sumDebit - sumCredit;
    if (diff !== 0) {
      if (diff > 0) {
        lines.push({
          entryGroupId,
          transactionDate: fiscalPeriodStart,
          accountId: sys.openingId,
          amountMinor: diff,
          debitAmountMinor: 0,
          creditAmountMinor: diff,
          summary: OPENING_JOURNAL_SUMMARY,
          kind: "journal",
        });
      } else {
        const d = -diff;
        lines.push({
          entryGroupId,
          transactionDate: fiscalPeriodStart,
          accountId: sys.openingId,
          amountMinor: d,
          debitAmountMinor: d,
          creditAmountMinor: 0,
          summary: OPENING_JOURNAL_SUMMARY,
          kind: "journal",
        });
      }
    }

    await tx.insert(transactions).values(lines);
  });
}

/** 指定勘定の期首残高だけ upsert し、期首仕訳を再生成 */
export async function upsertOpeningBalancesAndRegenerate(
  db: Database,
  fiscalPeriodStart: string,
  updates: { accountId: string; balanceMinor: number }[]
) {
  const now = new Date();
  for (const u of updates) {
    const balance = Math.floor(u.balanceMinor);
    if (balance === 0) {
      await db
        .delete(openingBalanceLines)
        .where(
          and(eq(openingBalanceLines.fiscalPeriodStart, fiscalPeriodStart), eq(openingBalanceLines.accountId, u.accountId))
        );
      continue;
    }
    await db
      .insert(openingBalanceLines)
      .values({
        fiscalPeriodStart,
        accountId: u.accountId,
        balanceMinor: balance,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [openingBalanceLines.fiscalPeriodStart, openingBalanceLines.accountId],
        set: { balanceMinor: balance, updatedAt: now },
      });
  }
  await regenerateOpeningJournalForFiscal(db, fiscalPeriodStart);
}

/** 期首残高用に有効な勘定一覧（期首調整勘定除く） */
export async function listAccountsForOpeningBalance(db: Database) {
  const sys = await getSystemAccounts(db);
  return db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(ne(accounts.id, sys.openingId), or(eq(accounts.isActive, true), isNull(accounts.isActive))))
    .orderBy(asc(accounts.code), asc(accounts.name));
}
