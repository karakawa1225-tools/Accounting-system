import { AP_BOOK_LABELS, parseApBook, apAdminPath } from "@/lib/ar-ap-books";
import { VendorMonthlyPdfDocument } from "@/components/vendor-monthly-pdf-document";
import { getMonthlyVendorPaymentLines } from "../actions";

export const dynamic = "force-dynamic";

export default async function VendorMonthlyPdfPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; book?: string }>;
}) {
  const p = await searchParams;
  const month = p.month && /^\d{4}-\d{2}$/.test(p.month) ? p.month : new Date().toISOString().slice(0, 7);
  const book = parseApBook(p.book);
  const report = await getMonthlyVendorPaymentLines(month, book);

  return (
    <VendorMonthlyPdfDocument
      title="仕入先 月別支払一覧"
      divisionLabel={AP_BOOK_LABELS[book]}
      month={report.month}
      backHref={apAdminPath(book)}
      rows={report.rows.map((r, idx) => ({
        id: `${r.transactionDate}-${r.vendorCode ?? ""}-${idx}`,
        transactionDate: r.transactionDate,
        vendorName: r.vendorName ?? "",
        bankName: r.bankName,
        branchName: r.branchName,
        amountMinor: r.amountMinor,
        summary: r.summary,
      }))}
      totalMinor={report.totalMinor}
    />
  );
}
