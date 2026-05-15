"use server";

import { revalidatePath } from "next/cache";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb as openDb } from "@/db";
import { accounts, bizgoExpenseLines, bizgoTripExpenseLines } from "@/db/schema";
import { resolveAccountIdFromBizgoCategory } from "@/lib/bizgo-account-map";
import { ensureBizgoTablesAtRuntime } from "@/lib/bizgo-bootstrap";
import { normalizeBizgoMonth, normalizeDate, parseYenAmount, pickField } from "@/lib/bizgo-parse";
import { parseCsvWithHeader } from "@/lib/parse-csv";

const BIZGO_PATH = "/admin/bizgo";

async function getDb() {
  const db = openDb();
  await ensureBizgoTablesAtRuntime(db);
  return db;
}

export type BizgoExpenseRow = {
  id: string;
  settlementMonth: string;
  subject: string | null;
  detailDate: string | null;
  categoryLabel: string;
  accountId: string | null;
  accountName: string | null;
  accountCode: string | null;
  amountInclTaxMinor: number;
  taxCategory: string | null;
  amountExclTaxMinor: number;
  taxAmountMinor: number;
  summary: string | null;
  hasReceipt: string | null;
  invoiceFlag: string | null;
  registrationNumber: string | null;
};

export type BizgoTripRow = {
  id: string;
  targetMonth: string;
  subject: string | null;
  tripStartDate: string | null;
  tripEndDate: string | null;
  tripDays: string | null;
  oneWayDistanceKm: string | null;
  lodging: string | null;
  dailyAllowanceTotalMinor: number;
  detailDate: string | null;
  categoryLabel: string;
  accountId: string | null;
  accountName: string | null;
  accountCode: string | null;
  amountInclTaxMinor: number;
  taxCategory: string | null;
  amountExclTaxMinor: number;
  taxAmountMinor: number;
  summary: string | null;
  hasReceipt: string | null;
  invoiceFlag: string | null;
  registrationNumber: string | null;
};

async function attachAccountNames<T extends { accountId: string | null }>(
  db: Awaited<ReturnType<typeof getDb>>,
  rows: T[]
): Promise<(T & { accountName: string | null; accountCode: string | null })[]> {
  const ids = [...new Set(rows.map((r) => r.accountId).filter(Boolean))] as string[];
  if (!ids.length) return rows.map((r) => ({ ...r, accountName: null, accountCode: null }));
  const accs = await db.select({ id: accounts.id, name: accounts.name, code: accounts.code }).from(accounts).where(inArray(accounts.id, ids));
  const map = new Map(accs.map((a) => [a.id, a]));
  return rows.map((r) => {
    const a = r.accountId ? map.get(r.accountId) : undefined;
    return { ...r, accountName: a?.name ?? null, accountCode: a?.code ?? null };
  });
}

export async function getBizgoExpenseLines(): Promise<BizgoExpenseRow[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(bizgoExpenseLines)
    .orderBy(desc(bizgoExpenseLines.settlementMonth), asc(bizgoExpenseLines.detailDate), asc(bizgoExpenseLines.categoryLabel));
  return attachAccountNames(db, rows);
}

export async function getBizgoTripExpenseLines(): Promise<BizgoTripRow[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(bizgoTripExpenseLines)
    .orderBy(desc(bizgoTripExpenseLines.targetMonth), asc(bizgoTripExpenseLines.tripStartDate), asc(bizgoTripExpenseLines.detailDate));
  return attachAccountNames(db, rows);
}

export type BizgoImportResult = {
  imported: number;
  skipped: number;
  unmappedCategories: string[];
  months: string[];
};

export async function importBizgoExpenseCsv(formData: FormData): Promise<BizgoImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("CSVファイルを選択してください");
  const replaceExistingMonths = formData.get("replaceExisting") !== "0";

  const { rows: csvRows } = parseCsvWithHeader(await file.text());
  if (csvRows.length === 0) throw new Error("データ行がありません");

  const db = await getDb();
  const batchId = crypto.randomUUID();
  const now = new Date();
  const unmapped = new Set<string>();
  const months = new Set<string>();
  let skipped = 0;

  type Pending = (typeof bizgoExpenseLines.$inferInsert)[];
  const pending: Pending = [];
  const accountCache = new Map<string, string | null>();

  for (const row of csvRows) {
    const categoryLabel = pickField(row, "区分");
    const month = normalizeBizgoMonth(pickField(row, "精算月"));
    if (!month || !categoryLabel) {
      skipped++;
      continue;
    }
    months.add(month);

    let accountId = accountCache.get(categoryLabel);
    if (accountId === undefined) {
      accountId = await resolveAccountIdFromBizgoCategory(db, categoryLabel);
      accountCache.set(categoryLabel, accountId);
    }
    if (!accountId) unmapped.add(categoryLabel);

    pending.push({
      importBatchId: batchId,
      settlementMonth: month,
      subject: pickField(row, "件名") || null,
      detailDate: normalizeDate(pickField(row, "明細日付")),
      categoryLabel,
      accountId,
      amountInclTaxMinor: parseYenAmount(pickField(row, "金額（税込）", "金額(税込)")),
      taxCategory: pickField(row, "消費税区分") || null,
      amountExclTaxMinor: parseYenAmount(pickField(row, "消費税別金額")),
      taxAmountMinor: parseYenAmount(pickField(row, "消費税額")),
      summary: pickField(row, "摘要") || null,
      hasReceipt: pickField(row, "領収書") || null,
      invoiceFlag: pickField(row, "インボイス") || null,
      registrationNumber: pickField(row, "登録番号") || null,
      createdAt: now,
    });
  }

  if (pending.length === 0) throw new Error("取り込める行がありません（精算月・区分を確認してください）");

  const monthList = [...months];
  if (replaceExistingMonths && monthList.length > 0) {
    await db.delete(bizgoExpenseLines).where(inArray(bizgoExpenseLines.settlementMonth, monthList));
  }

  for (const chunk of chunkArray(pending, 50)) {
    await db.insert(bizgoExpenseLines).values(chunk);
  }

  revalidatePath(BIZGO_PATH);
  return { imported: pending.length, skipped, unmappedCategories: [...unmapped].sort(), months: monthList.sort().reverse() };
}

