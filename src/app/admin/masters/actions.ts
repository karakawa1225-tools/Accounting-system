"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { getCompanyRow } from "@/app/admin/company/actions";
import { getDb as openSqlite, type Database } from "@/db";
import {
  accountCategoryEnum,
  accountDivisions,
  accounts,
  customers,
  openingBalanceLines,
  payees,
  transactions,
  vendors,
  type AccountCategory,
} from "@/db/schema";
import { mapAccountCategoryFromImport } from "@/lib/account-category";
import { resolveAccountDivisionFromImport } from "@/lib/account-divisions";
import { cleanupNonCsvMasters } from "@/lib/cleanup-non-csv-masters";
import { isCsvStyleAccountCode, isCsvStyleDivisionCode } from "@/lib/csv-master-policy";
import { getSystemAccounts, SYSTEM_ACCOUNT_CODES } from "@/lib/system-accounts";
import { requireAdmin } from "@/lib/authz";

async function getDb() {
  const db = openSqlite();
  const { ensureAccountDivisionsSchemaAtRuntime } = await import("@/lib/account-divisions-bootstrap");
  await ensureAccountDivisionsSchemaAtRuntime(db);
  return db;
}

function n(v: unknown) { return String(v ?? "").trim(); }
function nn(v: unknown) { const s = n(v); return s ? s : null; }
function ni(v: unknown) { const s = n(v); if (!s) return null; const x = Number(s); return Number.isFinite(x) ? Math.floor(x) : null; }
function parseCsv(content: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (q) {
      if (ch === '"') { if (content[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
      continue;
    }
    if (ch === '"') { q = true; continue; }
    if (ch === ",") { row.push(cell); cell = ""; continue; }
    if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; continue; }
    cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export async function createAccount(formData: FormData) {
  const db = await getDb();
  const divisionId = n(formData.get("accountDivisionId"));
  if (!divisionId) throw new Error("勘定科目区分を選択してください");
  const [div] = await db.select().from(accountDivisions).where(eq(accountDivisions.id, divisionId)).limit(1);
  if (!div) throw new Error("勘定科目区分が見つかりません");
  if (!isCsvStyleDivisionCode(div.code)) {
    throw new Error("勘定科目区分はCSV取込のもの（区分コードがYで始まる）を選んでください");
  }
  const code = nn(formData.get("code"));
  if (!code || !isCsvStyleAccountCode(code)) {
    throw new Error("勘定科目コードは数字のみで入力してください（CSV取込と同じ形式）");
  }
  await db.insert(accounts).values({
    code,
    categoryCode: nn(formData.get("categoryCode")),
    name: n(formData.get("name")),
    category: div.statementCategory,
    accountDivisionId: divisionId,
    barcodeCode: nn(formData.get("barcodeCode")),
    isActive: true,
  });
  revalidatePath("/admin/masters");
  revalidatePath("/admin/bank-transactions");
}

export async function createCustomer(formData: FormData) {
  const db = await getDb();
  await db.insert(customers).values({
    code: nn(formData.get("code")),
    name: n(formData.get("name")),
    barcodeCode: nn(formData.get("barcodeCode")),
    postalCode: nn(formData.get("postalCode")),
    address: nn(formData.get("address")),
    phone: nn(formData.get("phone")),
    closingDay: ni(formData.get("closingDay")),
    paymentSiteTerms: nn(formData.get("paymentSiteTerms")),
    email: nn(formData.get("email")),
    notes: nn(formData.get("notes")),
  });
  revalidatePath("/admin/masters");
}

export async function updateAccount(formData: FormData) {
  const db = await getDb();
  const id = n(formData.get("id"));
  if (!id) throw new Error("IDが不正です");
  const divisionId = n(formData.get("accountDivisionId"));
  if (!divisionId) throw new Error("勘定科目区分を選択してください");
  const [div] = await db.select().from(accountDivisions).where(eq(accountDivisions.id, divisionId)).limit(1);
  if (!div) throw new Error("勘定科目区分が見つかりません");
  await db
    .update(accounts)
    .set({
      code: nn(formData.get("code")),
      categoryCode: nn(formData.get("categoryCode")),
      name: n(formData.get("name")),
      category: div.statementCategory,
      accountDivisionId: divisionId,
      barcodeCode: nn(formData.get("barcodeCode")),
      isActive: n(formData.get("isActive")) === "0" ? false : true,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, id));
  revalidatePath("/admin/masters");
  revalidatePath("/admin/bank-transactions");
}

const PROTECTED_ACCOUNT_CODES = new Set<string>(Object.values(SYSTEM_ACCOUNT_CODES));

async function countAccountsWithSameCode(db: Database, code: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(accounts)
    .where(eq(accounts.code, code));
  return n;
}

export async function deleteAccount(formData: FormData) {
  const db = await getDb();
  const id = n(formData.get("id"));
  const mergeInto = nn(formData.get("mergeInto"));
  if (!id) throw new Error("IDが不正です");

  const [acc] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  if (!acc) throw new Error("勘定科目が見つかりません");

  const [{ c }] = await db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(transactions)
    .where(eq(transactions.accountId, id));

  if (mergeInto) {
    if (mergeInto === id) throw new Error("統合先が同じ勘定です");
    const [keep] = await db.select().from(accounts).where(eq(accounts.id, mergeInto)).limit(1);
    if (!keep) throw new Error("統合先が見つかりません");

    const fromCode = acc.code ? String(acc.code).trim() : "";
    const keepCode = keep.code ? String(keep.code).trim() : "";
    const sameCodeRow = Boolean(fromCode && keepCode && fromCode === keepCode);

    if (keep.isActive === false && !sameCodeRow) {
      throw new Error("無効な勘定へは統合できません（同一コードの重複をまとめる場合は、もう一方の行を選べます）");
    }

    if (fromCode && PROTECTED_ACCOUNT_CODES.has(fromCode)) {
      if (!sameCodeRow || fromCode !== keepCode) {
        throw new Error("標準勘定は、同じコード（SYS_*）の重複行へのみ統合できます");
      }
      const dupN = await countAccountsWithSameCode(db, fromCode);
      if (dupN < 2) throw new Error("重複していない標準勘定は統合できません");
    }

    await db.transaction(async (tx) => {
      await tx.update(transactions).set({ accountId: mergeInto, updatedAt: new Date() }).where(eq(transactions.accountId, id));

      const obLines = await tx.select().from(openingBalanceLines).where(eq(openingBalanceLines.accountId, id));
      for (const line of obLines) {
        const [existing] = await tx
          .select()
          .from(openingBalanceLines)
          .where(and(eq(openingBalanceLines.fiscalPeriodStart, line.fiscalPeriodStart), eq(openingBalanceLines.accountId, mergeInto)))
          .limit(1);
        if (existing) {
          await tx
            .update(openingBalanceLines)
            .set({ balanceMinor: existing.balanceMinor + line.balanceMinor, updatedAt: new Date() })
            .where(and(eq(openingBalanceLines.fiscalPeriodStart, line.fiscalPeriodStart), eq(openingBalanceLines.accountId, mergeInto)));
          await tx
            .delete(openingBalanceLines)
            .where(and(eq(openingBalanceLines.fiscalPeriodStart, line.fiscalPeriodStart), eq(openingBalanceLines.accountId, id)));
        } else {
          await tx
            .update(openingBalanceLines)
            .set({ accountId: mergeInto, updatedAt: new Date() })
            .where(and(eq(openingBalanceLines.fiscalPeriodStart, line.fiscalPeriodStart), eq(openingBalanceLines.accountId, id)));
        }
      }

      await tx.delete(accounts).where(eq(accounts.id, id));
    });

    revalidatePath("/admin/masters");
    revalidatePath("/admin/bank-transactions");
    revalidatePath("/dashboard");
    revalidatePath("/admin/receivables");
    revalidatePath("/admin/payables");
    return;
  }

  const codeStr = acc.code ? String(acc.code).trim() : "";
  if (codeStr && PROTECTED_ACCOUNT_CODES.has(codeStr)) {
    if (c > 0) {
      await db.update(accounts).set({ isActive: false, updatedAt: new Date() }).where(eq(accounts.id, id));
    } else {
      await db.delete(openingBalanceLines).where(eq(openingBalanceLines.accountId, id));
      try {
        await db.delete(accounts).where(eq(accounts.id, id));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("FOREIGN KEY") || msg.includes("foreign key")) {
          await db.update(accounts).set({ isActive: false, updatedAt: new Date() }).where(eq(accounts.id, id));
        } else {
          throw e;
        }
      }
    }
    revalidatePath("/admin/masters");
    revalidatePath("/admin/bank-transactions");
    revalidatePath("/dashboard");
    return;
  }

  if (c > 0) {
    await db.update(accounts).set({ isActive: false, updatedAt: new Date() }).where(eq(accounts.id, id));
  } else {
    await db.delete(openingBalanceLines).where(eq(openingBalanceLines.accountId, id));
    try {
      await db.delete(accounts).where(eq(accounts.id, id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("FOREIGN KEY") || msg.includes("foreign key")) {
        await db.update(accounts).set({ isActive: false, updatedAt: new Date() }).where(eq(accounts.id, id));
      } else {
        throw e;
      }
    }
  }
  revalidatePath("/admin/masters");
  revalidatePath("/admin/bank-transactions");
  revalidatePath("/dashboard");
}

export async function updateCustomer(formData: FormData) {
  const db = await getDb();
  const id = n(formData.get("id"));
  if (!id) throw new Error("IDが不正です");
  await db
    .update(customers)
    .set({
      code: nn(formData.get("code")),
      name: n(formData.get("name")),
      barcodeCode: nn(formData.get("barcodeCode")),
      postalCode: nn(formData.get("postalCode")),
      address: nn(formData.get("address")),
      phone: nn(formData.get("phone")),
      closingDay: ni(formData.get("closingDay")),
      paymentSiteTerms: nn(formData.get("paymentSiteTerms")),
      paymentSiteDays: null,
      email: nn(formData.get("email")),
      notes: nn(formData.get("notes")),
      updatedAt: new Date(),
    })
    .where(eq(customers.id, id));
  revalidatePath("/admin/masters");
}

export async function deleteCustomer(formData: FormData) {
  const db = await getDb();
  const id = n(formData.get("id"));
  if (!id) throw new Error("IDが不正です");
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(transactions)
    .where(eq(transactions.customerId, id));
  if (c > 0) throw new Error("取引が紐づいているため削除できません");
  await db.delete(customers).where(eq(customers.id, id));
  revalidatePath("/admin/masters");
}

export async function updateVendor(formData: FormData) {
  const db = await getDb();
  const id = n(formData.get("id"));
  if (!id) throw new Error("IDが不正です");
  await db
    .update(vendors)
    .set({
      code: nn(formData.get("code")),
      name: n(formData.get("name")),
      barcodeCode: nn(formData.get("barcodeCode")),
      bankName: nn(formData.get("bankName")),
      branchName: nn(formData.get("branchName")),
      accountType: nn(formData.get("accountType")),
      accountNumber: nn(formData.get("accountNumber")),
      postalCode: nn(formData.get("postalCode")),
      address: nn(formData.get("address")),
      phone: nn(formData.get("phone")),
      email: nn(formData.get("email")),
      notes: nn(formData.get("notes")),
      updatedAt: new Date(),
    })
    .where(eq(vendors.id, id));
  revalidatePath("/admin/masters");
}

export async function deleteVendor(formData: FormData) {
  const db = await getDb();
  const id = n(formData.get("id"));
  if (!id) throw new Error("IDが不正です");
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(transactions)
    .where(eq(transactions.vendorId, id));
  if (c > 0) throw new Error("取引が紐づいているため削除できません");
  await db.delete(vendors).where(eq(vendors.id, id));
  revalidatePath("/admin/masters");
}

export async function createVendor(formData: FormData) {
  const db = await getDb();
  await db.insert(vendors).values({
    code: nn(formData.get("code")),
    name: n(formData.get("name")),
    barcodeCode: nn(formData.get("barcodeCode")),
    bankName: nn(formData.get("bankName")),
    branchName: nn(formData.get("branchName")),
    accountType: nn(formData.get("accountType")),
    accountNumber: nn(formData.get("accountNumber")),
    postalCode: nn(formData.get("postalCode")),
    address: nn(formData.get("address")),
    phone: nn(formData.get("phone")),
    email: nn(formData.get("email")),
    notes: nn(formData.get("notes")),
  });
  revalidatePath("/admin/masters");
}

export async function importAccountsCsv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("CSVファイルを選択してください");
  const rows = parseCsv(await file.text()).slice(1);
  const db = await getDb();
  for (const r of rows) {
    const categoryCode = n(r[0]);
    const categoryLabel = n(r[1]);
    const code = n(r[2]);
    const name = n(r[3]);
    const barcodeCode = nn(r[4]);
    if (!name) continue;
    const div = await resolveAccountDivisionFromImport(db, categoryCode, categoryLabel);
    if (!div) throw new Error(`勘定「${name}」の区分を解決できません。勘定科目区分マスタと区分コード／名称を確認してください。`);
    const [existing] = code ? await db.select().from(accounts).where(eq(accounts.code, code)).limit(1) : [];
    const values = {
      categoryCode: categoryCode || null,
      category: div.statementCategory,
      accountDivisionId: div.id,
      code: code || null,
      name,
      barcodeCode,
      updatedAt: new Date(),
    };
    if (existing) await db.update(accounts).set(values).where(eq(accounts.id, existing.id));
    else await db.insert(accounts).values({ ...values, isActive: true });
  }
  revalidatePath("/admin/masters");
  revalidatePath("/admin/bank-transactions");
}

export async function createAccountDivision(formData: FormData) {
  const db = await getDb();
  const sc = n(formData.get("statementCategory"));
  if (!(accountCategoryEnum as readonly string[]).includes(sc)) throw new Error("財務区分（5類型）が不正です");
  const codeRaw = nn(formData.get("code"));
  if (!codeRaw || !isCsvStyleDivisionCode(codeRaw)) {
    throw new Error("区分コードはYで始まる形式で入力してください（CSV取込と同じ形式）");
  }
  const [dup] = await db.select({ id: accountDivisions.id }).from(accountDivisions).where(eq(accountDivisions.code, codeRaw)).limit(1);
  if (dup) throw new Error("同じ区分コードが既に存在します");
  await db.insert(accountDivisions).values({
    code: codeRaw,
    name: n(formData.get("name")),
    statementCategory: sc as AccountCategory,
    sortOrder: ni(formData.get("sortOrder")) ?? 0,
    isActive: true,
  });
  revalidatePath("/admin/masters");
}

export async function updateAccountDivision(formData: FormData) {
  const db = await getDb();
  const id = n(formData.get("id"));
  if (!id) throw new Error("IDが不正です");
  const sc = n(formData.get("statementCategory"));
  if (!(accountCategoryEnum as readonly string[]).includes(sc)) throw new Error("財務区分が不正です");
  const codeRaw = nn(formData.get("code"));
  if (!codeRaw || !isCsvStyleDivisionCode(codeRaw)) {
    throw new Error("区分コードはYで始まる形式で入力してください（CSV取込と同じ形式）");
  }
  const [dup] = await db
    .select({ id: accountDivisions.id })
    .from(accountDivisions)
    .where(and(eq(accountDivisions.code, codeRaw), ne(accountDivisions.id, id)))
    .limit(1);
  if (dup) throw new Error("同じ区分コードが既に存在します");
  const now = new Date();
  await db
    .update(accountDivisions)
    .set({
      code: codeRaw,
      name: n(formData.get("name")),
      statementCategory: sc as AccountCategory,
      sortOrder: ni(formData.get("sortOrder")) ?? 0,
      isActive: n(formData.get("isActive")) === "0" ? false : true,
      updatedAt: now,
    })
    .where(eq(accountDivisions.id, id));
  await db
    .update(accounts)
    .set({ category: sc as AccountCategory, updatedAt: now })
    .where(eq(accounts.accountDivisionId, id));
  revalidatePath("/admin/masters");
  revalidatePath("/admin/bank-transactions");
}

export async function deleteAccountDivision(formData: FormData) {
  const db = await getDb();
  const id = n(formData.get("id"));
  if (!id) throw new Error("IDが不正です");
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(accounts)
    .where(eq(accounts.accountDivisionId, id));
  if (c > 0) throw new Error("この区分を使用中の勘定科目があるため削除できません");
  await db.delete(accountDivisions).where(eq(accountDivisions.id, id));
  revalidatePath("/admin/masters");
}

/** CSV列: 区分コード,区分名称,財務区分(asset等または日本語),表示順（任意） */
export async function importAccountDivisionsCsv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("CSVファイルを選択してください");
  const rows = parseCsv(await file.text()).slice(1);
  const db = await getDb();
  for (const r of rows) {
    const code = nn(r[0]);
    const name = n(r[1]);
    const stmtRaw = n(r[2]);
    const sortOrder = ni(r[3]) ?? 0;
    if (!name) continue;
    const statementCategory: AccountCategory = (accountCategoryEnum as readonly string[]).includes(stmtRaw)
      ? (stmtRaw as AccountCategory)
      : mapAccountCategoryFromImport("", stmtRaw);

    const [existingByCode] = code
      ? await db.select().from(accountDivisions).where(eq(accountDivisions.code, code)).limit(1)
      : [];
    const [existingByName] =
      !existingByCode?.id && !code
        ? await db.select().from(accountDivisions).where(eq(accountDivisions.name, name)).limit(1)
        : [];
    const existing = existingByCode ?? existingByName;
    const now = new Date();
    const values = {
      code,
      name,
      statementCategory,
      sortOrder,
      updatedAt: now,
    };
    if (existing)
      await db
        .update(accountDivisions)
        .set({ ...values, isActive: existing.isActive })
        .where(eq(accountDivisions.id, existing.id));
    else await db.insert(accountDivisions).values({ ...values, isActive: true, createdAt: now });
  }
  revalidatePath("/admin/masters");
}

export async function importCustomersCsv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("CSVファイルを選択してください");
  const rows = parseCsv(await file.text()).slice(1);
  const db = await getDb();
  for (const r of rows) {
    const code = n(r[0]);
    const name = n(r[1]);
    if (!name) continue;
    const values = {
      code: code || null,
      name,
      barcodeCode: nn(r[2]),
      postalCode: nn(r[3]),
      address: nn(r[4]),
      phone: nn(r[5]),
      closingDay: ni(r[6]),
      paymentSiteTerms: nn(r[7]),
      paymentSiteDays: null,
      updatedAt: new Date(),
    };
    const [existing] = code ? await db.select().from(customers).where(eq(customers.code, code)).limit(1) : [];
    if (existing) await db.update(customers).set(values).where(eq(customers.id, existing.id));
    else await db.insert(customers).values(values);
  }
  revalidatePath("/admin/masters");
}

