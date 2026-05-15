import { asc, eq } from "drizzle-orm";
import { getCompanyRow } from "@/app/admin/company/actions";
import { getDb } from "@/db";
import { accountDivisions, accounts, customers, openingBalanceLines, payees, vendors } from "@/db/schema";
import { ensureDefaultAccountDivisions } from "@/lib/account-divisions";
import { SYSTEM_ACCOUNT_CODES } from "@/lib/system-accounts";
import { MastersClient } from "./view";

export default async function AdminMastersPage() {
  const db = getDb();
  await ensureDefaultAccountDivisions(db);
  const [accountRows, divisionRows, customerRows, vendorRows, payeeRows, company, openingRow] = await Promise.all([
    db.select().from(accounts).orderBy(asc(accounts.code), asc(accounts.name)),
    db.select().from(accountDivisions).orderBy(asc(accountDivisions.sortOrder), asc(accountDivisions.code), asc(accountDivisions.name)),
    db.select().from(customers).orderBy(asc(customers.code), asc(customers.name)),
    db.select().from(vendors).orderBy(asc(vendors.code), asc(vendors.name)),
    db.select().from(payees).orderBy(asc(payees.code), asc(payees.name)),
    getCompanyRow(),
    db.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, SYSTEM_ACCOUNT_CODES.OPENING)).limit(1),
  ]);

  const fiscal = company.fiscalPeriodStart?.trim() ?? null;
  const openingAid = openingRow[0]?.id ?? "";

  const obRows = fiscal
    ? await db.select().from(openingBalanceLines).where(eq(openingBalanceLines.fiscalPeriodStart, fiscal))
    : [];

  const openingBalances: Record<string, number> = {};
  for (const r of obRows) openingBalances[r.accountId] = r.balanceMinor;

  /** 会計開始前・DBに行がない勘定は期首残高を明示的に 0 とする（表示・保存ロジックを統一） */
  const visibleForOpening = accountRows.filter(
    (a) => String(a.id) !== openingAid && a.isActive !== false
  );
  for (const a of visibleForOpening) {
    const id = String(a.id);
    if (openingBalances[id] === undefined) openingBalances[id] = 0;
  }

  const openingBalanceFormKey = `${fiscal ?? "pending"}|${obRows
    .map((r) => `${r.accountId}:${r.balanceMinor}`)
    .sort()
    .join(";")}`;

  return (
    <MastersClient
      accounts={accountRows}
      accountDivisions={divisionRows}
      customers={customerRows}
      vendors={vendorRows}
      payees={payeeRows}
      fiscalPeriodStart={fiscal}
      openingBalances={openingBalances}
      openingAccountId={openingAid}
      openingBalanceFormKey={openingBalanceFormKey}
    />
  );
}
