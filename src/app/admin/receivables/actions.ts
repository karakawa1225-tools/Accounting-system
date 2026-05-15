"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { arAllocations, customers, transactions } from "@/db/schema";
import { getSystemAccounts } from "@/lib/system-accounts";

export async function registerArSale(formData: FormData) {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const customerId = String(formData.get("customerId") ?? "");
  const transactionDate = String(formData.get("transactionDate") ?? "");
  const amountMinor = Math.floor(Number(formData.get("amountMinor") ?? 0));
  const summary = String(formData.get("summary") ?? "") || null;
  if (!customerId) throw new Error("顧客を選択してください");
  if (!transactionDate) throw new Error("売上日を入力してください");
  if (amountMinor <= 0) throw new Error("金額は1円以上で入力してください");
  const entryGroupId = crypto.randomUUID();
  await db.insert(transactions).values([
    { entryGroupId, transactionDate, accountId: sys.arId, customerId, amountMinor, debitAmountMinor: amountMinor, creditAmountMinor: 0, summary, kind: "ar_sale" },
    { entryGroupId, transactionDate, accountId: sys.salesId, amountMinor, debitAmountMinor: 0, creditAmountMinor: amountMinor, summary, kind: "ar_sale" },
  ]);
  revalidatePath("/admin/receivables");
}

export async function getArRecentLines(limit = 120) {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const rows = await db
    .select({
      id: transactions.id,
      entryGroupId: transactions.entryGroupId,
      transactionDate: transactions.transactionDate,
      customerId: transactions.customerId,
      customerName: customers.name,
      kind: transactions.kind,
      debitAmountMinor: transactions.debitAmountMinor,
      creditAmountMinor: transactions.creditAmountMinor,
      summary: transactions.summary,
      createdAt: transactions.createdAt,
      allocationCount:
        sql<number>`(select count(*) from ${arAllocations} where ${arAllocations.salesArDebitTransactionId} = ${transactions.id})`.mapWith(
          Number
        ),
    })
    .from(transactions)
    .leftJoin(customers, eq(transactions.customerId, customers.id))
    .where(
      and(
        eq(transactions.accountId, sys.arId),
        isNotNull(transactions.customerId),
        sql`${transactions.kind} in ('ar_sale','ar_payment')`
      )
    )
    .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
    .limit(limit);
  return rows.map((r) => {
    const { allocationCount, debitAmountMinor, creditAmountMinor, ...rest } = r;
    return {
      ...rest,
      amountMinor: r.kind === "ar_sale" ? debitAmountMinor : creditAmountMinor,
      saleAllocationLocked: r.kind === "ar_sale" ? allocationCount > 0 : false,
    };
  });
}

export async function deleteArHistoryLine(transactionId: string) {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const [row] = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!row || row.accountId !== sys.arId || !row.entryGroupId) throw new Error("対象の売掛履歴が見つかりません");

  if (row.kind === "ar_sale") {
    if (row.debitAmountMinor <= 0) throw new Error("売上行の形式が不正です");
    const [alloc] = await db.select().from(arAllocations).where(eq(arAllocations.salesArDebitTransactionId, transactionId)).limit(1);
    if (alloc) throw new Error("入金で消込済みの売上は削除できません。該当する入金を先に削除してください。");
    await db.delete(transactions).where(eq(transactions.entryGroupId, row.entryGroupId));
  } else if (row.kind === "ar_payment") {
    if (row.creditAmountMinor <= 0) throw new Error("入金行の形式が不正です");
    await db.delete(arAllocations).where(eq(arAllocations.paymentArCreditTransactionId, transactionId));
    await db.delete(transactions).where(eq(transactions.entryGroupId, row.entryGroupId));
  } else {
    throw new Error("この区分は削除できません");
  }

  revalidatePath("/admin/receivables");
  revalidatePath("/admin/bank-transactions");
  revalidatePath("/dashboard");
}