export async function createPayee(formData: FormData) {
  const db = await getDb();
  await db.insert(payees).values({
    code: nn(formData.get("code")),
    name: n(formData.get("name")),
    category: nn(formData.get("category")),
  });
  revalidatePath("/admin/masters");
  revalidatePath("/admin/bank-transactions");
}

export async function updatePayee(formData: FormData) {
  const db = await getDb();
  const id = n(formData.get("id"));
  if (!id) throw new Error("IDが不正です");
  await db
    .update(payees)
    .set({
      code: nn(formData.get("code")),
      name: n(formData.get("name")),
      category: nn(formData.get("category")),
      updatedAt: new Date(),
    })
    .where(eq(payees.id, id));
  revalidatePath("/admin/masters");
  revalidatePath("/admin/bank-transactions");
}

export async function deletePayee(formData: FormData) {
  const db = await getDb();
  const id = n(formData.get("id"));
  if (!id) throw new Error("IDが不正です");
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(transactions)
    .where(eq(transactions.payeeId, id));
  if (c > 0) throw new Error("取引が紐づいているため削除できません");
  await db.delete(payees).where(eq(payees.id, id));
  revalidatePath("/admin/masters");
  revalidatePath("/admin/bank-transactions");
}

/** CSV: 支払先コード, 支払先, 区分（1行目ヘッダ想定） */
export async function importPayeesCsv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("CSVファイルを選択してください");
  const rows = parseCsv(await file.text()).slice(1);
  const db = await getDb();
  for (const r of rows) {
    const code = n(r[0]);
    const name = n(r[1]);
    if (!name) continue;
    const values = {
      code: code || null,
      name,
      category: nn(r[2]),
      updatedAt: new Date(),
    };
    const [existing] = code ? await db.select().from(payees).where(eq(payees.code, code)).limit(1) : [];
    if (existing) await db.update(payees).set(values).where(eq(payees.id, existing.id));
    else
      await db.insert(payees).values({
        code: values.code,
        name: values.name,
        category: values.category,
      });
  }
  revalidatePath("/admin/masters");
  revalidatePath("/admin/bank-transactions");
}

