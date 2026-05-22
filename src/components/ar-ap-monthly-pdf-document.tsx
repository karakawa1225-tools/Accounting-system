import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { formatMonthLabel } from "@/lib/transaction-month-filter";

export type ArApPdfRow = {
  id: string;
  transactionDate: string;
  kindLabel: string;
  partyName: string;
  amountMinor: number;
  summary: string | null;
};

function yen(v: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(v);
}

const PDF_STYLES = `
  @media print {
    .admin-print-hide {
      display: none !important;
    }
    body {
      background: #fff !important;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }

  .ar-ap-monthly-pdf {
    max-width: 210mm;
    margin: 0 auto;
    background: #fff;
    color: #0f172a;
  }

  @media print {
    @page {
      size: A4 portrait;
      margin: 10mm 8mm;
    }
    .ar-ap-monthly-pdf {
      max-width: none;
      padding: 0 !important;
    }
    .ar-ap-pdf-no-print {
      display: none !important;
    }
    .ar-ap-pdf-section {
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .ar-ap-pdf-table tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }

  .ar-ap-pdf-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .ar-ap-pdf-title {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 900;
    letter-spacing: 0.06em;
  }

  .ar-ap-pdf-meta {
    margin: 4px 0 0;
    font-size: 0.8rem;
    font-weight: 700;
    color: #64748b;
  }

  .ar-ap-pdf-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.72rem;
    line-height: 1.35;
  }

  .ar-ap-pdf-table th,
  .ar-ap-pdf-table td {
    border: 1px solid #cbd5e1;
    padding: 3px 5px;
    vertical-align: top;
    text-align: left;
  }

  .ar-ap-pdf-table th {
    background: #f1f5f9;
    font-weight: 800;
    white-space: nowrap;
  }

  .ar-ap-pdf-table td.num,
  .ar-ap-pdf-table th.num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .ar-ap-pdf-table td.date,
  .ar-ap-pdf-table td.kind {
    white-space: nowrap;
  }

  .ar-ap-pdf-table td.summary {
    word-break: break-word;
  }

  .ar-ap-pdf-table td.empty {
    color: #94a3b8;
    text-align: center;
  }

  .ar-ap-pdf-table tfoot td {
    font-weight: 800;
    background: #f8fafc;
  }

  .ar-ap-pdf-kind-in {
    color: #0369a1;
    font-weight: 800;
  }

  .ar-ap-pdf-kind-out {
    color: #b91c1c;
    font-weight: 800;
  }
`;

export function ArApMonthlyPdfDocument({
  title,
  divisionLabel,
  month,
  backHref,
  partyColumnLabel,
  rows,
  footerTotals,
}: {
  title: string;
  divisionLabel: string;
  month: string;
  backHref: string;
  partyColumnLabel: string;
  rows: ArApPdfRow[];
  footerTotals: { label: string; amountMinor: number }[];
}) {

  return (
    <article className="ar-ap-monthly-pdf">
      <style>{PDF_STYLES}</style>

      <div className="ar-ap-pdf-toolbar ar-ap-pdf-no-print">
        <div>
          <h1 className="ar-ap-pdf-title">{title}</h1>
          <p className="ar-ap-pdf-meta">
            {divisionLabel} · {formatMonthLabel(month)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={backHref}>戻る</Link>
          <PrintButton />
        </div>
      </div>

      <header className="ar-ap-pdf-section" style={{ marginBottom: 8 }}>
        <h1 className="ar-ap-pdf-title">{title}</h1>
        <p className="ar-ap-pdf-meta">
          {divisionLabel} · {formatMonthLabel(month)} · {rows.length} 件
        </p>
      </header>

      <section className="ar-ap-pdf-section">
        <table className="ar-ap-pdf-table">
          <thead>
            <tr>
              <th>日付</th>
              <th>区分</th>
              <th>{partyColumnLabel}</th>
              <th className="num">金額</th>
              <th>摘要</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty">
                  この月の登録はありません
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="date">{r.transactionDate}</td>
                  <td className={`kind ${r.kindLabel.includes("入") || r.kindLabel.includes("売") ? "ar-ap-pdf-kind-in" : "ar-ap-pdf-kind-out"}`}>
                    {r.kindLabel}
                  </td>
                  <td>{r.partyName || "—"}</td>
                  <td className="num">{yen(r.amountMinor)}</td>
                  <td className="summary">{r.summary ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            {footerTotals.map((t) => (
              <tr key={t.label}>
                <td colSpan={3}>{t.label}</td>
                <td className="num">{yen(t.amountMinor)}</td>
                <td />
              </tr>
            ))}
          </tfoot>
        </table>
      </section>
    </article>
  );
}
