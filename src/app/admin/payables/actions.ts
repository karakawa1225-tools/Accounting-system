"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { apAllocations, transactions, vendors } from "@/db/schema";
import {
  apAllocationTargetMinor,
  parseTransferFeeBearer,
  type TransferFeeBearer,
} from "@/lib/payment-transfer-fee";
import { getSystemAccounts } from "@/lib/system-accounts";

export async function registerApPurchase(formData: FormData) {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const vendorId = String(formData.get("vendorId") ?? "");
  const transactionDate = String(formData.get("transactionDate") ?? "");
  const amountMinor = Math.floor(Number(formData.get("amountMinor") ?? 0));
  const summary = String(formData.get("summary") ?? "") || null;
  if (!vendorId) throw new Error("仕入先を選択してください");
  if (!transactionDate) throw new Error("仕入日を入力してください");
  if (amountMinor <= 0) throw new Error("金額は1円以上で入力してください");
  const entryGroupId = crypto.randomUUID();
  await db.insert(transactions).values([
    { entryGroupId, transactionDate, accountId: sys.purchasesId, vendorId, amountMinor, debitAmountMinor: amountMinor, creditAmountMinor: 0, summary, kind: "ap_purchase" },
    { entryGroupId, transactionDate, accountId: sys.apId, vendorId, amountMinor, debitAmountMinor: 0, creditAmountMinor: amountMinor, summary, kind: "ap_purchase" },
  ]);
  revalidatePath("/admin/payables");
}

export async function getApRecentLines(limit = 120) {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const rows = await db
    .select({
      id: transactions.id,
      entryGroupId: transactions.entryGroupId,
      transactionDate: transactions.transactionDate,
      vendorId: transactions.vendorId,
      vendorName: vendors.name,
      kind: transactions.kind,
      debitAmountMinor: transactions.debitAmountMinor,
      creditAmountMinor: transactions.creditAmountMinor,
      summary: transactions.summary,
      createdAt: transactions.createdAt,
      allocationCount:
        sql<number>`(select count(*) from ${apAllocations} where ${apAllocations.purchaseApCreditTransactionId} = ${transactions.id})`.mapWith(
          Number
        ),
    })
    .from(transactions)
    .leftJoin(vendors, eq(transactions.vendorId, vendors.id))
    .where(
      and(
        eq(transactions.accountId, sys.apId),
        isNotNull(transactions.vendorId),
        sql`${transactions.kind} in ('ap_purchase','ap_payment')`
      )
    )
    .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
    .limit(limit);
  return rows.map((r) => {
    const { allocationCount, debitAmountMinor, creditAmountMinor, ...rest } = r;
    return {
      ...rest,
      amountMinor: r.kind === "ap_purchase" ? creditAmountMinor : debitAmountMinor,
      purchaseAllocationLocked: r.kind === "ap_purchase" ? allocationCount > 0 : false,
    };
  });
}

export async function deleteApHistoryLine(transactionId: string) {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const [row] = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!row || row.accountId !== sys.apId || !row.entryGroupId) throw new Error("対象の買掛履歴が見つかりません");

  if (row.kind === "ap_purchase") {
    if (row.creditAmountMinor <= 0) throw new Error("仕入行の形式が不正です");
    const [alloc] = await db.select().from(apAllocations).where(eq(apAllocations.purchaseApCreditTransactionId, transactionId)).limit(1);
    if (alloc) throw new Error("支払で消込済みの仕入は削除できません。該当する支払を先に削除してください。");
    await db.delete(transactions).where(eq(transactions.entryGroupId, row.entryGroupId));
  } else if (row.kind === "ap_payment") {
    if (row.debitAmountMinor <= 0) throw new Error("支払行の形式が不正です");
    await db.delete(apAllocations).where(eq(apAllocations.paymentApDebitTransactionId, transactionId));
    await db.delete(transactions).where(eq(transactions.entryGroupId, row.entryGroupId));
  } else {
    throw new Error("この区分は削除できません");
  }

  revalidatePath("/admin/payables");
  revalidatePath("/admin/bank-transactions");
  revalidatePath("/dashboard");
}