export async function updateArHistoryLine(
  transactionId: string,
  input: { transactionDate: string; summary: string | null; amountMinor?: number; customerId?: string }
) {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const [row] = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!row || row.accountId !== sys.arId || !row.entryGroupId) throw new Error("対象の売掛履歴が見つかりません");

  const date = String(input.transactionDate ?? "").trim();
  if (!date) throw new Error("日付を入力してください");
  const summary = input.summary?.trim() ? input.summary.trim() : null;
  const eg = row.entryGroupId;

  if (row.kind === "ar_sale") {
    const [alloc] = await db.select().from(arAllocations).where(eq(arAllocations.salesArDebitTransactionId, transactionId)).limit(1);
    if (alloc) {
      await db
        .update(transactions)
        .set({ transactionDate: date, summary, updatedAt: new Date() })
        .where(eq(transactions.entryGroupId, eg));
      revalidatePath("/admin/receivables");
      revalidatePath("/admin/bank-transactions");
      revalidatePath("/dashboard");
      return;
    }

    const amount = Math.floor(input.amountMinor ?? row.debitAmountMinor ?? 0);
    if (amount <= 0) throw new Error("金額は1円以上にしてください");
    const customerId = String(input.customerId ?? row.customerId ?? "").trim();
    if (!customerId) throw new Error("顧客を選択してください");

    await db
      .update(transactions)
      .set({
        transactionDate: date,
        summary,
        customerId,
        debitAmountMinor: amount,
        creditAmountMinor: 0,
        amountMinor: amount,
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.entryGroupId, eg), eq(transactions.accountId, sys.arId)));

    await db
      .update(transactions)
      .set({
        transactionDate: date,
        summary,
        debitAmountMinor: 0,
        creditAmountMinor: amount,
        amountMinor: amount,
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.entryGroupId, eg), eq(transactions.accountId, sys.salesId)));

    revalidatePath("/admin/receivables");
    revalidatePath("/admin/bank-transactions");
    revalidatePath("/dashboard");
    return;
  }

  if (row.kind === "ar_payment") {
    await db
      .update(transactions)
      .set({ transactionDate: date, summary, updatedAt: new Date() })
      .where(eq(transactions.entryGroupId, eg));
    revalidatePath("/admin/receivables");
    revalidatePath("/admin/bank-transactions");
    revalidatePath("/dashboard");
    return;
  }

  throw new Error("この区分は編集できません");
}

export async function getMonthlyArPaymentLines(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("月指定が不正です");
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const rows = await db
    .select({
      transactionDate: transactions.transactionDate,
      customerCode: customers.code,
      customerName: customers.name,
      amountMinor: transactions.creditAmountMinor,
      summary: transactions.summary,
    })
    .from(transactions)
    .leftJoin(customers, eq(transactions.customerId, customers.id))
    .where(
      and(
        eq(transactions.accountId, sys.arId),
        eq(transactions.kind, "ar_payment"),
        sql`substr(${transactions.transactionDate},1,7) = ${month}`
      )
    )
    .orderBy(asc(transactions.transactionDate), asc(customers.code), asc(customers.name));
  const totalMinor = rows.reduce((s, r) => s + r.amountMinor, 0);
  return { month, rows, totalMinor };
}

