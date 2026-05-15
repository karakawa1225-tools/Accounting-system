import Link from "next/link";

const card =
  "rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm backdrop-blur-sm";

function FlowStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-lg font-black text-white shadow">
        {n}
      </span>
      <div>
        <div className="font-extrabold tracking-wide text-slate-900">{title}</div>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-600">{body}</p>
      </div>
    </li>
  );
}

function ScreenCard({
  icon,
  title,
  href,
  steps,
}: {
  icon: string;
  title: string;
  href: string;
  steps: string[];
}) {
  return (
    <article className={card}>
      <div className="flex items-start gap-4">
        <span className="text-4xl" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-xl font-black tracking-wide text-slate-900">
            <Link href={href} className="text-cyan-800 hover:underline">
              {title}
            </Link>
          </h2>
          <ol className="mt-4 grid list-none gap-3 p-0">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm font-semibold text-slate-700">
                <span className="text-cyan-600">▸</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </article>
  );
}

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-16">
      <header className="rounded-3xl border border-cyan-200 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 p-8 text-white shadow-xl">
        <p className="m-0 text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Silverjet Console</p>
        <h1 className="mt-3 text-3xl font-black tracking-wide sm:text-4xl">取扱説明書</h1>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-relaxed text-slate-300">
          会計システムを初めて使う方向けの操作ガイドです。画面の流れ・入力のコツ・月次の PDF / CSV 出力まで、項目別に説明します。
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold">
          <Link href="/admin/masters" className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20">
            マスタ管理へ
          </Link>
          <Link href="/admin/csv-guide" className="rounded-lg bg-cyan-500/30 px-4 py-2 hover:bg-cyan-500/50">
            CSVガイド
          </Link>
        </div>
      </header>

      <section className={card}>
        <h2 className="m-0 text-lg font-black text-slate-900">🗺️ おすすめの導入順序</h2>
        <ol className="mt-6 grid list-none gap-6 p-0">
          <FlowStep n={1} title="会計設定" body="自社設定で会計期間の開始日・終了日を登録します。期首残高の保存にも必要です。" />
          <FlowStep n={2} title="マスタ登録" body="勘定科目区分 → 勘定科目 → 顧客・仕入先・支払先の順がおすすめです。CSV一括取込も利用できます。" />
          <FlowStep n={3} title="期首残高" body="マスタ管理の期首残高タブで、期首時点の各勘定残高を入力します（未入力は 0 円表示）。" />
          <FlowStep n={4} title="日次処理" body="売掛・買掛・入出金を記録し、ダッシュボードで残高を確認します。" />
        </ol>
        <pre className="mt-6 overflow-x-auto rounded-xl bg-slate-100 p-4 text-xs font-bold text-slate-700">
{`会計設定 → マスタ(CSV可) → 期首残高 → 売掛 / 買掛 / 入出金 → 月次PDF・CSV`}
        </pre>
      </section>

      <div className="grid gap-6 md:grid-cols-1">
        <ScreenCard
          icon="🏦"
          title="入出金管理"
          href="/admin/bank-transactions"
          steps={[
            "自社設定で銀行口座と前期末残高（今期期首の前日時点）を登録し、入出金画面でその口座を選択します。",
            "「新規登録」→ 入金 or 出金 → 日付・金額・相手勘定科目を入力して登録。",
            "入金は青、出金は赤で通帳風に一覧表示されます。",
            "対象月を選び「月次明細 PDF」で左=入金・右=出金の印刷用画面、「CSV」でダウンロード。",
          ]}
        />
        <ScreenCard
          icon="📥"
          title="売掛管理"
          href="/admin/receivables"
          steps={[
            "「売上登録」で顧客・税抜金額・税率を入力すると売掛金が増えます。",
            "残高一覧から「入金消込」で、古い売上から自動で充当（FIFO）されます。",
            "履歴の月を選び「月別入金 PDF / CSV」で顧客別入金一覧を出力。",
          ]}
        />
        <ScreenCard
          icon="📤"
          title="買掛管理"
          href="/admin/payables"
          steps={[
            "「仕入登録」で仕入先・金額を入力すると買掛金が増えます。",
            "「支払消込」で買掛を支払います。仕入先マスタの銀行名・支店名は振込リストに反映されます。",
            "月別支払 PDF/CSV … 日付・仕入先・金額の一覧。",
            "仕入先振込 PDF/CSV … 仕入先名・銀行名・支店名付き（振込作業用）。",
          ]}
        />
        <ScreenCard
          icon="📋"
          title="マスタ管理"
          href="/admin/masters"
          steps={[
            "各タブに検索ボックスがあります（例: 勘定科目で「現金」）。",
            "仕入先 CSV には振込銀行名・支店名・口座情報の列があります。",
            "期首残高は会計期間開始日設定後に保存できます。",
          ]}
        />
        <ScreenCard
          icon="✈️"
          title="BizGO精算"
          href="/admin/bizgo"
          steps={[
            "経費精算書・出張経費精算書の CSV を取込み、月別・区分別・消費税別に確認。",
            "CSV の「区分」列は勘定科目名またはコードと照合されます。",
          ]}
        />
      </div>

      <section className={card}>
        <h2 className="m-0 text-lg font-black text-slate-900">🖨️ PDF・CSV の出し方</h2>
        <ul className="mt-4 grid gap-3 text-sm font-semibold text-slate-700">
          <li>
            <strong>PDF</strong> … ボタンで印刷用ページを開き、「印刷 / PDF保存」→ 送信先で「PDFに保存」（Chrome / Edge）。
          </li>
          <li>
            <strong>CSV</strong> … ボタンを押すとファイルがダウンロードされます。Excel で開く場合は UTF-8（BOM付き）のまま利用できます。
          </li>
        </ul>
      </section>

      <section className={`${card} border-amber-200 bg-amber-50/80`}>
        <h2 className="m-0 text-lg font-black text-amber-950">⚠️ 「標準勘定がありません」エラー</h2>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-amber-900">
          銀行・売掛・買掛などの内部処理用勘定（SYS_BANK など）が DB に無いときに表示されます。通常は画面を開いたときに自動作成されます。解消しない場合はプロジェクトフォルダで次を実行してください。
        </p>
        <pre className="mt-4 rounded-lg bg-slate-900 p-4 text-sm font-mono text-cyan-200">npm run db:ensure-system-accounts</pre>
      </section>
    </div>
  );
}
