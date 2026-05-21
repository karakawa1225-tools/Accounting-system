"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  clearAllBizgoExpense,
  clearAllBizgoTrip,
  clearBizgoExpenseMonth,
  clearBizgoTripMonth,
  importBizgoExpenseCsv,
  importBizgoTripExpenseCsv,
  type BizgoExpenseRow,
  type BizgoImportResult,
  type BizgoTripRow,
} from "./actions";

function yen(v: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(v);
}

function formatMonthLabel(ym: string) {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[1]}年${Number(m[2])}月`;
  return ym;
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #cdd4de",
  borderRadius: 14,
  padding: 20,
  boxShadow: "0 8px 20px rgba(30,41,59,.06)",
};
const btn: React.CSSProperties = {
  border: "none",
  color: "#fff",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: "0.1em",
  background: "linear-gradient(90deg,#06b6d4,#0ea5e9,#3b82f6)",
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  border: "1px solid #94a3b8",
  color: "#334155",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 14,
  fontWeight: 700,
  background: "#f8fafc",
  cursor: "pointer",
};
const tabBtn = (active: boolean): React.CSSProperties => ({
  border: active ? "2px solid #0284c7" : "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "12px 18px",
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: "0.06em",
  background: active ? "linear-gradient(180deg,#e0f2fe,#f0f9ff)" : "#fff",
  color: active ? "#0c4a6e" : "#475569",
  cursor: "pointer",
});
const subTabBtn = (active: boolean): React.CSSProperties => ({
  ...tabBtn(active),
  padding: "8px 14px",
  fontSize: 14,
});

const th: React.CSSProperties = {
  padding: "6px 8px",
  color: "#475569",
  fontWeight: 800,
  fontSize: 13,
  letterSpacing: "0.04em",
  textAlign: "left",
  borderBottom: "2px solid #e2e8f0",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "5px 8px",
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.35,
  borderTop: "1px solid #f1f5f9",
  verticalAlign: "top",
};
const tdWrap: React.CSSProperties = {
  ...td,
  whiteSpace: "normal",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
};

type MainKind = "expense" | "trip";
type ViewMode = "month" | "category" | "tax";

function sumAmount(rows: { amountInclTaxMinor: number }[]) {
  return rows.reduce((s, r) => s + r.amountInclTaxMinor, 0);
}

function formatTripPeriod(r: BizgoTripRow): string {
  const start = r.tripStartDate;
  const end = r.tripEndDate;
  if (!start && !end) return "—";
  let s = start ?? "";
  if (end) s += (s ? " ～ " : "") + end;
  if (r.tripDays) s += `（${r.tripDays}日）`;
  return s;
}

function groupRowsForMonthHeader(rows: (BizgoExpenseRow | BizgoTripRow)[], kind: MainKind) {
  const map = new Map<string, (BizgoExpenseRow | BizgoTripRow)[]>();
  for (const r of rows) {
    const subject = r.subject?.trim() || "（件名なし）";
    const key =
      kind === "trip"
        ? `${subject}\u0001${(r as BizgoTripRow).tripStartDate ?? ""}\u0001${(r as BizgoTripRow).tripEndDate ?? ""}\u0001${(r as BizgoTripRow).tripDays ?? ""}`
        : subject;
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return [...map.entries()].map(([, groupRows]) => {
    const first = groupRows[0]!;
    return {
      subject: first.subject?.trim() || "（件名なし）",
      tripPeriod: kind === "trip" ? formatTripPeriod(first as BizgoTripRow) : null,
      rows: groupRows,
    };
  });
}

function accountCell(r: { categoryLabel: string; accountName: string | null; accountCode: string | null }) {
  if (r.accountName) {
    return (
      <span>
        {r.accountCode ? <span style={{ color: "#64748b", marginRight: 6 }}>{r.accountCode}</span> : null}
        {r.accountName}
      </span>
    );
  }
  return <span style={{ color: "#b45309", fontWeight: 700 }}>{r.categoryLabel}（未紐づけ）</span>;
}

function DetailTable({ rows }: { rows: (BizgoExpenseRow | BizgoTripRow)[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
        <thead>
          <tr>
            <th style={th}>明細日付</th>
            <th style={th}>区分</th>
            <th style={th}>勘定科目</th>
            <th style={th}>消費税区分</th>
            <th style={{ ...th, textAlign: "right" }}>税抜</th>
            <th style={{ ...th, textAlign: "right" }}>消費税</th>
            <th style={{ ...th, minWidth: 140 }}>摘要・金額（税込）</th>
            <th style={th}>領収書</th>
            <th style={{ ...th, minWidth: 88 }}>インボイス</th>
            <th style={{ ...th, minWidth: 100 }}>登録番号</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{r.detailDate ?? "—"}</td>
              <td style={td}>{r.categoryLabel}</td>
              <td style={td}>{accountCell(r)}</td>
              <td style={td}>{r.taxCategory ?? "—"}</td>
              <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {yen(r.amountExclTaxMinor)}
              </td>
              <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {yen(r.taxAmountMinor)}
              </td>
              <td style={{ ...tdWrap, minWidth: 140, maxWidth: 360 }}>
                <div style={{ fontWeight: 600, color: "#0f172a" }}>{r.summary?.trim() ? r.summary : "—"}</div>
                <div
                  style={{
                    marginTop: 4,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 800,
                    fontSize: 14,
                    color: "#0369a1",
                    whiteSpace: "nowrap",
                  }}
                >
                  {yen(r.amountInclTaxMinor)}
                </div>
              </td>
              <td style={{ ...tdWrap, whiteSpace: "nowrap" }}>{r.hasReceipt ?? "—"}</td>
              <td style={{ ...tdWrap, minWidth: 88 }}>{r.invoiceFlag?.trim() ? r.invoiceFlag : "—"}</td>
              <td style={{ ...tdWrap, fontSize: 13, minWidth: 100 }}>{r.registrationNumber ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubjectHeaderBar({
  subject,
  tripPeriod,
  subtotal,
  lineCount,
}: {
  subject: string;
  tripPeriod: string | null;
  subtotal: number;
  lineCount: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "8px 16px",
        padding: "8px 14px",
        background: "linear-gradient(90deg,#0e4f6e,#075985)",
        color: "#fff",
        borderTop: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px", minWidth: 0, flex: "1 1 280px" }}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>
          <span style={{ opacity: 0.85, marginRight: 6 }}>件名</span>
          {subject}
        </span>
        {tripPeriod != null ? (
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            <span style={{ opacity: 0.85, marginRight: 6 }}>出張期間</span>
            {tripPeriod}
          </span>
        ) : null}
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
        小計 {yen(subtotal)}（{lineCount}件）
      </span>
    </div>
  );
}

function MonthBlock({
  title,
  rows,
  kind,
  onClearMonth,
  pending,
}: {
  title: string;
  rows: (BizgoExpenseRow | BizgoTripRow)[];
  kind: MainKind;
  onClearMonth?: () => void;
  pending: boolean;
}) {
  const total = sumAmount(rows);
  const groups = groupRowsForMonthHeader(rows, kind);
  return (
    <section
      style={{
        border: "2px solid #bae6fd",
        borderRadius: 12,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "10px 16px",
          background: "linear-gradient(90deg,#0c4a6e,#0369a1)",
          color: "#fff",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: "0.08em" }}>{title}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>合計 {yen(total)}</span>
          <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>{rows.length} 件</span>
          {onClearMonth ? (
            <button type="button" style={{ ...btnGhost, color: "#fecaca", borderColor: "#fca5a5" }} disabled={pending} onClick={onClearMonth}>
              この月を削除
            </button>
          ) : null}
        </div>
      </div>
      {groups.map((g, i) => (
        <div key={`${g.subject}-${i}`}>
          <SubjectHeaderBar
            subject={g.subject}
            tripPeriod={g.tripPeriod}
            subtotal={sumAmount(g.rows)}
            lineCount={g.rows.length}
          />
          <div style={{ padding: "0 10px 10px" }}>
            <DetailTable rows={g.rows} />
          </div>
        </div>
      ))}
    </section>
  );
}

function GroupBlock({
  title,
  subtitle,
  rows,
  kind,
}: {
  title: string;
  subtitle?: string;
  rows: (BizgoExpenseRow | BizgoTripRow)[];
  kind: MainKind;
}) {
  const total = sumAmount(rows);
  const subjectGroups = groupRowsForMonthHeader(rows, kind);
  return (
    <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
      <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid #e2e8f0" }}>
        <h4 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 900, color: "#0f172a" }}>{title}</h4>
        {subtitle ? <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#64748b" }}>{subtitle}</p> : null}
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0369a1" }}>
          小計 {yen(total)}（{rows.length} 件）
        </p>
      </div>
      {subjectGroups.map((g, i) => (
        <div key={`${g.subject}-${i}`}>
          <SubjectHeaderBar
            subject={g.subject}
            tripPeriod={g.tripPeriod}
            subtotal={sumAmount(g.rows)}
            lineCount={g.rows.length}
          />
          <div style={{ padding: "0 10px 10px" }}>
            <DetailTable rows={g.rows} />
          </div>
        </div>
      ))}
    </section>
  );
}

function ImportPanel({
  label,
  pending,
  lastResult,
  onSubmit,
}: {
  label: string;
  pending: boolean;
  lastResult: BizgoImportResult | null;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <div style={{ ...card, display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{label} CSV 取込</h3>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#475569", lineHeight: 1.6 }}>
        1行目はヘッダ行です。「区分」は勘定科目マスタの<strong>名称またはコード</strong>と照合して紐づけます。CSV に含まれる月の既存データは上書き（その月のみ削除してから取込）します。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("replaceExisting", "1");
          onSubmit(fd);
        }}
        style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}
      >
        <input type="file" name="file" accept=".csv,text/csv" required style={{ fontSize: 14, fontWeight: 600 }} />
        <button type="submit" style={btn} disabled={pending}>
          取込
        </button>
      </form>
      {lastResult ? (
        <div style={{ fontSize: 14, fontWeight: 700, color: "#15803d", lineHeight: 1.55 }}>
          {lastResult.imported} 件を取込（スキップ {lastResult.skipped} 件）
          {lastResult.months.length ? `／対象月: ${lastResult.months.map(formatMonthLabel).join("、")}` : ""}
          {lastResult.unmappedCategories.length > 0 ? (
            <div style={{ marginTop: 8, color: "#b45309" }}>
              勘定未紐づけの区分: {lastResult.unmappedCategories.join("、")}
              <div style={{ fontWeight: 600, marginTop: 4 }}>マスタ管理で同名の勘定科目を登録してから再取込してください。</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function BizgoView({ expenseLines, tripLines }: { expenseLines: BizgoExpenseRow[]; tripLines: BizgoTripRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mainTab, setMainTab] = useState<MainKind>("expense");
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [msg, setMsg] = useState("");
  const [expenseImportResult, setExpenseImportResult] = useState<BizgoImportResult | null>(null);
  const [tripImportResult, setTripImportResult] = useState<BizgoImportResult | null>(null);

  const run = (f: () => Promise<void>) =>
    startTransition(() =>
      void f()
        .then(() => {
          setMsg("");
          router.refresh();
        })
        .catch((e) => setMsg(e?.message ?? "エラーが発生しました"))
    );

  const submitExpenseImport = (fd: FormData) => {
    startTransition(() =>
      void importBizgoExpenseCsv(fd)
        .then((res) => {
          setMsg("");
          setExpenseImportResult(res);
          router.refresh();
        })
        .catch((e) => setMsg(e?.message ?? "取込に失敗しました"))
    );
  };

  const submitTripImport = (fd: FormData) => {
    startTransition(() =>
      void importBizgoTripExpenseCsv(fd)
        .then((res) => {
          setMsg("");
          setTripImportResult(res);
          router.refresh();
        })
        .catch((e) => setMsg(e?.message ?? "取込に失敗しました"))
    );
  };

  const expenseMonthGroups = useMemo(() => {
    const map = new Map<string, BizgoExpenseRow[]>();
    for (const r of expenseLines) {
      const list = map.get(r.settlementMonth) ?? [];
      list.push(r);
      map.set(r.settlementMonth, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [expenseLines]);

  const tripMonthGroups = useMemo(() => {
    const map = new Map<string, BizgoTripRow[]>();
    for (const r of tripLines) {
      const list = map.get(r.targetMonth) ?? [];
      list.push(r);
      map.set(r.targetMonth, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [tripLines]);

  const groupByKey = <T extends BizgoExpenseRow | BizgoTripRow>(rows: T[], key: (r: T) => string) => {
    const map = new Map<string, T[]>();
    for (const r of rows) {
      const k = key(r) || "（未設定）";
      const list = map.get(k) ?? [];
      list.push(r);
      map.set(k, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "ja"));
  };

  const expenseCategoryGroups = useMemo(() => groupByKey(expenseLines, (r) => r.categoryLabel), [expenseLines]);
  const expenseTaxGroups = useMemo(() => groupByKey(expenseLines, (r) => r.taxCategory ?? ""), [expenseLines]);
  const tripCategoryGroups = useMemo(() => groupByKey(tripLines, (r) => r.categoryLabel), [tripLines]);
  const tripTaxGroups = useMemo(() => groupByKey(tripLines, (r) => r.taxCategory ?? ""), [tripLines]);

  const rows = mainTab === "expense" ? expenseLines : tripLines;
  const monthGroups = mainTab === "expense" ? expenseMonthGroups : tripMonthGroups;
  const categoryGroups = mainTab === "expense" ? expenseCategoryGroups : tripCategoryGroups;
  const taxGroups = mainTab === "expense" ? expenseTaxGroups : tripTaxGroups;

  return (
    <main style={{ display: "grid", gap: 18 }}>
      <div>
        <h1 className="m-0 text-3xl font-extrabold tracking-[0.08em] sm:text-4xl">BizGO！（経費・出張経費精算）</h1>
        <p style={{ margin: "10px 0 0", fontSize: 15, fontWeight: 600, color: "#475569", lineHeight: 1.65 }}>
          社長の経費精算書・出張経費精算書 CSV を取り込み、月別・区分別・消費税別に一覧表示します。
        </p>
      </div>

      {msg ? <div style={{ fontSize: 15, fontWeight: 700, color: "#b91c1c" }}>{msg}</div> : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button type="button" style={tabBtn(mainTab === "expense")} onClick={() => setMainTab("expense")}>
          経費精算書
        </button>
        <button type="button" style={tabBtn(mainTab === "trip")} onClick={() => setMainTab("trip")}>
          出張経費精算書
        </button>
      </div>

      {mainTab === "expense" ? (
        <ImportPanel label="経費精算書" pending={pending} lastResult={expenseImportResult} onSubmit={submitExpenseImport} />
      ) : (
        <ImportPanel label="出張経費精算書" pending={pending} lastResult={tripImportResult} onSubmit={submitTripImport} />
      )}

      <section style={card}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" style={subTabBtn(viewMode === "month")} onClick={() => setViewMode("month")}>
              月別
            </button>
            <button type="button" style={subTabBtn(viewMode === "category")} onClick={() => setViewMode("category")}>
              区分別
            </button>
            <button type="button" style={subTabBtn(viewMode === "tax")} onClick={() => setViewMode("tax")}>
              消費税別
            </button>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0369a1" }}>
            全体合計 {yen(sumAmount(rows))}（{rows.length} 件）
          </div>
          <button
            type="button"
            style={btnGhost}
            disabled={pending || rows.length === 0}
            onClick={() => {
              if (!window.confirm(mainTab === "expense" ? "経費精算データをすべて削除しますか？" : "出張経費データをすべて削除しますか？")) return;
              run(() => (mainTab === "expense" ? clearAllBizgoExpense() : clearAllBizgoTrip()));
            }}
          >
            全件削除
          </button>
        </div>

        <div style={{ marginTop: 18, display: "grid", gap: 20 }}>
          {rows.length === 0 ? (
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#64748b" }}>データがありません。上の CSV 取込から登録してください。</p>
          ) : viewMode === "month" ? (
            monthGroups.map(([month, groupRows]) => (
              <MonthBlock
                key={month}
                title={formatMonthLabel(month)}
                rows={groupRows}
                kind={mainTab}
                pending={pending}
                onClearMonth={() => {
                  if (!window.confirm(`${formatMonthLabel(month)} のデータを削除しますか？`)) return;
                  run(() => (mainTab === "expense" ? clearBizgoExpenseMonth(month) : clearBizgoTripMonth(month)));
                }}
              />
            ))
          ) : viewMode === "category" ? (
            categoryGroups.map(([label, groupRows]) => (
              <GroupBlock
                key={label}
                title={`区分: ${label}`}
                subtitle={
                  groupRows[0]?.accountName
                    ? `勘定科目: ${groupRows[0].accountCode ? `${groupRows[0].accountCode} · ` : ""}${groupRows[0].accountName}`
                    : "勘定科目: 未紐づけ"
                }
                rows={groupRows}
                kind={mainTab}
              />
            ))
          ) : (
            taxGroups.map(([label, groupRows]) => (
              <GroupBlock key={label} title={`消費税区分: ${label || "（未設定）"}`} rows={groupRows} kind={mainTab} />
            ))
          )}
        </div>
      </section>
    </main>
  );
}