export async function importVendorsCsv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("CSVファイルを選択してください");
  const rows = parseCsv(await file.text()).slice(1);
  const db = await getDb();
  for (const r of rows) {
    const code = n(r[0]);
    const name = n(r[1]);
    if (!name) continue;
    const values = {
      code: code || null,
      name,
      barcodeCode: nn(r[2]),
      bankName: nn(r[3]),
      branchName: nn(r[4]),
      accountType: nn(r[5]),
      accountNumber: nn(r[6]),
      updatedAt: new Date(),
    };
    const [existing] = code ? await db.select().from(vendors).where(eq(vendors.code, code)).limit(1) : [];
    if (existing) await db.update(vendors).set(values).where(eq(vendors.id, existing.id));
    else await db.insert(vendors).values(values);
  }
  revalidatePath("/admin/masters");
}

const OPENING_JOURNAL_SUMMARY = "[期首残高]";

/** 期首残高を保存し、会計期間開始日に仕訳（journal）で複式釣りを生成する。 */
export async function saveOpeningBalances(formData: FormData) {
  const company = await getCompanyRow();
  const fiscal = company.fiscalPeriodStart?.trim();
  if (!fiscal) throw new Error("会計期間の開始日を先に自社設定で登録してください");

  const db = await getDb();
  const sys = await getSystemAccounts(db);

  const accRows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(ne(accounts.id, sys.openingId), or(eq(accounts.isActive, true), isNull(accounts.isActive))))
    .orderBy(asc(accounts.code), asc(accounts.name));

  const parsed: { accountId: string; balance: number }[] = [];
  for (const { id } of accRows) {
    const raw = formData.get(`ob_${id}`);
    const s = raw == null ? "" : String(raw).trim().replace(/,/g, "");
    const balance = s === "" ? 0 : Math.floor(Number(s));
    if (!Number.isFinite(balance)) throw new Error("金額が不正な行があります");
    parsed.push({ accountId: id, balance });
  }

  const nonZero = parsed.filter((p) => p.balance !== 0);

  await db.transaction(async (tx) => {
    await tx.delete(openingBalanceLines).where(eq(openingBalanceLines.fiscalPeriodStart, fiscal));

    const existingGroups = await tx
      .select({ eg: transactions.entryGroupId })
      .from(transactions)
      .where(
        and(
          eq(transactions.transactionDate, fiscal),
          eq(transactions.summary, OPENING_JOURNAL_SUMMARY),
          eq(transactions.kind, "journal"),
          isNotNull(transactions.entryGroupId)
        )
      );
    const egs = [...new Set(existingGroups.map((r) => r.eg).filter(Boolean))] as string[];
    if (egs.length) await tx.delete(transactions).where(inArray(transactions.entryGroupId, egs));

    const now = new Date();
    for (const p of nonZero) {
      await tx.insert(openingBalanceLines).values({
        fiscalPeriodStart: fiscal,
        accountId: p.accountId,
        balanceMinor: p.balance,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (nonZero.length === 0) return;

    const entryGroupId = crypto.randomUUID();
    let sumDebit = 0;
    let sumCredit = 0;
    const lines: (typeof transactions.$inferInsert)[] = [];

    for (const p of nonZero) {
      const b = p.balance;
      if (b > 0) {
        sumDebit += b;
        lines.push({
          entryGroupId,
          transactionDate: fiscal,
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
          transactionDate: fiscal,
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
          transactionDate: fiscal,
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
          transactionDate: fiscal,
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

  revalidatePath("/admin/masters");
  revalidatePath("/admin/bank-transactions");
  revalidatePath("/dashboard");
}

/** CSV以外の区分（Y始まり以外）・勘定（数字コード以外）を整理。標準勘定 SYS_* は残す。 */
export async function runCleanupNonCsvMasters() {
  await requireAdmin();
  const db = await getDb();
  const result = await cleanupNonCsvMasters(db);
  revalidatePath("/admin/masters");
  revalidatePath("/admin/bank-transactions");
  revalidatePath("/dashboard");
  revalidatePath("/admin/company");
  return result;
}
