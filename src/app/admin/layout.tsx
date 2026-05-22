import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { getCurrentSession } from "@/lib/authz";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  const isAdmin = session?.role === "admin";

  const sideLinks = [
    ["/dashboard", "ダッシュボード"],
    ["/admin/masters", "日次管理"],
    ["/admin/guide", "取扱説明書"],
    ["/admin/csv-guide", "CSVガイド"],
    ["/admin/receivables", "売掛処理"],
    ["/admin/payables", "買掛処理"],
    ["/admin/bank-transactions", "入出金"],
    ["/admin/bizgo", "BizGO精算"],
  ] as const;
  const adminOnlySide = [
    ["/admin/company", "会計設定"],
    ["/admin/users", "ユーザー管理"],
  ] as const;

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#d4d8dd_0%,#eaedf1_48%,#d1d6dc_100%)] text-slate-800 print:bg-white">
      <header className="admin-print-hide sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 bg-white/90 px-5 py-4 shadow-sm backdrop-blur-sm">
        <div className="font-brand text-2xl font-black tracking-[0.16em] text-transparent sm:text-3xl md:text-[2.2rem] bg-gradient-to-r from-cyan-700 via-sky-600 to-blue-600 bg-clip-text">
          Silverjet Console
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-black tracking-[0.12em] sm:text-base">
          <Link href="/dashboard">ダッシュボード</Link>
          <Link href="/admin/masters">マスタ管理</Link>
          <Link href="/admin/guide">取扱説明書</Link>
          <Link href="/admin/csv-guide">CSVガイド</Link>
          <Link href="/admin/receivables">売掛管理</Link>
          <Link href="/admin/payables">買掛管理</Link>
          <Link href="/admin/bank-transactions">入出金</Link>
          <Link href="/admin/bizgo">BizGO精算</Link>
          {isAdmin ? <Link href="/admin/company">自社設定</Link> : null}
          {isAdmin ? <Link href="/admin/users">ユーザー管理</Link> : null}
          <LogoutButton className="rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-200" />
        </nav>
      </header>

      <div className="grid min-h-[calc(100vh-88px)] grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] print:block print:min-h-0">
        <aside className="admin-print-hide border-r border-slate-300/80 bg-white/70 p-3 md:p-4">
          <div className="mb-4 rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50 p-4 text-center shadow-sm">
            <div className="text-xs font-black tracking-[0.18em] text-slate-500">会計</div>
            <div className="mt-2 text-4xl leading-none text-cyan-700">🧮</div>
          </div>

          <div className="grid gap-1">
            {[...sideLinks, ...(isAdmin ? adminOnlySide : [])].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-md px-3 py-2 text-sm font-bold tracking-[0.08em] text-slate-700 transition hover:bg-cyan-100/70 hover:text-cyan-900"
              >
                {label}
              </Link>
            ))}
          </div>
        </aside>

        <div className="px-4 py-5 sm:px-7 sm:py-8 print:p-0">{children}</div>
      </div>
    </div>
  );
}
