import Link from "next/link";
import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, customers, transactions, vendors } from "@/db/schema";
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

  const balanceSum = (accountId: string, liability = false) =>
    db
      .select({
        v: sql<number>`coalesce(sum(${
          liability
            ? sql`${transactions.creditAmountMinor} - ${transactions.debitAmountMinor}`
            : sql`${transactions.debitAmountMinor} - ${transactions.creditAmountMinor}`
        }),0)`.mapWith(Number),
      })
      .from(transactions)
      .where(sql`${transactions.accountId} = ${accountId}`)
      .then(([r]) => r?.v ?? 0);

  const monthExpenseSum = (accountId: string) =>
    db
      .select({
        v: sql<number>`coalesce(sum(${transactions.debitAmountMinor}),0)`.mapWith(Number),
      })
      .from(transactions)
      .where(
        sql`${transactions.accountId} = ${accountId} and substr(${transactions.transactionDate},1,7) = strftime('%Y-%m','now','localtime')`
      )
      .then(([r]) => r?.v ?? 0);

  const monthRevenueSum = (accountId: string) =>
    db
      .select({
        v: sql<number>`coalesce(sum(${transactions.creditAmountMinor}),0)`.mapWith(Number),
      })
      .from(transactions)
      .where(
        sql`${transactions.accountId} = ${accountId} and substr(${transactions.transactionDate},1,7) = strftime('%Y-%m','now','localtime')`
      )
      .then(([r]) => r?.v ?? 0);

  const [arSeko, arKiko, apKaikake, apGaichu, salesSeko, salesKiko, purchaseMonth, outsourceMonth] = await Promise.all([
    balanceSum(sys.arId),
    balanceSum(sys.arKikoId),
    balanceSum(sys.apId, true),
    balanceSum(sys.apOutsourceId, true),
    monthRevenueSum(sys.salesId),
    monthRevenueSum(sys.salesKikoId),
    monthExpenseSum(sys.purchasesId),
    monthExpenseSum(sys.outsourceExpenseId),
  ]);

  const metricCards = [
    { label: "売掛（施工部）", value: yen(arSeko), tone: "from-cyan-600/25 to-sky-600/10" },
    { label: "売掛（機工部）", value: yen(arKiko), tone: "from-teal-600/25 to-cyan-600/10" },
    { label: "買掛金", value: yen(apKaikake), tone: "from-blue-700/25 to-indigo-600/10" },
    { label: "外注費（未払）", value: yen(apGaichu), tone: "from-indigo-600/25 to-violet-600/10" },
    { label: "当月売上（施工）", value: yen(salesSeko), tone: "from-emerald-500/25 to-cyan-600/10" },
    { label: "当月売上（機工）", value: yen(salesKiko), tone: "from-lime-500/25 to-emerald-600/10" },
    { label: "当月仕入", value: yen(purchaseMonth), tone: "from-violet-500/25 to-blue-700/10" },
    { label: "当月外注費", value: yen(outsourceMonth), tone: "from-purple-500/25 to-indigo-700/10" },
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
