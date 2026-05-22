import Link from "next/link";
import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, customers, vendors } from "@/db/schema";
import {
  currentMonthYmJst,
  listArBookLedgerRows,
  listArOrphanLedgerRows,
  sumApBookBalanceMinor,
  sumArBookBalanceMinor,
  sumMonthlyApPurchaseMinor,
  sumMonthlyArSalesMinor,
} from "@/lib/dashboard-metrics";
import { getSystemAccounts } from "@/lib/system-accounts";
import { sessionCookieName, verifySessionToken } from "@/lib/session";

function yen(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function DashboardPage() {
  const tok = (await cookies()).get(sessionCookieName)?.value;
  const session = await verifySessionToken(tok);
  const isAdmin = session?.role === "admin";

  const db = getDb();
  const sys = await getSystemAccounts(db);
  const [accCount, customerCount, vendorCount] = await Promise.all([
    db.select({ c: sql<number>`count(*)`.mapWith(Number) }).from(accounts),
    db.select({ c: sql<number>`count(*)`.mapWith(Number) }).from(customers),
    db.select({ c: sql<number>`count(*)`.mapWith(Number) }).from(vendors),
  ]);

  const monthYm = currentMonthYmJst();

  const [arSeko, arKiko, apKaikake, apGaichu, salesSeko, salesKiko, purchaseMonth, outsourceMonth, sekoLedger, sekoOrphans] =
    await Promise.all([
      sumArBookBalanceMinor(db, sys, "seko"),
      sumArBookBalanceMinor(db, sys, "kiko"),
      sumApBookBalanceMinor(db, sys, "kaikake"),
      sumApBookBalanceMinor(db, sys, "gaichu"),
      sumMonthlyArSalesMinor(db, sys, "seko", monthYm),
      sumMonthlyArSalesMinor(db, sys, "kiko", monthYm),
      sumMonthlyApPurchaseMinor(db, sys, "kaikake", monthYm),
      sumMonthlyApPurchaseMinor(db, sys, "gaichu", monthYm),
      listArBookLedgerRows(db, sys, "seko"),
      listArOrphanLedgerRows(db, sys, "seko"),
    ]);

  const metricCards = [
    { label: "売掛（施工部）", value: yen(arSeko), tone: "from-cyan-600/25 to-sky-600/10" },
    { label: "売掛（機工部）", value: yen(arKiko), tone: "from-teal-600/25 to-cyan-600/10" },
    { label: "買掛金", value: yen(apKaikake), tone: "from-blue-700/25 to-indigo-600/10" },
    { label: "外注費（未払）", value: yen(apGaichu), tone: "from-indigo-600/25 to-violet-600/10" },
    { label: `当月売上（施工） ${monthYm}`, value: yen(salesSeko), tone: "from-emerald-500/25 to-cyan-600/10" },
    { label: `当月売上（機工） ${monthYm}`, value: yen(salesKiko), tone: "from-lime-500/25 to-emerald-600/10" },
    { label: `当月仕入 ${monthYm}`, value: yen(purchaseMonth), tone: "from-violet-500/25 to-blue-700/10" },
    { label: `当月外注費 ${monthYm}`, value: yen(outsourceMonth), tone: "from-purple-500/25 to-indigo-700/10" },
  ];

  const masterCards = [
    { label: "勘定科目", value: accCount[0]?.c ?? 0, href: "/admin/masters" },
    { label: "顧客", value: customerCount[0]?.c ?? 0, href: "/admin/masters" },
    { label: "仕入先", value: vendorCount[0]?.c ?? 0, href: "/admin/masters" },
  ];

  return (
    <main className="space-y-5 p-5 sm:p-7">
      <section className="rounded-2xl border border-slate-300 bg-gradient-to-r from-slate-900 via-blue-950 to-cyan-950 p-5 text-slate-100 shadow-lg">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-brand text-xs tracking-[0.28em] text-cyan-200/90">FINANCE OVERVIEW</p>
            <h1 className="mt-1 text-3xl font-black tracking-[0.12em] sm:text-4xl">DASHBOARD</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold tracking-[0.12em]">
            <Link className="rounded-md border border-cyan-300/50 bg-cyan-500/10 px-3 py-2 hover:bg-cyan-400/20" href="/admin/masters">
              MASTER
            </Link>
            <Link className="rounded-md border border-teal-300/50 bg-teal-500/10 px-3 py-2 hover:bg-teal-400/20" href="/admin/csv-guide">
              CSVガイド
            </Link>
            <Link className="rounded-md border border-sky-300/50 bg-sky-500/10 px-3 py-2 hover:bg-sky-400/20" href="/admin/receivables">
              RECEIVABLES
            </Link>
            <Link className="rounded-md border border-blue-300/50 bg-blue-500/10 px-3 py-2 hover:bg-blue-400/20" href="/admin/payables/kaikake">
              AP 買掛
            </Link>
            <Link className="rounded-md border border-indigo-300/50 bg-indigo-500/10 px-3 py-2 hover:bg-indigo-400/20" href="/admin/payables/gaichu">
              AP 外注
            </Link>
            {isAdmin ? (
              <Link className="rounded-md border border-indigo-300/50 bg-indigo-500/10 px-3 py-2 hover:bg-indigo-400/20" href="/admin/company">
                COMPANY
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((m) => (
          <article key={m.label} className={`rounded-xl border border-slate-300 bg-gradient-to-br ${m.tone} p-4 shadow-sm backdrop-blur`}>
            <p className="text-xs font-bold tracking-[0.18em] text-slate-600">{m.label}</p>
            <p className="mt-3 text-2xl font-black tracking-[0.08em] text-slate-900">{m.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-black tracking-[0.08em] text-slate-900">
          施工部 売掛明細（日付昇順）
        </h2>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          売掛残高 {yen(arSeko)} ＝ 売上・入金消込のみ。入出金画面の cash が売掛勘定に付いていると残高から差し引かれます。
        </p>
        {sekoOrphans.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
            売掛勘定に売掛管理外の仕訳が {sekoOrphans.length} 件あります。旧表示では入金
            {yen(
              sekoOrphans.reduce((s, r) => s + Number(r.creditAmountMinor ?? 0), 0)
            )}
            分が残高から引かれていました。例: {String(sekoOrphans[0].transactionDate)}{" "}
            {String(sekoOrphans[0].kind)} {String(sekoOrphans[0].summary ?? "")}
          </div>
        ) : null}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-2 py-2 font-bold text-slate-600">日付</th>
                <th className="px-2 py-2 font-bold text-slate-600">区分</th>
                <th className="px-2 py-2 font-bold text-slate-600">顧客</th>
                <th className="px-2 py-2 text-right font-bold text-slate-600">金額</th>
                <th className="px-2 py-2 font-bold text-slate-600">摘要</th>
              </tr>
            </thead>
            <tbody>
              {sekoLedger.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-3 text-slate-500">
                    明細なし
                  </td>
                </tr>
              ) : (
                sekoLedger.map((r, i) => (
                  <tr key={`${r.transactionDate}-${r.kind}-${i}`} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-2 py-2">{r.transactionDate}</td>
                    <td className="px-2 py-2">{r.kindLabel}</td>
                    <td className="px-2 py-2">{r.customerName ?? "—"}</td>
                    <td
                      className={`px-2 py-2 text-right font-semibold tabular-nums ${r.flow === "in" ? "text-cyan-800" : "text-rose-700"}`}
                    >
                      {r.flow === "in" ? "+" : "−"}
                      {yen(r.amountMinor)}
                    </td>
                    <td className="px-2 py-2">{r.summary ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black tracking-[0.08em] text-slate-900">キャッシュフロー波形 (概況)</h2>
            <span className="text-xs font-bold tracking-[0.1em] text-slate-500">SIMULATED VIEW</span>
          </div>
          <div className="relative h-52 overflow-hidden rounded-lg border border-slate-200 bg-slate-950/95">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,.22),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,.2),transparent_40%)]" />
            <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(to_right,rgba(148,163,184,.32)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,.3)_1px,transparent_1px)] [background-size:38px_38px]" />
            <div className="absolute bottom-7 left-0 right-0 h-16 bg-gradient-to-r from-cyan-400/30 via-blue-400/20 to-indigo-400/30 blur-lg" />
            <svg viewBox="0 0 800 220" className="absolute inset-0 h-full w-full">
              <path d="M0 150 C80 80, 170 185, 250 130 C320 85, 420 170, 500 125 C570 92, 660 150, 800 90" fill="none" stroke="#22d3ee" strokeWidth="4" />
              <path d="M0 170 C95 145, 180 95, 260 140 C350 190, 410 80, 510 150 C600 210, 690 120, 800 140" fill="none" stroke="#60a5fa" strokeWidth="4" opacity=".95" />
            </svg>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold tracking-[0.08em] text-slate-600 sm:grid-cols-4">
            <div className="rounded-md bg-cyan-50 px-3 py-2">入力トレンド: 安定</div>
            <div className="rounded-md bg-blue-50 px-3 py-2">出力トレンド: 変動</div>
            <div className="rounded-md bg-emerald-50 px-3 py-2">売掛回収: 良好</div>
            <div className="rounded-md bg-violet-50 px-3 py-2">資金余力: 監視中</div>
          </div>
        </article>

        <article className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black tracking-[0.08em] text-slate-900">マスタ状況</h2>
          <div className="mt-3 space-y-2">
            {masterCards.map((m) => (
              <Link key={m.label} href={m.href} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 hover:bg-slate-100">
                <span className="text-sm font-bold tracking-[0.08em] text-slate-700">{m.label}</span>
                <span className="font-brand text-2xl font-black tracking-[0.1em] text-cyan-700">{m.value}</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-gradient-to-r from-cyan-50 to-blue-50 px-3 py-3">
            <p className="text-xs font-bold tracking-[0.12em] text-slate-600">NEXT ACTION</p>
            <p className="mt-1 text-sm font-bold tracking-[0.06em] text-slate-800">
              残高差異が大きい先を、施工部・機工部・買掛金・外注費の各管理画面から優先確認してください。
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
