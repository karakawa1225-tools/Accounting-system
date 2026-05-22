import { asc } from "drizzle-orm";
import { getCompanyRow } from "@/app/admin/company/actions";
import { getDb } from "@/db";
import { customers } from "@/db/schema";
import { getArRecentLinesMerged, getReceivableBalancesMerged } from "./actions";
import { ReceivablesView } from "./view";

export default async function ReceivablesPage() {
  const db = getDb();
  const [balances, customerRows, recentLines, company] = await Promise.all([
    getReceivableBalancesMerged(),
    db.select({ id: customers.id, name: customers.name, code: customers.code }).from(customers).orderBy(asc(customers.code), asc(customers.name)),
    getArRecentLinesMerged(),
    getCompanyRow(),
  ]);

  return (
    <ReceivablesView
      balances={balances}
      customers={customerRows}
      recentLines={recentLines}
      fiscalStart={company.fiscalPeriodStart}
      fiscalEnd={company.fiscalPeriodEnd}
    />
  );
}