export async function updateApHistoryLine(
  transactionId: string,
  input: { transactionDate: string; summary: string | null; amountMinor?: number; vendorId?: string }
) {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const [row] = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!row || row.accountId !== sys.apId || !row.entryGroupId) throw new Error("対象の買掛履歴が見つかりません");

  const date = String(input.transactionDate ?? "").trim();
  if (!date) throw new Error("日付を入力してください");
  const summary = input.summary?.trim() ? input.summary.trim() : null;
  const eg = row.entryGroupId;

  if (row.kind === "ap_purchase") {
    const [alloc] = await db.select().from(apAllocations).where(eq(apAllocations.purchaseApCreditTransactionId, transactionId)).limit(1);
    if (alloc) {
      await db.update(transactions).set({ transactionDate: date, summary, updatedAt: new Date() }).where(eq(transactions.entryGroupId, eg));
      revalidatePath("/admin/payables");
      revalidatePath("/admin/bank-transactions");
      revalidatePath("/dashboard");
      return;
    }

    const amount = Math.floor(input.amountMinor ?? row.creditAmountMinor ?? 0);
    if (amount <= 0) throw new Error("金額は1円以上にしてください");
    const vendorId = String(input.vendorId ?? row.vendorId ?? "").trim();
    if (!vendorId) throw new Error("仕入先を選択してください");

    await db
      .update(transactions)
      .set({
        transactionDate: date,
        summary,
        vendorId,
        debitAmountMinor: amount,
        creditAmountMinor: 0,
        amountMinor: amount,
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.entryGroupId, eg), eq(transactions.accountId, sys.purchasesId)));

    await db
      .update(transactions)
      .set({
        transactionDate: date,
        summary,
        vendorId,
        debitAmountMinor: 0,
        creditAmountMinor: amount,
        amountMinor: amount,
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.entryGroupId, eg), eq(transactions.accountId, sys.apId)));

    revalidatePath("/admin/payables");
    revalidatePath("/admin/bank-transactions");
    revalidatePath("/dashboard");
    return;
  }

  if (row.kind === "ap_payment") {
    await db.update(transactions).set({ transactionDate: date, summary, updatedAt: new Date() }).where(eq(transactions.entryGroupId, eg));
    revalidatePath("/admin/payables");
    revalidatePath("/admin/bank-transactions");
    revalidatePath("/dashboard");
    return;
  }

  throw new Error("この区分は編集できません");
}

export async function getMonthlyApPaymentLines(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("月指定が不正です");
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const rows = await db
    .select({
      transactionDate: transactions.transactionDate,
      vendorCode: vendors.code,
      vendorName: vendors.name,
      amountMinor: transactions.debitAmountMinor,
      summary: transactions.summary,
    })
    .from(transactions)
    .leftJoin(vendors, eq(transactions.vendorId, vendors.id))
    .where(
      and(
        eq(transactions.accountId, sys.apId),
        eq(transactions.kind, "ap_payment"),
        sql`substr(${transactions.transactionDate},1,7) = ${month}`
      )
    )
    .orderBy(asc(transactions.transactionDate), asc(vendors.code), asc(vendors.name));
  const totalMinor = rows.reduce((s, r) => s + r.amountMinor, 0);
  return { month, rows, totalMinor };
}

/** 仕入先への月別支払一覧（振込先銀行・支店付き） */
export async function getMonthlyVendorPaymentLines(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("月指定が不正です");
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const rows = await db
    .select({
      transactionDate: transactions.transactionDate,
      vendorCode: vendors.code,
      vendorName: vendors.name,
      bankName: vendors.bankName,
      branchName: vendors.branchName,
      accountType: vendors.accountType,
      accountNumber: vendors.accountNumber,
      amountMinor: transactions.debitAmountMinor,
      summary: transactions.summary,
    })
    .from(transactions)
    .leftJoin(vendors, eq(transactions.vendorId, vendors.id))
    .where(
      and(
        eq(transactions.accountId, sys.apId),
        eq(transactions.kind, "ap_payment"),
        sql`substr(${transactions.transactionDate},1,7) = ${month}`
      )
    )
    .orderBy(asc(transactions.transactionDate), asc(vendors.code), asc(vendors.name));
  const totalMinor = rows.reduce((s, r) => s + r.amountMinor, 0);
  return { month, rows, totalMinor };
}

