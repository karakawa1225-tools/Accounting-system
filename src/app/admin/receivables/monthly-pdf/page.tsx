import { AR_BOOK_LABELS, parseArBook, arAdminPath } from "@/lib/ar-ap-books";
import { ArApMonthlyPdfDocument } from "@/components/ar-ap-monthly-pdf-document";
import { getMonthlyArLedgerForPdf } from "../actions";

export const dynamic = "force-dynamic";

export default async function ReceivablesMonthlyPdfPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; book?: string }>;
}) {
  const p = await searchParams;
  const month = p.month && /^\d{4}-\d{2}$/.test(p.month) ? p.month : new Date().toISOString().slice(0, 7);
  const book = parseArBook(p.book);
  const report = await getMonthlyArLedgerForPdf(month, book);

  return (
    <ArApMonthlyPdfDocument
      title="売掛 月次明細"
      divisionLabel={AR_BOOK_LABELS[book]}
      month={report.month}
      backHref={arAdminPath(book)}
      partyColumnLabel="顧客"
      rows={report.rows}
      footerTotals={[
        { label: "売上合計", amountMinor: report.salesTotal },
        { label: "入金合計", amountMinor: report.paymentTotal },
      ]}
    />
  );
}
