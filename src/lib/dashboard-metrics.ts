import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { transactions } from "@/db/schema";
import type { ApBook, ArBook } from "@/lib/ar-ap-books";
import { resolveApAccounts, resolveArAccounts } from "@/lib/ar-ap-books";
import type { getSystemAccounts } from "@/lib/system-accounts";
import { transactionDateInMonth } from "@/lib/transaction-month-filter";

type SystemAccounts = Awaited<ReturnType<typeof getSystemAccounts>>;

/** ダッシュボード表示用の当月（日本時間） */
export function currentMonthYmJst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
}

/** 当月の売上登録（ar_sale の貸方＝売上高）のみ */
export async function sumMonthlyArSalesMinor(
  db: Database,
  sys: SystemAccounts,
  book: ArBook,
  month = currentMonthYmJst()
): Promise<number> {
  const { salesId } = resolveArAccounts(sys, book);
  const [row] = await db
    .select({
      v: sql<number>`coalesce(sum(${transactions.creditAmountMinor}),0)`.mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, salesId),
        eq(transactions.kind, "ar_sale"),
        transactionDateInMonth(transactions.transactionDate, month)
      )
    );
  return Number(row?.v ?? 0);
}

/** 当月の仕入・外注登録（ap_purchase の借方）のみ */
export async function sumMonthlyApPurchaseMinor(
  db: Database,
  sys: SystemAccounts,
  book: ApBook,
  month = currentMonthYmJst()
): Promise<number> {
  const { expenseId } = resolveApAccounts(sys, book);
  const [row] = await db
    .select({
      v: sql<number>`coalesce(sum(${transactions.debitAmountMinor}),0)`.mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, expenseId),
        eq(transactions.kind, "ap_purchase"),
        transactionDateInMonth(transactions.transactionDate, month)
      )
    );
  return Number(row?.v ?? 0);
}
