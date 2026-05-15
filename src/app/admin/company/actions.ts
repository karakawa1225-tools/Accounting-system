"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, companies } from "@/db/schema";
import { requireAdmin } from "@/lib/authz";
import {
  listCompanyBankAccounts,
  migrateLegacyCompanyBanksIfNeeded,
  replaceCompanyBankAccounts,
  syncCompanyBankFiscalBalancesToOpening,
  type CompanyBankInput,
} from "@/lib/company-bank-accounts";
import { ensureCompanyBankAccountsTableAtRuntime } from "@/lib/company-bank-bootstrap";

export async function getCompanyRow() {
  const db = getDb();
  await ensureCompanyBankAccountsTableAtRuntime();
  const [row] = await db.select().from(companies).limit(1);
  if (row) return row;
  await db.insert(companies).values({ name: "会社名未設定" });
  const [created] = await db.select().from(companies).limit(1);
  return created!;
}

export async function getCompanySettingsData() {
  const db = getDb();
  await ensureCompanyBankAccountsTableAtRuntime();
  const company = await getCompanyRow();
  await migrateLegacyCompanyBanksIfNeeded(db, company.id);
  const banks = await listCompanyBankAccounts(db, company.id);
  const ledgerAccounts = await db
    .select({ id: accounts.id, code: accounts.code, name: accounts.name, category: accounts.category })
    .from(accounts)
    .where(and(eq(accounts.category, "asset"), or(eq(accounts.isActive, true), isNull(accounts.isActive))))
    .orderBy(asc(accounts.code), asc(accounts.name));
  return { company, banks, ledgerAccounts };
}

export async function updateCompany(formData: FormData) {
  await requireAdmin();
  const db = getDb();
  const [existing] = await db.select().from(companies).limit(1);
  if (!existing) throw new Error("会社情報が見つかりません");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("社名は必須です");
  const fiscalPeriodStart = pickDate(formData.get("fiscalPeriodStart"));
  const fiscalPeriodEnd = pickDate(formData.get("fiscalPeriodEnd"));
  if (fiscalPeriodStart && fiscalPeriodEnd && fiscalPeriodStart > fiscalPeriodEnd) {
    throw new Error("会計期間の開始日は終了日以前にしてください");
  }
  await db
    .update(companies)
    .set({
      name,
      postalCode: String(formData.get("postalCode") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      fax: String(formData.get("fax") ?? "").trim() || null,
      representativeName: String(formData.get("representativeName") ?? "").trim() || null,
      taxId: String(formData.get("taxId") ?? "").trim() || null,
      invoiceRegistrationNumber: String(formData.get("invoiceRegistrationNumber") ?? "").trim() || null,
      fiscalPeriodStart,
      fiscalPeriodEnd,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, existing.id));

  const banksJson = String(formData.get("banksJson") ?? "").trim();
  if (banksJson) {
    let parsed: CompanyBankInput[];
    try {
      parsed = JSON.parse(banksJson) as CompanyBankInput[];
      if (!Array.isArray(parsed)) throw new Error("invalid");
    } catch {
      throw new Error("銀行口座データの形式が不正です");
    }
    for (const row of parsed) {
      if (!row.accountId?.trim()) throw new Error("各銀行口座に紐づく勘定科目を選択してください");
    }
    await replaceCompanyBankAccounts(db, existing.id, parsed);
    const fiscal = fiscalPeriodStart ?? existing.fiscalPeriodStart;
    try {
      await syncCompanyBankFiscalBalancesToOpening(db, existing.id, fiscal);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!fiscal) throw new Error("期末残高を反映するには、会計期間の開始日を登録してください");
      throw e instanceof Error ? e : new Error(msg);
    }
  }

  revalidatePath("/admin/company");
  revalidatePath("/admin/bank-transactions");
  revalidatePath("/admin/masters");
  revalidatePath("/dashboard");
}

function pickDate(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}
