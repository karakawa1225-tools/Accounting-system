import Link from "next/link";

const templates = [
  {
    id: "kamoku-kubun",
    file: "/csv-templates/kamoku-kubun.csv",
    title: "勘定科目区分マスタ",
    screen: "/admin/masters（勘定科目タブ上部）",
    description: "先に自分の会社用の「区分」（例: 流動資産の部・販管費）を登録します。",
    cols: [
      ["区分コード", "任意。空欄時は区分名称のみで検索されます。", "はい"],
      ["区分名称", "画面に出る名前。必須。", "いいえ"],
      ["財務区分", "asset / liability / equity / revenue / expense。または「資産の部」など日本語も可。", "いいえ"],
      ["表示順", "並び順の数値。省略時は 0。", "はい"],
    ],
  },
  {
    id: "kamoku",
    file: "/csv-templates/kamoku.csv",
    title: "勘定科目",
    screen: "/admin/masters（勘定科目タブ・勘定CSV取込）",
    description:
      "各列が「マスタと同じ並び」であることが重要です。1行目は説明用の見出しで、システムは2行目から読みます。",
    cols: [
      ["勘定側区分コード", "勘定科目区分マスタのコードと一致させると確実に紐づきます。", "はい"],
      ["勘定側区分名称", "コードが空のとき、区分名称でマスタを探します。", "はい"],
      ["勘定科目コード", "任意。同じコードがあれば上書き更新されます。", "はい"],
      ["勘定科目名", "必須。", "いいえ"],
      ["バーコード用コード", "任意。", "はい"],
    ],
  },
  {
    id: "kokyaku",
    file: "/csv-templates/kokyaku.csv",
    title: "顧客",
    screen: "/admin/masters（顧客タブ）",
    description: "売掛の相手先として使います。",
    cols: [
      ["顧客コード", "同じコードがあれば更新。", "はい"],
      ["顧客名", "必須。", "いいえ"],
      ["バーコード用コード", "任意。", "はい"],
      ["郵便番号", "任意。", "はい"],
      ["住所", "任意。", "はい"],
      ["電話", "任意。", "はい"],
      ["締日", "任意（数値や「末」など）。", "はい"],
      ["支払いサイト", "例: 末締め翌末払い。", "はい"],
    ],
  },
  {
    id: "shiire",
    file: "/csv-templates/shiire.csv",
    title: "仕入先",
    screen: "/admin/masters（仕入先タブ）",
    description: "買掛の相手先として使います。",
    cols: [
      ["仕入先コード", "同じコードがあれば更新。", "はい"],
      ["仕入先名", "必須。", "いいえ"],
      ["バーコード用コード", "任意。", "はい"],
      ["振込銀行名", "任意。", "はい"],
      ["支店名", "任意。", "はい"],
      ["口座区分", "任意。", "はい"],
      ["口座番号", "任意。", "はい"],
    ],
  },
  {
    id: "shiharai",
    file: "/csv-templates/shiharai.csv",
    title: "支払先",
    screen: "/admin/masters（支払先タブ）",
    description: "入出金で「相手先」として選ぶ名前です。",
    cols: [
      ["支払先コード", "同じコードがあれば更新。", "はい"],
      ["支払先", "必須。", "いいえ"],
      ["区分", "例: 給与・役員報酬・仕入・その他（自由記述）。", "はい"],
    ],
  },
] as const;

function FlowIllustration() {
  const steps = [
    { icon: "📝", label: "表を作る", sub: "Excel・スプレッドシート" },
    { icon: "💾", label: "CSVで保存", sub: "UTF-8推奨" },
    { icon: "📤", label: "マスタで取込", sub: "ファイルを選択" },
    { icon: "✅", label: "一覧を確認", sub: "エラー時は列を確認" },
  ];
  const nodes = steps.flatMap((s, i) => [
    <div
      key={s.label}
      className="flex h-[100px] w-[min(100%,148px)] flex-col items-center justify-center rounded-2xl border-2 border-cyan-200 bg-white px-2 text-center shadow-sm"
      aria-hidden
    >
      <span className="text-3xl leading-none">{s.icon}</span>
      <span className="mt-1 text-xs font-black text-slate-800">{s.label}</span>
      <span className="text-[10px] font-semibold leading-tight text-slate-500">{s.sub}</span>
    </div>,
    ...(i < steps.length - 1
      ? [
          <span key={`arr-${i}`} className="flex items-center justify-center text-2xl font-bold text-cyan-500" aria-hidden>
            <span className="md:hidden">↓</span>
            <span className="hidden md:inline">→</span>
          </span>,
        ]
      : []),
  ]);

  return (
    <div className="rounded-2xl border-2 border-dashed border-cyan-300/80 bg-gradient-to-br from-white to-cyan-50/80 p-6 shadow-inner">
      <p className="mb-4 text-center text-sm font-bold text-slate-600">はじめての流れ（イメージ）</p>
      <div className="flex flex-col items-center gap-2 md:flex-row md:flex-wrap md:justify-center md:gap-1">{nodes}</div>
    </div>
  );
}

