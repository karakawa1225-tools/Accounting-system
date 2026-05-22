import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { formatMonthLabel } from "@/lib/transaction-month-filter";

function yen(v: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(v);
}

const PDF_STYLES = `
  @media print {
    .admin-print-hide { display: none !important; }
    body { background: #fff !important; }
  }
  .vendor-monthly-pdf { max-width: 210mm; margin: 0 auto; background: #fff; color: #0f172a; }
  @media print {
    @page { size: A4 portrait; margin: 10mm 8mm; }
    .vendor-monthly-pdf { max-width: none; padding: 0 !important; }
    .vendor-pdf-no-print { display: none !important; }
    .vendor-pdf-table tr { break-inside: avoid; page-break-inside: avoid; }
  }
  .vendor-pdf-title { margin: 0; font-size: 1.15rem; font-weight: 900; letter-spacing: 0.06em; }
  .vendor-pdf-meta { margin: 4px 0 0; font-size: 0.8rem; font-weight: 700; color: #64748b; }
  .vendor-pdf-table { width: 100%; border-collapse: collapse; font-size: 0.68rem; line-height: 1.3; }
  .vendor-pdf-table th, .vendor-pdf-table td { border: 1px solid #cbd5e1; padding: 3px 4px; vertical-align: top; }
  .vendor-pdf-table th { background: #f1f5f9; font-weight: 800; white-space: nowrap; }
  .vendor-pdf-table td.num, .vendor-pdf-table th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .vendor-pdf-table td.date { white-space: nowrap; }
  .vendor-pdf-table td.empty { color: #94a3b8; text-align: center; }
  .vendor-pdf-table tfoot td { font-weight: 800; background: #f8fafc; }
`;

export type VendorPdfRow = {
  id: string;
  transactionDate: string;
  vendorName: string;
  bankName: string | null;
  branchName: string | null;
  amountMinor: number;
  summary: string | null;
};

export function VendorMonthlyPdfDocument({
  title,
  divisionLabel,
  month,
  backHref,
  rows,
  totalMinor,
}: {
  title: string;
  divisionLabel: string;
  month: string;
  backHref: string;
  rows: VendorPdfRow[];
  totalMinor: number;
}) {
  return (
    <article className="vendor-monthly-pdf">
      <style>{PDF_STYLES}</style>
      <div className="vendor-pdf-no-print" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <h1 className="vendor-pdf-title">{title}</h1>
          <p className="vendor-pdf-meta">
            {divisionLabel} · {formatMonthLabel(month)} · 支払 {rows.length} 件
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={backHref}>戻る</Link>
          <PrintButton />
        </div>
      </div>
      <header style={{ marginBottom: 8 }}>
        <h1 className="vendor-pdf-title">{title}</h1>
        <p className="vendor-pdf-meta">{divisionLabel} · {formatMonthLabel(month)}</p>
      </header>
      <table className="vendor-pdf-table">
        <thead>
          <tr>
            <th>日付</th>
            <th>仕入先</th>
            <th>銀行</th>
            <th>支店</th>
            <th className="num">支払額</th>
            <th>摘要</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="empty">
                この月の支払はありません
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <td className="date">{r.transactionDate}</td>
                <td>{r.vendorName || "—"}</td>
                <td>{r.bankName ?? "—"}</td>
                <td>{r.branchName ?? "—"}</td>
                <td className="num">{yen(r.amountMinor)}</td>
                <td>{r.summary ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>合計</td>
            <td className="num">{yen(totalMinor)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </article>
  );
}
