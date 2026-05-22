import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { customers, transactions } from "@/db/schema";
import type { ApBook, ArBook } from "@/lib/ar-ap-books";
import { resolveApAccounts, resolveArAccounts } from "@/lib/ar-ap-books";
import type { getSystemAccounts } from "@/lib/system-accounts";
import { transactionDateInMonth } from "@/lib/transaction-month-filter";

const AR_BALANCE_KINDS = ["ar_sale", "ar_payment"] as const;
const AP_BALANCE_KINDS = ["ap_purchase", "ap_payment"] as const;

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

/** 売掛管理と同じ範囲の売掛残高（入出金の cash 仕訳などは含めない） */
export async function sumArBookBalanceMinor(db: Database, sys: SystemAccounts, book: ArBook): Promise<number> {
  const { arId } = resolveArAccounts(sys, book);
  const [row] = await db
    .select({
      v: sql<number>`coalesce(sum(${transactions.debitAmountMinor} - ${transactions.creditAmountMinor}),0)`.mapWith(
        Number
      ),
    })
    .from(transactions)
    .where(and(eq(transactions.accountId, arId), inArray(transactions.kind, [...AR_BALANCE_KINDS])));
  return Number(row?.v ?? 0);
}

/** 買掛管理と同じ範囲の買掛残高 */
export async function sumApBookBalanceMinor(db: Database, sys: SystemAccounts, book: ApBook): Promise<number> {
  const { apId } = resolveApAccounts(sys, book);
  const [row] = await db
    .select({
      v: sql<number>`coalesce(sum(${transactions.creditAmountMinor} - ${transactions.debitAmountMinor}),0)`.mapWith(
        Number
      ),
    })
    .from(transactions)
    .where(and(eq(transactions.accountId, apId), inArray(transactions.kind, [...AP_BALANCE_KINDS])));
  return Number(row?.v ?? 0);
}

export type ArBookLedgerRow = {
  transactionDate: string;
  kind: string;
  kindLabel: string;
  amountMinor: number;
  flow: "in" | "out";
  summary: string | null;
  customerName: string | null;
};

/** 売掛勘定の明細（日付昇順）— ダッシュボード確認用 */
export async function listArBookLedgerRows(
  db: Database,
  sys: SystemAccounts,
  book: ArBook,
  limit = 80
): Promise<ArBookLedgerRow[]> {
  const { arId } = resolveArAccounts(sys, book);
  const rows = await db
    .select({
      transactionDate: transactions.transactionDate,
      kind: transactions.kind,
      debitAmountMinor: transactions.debitAmountMinor,
      creditAmountMinor: transactions.creditAmountMinor,
      summary: transactions.summary,
      customerName: customers.name,
    })
    .from(transactions)
    .leftJoin(customers, eq(transactions.customerId, customers.id))
    .where(and(eq(transactions.accountId, arId), inArray(transactions.kind, [...AR_BALANCE_KINDS])))
    .orderBy(asc(transactions.transactionDate), asc(transactions.createdAt))
    .limit(limit);

  return rows.map((r) => {
    const isIn = r.kind === "ar_sale";
    const amountMinor = isIn ? r.debitAmountMinor : r.creditAmountMinor;
    return {
      transactionDate: r.transactionDate,
      kind: r.kind,
      kindLabel: isIn ? "売上" : "入金",
      amountMinor,
      flow: isIn ? "in" : "out",
      summary: r.summary,
      customerName: r.customerName,
    };
  });
}

/** 売掛勘定に紐づく売掛管理外の仕訳（要データ確認） */
export async function listArOrphanLedgerRows(db: Database, sys: SystemAccounts, book: ArBook) {
  const { arId } = resolveArAccounts(sys, book);
  return db
    .select({
      transactionDate: transactions.transactionDate,
      kind: transactions.kind,
      debitAmountMinor: transactions.debitAmountMinor,
      creditAmountMinor: transactions.creditAmountMinor,
      summary: transactions.summary,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, arId),
        sql`${transactions.kind} not in ('ar_sale','ar_payment')`
      )
    )
    .orderBy(asc(transactions.transactionDate), asc(transactions.createdAt));
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
