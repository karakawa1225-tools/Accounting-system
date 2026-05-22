import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { getCompanyRow } from "@/app/admin/company/actions";
import { getDb } from "@/db";
import { vendors } from "@/db/schema";
import { AP_BOOKS, type ApBook, parseApBook } from "@/lib/ar-ap-books";
import { getApRecentLines, getPayableBalances } from "../actions";
import { PayablesView } from "../view";

export const dynamic = "force-dynamic";

export default async function PayablesBookPage({ params }: { params: Promise<{ book: string }> }) {
  const { book: raw } = await params;
  if (!AP_BOOKS.includes(raw as ApBook)) notFound();
  const book = parseApBook(raw);

  const db = getDb();
  const [balances, vendorRows, recentLines, company] = await Promise.all([
    getPayableBalances(book),
    db.select({ id: vendors.id, name: vendors.name, code: vendors.code }).from(vendors).orderBy(asc(vendors.code), asc(vendors.name)),
    getApRecentLines(book),
    getCompanyRow(),
  ]);

  return (
    <PayablesView
      book={book}
      balances={balances}
      vendors={vendorRows}
      recentLines={recentLines}
      fiscalStart={company.fiscalPeriodStart}
      fiscalEnd={company.fiscalPeriodEnd}
    />
  );
}
