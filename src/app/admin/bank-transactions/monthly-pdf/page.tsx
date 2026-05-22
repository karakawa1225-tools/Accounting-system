import Link from "next/link";
import { eq } from "drizzle-orm";
import { PrintButton } from "@/components/print-button";
import { getDb } from "@/db";
import { accounts } from "@/db/schema";
import { getSystemAccounts } from "@/lib/system-accounts";
import { splitBankLedgerForDisplay } from "@/lib/bank-ledger-display";
import { getBankLedgerLines } from "../actions";

function yen(v: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(v);
}

export const dynamic = "force-dynamic";

export default async function BankMonthlyPdfPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; account?: string }>;
}) {
  const p = await searchParams;
  const month = p.month && /^\d{4}-\d{2}$/.test(p.month) ? p.month : new Date().toISOString().slice(0, 7);
  const db = getDb();
  const sys = await getSystemAccounts(db);
  const bankAccountId = p.account ?? sys.bankId;
  const [acc] = await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, bankAccountId)).limit(1);
  const bankName = acc?.name ?? "銀行口座";

  const lines = await getBankLedgerLines({ month, bankAccountId });
  const { opening, regular } = splitBankLedgerForDisplay(lines);
  const ins = regular.filter((l) => l.flow === "in");
  const outs = regular.filter((l) => l.flow === "out");
  const inTotal = ins.reduce((s, l) => s + l.amountMinor, 0);
  const outTotal = outs.reduce((s, l) => s + l.amountMinor, 0);
  const max = Math.max(ins.length, outs.length);

  const cell: React.CSSProperties = { padding: "6px 8px", fontSize: 13, verticalAlign: "top" };
  const th: React.CSSProperties = { ...cell, fontWeight: 800, borderBottom: "2px solid #334155", background: "#f1f5f9" };

  return (
    <main style={{ background: "#fff", minHeight: "100vh", padding: 24 }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          main { padding: 12px !important; }
        }
      `}</style>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>銀行月次明細</h1>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 600 }}>
            {bankName} · {month}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/bank-transactions">戻る</Link>
          <PrintButton />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
        <section>
          {opening ? (
            <div
              style={{
                marginBottom: 14,
                padding: "12px 14px",
                borderRadius: 8,
                background: "linear-gradient(180deg,#eef2ff,#e0e7ff)",
                border: "1px solid #a5b4fc",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: "#4338ca", letterSpacing: "0.08em" }}>期首残高</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: "#312e81", fontVariantNumeric: "tabular-nums" }}>
                {yen(opening.amountMinor)}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: "#6366f1" }}>
                {opening.transactionDate}（入金合計には含めません）
              </div>
            </div>
          ) : null}
          <h2 style={{ margin: "0 0 8px", fontSize: 16, color: "#0369a1" }}>入金（左）</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>日付</th>
                <th style={{ ...th, textAlign: "right" }}>金額</th>
                <th style={th}>相手先</th>
                <th style={th}>摘要</th>
              </tr>
            </thead>
            <tbody>
              {ins.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={cell}>{r.transactionDate}</td>
                  <td style={{ ...cell, textAlign: "right", color: "#0369a1", fontWeight: 700 }}>{yen(r.amountMinor)}</td>
                  <td style={cell}>{r.counterparty ?? "—"}</td>
                  <td style={cell}>{r.summary ?? "—"}</td>
                </tr>
              ))}
              {ins.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...cell, color: "#94a3b8" }}>
                    入金なし
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #94a3b8" }}>
                <td style={{ ...cell, fontWeight: 800 }}>合計</td>
                <td style={{ ...cell, textAlign: "right", fontWeight: 800, color: "#0369a1" }}>{yen(inTotal)}</td>
                <td colSpan={2} style={cell} />
              </tr>
            </tfoot>
          </table>
        </section>

        <section>
          <h2 style={{ margin: "0 0 8px", fontSize: 16, color: "#b91c1c" }}>出金（右）</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>日付</th>
                <th style={{ ...th, textAlign: "right" }}>金額</th>
                <th style={th}>相手先</th>
                <th style={th}>摘要</th>
              </tr>
            </thead>
            <tbody>
              {outs.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={cell}>{r.transactionDate}</td>
                  <td style={{ ...cell, textAlign: "right", color: "#b91c1c", fontWeight: 700 }}>{yen(r.amountMinor)}</td>
                  <td style={cell}>{r.counterparty ?? "—"}</td>
                  <td style={cell}>{r.summary ?? "—"}</td>
                </tr>
              ))}
              {outs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...cell, color: "#94a3b8" }}>
                    出金なし
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #94a3b8" }}>
                <td style={{ ...cell, fontWeight: 800 }}>合計</td>
                <td style={{ ...cell, textAlign: "right", fontWeight: 800, color: "#b91c1c" }}>{yen(outTotal)}</td>
                <td colSpan={2} style={cell} />
              </tr>
            </tfoot>
          </table>
        </section>
      </div>

      {max > 0 || opening ? (
        <p style={{ marginTop: 16, fontSize: 12, color: "#94a3b8" }}>
          印刷時はブラウザの「PDFに保存」でファイル化できます。
          {opening ? " 期首残高は入金合計外。" : ""} 入金 {ins.length} 件 / 出金 {outs.length} 件
        </p>
      ) : null}
    </main>
  );
}