export async function getReceivableBalances() {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const allCustomers = await db.select().from(customers).orderBy(asc(customers.code), asc(customers.name));
  const rows = await db
    .select({
      customerId: transactions.customerId,
      balance: sql<number>`coalesce(sum(${transactions.debitAmountMinor} - ${transactions.creditAmountMinor}),0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.accountId, sys.arId), isNotNull(transactions.customerId)))
    .groupBy(transactions.customerId);
  const map = new Map(rows.map((r) => [r.customerId, Number(r.balance)]));
  return allCustomers.map((c) => ({ id: c.id, name: c.name, balanceMinor: map.get(c.id) ?? 0 }));
}

export type ArOpenLine = {
  id: string;
  transactionDate: string;
  summary: string | null;
  originalMinor: number;
  openMinor: number;
};

export async function getArOpenLines(customerId: string): Promise<ArOpenLine[]> {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const salesTx = await db
    .select({
      id: transactions.id,
      transactionDate: transactions.transactionDate,
      debitAmountMinor: transactions.debitAmountMinor,
      summary: transactions.summary,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.customerId, customerId),
        eq(transactions.accountId, sys.arId),
        eq(transactions.kind, "ar_sale"),
        gt(transactions.debitAmountMinor, 0)
      )
    )
    .orderBy(asc(transactions.transactionDate), asc(transactions.id));

  const allocSums = await db
    .select({
      salesId: arAllocations.salesArDebitTransactionId,
      allocated: sql<number>`coalesce(sum(${arAllocations.amountMinor}),0)`.mapWith(Number),
    })
    .from(arAllocations)
    .where(eq(arAllocations.customerId, customerId))
    .groupBy(arAllocations.salesArDebitTransactionId);
  const allocMap = new Map(allocSums.map((a) => [a.salesId, Number(a.allocated)]));

  return salesTx
    .map((t) => {
      const allocated = allocMap.get(t.id) ?? 0;
      const openMinor = t.debitAmountMinor - allocated;
      return {
        id: t.id,
        transactionDate: t.transactionDate,
        summary: t.summary,
        originalMinor: t.debitAmountMinor,
        openMinor,
      };
    })
    .filter((x) => x.openMinor > 0);
}

export async function registerArPayment(input: {
  customerId: string;
  transactionDate: string;
  summary: string | null;
  totalMinor: number;
  allocations: { salesArDebitTransactionId: string; amountMinor: number }[];
}) {
  const total = Math.floor(input.totalMinor);
  if (!input.customerId) throw new Error("顧客を選択してください");
  if (!input.transactionDate) throw new Error("日付を入力してください");
  if (total <= 0) throw new Error("入金額は1円以上にしてください");
  const sumAlloc = input.allocations.reduce((s, a) => s + Math.floor(a.amountMinor), 0);
  if (sumAlloc !== total) throw new Error(`消込合計（${sumAlloc}円）が入金額（${total}円）と一致しません`);

  const db = getDb();
  const sys = await getSystemAccounts(db);
  const openLines = await getArOpenLines(input.customerId);
  const openMap = new Map(openLines.map((l) => [l.id, l.openMinor]));

  for (const a of input.allocations) {
    const amt = Math.floor(a.amountMinor);
    if (amt <= 0) continue;
    const open = openMap.get(a.salesArDebitTransactionId);
    if (open == null) throw new Error("対象外の売掛行が含まれています");
    if (amt > open) throw new Error("消込額が未消込残高を超えています");
  }

  const entryGroupId = crypto.randomUUID();
  const bankId = crypto.randomUUID();
  const arCreditId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(transactions).values([
      {
        id: bankId,
        entryGroupId,
        transactionDate: input.transactionDate,
        accountId: sys.bankId,
        customerId: input.customerId,
        amountMinor: total,
        debitAmountMinor: total,
        creditAmountMinor: 0,
        summary: input.summary,
        kind: "ar_payment",
      },
      {
        id: arCreditId,
        entryGroupId,
        transactionDate: input.transactionDate,
        accountId: sys.arId,
        customerId: input.customerId,
        amountMinor: total,
        debitAmountMinor: 0,
        creditAmountMinor: total,
        summary: input.summary,
        kind: "ar_payment",
      },
    ]);
    for (const a of input.allocations) {
      const amt = Math.floor(a.amountMinor);
      if (amt <= 0) continue;
      await tx.insert(arAllocations).values({
        customerId: input.customerId,
        paymentArCreditTransactionId: arCreditId,
        salesArDebitTransactionId: a.salesArDebitTransactionId,
        amountMinor: amt,
      });
    }
  });

  revalidatePath("/admin/receivables");
  revalidatePath("/admin/bank-transactions");
}