export async function getPayableBalances() {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const allVendors = await db.select().from(vendors).orderBy(asc(vendors.code), asc(vendors.name));
  const rows = await db
    .select({
      vendorId: transactions.vendorId,
      balance: sql<number>`coalesce(sum(${transactions.creditAmountMinor} - ${transactions.debitAmountMinor}),0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.accountId, sys.apId), isNotNull(transactions.vendorId)))
    .groupBy(transactions.vendorId);
  const map = new Map(rows.map((r) => [r.vendorId, Number(r.balance)]));
  return allVendors.map((v) => ({ id: v.id, name: v.name, balanceMinor: map.get(v.id) ?? 0 }));
}

export type ApOpenLine = {
  id: string;
  transactionDate: string;
  summary: string | null;
  originalMinor: number;
  openMinor: number;
};

export async function getApOpenLines(vendorId: string): Promise<ApOpenLine[]> {
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const purchaseTx = await db
    .select({
      id: transactions.id,
      transactionDate: transactions.transactionDate,
      creditAmountMinor: transactions.creditAmountMinor,
      summary: transactions.summary,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.vendorId, vendorId),
        eq(transactions.accountId, sys.apId),
        eq(transactions.kind, "ap_purchase"),
        gt(transactions.creditAmountMinor, 0)
      )
    )
    .orderBy(asc(transactions.transactionDate), asc(transactions.id));

  const allocSums = await db
    .select({
      purchaseId: apAllocations.purchaseApCreditTransactionId,
      allocated: sql<number>`coalesce(sum(${apAllocations.amountMinor}),0)`.mapWith(Number),
    })
    .from(apAllocations)
    .where(eq(apAllocations.vendorId, vendorId))
    .groupBy(apAllocations.purchaseApCreditTransactionId);
  const allocMap = new Map(allocSums.map((a) => [a.purchaseId, Number(a.allocated)]));

  return purchaseTx
    .map((t) => {
      const allocated = allocMap.get(t.id) ?? 0;
      const openMinor = t.creditAmountMinor - allocated;
      return {
        id: t.id,
        transactionDate: t.transactionDate,
        summary: t.summary,
        originalMinor: t.creditAmountMinor,
        openMinor,
      };
    })
    .filter((x) => x.openMinor > 0);
}

export async function registerApPayment(input: {
  vendorId: string;
  transactionDate: string;
  summary: string | null;
  /** 振込支払額（銀行から出金した額） */
  transferMinor: number;
  transferFeeMinor: number;
  feeBearer: TransferFeeBearer;
  allocations: { purchaseApCreditTransactionId: string; amountMinor: number }[];
}) {
  const transfer = Math.floor(input.transferMinor);
  const fee = Math.max(0, Math.floor(input.transferFeeMinor || 0));
  const bearer = parseTransferFeeBearer(input.feeBearer);
  const allocTarget = apAllocationTargetMinor(transfer, fee, bearer);
  if (!input.vendorId) throw new Error("仕入先を選択してください");
  if (!input.transactionDate) throw new Error("日付を入力してください");
  if (transfer <= 0) throw new Error("支払額は1円以上にしてください");
  if (bearer === "counterparty" && fee > transfer) throw new Error("手数料が支払額を超えています");
  const sumAlloc = input.allocations.reduce((s, a) => s + Math.floor(a.amountMinor), 0);
  if (sumAlloc !== allocTarget) {
    throw new Error(
      `消込合計（${sumAlloc}円）が消込対象額（${allocTarget}円）と一致しません` +
        (bearer === "counterparty" && fee > 0 ? "（貴社負担: 支払額−手数料）" : "")
    );
  }

  const db = getDb();
  const sys = await getSystemAccounts(db);
  const openLines = await getApOpenLines(input.vendorId);
  const openMap = new Map(openLines.map((l) => [l.id, l.openMinor]));

  for (const a of input.allocations) {
    const amt = Math.floor(a.amountMinor);
    if (amt <= 0) continue;
    const open = openMap.get(a.purchaseApCreditTransactionId);
    if (open == null) throw new Error("対象外の買掛行が含まれています");
    if (amt > open) throw new Error("消込額が未払残高を超えています");
  }

  const entryGroupId = crypto.randomUUID();
  const apDebitId = crypto.randomUUID();
  const bankId = crypto.randomUUID();
  const feeMeta = {
    transferFeeMinor: fee > 0 ? fee : null,
    feeBearer: bearer,
  };

  await db.transaction(async (tx) => {
    const rows: (typeof transactions.$inferInsert)[] = [
      {
        id: apDebitId,
        entryGroupId,
        transactionDate: input.transactionDate,
        accountId: sys.apId,
        vendorId: input.vendorId,
        amountMinor: allocTarget,
        debitAmountMinor: allocTarget,
        creditAmountMinor: 0,
        summary: input.summary,
        kind: "ap_payment",
        ...feeMeta,
      },
      {
        id: bankId,
        entryGroupId,
        transactionDate: input.transactionDate,
        accountId: sys.bankId,
        vendorId: input.vendorId,
        amountMinor: transfer,
        debitAmountMinor: 0,
        creditAmountMinor: transfer,
        summary: input.summary,
        kind: "ap_payment",
        ...feeMeta,
      },
    ];
    if (fee > 0 && bearer === "counterparty") {
      rows.push({
        entryGroupId,
        transactionDate: input.transactionDate,
        accountId: sys.bankFeeId,
        vendorId: input.vendorId,
        amountMinor: fee,
        debitAmountMinor: fee,
        creditAmountMinor: 0,
        summary: input.summary,
        kind: "ap_payment",
        ...feeMeta,
      });
    }
    await tx.insert(transactions).values(rows);
    for (const a of input.allocations) {
      const amt = Math.floor(a.amountMinor);
      if (amt <= 0) continue;
      await tx.insert(apAllocations).values({
        vendorId: input.vendorId,
        paymentApDebitTransactionId: apDebitId,
        purchaseApCreditTransactionId: a.purchaseApCreditTransactionId,
        amountMinor: amt,
      });
    }
  });

  revalidatePath("/admin/payables");
  revalidatePath("/admin/bank-transactions");
}
