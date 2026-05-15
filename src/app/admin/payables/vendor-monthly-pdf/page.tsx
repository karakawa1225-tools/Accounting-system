import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { getMonthlyVendorPaymentLines } from "../actions";

function yen(v: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(v);
}

export const dynamic = "force-dynamic";

export default async function VendorMonthlyPdfPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const p = await searchParams;
  const month = p.month && /^\d{4}-\d{2}$/.test(p.month) ? p.month : new Date().toISOString().slice(0, 7);
  const report = await getMonthlyVendorPaymentLines(month);

  return (
    <main style={{ background: "#fff", minHeight: "100vh", padding: 24 }}>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>仕入先 月別支払一覧 {report.month}</h1>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>振込先銀行・支店情報付き</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/payables">戻る</Link>
          <PrintButton />
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>
            <th style={{ padding: 8 }}>日付</th>
            <th style={{ padding: 8 }}>仕入先名</th>
            <th style={{ padding: 8 }}>銀行名</th>
            <th style={{ padding: 8 }}>支店名</th>
            <th style={{ padding: 8, textAlign: "right" }}>支払額</th>
            <th style={{ padding: 8 }}>摘要</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((r, idx) => (
            <tr key={`${r.transactionDate}-${r.vendorName ?? ""}-${idx}`} style={{ borderTop: "1px solid #e2e8f0" }}>
              <td style={{ padding: 8 }}>{r.transactionDate}</td>
              <td style={{ padding: 8 }}>{r.vendorName ?? "—"}</td>
              <td style={{ padding: 8 }}>{r.bankName ?? "—"}</td>
              <td style={{ padding: 8 }}>{r.branchName ?? "—"}</td>
              <td style={{ padding: 8, textAlign: "right" }}>{yen(r.amountMinor)}</td>
              <td style={{ padding: 8 }}>{r.summary ?? "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid #94a3b8" }}>
            <td style={{ padding: 8 }} colSpan={4}>
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
