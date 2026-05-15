import { asc, eq, isNull, or } from "drizzle-orm";
import { getCompanyRow } from "@/app/admin/company/actions";
import { getDb } from "@/db";
import { accountDivisions, accounts, customers, payees } from "@/db/schema";
import { getCompanyBankAccountsForLedger } from "@/lib/company-bank-accounts";
import { ensureCompanyBankAccountsTableAtRuntime } from "@/lib/company-bank-bootstrap";
import { getSystemAccounts } from "@/lib/system-accounts";
import { getBankBalanceMinor, getBankLedgerLines } from "./actions";
import { BankTransactionsView } from "./view";

export const dynamic = "force-dynamic";

export default async function BankTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const p = await searchParams;
  const db = getDb();
  const { ensureAccountDivisionsSchemaAtRuntime } = await import("@/lib/account-divisions-bootstrap");
  await ensureAccountDivisionsSchemaAtRuntime(db);
  await ensureCompanyBankAccountsTableAtRuntime();
  const sys = await getSystemAccounts(db);
  const bankAccounts = await getCompanyBankAccountsForLedger(db);
  const fallback = { id: sys.bankId, code: "SYS_BANK", name: "普通預金" };
  const options = bankAccounts.length ? bankAccounts : [fallback];
  const bankAccountId = p.account && options.some((b) => b.id === p.account) ? p.account! : options[0]!.id;
  const selectedBank = options.find((b) => b.id === bankAccountId) ?? options[0]!;

  const [balanceMinor, lines, accountRows, customerRows, payeeRows, company] = await Promise.all([
    getBankBalanceMinor(bankAccountId),
    getBankLedgerLines({ bankAccountId }),
    db
      .select({
        id: accounts.id,
        name: accounts.name,
        code: accounts.code,
        category: accounts.category,
        divisionName: accountDivisions.name,
      })
      .from(accounts)
      .leftJoin(accountDivisions, eq(accounts.accountDivisionId, accountDivisions.id))
      .where(or(eq(accounts.isActive, true), isNull(accounts.isActive)))
      .orderBy(asc(accounts.code), asc(accounts.name)),
    db.select({ id: customers.id, name: customers.name, code: customers.code }).from(customers).orderBy(asc(customers.code), asc(customers.name)),
    db.select({ id: payees.id, name: payees.name, code: payees.code, category: payees.category }).from(payees).orderBy(asc(payees.code), asc(payees.name)),
    getCompanyRow(),
  ]);

  const accountsForCounter = accountRows.filter((a) => a.id !== bankAccountId);

  return (
    <BankTransactionsView
      fiscalStart={company.fiscalPeriodStart}
      fiscalEnd={company.fiscalPeriodEnd}
      bankAccounts={options.map((b) => ({ id: b.id, code: b.code, name: b.name }))}
      bankAccountId={bankAccountId}
      bankAccountName={selectedBank.name}
      hasCompanyBanks={bankAccounts.length > 0}
      initialBalanceMinor={balanceMinor}
      lines={lines}
      accounts={accountsForCounter}
      customers={customerRows}
      payees={payeeRows}
    />
  );
}
