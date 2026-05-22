import { AP_BOOK_LABELS, apPurchaseTotalLabel, parseApBook, apAdminPath } from "@/lib/ar-ap-books";
import { ArApMonthlyPdfDocument } from "@/components/ar-ap-monthly-pdf-document";
import { getMonthlyApLedgerForPdf } from "../actions";

export const dynamic = "force-dynamic";

export default async function PayablesMonthlyPdfPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; book?: string }>;
}) {
  const p = await searchParams;
  const month = p.month && /^\d{4}-\d{2}$/.test(p.month) ? p.month : new Date().toISOString().slice(0, 7);
  const book = parseApBook(p.book);
  const report = await getMonthlyApLedgerForPdf(month, book);

  const purchaseLabel = apPurchaseTotalLabel(book);

  return (
    <ArApMonthlyPdfDocument
      title="買掛 月次明細"
      divisionLabel={AP_BOOK_LABELS[book]}
      month={report.month}
      backHref={apAdminPath(book)}
      partyColumnLabel="仕入先"
      rows={report.rows}
      footerTotals={[
        { label: purchaseLabel, amountMinor: report.purchaseTotal },
        { label: "支払合計", amountMinor: report.paymentTotal },
      ]}
    />
  );
}
