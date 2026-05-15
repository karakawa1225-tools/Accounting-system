import Link from "next/link";
import { cookies } from "next/headers";
import { sessionCookieName, verifySessionToken } from "@/lib/session";

export default async function HomePage() {
  const token = (await cookies()).get(sessionCookieName)?.value;
  const session = await verifySessionToken(token);
  const isAuthed = Boolean(session);
  const isAdmin = session?.role === "admin";

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.22),transparent),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(59,130,246,0.18),transparent),radial-gradient(ellipse_50%_30%_at_0%_100%,rgba(99,102,241,0.12),transparent)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,rgba(148,163,184,0.9)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.9)_1px,transparent_1px)] [background-size:64px_64px]" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="font-brand text-xl font-black tracking-[0.2em] text-transparent sm:text-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 bg-clip-text">
          Silverjet
        </span>
        <nav className="flex flex-wrap items-center gap-3 text-xs font-bold tracking-[0.14em] sm:gap-4 sm:text-sm">
          {isAuthed ? (
            <>
              <Link className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-cyan-200 transition hover:bg-cyan-500/20" href="/admin/masters">
                業務へ
              </Link>
              <Link className="rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-2 text-slate-200 transition hover:bg-slate-700/80" href="/dashboard">
                ダッシュボード
              </Link>
            </>
          ) : (
            <Link
              className="rounded-lg border border-cyan-400/50 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 px-5 py-2.5 text-cyan-100 shadow-[0_0_24px_-4px_rgba(34,211,238,0.45)] transition hover:from-cyan-500/30 hover:to-blue-600/30"
              href="/login"
            >
              ログイン
            </Link>
          )}
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20 pt-8 sm:px-10 sm:pt-14">
        <p className="text-xs font-bold tracking-[0.35em] text-cyan-300/90 sm:text-sm">DOUBLE-ENTRY · AR / AP</p>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl font-black leading-[1.15] tracking-[0.06em] text-white sm:text-5xl md:text-6xl">
          売掛・買掛とマスタを、
          <span className="block bg-gradient-to-r from-cyan-200 via-white to-blue-200 bg-clip-text text-transparent">一本の流れで。</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-semibold leading-relaxed tracking-wide text-slate-400 sm:text-lg">
          複式簿記の整合性を保ちながら、顧客・仕入先・自社設定までをまとめて扱える、軽量な会計オペレーション用コンソールです。
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          {isAuthed ? (
            <Link
              href="/admin/masters"
              className="inline-flex min-w-[200px] justify-center rounded-xl border border-cyan-400/50 bg-gradient-to-r from-cyan-500 to-sky-600 px-8 py-4 text-sm font-black tracking-[0.18em] text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:brightness-110"
            >
              業務を開始
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex min-w-[200px] justify-center rounded-xl border border-cyan-400/50 bg-gradient-to-r from-cyan-500 to-sky-600 px-8 py-4 text-sm font-black tracking-[0.18em] text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:brightness-110"
            >
              サインイン
            </Link>
          )}
          {isAuthed ? (
            <Link
              href="/dashboard"
              className="inline-flex min-w-[200px] justify-center rounded-xl border border-slate-600 bg-slate-900/80 px-8 py-4 text-sm font-black tracking-[0.14em] text-slate-200 backdrop-blur transition hover:border-slate-500 hover:bg-slate-800/90"
            >
              概要ダッシュボード
            </Link>
          ) : (
            <a
              href="#modules"
              className="inline-flex min-w-[200px] justify-center rounded-xl border border-slate-600 bg-slate-900/80 px-8 py-4 text-sm font-black tracking-[0.14em] text-slate-200 backdrop-blur transition hover:border-slate-500 hover:bg-slate-800/90"
            >
              機能一覧へ
            </a>
          )}
        </div>
      </section>

      <section id="modules" className="relative z-10 mx-auto scroll-mt-24 grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-3 sm:px-10">
        {[
          { t: "マスタ管理", d: "勘定科目・顧客・仕入先を一括で。CSV取込にも対応。", href: "/admin/masters", adminOnly: false },
          {
            t: "CSV取込ガイド",
            d: "はじめて向けの流れ・列の説明・ダウンロード用サンプル。",
            href: "/admin/csv-guide",
            adminOnly: false,
          },
          { t: "売掛 / 買掛", d: "税込計算から入金・支払消込まで、仕訳と紐づけて記録。", href: "/admin/receivables", adminOnly: false },
          { t: "自社・銀行", d: "会社情報・会計期間・自社口座を管理者が保存。", href: "/admin/company", adminOnly: true },
        ]
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => (
          <Link
            key={item.t}
            href={item.href}
            className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur transition hover:border-cyan-500/40 hover:bg-slate-900/90"
          >
            <h2 className="text-lg font-black tracking-[0.08em] text-white group-hover:text-cyan-200">{item.t}</h2>
            <p className="mt-3 text-sm font-semibold leading-relaxed tracking-wide text-slate-500 group-hover:text-slate-400">{item.d}</p>
            <span className="mt-4 inline-block text-xs font-bold tracking-[0.2em] text-cyan-400/80">OPEN →</span>
          </Link>
        ))}
      </section>

      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950/90 px-6 py-6 text-center text-xs font-bold tracking-[0.12em] text-slate-600 sm:px-10">
        Silverjet · Accounting operations console
      </footer>
    </main>
  );
}
