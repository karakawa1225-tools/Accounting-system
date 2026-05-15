import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db";
import { accounts, companies, companyBankAccounts } from "@/db/schema";
import { upsertOpeningBalancesAndRegenerate } from "@/lib/opening-balance-journal";
import { getSystemAccounts } from "@/lib/system-accounts";

export type CompanyBankAccountRow = {
  id: string;
  companyId: string;
  label: string | null;
  bankName: string | null;
  branchName: string | null;
  accountType: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  accountId: string;
  fiscalEndBalanceMinor: number;
  sortOrder: number;
  isActive: boolean;
};

/** 入出金・帳票用の表示名 */
export function formatCompanyBankLabel(row: {
  label: string | null;
  bankName: string | null;
  branchName: string | null;
  accountType: string | null;
  accountName?: string | null;
}) {
  if (row.label?.trim()) return row.label.trim();
  const parts = [row.bankName, row.branchName, row.accountType].filter((s) => s?.trim());
  if (parts.length) return parts.join(" ");
  return row.accountName?.trim() || "銀行口座";
}

export async function listCompanyBankAccounts(db: Database, companyId: string): Promise<CompanyBankAccountRow[]> {
  const rows = await db
    .select()
    .from(companyBankAccounts)
    .where(and(eq(companyBankAccounts.companyId, companyId), eq(companyBankAccounts.isActive, true)))
    .orderBy(asc(companyBankAccounts.sortOrder), asc(companyBankAccounts.createdAt));
  return rows.map((r) => ({ ...r, isActive: Boolean(r.isActive) }));
}

/** レガシー companies の単一口座 → company_bank_accounts へ移行 */
export async function migrateLegacyCompanyBanksIfNeeded(db: Database, companyId: string) {
  const existing = await db
    .select({ id: companyBankAccounts.id })
    .from(companyBankAccounts)
    .where(eq(companyBankAccounts.companyId, companyId))
    .limit(1);
  if (existing.length) return;

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return;

  const sys = await getSystemAccounts(db);
  const hasLegacy =
    Boolean(company.bankName?.trim()) ||
    Boolean(company.bankBranchName?.trim()) ||
    Boolean(company.bankAccountNumber?.trim());

  await db.insert(companyBankAccounts).values({
    companyId,
    label: hasLegacy
      ? [company.bankName, company.bankBranchName].filter(Boolean).join(" ") || "自社口座"
      : "普通預金",
    bankName: company.bankName,
    branchName: company.bankBranchName,
    accountType: company.bankAccountType,
    accountNumber: company.bankAccountNumber,
    accountHolder: company.bankAccountHolder,
    accountId: sys.bankId,
    sortOrder: 0,
    isActive: true,
  });
}

/** 入出金画面で選べる口座（勘定科目 ID を返す） */
export async function getCompanyBankAccountsForLedger(db: Database) {
  const [company] = await db.select({ id: companies.id }).from(companies).limit(1);
  if (!company) return [];

  await migrateLegacyCompanyBanksIfNeeded(db, company.id);
  const rows = await listCompanyBankAccounts(db, company.id);
  if (!rows.length) return [];

  const accountIds = [...new Set(rows.map((r) => r.accountId))];
  const allAcc =
    accountIds.length > 0
      ? await db
          .select({ id: accounts.id, code: accounts.code, name: accounts.name })
          .from(accounts)
          .where(inArray(accounts.id, accountIds))
      : [];
  const accMap = new Map(allAcc.map((a) => [a.id, a]));

  return rows.map((r) => {
    const acc = accMap.get(r.accountId);
    const displayName = formatCompanyBankLabel({ ...r, accountName: acc?.name ?? null });
    return {
      id: r.accountId,
      companyBankId: r.id,
      code: acc?.code ?? null,
      name: displayName,
      bankName: r.bankName,
      branchName: r.branchName,
      accountType: r.accountType,
      accountNumber: r.accountNumber,
    };
  });
}

export type CompanyBankInput = {
  id?: string;
  label?: string;
  bankName?: string;
  branchName?: string;
  accountType?: string;
  accountNumber?: string;
  accountHolder?: string;
  accountId: string;
  /** 前期末時点の残高（円）→ 今期期首の期首残高へ反映 */
  fiscalEndBalanceMinor?: number;
};

export async function replaceCompanyBankAccounts(db: Database, companyId: string, inputs: CompanyBankInput[]) {
  const valid = inputs.filter((r) => r.accountId?.trim());
  await db.delete(companyBankAccounts).where(eq(companyBankAccounts.companyId, companyId));
  if (!valid.length) return;

  const now = new Date();
  await db.insert(companyBankAccounts).values(
    valid.map((row, i) => ({
      id: row.id?.trim() || crypto.randomUUID(),
      companyId,
      label: row.label?.trim() || null,
      bankName: row.bankName?.trim() || null,
      branchName: row.branchName?.trim() || null,
      accountType: row.accountType?.trim() || null,
      accountNumber: row.accountNumber?.trim() || null,
      accountHolder: row.accountHolder?.trim() || null,
      accountId: row.accountId.trim(),
      fiscalEndBalanceMinor: Math.floor(Number(row.fiscalEndBalanceMinor ?? 0)) || 0,
      sortOrder: i,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }))
  );

  const first = valid[0];
  await db
    .update(companies)
    .set({
      bankName: first.bankName?.trim() || null,
      bankBranchName: first.branchName?.trim() || null,
      bankAccountType: first.accountType?.trim() || null,
      bankAccountNumber: first.accountNumber?.trim() || null,
      bankAccountHolder: first.accountHolder?.trim() || null,
      updatedAt: now,
    })
    .where(eq(companies.id, companyId));
}

/** 銀行口座の前期末残高を今期期首の期首残高・期首仕訳へ反映 */
export async function syncCompanyBankFiscalBalancesToOpening(
  db: Database,
  companyId: string,
  fiscalPeriodStart: string | null | undefined
) {
  const fiscal = fiscalPeriodStart?.trim();
  if (!fiscal) return;
  const banks = await listCompanyBankAccounts(db, companyId);
  if (!banks.length) return;
  await upsertOpeningBalancesAndRegenerate(
    db,
    fiscal,
    banks.map((b) => ({ accountId: b.accountId, balanceMinor: b.fiscalEndBalanceMinor }))
  );
}
