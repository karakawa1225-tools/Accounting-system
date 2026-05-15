"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, gt, isNotNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db";
import { accounts, customers, payees, transactions, vendors } from "@/db/schema";
import { getSystemAccounts } from "@/lib/system-accounts";

export type BankLedgerFilter = {
  month?: string;
  flow?: "all" | "in" | "out";
  bankAccountId?: string;
};

export type BankLedgerLine = {
  id: string;
  entryGroupId: string | null;
  transactionDate: string;
  flow: "in" | "out";
  amountMinor: number;
  counterparty: string | null;
  counterpartyKind: "customer" | "vendor" | "payee" | null;
  accountName: string;
  summary: string | null;
  kind: string;
};

export async function getBankBalanceMinor(bankAccountId?: string): Promise<number> {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const accountId = bankAccountId ?? sys.bankId;
  const [row] = await db
    .select({
      balance: sql<number>`coalesce(sum(${transactions.debitAmountMinor} - ${transactions.creditAmountMinor}),0)`.mapWith(Number),
    })
    .from(transactions)
    .where(eq(transactions.accountId, accountId));
  return Number(row?.balance ?? 0);
}

export async function getBankLedgerLines(filter: BankLedgerFilter = {}): Promise<BankLedgerLine[]> {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const bankAccountId = filter.bankAccountId ?? sys.bankId;
  const counterpart = alias(transactions, "bank_counterpart");
  const counterAcc = alias(accounts, "bank_counter_acc");

  const monthOk = Boolean(filter.month && /^\d{4}-\d{2}$/.test(filter.month!));
  const flow = filter.flow ?? "all";

  const filters = [
    eq(transactions.accountId, bankAccountId),
    ...(monthOk ? [sql`substr(${transactions.transactionDate},1,7) = ${filter.month}`] : []),
    ...(flow === "in"
      ? [gt(transactions.debitAmountMinor, 0)]
      : flow === "out"
        ? [gt(transactions.creditAmountMinor, 0)]
        : [or(gt(transactions.debitAmountMinor, 0), gt(transactions.creditAmountMinor, 0))]),
  ];

  const rows = await db
    .select({
      id: transactions.id,
      entryGroupId: transactions.entryGroupId,
      transactionDate: transactions.transactionDate,
      debitAmountMinor: transactions.debitAmountMinor,
      creditAmountMinor: transactions.creditAmountMinor,
      summary: transactions.summary,
      kind: transactions.kind,
      customerId: transactions.customerId,
      vendorId: transactions.vendorId,
      payeeId: transactions.payeeId,
      customerName: customers.name,
      vendorName: vendors.name,
      payeeName: payees.name,
      counterName: counterAcc.name,
    })
    .from(transactions)
    .leftJoin(
      counterpart,
      and(
        isNotNull(transactions.entryGroupId),
        eq(counterpart.entryGroupId, transactions.entryGroupId),
        ne(counterpart.id, transactions.id),
        ne(counterpart.accountId, bankAccountId)
      )
    )
    .leftJoin(counterAcc, eq(counterAcc.id, counterpart.accountId))
    .leftJoin(customers, eq(transactions.customerId, customers.id))
    .leftJoin(vendors, eq(transactions.vendorId, vendors.id))
    .leftJoin(payees, eq(transactions.payeeId, payees.id))
    .where(and(...filters))
    .orderBy(asc(transactions.transactionDate), asc(transactions.createdAt));

  return rows.map((r) => {
    const isIn = r.debitAmountMinor > 0;
    const amountMinor = isIn ? r.debitAmountMinor : r.creditAmountMinor;
    let counterparty: string | null = null;
    let counterpartyKind: "customer" | "vendor" | "payee" | null = null;
    if (r.customerName) {
      counterparty = r.customerName;
      counterpartyKind = "customer";
    } else if (r.payeeName) {
      counterparty = r.payeeName;
      counterpartyKind = "payee";
    } else if (r.vendorName) {
      counterparty = r.vendorName;
      counterpartyKind = "vendor";
    }
    const accountName = r.counterName ?? "—";
    return {
      id: r.id,
      entryGroupId: r.entryGroupId,
      transactionDate: r.transactionDate,
      flow: isIn ? "in" : "out",
      amountMinor,
      counterparty,
      counterpartyKind,
      accountName,
      summary: r.summary,
      kind: r.kind,
    };
  });
}

export async function registerBankMovement(input: {
  bankAccountId?: string;
  transactionDate: string;
  amountMinor: number;
  direction: "in" | "out";
  counterAccountId: string;
  summary: string | null;
  customerId: string | null;
  payeeId: string | null;
}) {
  const amount = Math.floor(input.amountMinor);
  if (!input.transactionDate) throw new Error("日付を入力してください");
  if (amount <= 0) throw new Error("金額は1円以上で入力してください");

  const db = getDb();
  const sys = await getSystemAccounts(db);
  const bankAccountId = input.bankAccountId ?? sys.bankId;
  const summary = input.summary?.trim() ? input.summary.trim() : null;

  if (input.direction === "in" && input.payeeId) throw new Error("入金時は支払先を選べません（任意メモは顧客のみ）");
  if (input.direction === "out" && input.customerId) throw new Error("出金時は顧客を選べません（任意メモは支払先のみ）");

  const counterId = input.counterAccountId;
  if (!counterId) throw new Error("勘定科目を選択してください");
  if (counterId === bankAccountId) throw new Error("勘定科目に選択中の銀行口座は選べません");

  const customerOnBank = input.direction === "in" ? input.customerId : null;
  const payeeOnBank = input.direction === "out" ? input.payeeId : null;

  const entryGroupId = crypto.randomUUID();
  if (input.direction === "in") {
    await db.insert(transactions).values([
      {
        entryGroupId,
        transactionDate: input.transactionDate,
        accountId: bankAccountId,
        customerId: customerOnBank,
        vendorId: null,
        payeeId: null,
        amountMinor: amount,
        debitAmountMinor: amount,
        creditAmountMinor: 0,
        summary,
        kind: "cash",
      },
      {
        entryGroupId,
        transactionDate: input.transactionDate,
        accountId: counterId,
        customerId: null,
        vendorId: null,
        payeeId: null,
        amountMinor: amount,
        debitAmountMinor: 0,
        creditAmountMinor: amount,
        summary,
        kind: "cash",
      },
    ]);
  } else {
    await db.insert(transactions).values([
      {
        entryGroupId,
        transactionDate: input.transactionDate,
        accountId: counterId,
        customerId: null,
        vendorId: null,
        payeeId: null,
        amountMinor: amount,
        debitAmountMinor: amount,
        creditAmountMinor: 0,
        summary,
        kind: "cash",
      },
      {
        entryGroupId,
        transactionDate: input.transactionDate,
        accountId: bankAccountId,
        customerId: null,
        vendorId: null,
        payeeId: payeeOnBank,
        amountMinor: amount,
        debitAmountMinor: 0,
        creditAmountMinor: amount,
        summary,
        kind: "cash",
      },
    ]);
  }

  revalidatePath("/admin/bank-transactions");
  revalidatePath("/admin/bank-transactions/monthly-pdf");
  revalidatePath("/dashboard");
}
