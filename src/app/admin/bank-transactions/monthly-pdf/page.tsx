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

function formatMonthLabel(ym: string) {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[1]}年${Number(m[2])}月`;
  return ym;
}

export const dynamic = "force-dynamic";

type LedgerRow = {
  id: string;
  transactionDate: string;
  amountMinor: number;
  counterparty: string | null;
  summary: string | null;
};

function LedgerTable({
  rows,
  emptyLabel,
  amountColor,
  total,
}: {
  rows: LedgerRow[];
  emptyLabel: string;
  amountColor: string;
  total: number;
}) {
  return (
    <table className="bank-pdf-table">
      <thead>
        <tr>
          <th>日付</th>
          <th className="num">金額</th>
          <th>相手先</th>
          <th>摘要</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={4} className="empty">
              {emptyLabel}
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.id}>
              <td className="date">{r.transactionDate}</td>
              <td className="num" style={{ color: amountColor }}>
                {yen(r.amountMinor)}
              </td>
              <td>{r.counterparty ?? "—"}</td>
              <td className="summary">{r.summary ?? "—"}</td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot>
        <tr>
          <td>合計</td>
          <td className="num" style={{ color: amountColor }}>
            {yen(total)}
          </td>
          <td colSpan={2} />
        </tr>
      </tfoot>
    </table>
  );
}

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

  const inRows: LedgerRow[] = ins.map((r) => ({
    id: r.id,
    transactionDate: r.transactionDate,
    amountMinor: r.amountMinor,
    counterparty: r.counterparty,
    summary: r.summary,
  }));
  const outRows: LedgerRow[] = outs.map((r) => ({
    id: r.id,
    transactionDate: r.transactionDate,
    amountMinor: r.amountMinor,
    counterparty: r.counterparty,
    summary: r.summary,
  }));

  return (
    <article className="bank-monthly-pdf">
      <style>{`
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

        .bank-monthly-pdf {
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
          .bank-monthly-pdf {
            max-width: none;
            padding: 0 !important;
          }
          .bank-pdf-no-print {
            display: none !important;
          }
          .bank-pdf-section {
            break-inside: avoid-page;
            page-break-inside: avoid;
          }
          .bank-pdf-table {
            break-inside: auto;
            page-break-inside: auto;
          }
          .bank-pdf-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }

        .bank-pdf-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .bank-pdf-title {
          margin: 0;
          font-size: 1.35rem;
          font-weight: 900;
          letter-spacing: 0.06em;
        }

        .bank-pdf-meta {
          margin: 4px 0 0;
          font-size: 0.85rem;
          font-weight: 700;
          color: #64748b;
        }

        .bank-pdf-opening {
          margin-bottom: 12px;
          padding: 10px 12px;
          border: 1px solid #a5b4fc;
          border-radius: 6px;
          background: #eef2ff;
        }

        .bank-pdf-opening-label {
          font-size: 0.8rem;
          font-weight: 800;
          color: #4338ca;
          letter-spacing: 0.1em;
        }

        .bank-pdf-opening-amount {
          margin-top: 2px;
          font-size: 1.35rem;
          font-weight: 900;
          color: #312e81;
          font-variant-numeric: tabular-nums;
        }

        .bank-pdf-opening-note {
          margin-top: 2px;
          font-size: 0.72rem;
          font-weight: 600;
          color: #6366f1;
        }

        .bank-pdf-section {
          margin-bottom: 14px;
        }

        .bank-pdf-section-title {
          margin: 0 0 6px;
          padding: 4px 8px;
          font-size: 0.95rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          border-radius: 4px;
        }

        .bank-pdf-section-title.in {
          color: #0369a1;
          background: #e0f2fe;
        }

        .bank-pdf-section-title.out {
          color: #b91c1c;
          background: #fee2e2;
        }

        .bank-pdf-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.72rem;
          line-height: 1.35;
        }

        .bank-pdf-table th,
        .bank-pdf-table td {
          border: 1px solid #cbd5e1;
          padding: 3px 5px;
          vertical-align: top;
          text-align: left;
        }

        .bank-pdf-table th {
          background: #f1f5f9;
          font-weight: 800;
          white-space: nowrap;
        }

        .bank-pdf-table td.num,
        .bank-pdf-table th.num {
          text-align: right;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }

        .bank-pdf-table td.date {
          white-space: nowrap;
        }

        .bank-pdf-table td.summary {
          word-break: break-word;
        }

        .bank-pdf-table td.empty {
          color: #94a3b8;
          text-align: center;
        }

        .bank-pdf-table tfoot td {
          font-weight: 800;
          background: #f8fafc;
        }

        .bank-pdf-footer {
          margin-top: 8px;
          font-size: 0.68rem;
          color: #94a3b8;
          font-weight: 600;
        }
      `}</style>

      <div className="bank-pdf-toolbar bank-pdf-no-print">
        <div>
          <h1 className="bank-pdf-title">銀行月次明細</h1>
          <p className="bank-pdf-meta">
            {bankName} · {formatMonthLabel(month)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/bank-transactions">戻る</Link>
          <PrintButton />
        </div>
      </div>

      <header className="bank-pdf-section" style={{ marginBottom: 10 }}>
        <h1 className="bank-pdf-title" style={{ fontSize: "1.15rem" }}>
          銀行月次明細（入出金）
        </h1>
        <p className="bank-pdf-meta">
          {bankName} · {formatMonthLabel(month)} · 入金 {ins.length} 件 / 出金 {outs.length} 件
        </p>
      </header>

      {opening ? (
        <section className="bank-pdf-opening bank-pdf-section">
          <div className="bank-pdf-opening-label">期首残高</div>
          <div className="bank-pdf-opening-amount">{yen(opening.amountMinor)}</div>
          <div className="bank-pdf-opening-note">
            {opening.transactionDate}（入金合計・月次集計には含めません）
          </div>
        </section>
      ) : null}

      <section className="bank-pdf-section">
        <h2 className="bank-pdf-section-title in">入金</h2>
        <LedgerTable rows={inRows} emptyLabel="入金なし" amountColor="#0369a1" total={inTotal} />
      </section>

      <section className="bank-pdf-section">
        <h2 className="bank-pdf-section-title out">出金</h2>
        <LedgerTable rows={outRows} emptyLabel="出金なし" amountColor="#b91c1c" total={outTotal} />
      </section>

      <p className="bank-pdf-footer bank-pdf-no-print">
        印刷時はメニュー・サイドバーを除き、上記の入出金明細のみが出力されます。ブラウザの「PDFに保存」で2〜3ページ程度に収まるようコンパクト表示しています。
      </p>
    </article>
  );
}
