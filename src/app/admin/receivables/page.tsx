import { asc } from "drizzle-orm";
import { getCompanyRow } from "@/app/admin/company/actions";
import { getDb } from "@/db";
import { customers } from "@/db/schema";
import { parseArBook } from "@/lib/ar-ap-books";
import { getArRecentLines, getReceivableBalances } from "./actions";
import { ReceivablesView } from "./view";

export default async function ReceivablesPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>;
}) {
  const p = await searchParams;
  const book = parseArBook(p.dept);

  const db = getDb();
  const [balances, customerRows, recentLines, company] = await Promise.all([
    getReceivableBalances(book),
    db.select({ id: customers.id, name: customers.name, code: customers.code }).from(customers).orderBy(asc(customers.code), asc(customers.name)),
    getArRecentLines(book),
    getCompanyRow(),
  ]);

  return (
    <ReceivablesView
      book={book}
      balances={balances}
      customers={customerRows}
      recentLines={recentLines}
      fiscalStart={company.fiscalPeriodStart}
      fiscalEnd={company.fiscalPeriodEnd}
    />
  );
}
