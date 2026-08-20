"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, gt, isNotNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db";
import { accounts, customers, payees, transactions, vendors } from "@/db/schema";
import { getSystemAccounts } from "@/lib/system-accounts";
import { transactionDateInMonth } from "@/lib/transaction-month-filter";

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
  counterAccountId: string | null;
  customerId: string | null;
  payeeId: string | null;
  summary: string | null;
  kind: string;
};

export type BankMovementInput = {
  bankAccountId?: string;
  transactionDate: string;
  amountMinor: number;
  direction: "in" | "out";
  counterAccountId: string;
  summary: string | null;
  customerId: string | null;
  payeeId: string | null;
};

function revalidateBankPaths() {
  revalidatePath("/admin/bank-transactions");
  revalidatePath("/admin/bank-transactions/monthly-pdf");
  revalidatePath("/admin/exports/bank-monthly");
  revalidatePath("/dashboard");
}

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
    ...(monthOk ? [transactionDateInMonth(transactions.transactionDate, filter.month!)] : []),
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
      counterAccountId: counterpart.accountId,
      bankCustomerId: transactions.customerId,
      bankPayeeId: transactions.payeeId,
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
      counterAccountId: r.counterAccountId,
      customerId: r.bankCustomerId,
      payeeId: r.bankPayeeId,
      summary: r.summary,
      kind: r.kind,
    };
  });
}

async function assertBankMovementInput(input: BankMovementInput, bankAccountId: string) {
  const amount = Math.floor(input.amountMinor);
  if (!input.transactionDate) throw new Error("日付を入力してください");
  if (amount <= 0) throw new Error("金額は1円以上で入力してください");
  if (input.direction === "in" && input.payeeId) throw new Error("入金時は支払先を選べません（任意メモは顧客のみ）");
  if (input.direction === "out" && input.customerId) throw new Error("出金時は顧客を選べません（任意メモは支払先のみ）");
  const counterId = input.counterAccountId;
  if (!counterId) throw new Error("勘定科目を選択してください");
  if (counterId === bankAccountId) throw new Error("勘定科目に選択中の銀行口座は選べません");
  return { amount, summary: input.summary?.trim() ? input.summary.trim() : null, counterId };
}

type InsertBankMovementOpts = {
  /** 編集時に一覧の並び（日付→作成日時）を変えないため、元の createdAt を引き継ぐ */
  createdAt?: Date;
  /** 銀行側行の ID を維持（編集後も同じ行として見えるように） */
  bankRowId?: string;
  counterRowId?: string;
};

async function insertBankMovementPair(
  db: ReturnType<typeof getDb>,
  entryGroupId: string,
  bankAccountId: string,
  input: BankMovementInput,
  opts: InsertBankMovementOpts = {}
) {
  const { amount, summary, counterId } = await assertBankMovementInput(input, bankAccountId);
  const customerOnBank = input.direction === "in" ? input.customerId : null;
  const payeeOnBank = input.direction === "out" ? input.payeeId : null;
  const createdAt = opts.createdAt;
  const bankId = opts.bankRowId;
  const counterIdRow = opts.counterRowId;

  if (input.direction === "in") {
    await db.insert(transactions).values([
      {
        ...(bankId ? { id: bankId } : {}),
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
        ...(createdAt ? { createdAt } : {}),
      },
      {
        ...(counterIdRow ? { id: counterIdRow } : {}),
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
        ...(createdAt ? { createdAt } : {}),
      },
    ]);
  } else {
    await db.insert(transactions).values([
      {
        ...(counterIdRow ? { id: counterIdRow } : {}),
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
        ...(createdAt ? { createdAt } : {}),
      },
      {
        ...(bankId ? { id: bankId } : {}),
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
        ...(createdAt ? { createdAt } : {}),
      },
    ]);
  }
}

async function getEditableBankCashRow(db: ReturnType<typeof getDb>, bankTransactionId: string, bankAccountId: string) {
  const [row] = await db.select().from(transactions).where(eq(transactions.id, bankTransactionId)).limit(1);
  if (!row || row.accountId !== bankAccountId || row.kind !== "cash" || !row.entryGroupId) {
    throw new Error("編集できる入出金が見つかりません");
  }
  return row;
}

export async function registerBankMovement(input: BankMovementInput) {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const bankAccountId = input.bankAccountId ?? sys.bankId;
  const entryGroupId = crypto.randomUUID();
  await insertBankMovementPair(db, entryGroupId, bankAccountId, input);
  revalidateBankPaths();
}

export async function updateBankCashMovement(bankTransactionId: string, input: BankMovementInput) {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const bankAccountId = input.bankAccountId ?? sys.bankId;
  const row = await getEditableBankCashRow(db, bankTransactionId, bankAccountId);
  const entryGroupId = row.entryGroupId!;
  const groupRows = await db.select().from(transactions).where(eq(transactions.entryGroupId, entryGroupId));
  const bankRow = groupRows.find((r) => r.accountId === bankAccountId) ?? row;
  const counterRow = groupRows.find((r) => r.id !== bankRow.id && r.accountId !== bankAccountId);
  // 一覧は transactionDate → createdAt 順。編集で作り直しても並びが動かないよう元値を保持する
  await db.delete(transactions).where(eq(transactions.entryGroupId, entryGroupId));
  await insertBankMovementPair(db, entryGroupId, bankAccountId, input, {
    createdAt: bankRow.createdAt,
    bankRowId: bankRow.id,
    counterRowId: counterRow?.id,
  });
  revalidateBankPaths();
}

export async function deleteBankCashMovement(bankTransactionId: string, bankAccountId?: string) {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const accountId = bankAccountId ?? sys.bankId;
  const row = await getEditableBankCashRow(db, bankTransactionId, accountId);
  await db.delete(transactions).where(eq(transactions.entryGroupId, row.entryGroupId!));
  revalidateBankPaths();
}
