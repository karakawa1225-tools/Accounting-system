import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { getCompanyRow } from "@/app/admin/company/actions";
import { getDb } from "@/db";
import { customers } from "@/db/schema";
import { AR_BOOKS, type ArBook, parseArBook } from "@/lib/ar-ap-books";
import { getArRecentLines, getReceivableBalances } from "../actions";
import { ReceivablesView } from "../view";

export default async function ReceivablesBookPage({ params }: { params: Promise<{ book: string }> }) {
  const { book: raw } = await params;
  if (!AR_BOOKS.includes(raw as ArBook)) notFound();
  const book = parseArBook(raw);

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
