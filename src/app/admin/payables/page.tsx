import { asc } from "drizzle-orm";
import { getCompanyRow } from "@/app/admin/company/actions";
import { getDb } from "@/db";
import { vendors } from "@/db/schema";
import { getApRecentLines, getPayableBalances } from "./actions";
import { PayablesView } from "./view";

export default async function PayablesPage() {
  const db = getDb();
  const [balances, vendorRows, recentLines, company] = await Promise.all([
    getPayableBalances(),
    db.select({ id: vendors.id, name: vendors.name, code: vendors.code }).from(vendors).orderBy(asc(vendors.code), asc(vendors.name)),
    getApRecentLines(),
    getCompanyRow(),
  ]);
  return (
    <PayablesView
      balances={balances}
      vendors={vendorRows}
      recentLines={recentLines}
      fiscalStart={company.fiscalPeriodStart}
      fiscalEnd={company.fiscalPeriodEnd}
    />
  );
}