export async function importBizgoTripExpenseCsv(formData: FormData): Promise<BizgoImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("CSVファイルを選択してください");
  const replaceExistingMonths = formData.get("replaceExisting") !== "0";

  const { rows: csvRows } = parseCsvWithHeader(await file.text());
  if (csvRows.length === 0) throw new Error("データ行がありません");

  const db = await getDb();
  const batchId = crypto.randomUUID();
  const now = new Date();
  const unmapped = new Set<string>();
  const months = new Set<string>();
  let skipped = 0;

  type Pending = (typeof bizgoTripExpenseLines.$inferInsert)[];
  const pending: Pending = [];
  const accountCache = new Map<string, string | null>();

  for (const row of csvRows) {
    const categoryLabel = pickField(row, "区分");
    const month = normalizeBizgoMonth(pickField(row, "対象月"));
    if (!month || !categoryLabel) {
      skipped++;
      continue;
    }
    months.add(month);

    let accountId = accountCache.get(categoryLabel);
    if (accountId === undefined) {
      accountId = await resolveAccountIdFromBizgoCategory(db, categoryLabel);
      accountCache.set(categoryLabel, accountId);
    }
    if (!accountId) unmapped.add(categoryLabel);

    pending.push({
      importBatchId: batchId,
      targetMonth: month,
      subject: pickField(row, "件名") || null,
      tripStartDate: normalizeDate(pickField(row, "出張開始日")),
      tripEndDate: normalizeDate(pickField(row, "出張終了日")),
      tripDays: pickField(row, "出張日数") || null,
      oneWayDistanceKm: pickField(row, "片道距離（km）", "片道距離(km)") || null,
      lodging: pickField(row, "宿泊") || null,
      dailyAllowanceTotalMinor: parseYenAmount(pickField(row, "日当合計")),
      detailDate: normalizeDate(pickField(row, "明細日付")),
      categoryLabel,
      accountId,
      amountInclTaxMinor: parseYenAmount(pickField(row, "金額（税込）", "金額(税込)")),
      taxCategory: pickField(row, "消費税区分") || null,
      amountExclTaxMinor: parseYenAmount(pickField(row, "消費税別金額")),
      taxAmountMinor: parseYenAmount(pickField(row, "消費税額")),
      summary: pickField(row, "摘要") || null,
      hasReceipt: pickField(row, "領収書") || null,
      invoiceFlag: pickField(row, "インボイス") || null,
      registrationNumber: pickField(row, "登録番号") || null,
      createdAt: now,
    });
  }

  if (pending.length === 0) throw new Error("取り込める行がありません（対象月・区分を確認してください）");

  const monthList = [...months];
  if (replaceExistingMonths && monthList.length > 0) {
    await db.delete(bizgoTripExpenseLines).where(inArray(bizgoTripExpenseLines.targetMonth, monthList));
  }

  for (const chunk of chunkArray(pending, 50)) {
    await db.insert(bizgoTripExpenseLines).values(chunk);
  }

  revalidatePath(BIZGO_PATH);
  return { imported: pending.length, skipped, unmappedCategories: [...unmapped].sort(), months: monthList.sort().reverse() };
}

export async function clearBizgoExpenseMonth(month: string) {
  const m = normalizeBizgoMonth(month);
  if (!m) throw new Error("月が不正です");
  const db = await getDb();
  await db.delete(bizgoExpenseLines).where(eq(bizgoExpenseLines.settlementMonth, m));
  revalidatePath(BIZGO_PATH);
}

export async function clearBizgoTripMonth(month: string) {
  const m = normalizeBizgoMonth(month);
  if (!m) throw new Error("月が不正です");
  const db = await getDb();
  await db.delete(bizgoTripExpenseLines).where(eq(bizgoTripExpenseLines.targetMonth, m));
  revalidatePath(BIZGO_PATH);
}

export async function clearAllBizgoExpense() {
  const db = await getDb();
  await db.delete(bizgoExpenseLines);
  revalidatePath(BIZGO_PATH);
}

export async function clearAllBizgoTrip() {
  const db = await getDb();
  await db.delete(bizgoTripExpenseLines);
  revalidatePath(BIZGO_PATH);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