function ColumnGraphic() {
  return (
    <svg viewBox="0 0 400 120" className="mx-auto h-auto w-full max-w-md text-slate-700" aria-hidden>
      <title>CSVの列イメージ</title>
      <rect x="8" y="20" width="384" height="36" rx="6" fill="#e0f2fe" stroke="#06b6d4" strokeWidth="2" />
      <text x="20" y="44" fill="#0f172a" fontSize="13" fontWeight="700" fontFamily="system-ui,sans-serif">
        A列｜ B列｜ C列｜ …（1行目は見出し・スキップ）
      </text>
      <rect x="8" y="70" width="384" height="36" rx="6" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
      <text x="20" y="94" fill="#475569" fontSize="12" fontWeight="600" fontFamily="system-ui,sans-serif">
        2行目からデータ ● 並び順が説明どおりであることが最重要
      </text>
    </svg>
  );
}

export default function CsvGuidePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-12">
      <div>
        <p className="text-sm font-black tracking-[0.2em] text-cyan-700">マスタ管理</p>
        <h1 className="mt-2 text-3xl font-black tracking-wide text-slate-900 sm:text-4xl">CSV取り込みガイド</h1>
        <p className="mt-3 text-base font-semibold leading-relaxed text-slate-600">
          このシステムで使えるCSVの<strong>列の順番</strong>と<strong>おすすめの取り込み順</strong>をまとめました。サンプルファイルをダウンロードして、そのまま編集しても使えます。
        </p>
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-950">
          サンプルCSVは <strong>UTF-8（BOM付き）</strong> です。WindowsのExcelで開いても日本語が文字化けしにくい形式です。取込はこのまま（BOM付きのまま）で問題ありません。
        </p>
      </div>

      <FlowIllustration />

      <section className="rounded-2xl border border-amber-200 bg-amber-50/90 p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-black text-amber-950">
          <span className="text-2xl" aria-hidden>
            ⚠️
          </span>
          つまずきやすいポイント
        </h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm font-semibold text-amber-950/90">
          <li>
            <strong>1行目は見出し行</strong>として扱われ、<strong>データは2行目から</strong>読み込まれます（見出しの文字は自由でOK。列の<strong>位置</strong>だけ合わせてください）。
          </li>
          <li>区切りは<strong>カンマ（,）</strong>です。セル内にカンマを入れる場合は、値をダブルクォートで囲みます。</li>
          <li>
            Excelで保存する場合は<strong>「CSV UTF-8（コンマ区切り）」</strong>など、文字化けしない形式を選ぶと安全です。
          </li>
          <li>勘定科目を取り込む前に、できるだけ<strong>勘定科目区分マスタ</strong>と<strong>コードの対応</strong>を用意しておくとスムーズです。</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-sky-200 bg-white p-5 shadow-md">
        <h2 className="text-lg font-black text-slate-900">列（カラム）って何？</h2>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          横一列が「1件のデータ」です。<strong>A列から順番に</strong>意味が決まっているので、空欄にしたい列があっても<strong>コンマで区切りを省略しないでください。</strong>
        </p>
        <div className="mt-4">
          <ColumnGraphic />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-black text-slate-900">おすすめの取り込み順</h2>
        <ol className="space-y-3">
          {[
            "勘定科目区分マスタ（kamoku-kubun.csv）",
            "勘定科目（kamoku.csv）",
            "顧客・仕入先・支払先（必要なものだけ）",
          ].map((t, i) => (
            <li
              key={t}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-800 shadow-sm"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm text-white">
                {i + 1}
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="space-y-8">
        {templates.map((t) => (
          <section key={t.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-cyan-50/50 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-black text-slate-900">{t.title}</h3>
                <a
                  href={t.file}
                  download={`${t.id}-sample.csv`}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-black tracking-wide text-white shadow transition hover:bg-cyan-700"
                >
                  サンプルCSVをダウンロード
                </a>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-600">{t.description}</p>
              <p className="mt-1 text-xs font-bold text-cyan-800">
                取込画面：<Link href="/admin/masters" className="underline hover:text-cyan-950">{t.screen}</Link>
              </p>
            </div>
            <div className="overflow-x-auto px-5 py-4">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="py-2 pr-4 font-black text-slate-800">列（左から順）</th>
                    <th className="py-2 pr-4 font-black text-slate-800">説明</th>
                    <th className="py-2 font-black text-slate-800">空欄OK？</th>
                  </tr>
                </thead>
                <tbody>
                  {t.cols.map(([name, desc, blank]) => (
                    <tr key={name} className="border-b border-slate-100">
                      <td className="py-2.5 pr-4 font-bold text-slate-900">{name}</td>
                      <td className="py-2.5 pr-4 font-semibold text-slate-600">{desc}</td>
                      <td className="py-2.5 font-bold text-cyan-800">{blank}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <Link
          href="/admin/masters"
          className="rounded-xl border-2 border-cyan-500 bg-white px-6 py-3 text-center text-sm font-black text-cyan-800 shadow-sm transition hover:bg-cyan-50"
        >
          マスタ管理へ戻る
        </Link>
        <a
          href="/csv-templates/kamoku-kubun.csv"
          className="rounded-xl bg-slate-800 px-6 py-3 text-center text-sm font-black text-white shadow transition hover:bg-slate-900"
          download="kamoku-kubun-sample.csv"
        >
          区分サンプルだけ先に落とす
        </a>
      </div>
    </div>
  );
}
