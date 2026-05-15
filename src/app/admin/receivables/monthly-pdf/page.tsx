import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { getMonthlyArPaymentLines } from "../actions";

function yen(v: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(v);
}

export const dynamic = "force-dynamic";

export default async function ReceivablesMonthlyPdfPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const p = await searchParams;
  const month = p.month && /^\d{4}-\d{2}$/.test(p.month) ? p.month : new Date().toISOString().slice(0, 7);
  const report = await getMonthlyArPaymentLines(month);

  return (
    <main style={{ background: "#fff", minHeight: "100vh", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>月別入金リスト {report.month}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/receivables">戻る</Link>
          <PrintButton />
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>
            <th style={{ padding: 8 }}>日付</th>
            <th style={{ padding: 8 }}>顧客コード</th>
            <th style={{ padding: 8 }}>顧客名</th>
            <th style={{ padding: 8, textAlign: "right" }}>入金額</th>
            <th style={{ padding: 8 }}>摘要</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((r, idx) => (
            <tr key={`${r.transactionDate}-${r.customerCode ?? ""}-${idx}`} style={{ borderTop: "1px solid #e2e8f0" }}>
              <td style={{ padding: 8 }}>{r.transactionDate}</td>
              <td style={{ padding: 8 }}>{r.customerCode ?? "—"}</td>
              <td style={{ padding: 8 }}>{r.customerName ?? "—"}</td>
              <td style={{ padding: 8, textAlign: "right" }}>{yen(r.amountMinor)}</td>
              <td style={{ padding: 8 }}>{r.summary ?? "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid #94a3b8" }}>
            <td style={{ padding: 8 }} colSpan={3}>
              合計
            </td>
            <td style={{ padding: 8, textAlign: "right", fontWeight: 800 }}>{yen(report.totalMinor)}</td>
            <td style={{ padding: 8 }} />
          </tr>
        </tfoot>
      </table>
    </main>
  );
}

