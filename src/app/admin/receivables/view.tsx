"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { MonthlyExportLinks } from "@/components/monthly-export-links";
import { AR_BOOK_LABELS, AR_BOOKS, type ArBook, arAdminPath, parseArBook } from "@/lib/ar-ap-books";
import { FiscalPeriodInlineTable } from "@/lib/fiscal-period-ui";
import { matchesListSearch } from "@/lib/list-search";
import { arAllocationTargetMinor, type TransferFeeBearer } from "@/lib/payment-transfer-fee";
import { deleteArHistoryLine, getArOpenLines, registerArPayment, registerArSale, updateArHistoryLine, type ArOpenLine } from "./actions";

function yen(v: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(v);
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #cdd4de", borderRadius: 12, padding: 20 };
const btn: React.CSSProperties = {
  border: "none",
  color: "#fff",
  borderRadius: 8,
  padding: "12px 18px",
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: "0.14em",
  background: "linear-gradient(90deg,#06b6d4,#0ea5e9,#3b82f6)",
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  border: "1px solid #94a3b8",
  color: "#334155",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "0.1em",
  background: "#f8fafc",
  cursor: "pointer",
};
const btnDanger: React.CSSProperties = { ...btnGhost, borderColor: "#fca5a5", color: "#b91c1c", background: "#fef2f2", fontSize: 14 };
const btnMuted: React.CSSProperties = { ...btnGhost, fontSize: 14, padding: "8px 12px" };
const inp: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", fontSize: 16, fontWeight: 600, letterSpacing: "0.04em" };

function fifoAllocate(lines: ArOpenLine[], total: number): Record<string, number> {
  let rem = Math.max(0, Math.floor(total));
  const out: Record<string, number> = {};
  for (const l of lines) {
    const take = Math.min(rem, l.openMinor);
    if (take > 0) {
      out[l.id] = take;
      rem -= take;
    }
  }
  return out;
}

export function ReceivablesView({
  book,
  balances,
  customers,
  recentLines,
  fiscalStart,
  fiscalEnd,
}: {
  book: ArBook;
  balances: { id: string; name: string; balanceMinor: number }[];
  customers: { id: string; name: string; code: string | null }[];
  fiscalStart?: string | null;
  fiscalEnd?: string | null;
  recentLines: {
    id: string;
    customerId: string | null;
    transactionDate: string;
    customerName: string | null;
    kind: string;
    amountMinor: number;
    summary: string | null;
    saleAllocationLocked: boolean;
  }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const switchDepartment = (next: ArBook) => {
    if (next === book) return;
    setMsg("");
    router.push(arAdminPath(next));
    router.refresh();
  };
  const [msg, setMsg] = useState("");
  const [amountExcl, setAmountExcl] = useState("");
  const [taxRate, setTaxRate] = useState("10");
  const tax = useMemo(() => Math.floor((Math.max(0, Number(amountExcl || 0)) * Math.max(0, Number(taxRate || 0))) / 100), [amountExcl, taxRate]);
  const total = Math.floor(Math.max(0, Number(amountExcl || 0))) + tax;

  const payRef = useRef<HTMLDialogElement>(null);
  const [payCustomerId, setPayCustomerId] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payTotal, setPayTotal] = useState("");
  const [payFee, setPayFee] = useState("");
  const [payFeeBearer, setPayFeeBearer] = useState<TransferFeeBearer>("counterparty");
  const [paySummary, setPaySummary] = useState("");
  const [openLines, setOpenLines] = useState<ArOpenLine[]>([]);
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [balanceSearch, setBalanceSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  const filteredBalances = useMemo(() => {
    if (!balanceSearch.trim()) return balances;
    return balances.filter((b) => matchesListSearch(`${b.name} ${b.balanceMinor}`, balanceSearch));
  }, [balances, balanceSearch]);

  const filteredRecentLines = useMemo(() => {
    if (!historySearch.trim()) return recentLines;
    return recentLines.filter((r) => {
      const kind = r.kind === "ar_sale" ? "売上" : "入金";
      const hay = [r.transactionDate, kind, r.customerName ?? "", r.summary ?? "", String(r.amountMinor), yen(r.amountMinor)].join(" ");
      return matchesListSearch(hay, historySearch);
    });
  }, [recentLines, historySearch]);

  const editRef = useRef<HTMLDialogElement>(null);
  const [editLineId, setEditLineId] = useState("");
  const [editKind, setEditKind] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editSaleAllocationLocked, setEditSaleAllocationLocked] = useState(false);

  const openEditHistory = (r: (typeof recentLines)[number]) => {
    setMsg("");
    setEditLineId(r.id);
    setEditKind(r.kind);
    setEditDate(r.transactionDate);
    setEditCustomerId(r.customerId ?? "");
    setEditAmount(String(r.amountMinor));
    setEditSummary(r.summary ?? "");
    setEditSaleAllocationLocked(r.saleAllocationLocked);
    editRef.current?.showModal();
  };

  const submitEditHistory = () => {
    startTransition(() => {
      if (!editLineId) return;
      const payload =
        editKind === "ar_sale"
          ? {
              transactionDate: editDate,
              summary: editSummary.trim() || null,
              ...(editSaleAllocationLocked
                ? {}
                : {
                    customerId: editCustomerId,
                    amountMinor: Math.floor(Number(editAmount || 0)),
                  }),
            }
          : { transactionDate: editDate, summary: editSummary.trim() || null };
      void updateArHistoryLine(editLineId, book, payload)
        .then(() => {
          setMsg("履歴を更新しました");
          editRef.current?.close();
          router.refresh();
        })
        .catch((e: Error) => setMsg(e?.message ?? "更新に失敗しました"));
    });
  };

  const loadOpen = (cid: string) => {
    if (!cid) {
      setOpenLines([]);
      setAlloc({});
      return;
    }
    startTransition(() =>
      void getArOpenLines(cid, book)
        .then((lines) => {
          setOpenLines(lines);
          const sum = lines.reduce((s, l) => s + l.openMinor, 0);
          setPayTotal(String(sum));
          const m = fifoAllocate(lines, sum);
          const next: Record<string, string> = {};
          for (const l of lines) next[l.id] = String(m[l.id] ?? 0);
          setAlloc(next);
        })
        .catch((e) => setMsg(e?.message ?? "未消込の取得に失敗しました"))
    );
  };

  const allocSum = useMemo(
    () => Object.values(alloc).reduce((s, v) => s + Math.max(0, Math.floor(Number(v || 0))), 0),
    [alloc]
  );

  const transferMinor = Math.max(0, Math.floor(Number(payTotal || 0)));
  const feeMinor = Math.max(0, Math.floor(Number(payFee || 0)));
  const allocTargetMinor = useMemo(
    () => arAllocationTargetMinor(transferMinor, feeMinor, payFeeBearer),
    [transferMinor, feeMinor, payFeeBearer]
  );

  const openPayment = (customerId: string) => {
    setMsg("");
    setPayCustomerId(customerId);
    setPayDate(new Date().toISOString().slice(0, 10));
    loadOpen(customerId);
    payRef.current?.showModal();
  };

  const applyFifo = () => {
    const m = fifoAllocate(openLines, allocTargetMinor);
    const next: Record<string, string> = {};
    for (const l of openLines) next[l.id] = String(m[l.id] ?? 0);
    setAlloc(next);
  };

  const submitPayment = () => {
    const allocations = openLines
      .map((l) => ({ salesArDebitTransactionId: l.id, amountMinor: Math.floor(Number(alloc[l.id] || 0)) }))
      .filter((a) => a.amountMinor > 0);
    startTransition(() =>
      void registerArPayment({
        book,
        customerId: payCustomerId,
        transactionDate: payDate,
        summary: paySummary.trim() || null,
        transferMinor,
        transferFeeMinor: feeMinor,
        feeBearer: payFeeBearer,
        allocations,
      })
        .then(() => {
          setMsg("入金消込を登録しました");
          payRef.current?.close();
        })
        .catch((e) => setMsg(e?.message ?? "登録に失敗しました"))
    );
  };

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <h1 className="m-0 text-3xl font-extrabold tracking-[0.08em] sm:text-4xl">売掛管理</h1>
      {msg ? (
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.04em", color: msg.includes("失敗") ? "#b91c1c" : "#15803d" }}>{msg}</div>
      ) : null}

      <section style={{ ...card, display: "grid", gap: 8 }}>
        <h3 className="m-0 text-xl font-extrabold tracking-[0.06em]">部署</h3>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#64748b", letterSpacing: "0.04em" }}>
          施工部・機工部を選んでから売上登録・入金消込を行います。選択した部署の売掛金・売上高に計上されます。
        </p>
        <label style={{ display: "grid", gap: 6, maxWidth: 320, fontSize: 15, fontWeight: 700, color: "#334155" }}>
          担当部署
          <select
            style={inp}
            value={book}
            onChange={(e) => switchDepartment(parseArBook(e.target.value))}
            aria-label="担当部署"
          >
            {AR_BOOKS.map((b) => (
              <option key={b} value={b}>
                {AR_BOOK_LABELS[b]}
              </option>
            ))}
          </select>
        </label>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0e7490", letterSpacing: "0.06em" }}>
          現在: {AR_BOOK_LABELS[book]} の売掛を表示・登録中
        </p>
      </section>

      <form
        action={(fd) =>
          startTransition(() =>
            void registerArSale(fd)
              .then(() => setMsg("売上を登録しました"))
              .catch((e) => setMsg(e?.message ?? "登録に失敗しました"))
          )
        }
        style={{ ...card, display: "grid", gap: 8 }}
      >
        <input type="hidden" name="book" value={book} />
        <h3 className="m-0 text-xl font-extrabold tracking-[0.06em]">売上登録</h3>
        <select style={inp} name="customerId" required>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code ? `${c.code} - ` : ""}
              {c.name}
            </option>
          ))}
        </select>
        <input style={inp} name="transactionDate" type="date" required />
        <input style={inp} value={amountExcl} onChange={(e) => setAmountExcl(e.target.value)} type="number" min={1} step={1} placeholder="税抜金額" required />
        <input style={inp} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} type="number" min={0} step={1} placeholder="消費税率(%)" />
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.05em", color: "#475569" }}>
          消費税額: {yen(tax)} / 税込金額: {yen(total)}
        </div>
        <input type="hidden" name="amountMinor" value={total > 0 ? String(total) : ""} />
        <input style={inp} name="summary" placeholder="摘要" />
        <button type="submit" disabled={pending} style={btn}>
          登録
        </button>
      </form>

      <section style={card}>
        <h3 className="mt-0 text-xl font-extrabold tracking-[0.06em]">顧客別売掛残高（{AR_BOOK_LABELS[book]}）</h3>
        <label style={{ display: "grid", gap: 6, margin: "8px 0 10px", maxWidth: 440, fontSize: 14, fontWeight: 700, color: "#475569" }}>
          この一覧を検索（顧客名・金額の数字など）
          <input
            type="search"
            style={inp}
            value={balanceSearch}
            onChange={(e) => setBalanceSearch(e.target.value)}
            placeholder="例: 株式会社"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 16, fontWeight: 600, letterSpacing: "0.04em" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "10px 8px", color: "#64748b", fontWeight: 800, letterSpacing: "0.06em" }}>顧客</th>
                <th style={{ padding: "10px 8px", color: "#64748b", textAlign: "right", fontWeight: 800, letterSpacing: "0.06em" }}>残高</th>
                <th style={{ padding: "10px 8px", width: 160, fontWeight: 800, letterSpacing: "0.06em" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredBalances.map((b) => (
                <tr key={b.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 8px" }}>{b.name}</td>
                  <td style={{ padding: "10px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{yen(b.balanceMinor)}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <button type="button" style={btnGhost} disabled={pending || b.balanceMinor <= 0} onClick={() => openPayment(b.id)}>
                      入金消込
                    </button>
                  </td>
                </tr>
              ))}
              {filteredBalances.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: 12, color: "#64748b", fontWeight: 700 }}>
                    {balances.length === 0 ? "残高データはありません。" : "検索条件に一致する行がありません。"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h3 className="m-0 text-xl font-extrabold tracking-[0.06em]">売掛登録履歴（{AR_BOOK_LABELS[book]}）</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input style={inp} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <MonthlyExportLinks
              month={month}
              pdfHref={`/admin/receivables/monthly-pdf?dept=${book}`}
              csvHref={`/admin/exports/receivables-monthly?book=${book}`}
              pdfLabel="月次明細 PDF"
              csvLabel="月別入金 CSV"
            />
          </div>
        </div>
        <FiscalPeriodInlineTable fiscalStart={fiscalStart} fiscalEnd={fiscalEnd} />
        <label style={{ display: "grid", gap: 6, margin: "10px 0 0", maxWidth: 440, fontSize: 14, fontWeight: 700, color: "#475569" }}>
          この履歴一覧を検索（日付・顧客・摘要・金額など）
          <input
            type="search"
            style={inp}
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="例: 売上 / 2025"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: 8 }}>日付</th>
                <th style={{ padding: 8 }}>区分</th>
                <th style={{ padding: 8 }}>顧客</th>
                <th style={{ padding: 8, textAlign: "right" }}>金額</th>
                <th style={{ padding: 8 }}>摘要</th>
                <th style={{ padding: 8 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecentLines.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 8 }}>{r.transactionDate}</td>
                  <td style={{ padding: 8 }}>{r.kind === "ar_sale" ? "売上" : "入金"}</td>
                  <td style={{ padding: 8 }}>{r.customerName ?? "—"}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{yen(r.amountMinor)}</td>
                  <td style={{ padding: 8 }}>{r.summary ?? "—"}</td>
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                    <button type="button" style={{ ...btnMuted, marginRight: 6 }} onClick={() => openEditHistory(r)} disabled={pending}>
                      編集
                    </button>
                    <button
                      type="button"
                      style={btnDanger}
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm(`${r.kind === "ar_sale" ? "売上" : "入金"} の履歴を削除しますか？関連する仕訳もまとめて削除されます。`)) return;
                        startTransition(() =>
                          void deleteArHistoryLine(r.id, book)
                            .then(() => {
                              setMsg("履歴を削除しました");
                              router.refresh();
                            })
                            .catch((e: Error) => setMsg(e?.message ?? "削除に失敗しました"))
                        );
                      }}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRecentLines.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 12, color: "#64748b", fontWeight: 700 }}>
                    {recentLines.length === 0 ? "登録履歴はまだありません。" : "検索条件に一致する行がありません。"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <dialog ref={editRef} style={{ border: "none", borderRadius: 12, padding: 0, maxWidth: 480, width: "94vw" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", fontWeight: 800, letterSpacing: "0.08em", fontSize: 18 }}>履歴の編集</div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#475569" }}>
            {editKind === "ar_sale"
              ? editSaleAllocationLocked
                ? "消込済みの売上は日付・摘要のみ変更できます。金額・顧客を直す場合は入金側を削除してからやり直してください。"
                : "売上の日付・顧客・税込金額・摘要を変更します（複式の相手勘定にも反映されます）。"
              : "入金の日付・摘要のみ変更できます。金額・消込内容を変える場合は一度削除して登録し直してください。"}
          </p>
          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em" }}>
            日付
            <input style={inp} type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          </label>
          {editKind === "ar_sale" ? (
            <>
              <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em" }}>
                顧客
                <select
                  style={inp}
                  disabled={editSaleAllocationLocked || pending}
                  value={editCustomerId}
                  onChange={(e) => setEditCustomerId(e.target.value)}
                >
                  <option value="">選択してください</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code ? `${c.code} - ` : ""}
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em" }}>
                金額（税込・円）
                <input
                  style={inp}
                  type="number"
                  min={1}
                  disabled={editSaleAllocationLocked || pending}
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </label>
            </>
          ) : (
            <div style={{ fontSize: 15, fontWeight: 700, color: "#64748b" }}>金額: {yen(Math.floor(Number(editAmount || 0)))}</div>
          )}
          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em" }}>
            摘要
            <input style={inp} value={editSummary} onChange={(e) => setEditSummary(e.target.value)} placeholder="摘要" />
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" style={btnGhost} onClick={() => editRef.current?.close()}>
              キャンセル
            </button>
            <button
              type="button"
              style={btn}
              disabled={
                pending ||
                !editDate ||
                (editKind === "ar_sale" &&
                  !editSaleAllocationLocked &&
                  (!editCustomerId || Math.floor(Number(editAmount || 0)) <= 0))
              }
              onClick={submitEditHistory}
            >
              保存
            </button>
          </div>
        </div>
      </dialog>

      <dialog ref={payRef} style={{ border: "none", borderRadius: 12, padding: 0, maxWidth: 720, width: "94vw" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", fontWeight: 800, letterSpacing: "0.08em", fontSize: 18 }}>入金消込</div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em" }}>
            顧客
            <select
              style={inp}
              value={payCustomerId}
              onChange={(e) => {
                setPayCustomerId(e.target.value);
                loadOpen(e.target.value);
              }}
            >
              <option value="">選択してください</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} - ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em" }}>
            入金日
            <input style={inp} type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em" }}>
            振込金額・入金額（税込・円）
            <input style={inp} type="number" min={0} step={1} value={payTotal} onChange={(e) => setPayTotal(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em" }}>
            振込手数料（円）
            <input style={inp} type="number" min={0} step={1} value={payFee} onChange={(e) => setPayFee(e.target.value)} placeholder="0" />
          </label>
          <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", margin: 0 }}>
            <legend style={{ fontSize: 14, fontWeight: 800, color: "#475569", padding: "0 4px" }}>手数料負担</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 15, fontWeight: 700 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="arFeeBearer"
                  checked={payFeeBearer === "our"}
                  onChange={() => setPayFeeBearer("our")}
                />
                当社負担（消込＝振込金額＋手数料）
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="arFeeBearer"
                  checked={payFeeBearer === "counterparty"}
                  onChange={() => setPayFeeBearer("counterparty")}
                />
                貴社負担（消込＝振込金額のみ）
              </label>
            </div>
          </fieldset>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={btnGhost} onClick={applyFifo} disabled={!openLines.length}>
              入金額を古い順に自動配分
            </button>
            <button
              type="button"
              style={btnGhost}
              disabled={!openLines.length}
              onClick={() => {
                const next: Record<string, string> = {};
                for (const l of openLines) next[l.id] = String(l.openMinor);
                setAlloc(next);
                setPayTotal(String(openLines.reduce((s, l) => s + l.openMinor, 0)));
              }}
            >
              未消込を全額指定
            </button>
          </div>
          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em" }}>
            摘要
            <input style={inp} value={paySummary} onChange={(e) => setPaySummary(e.target.value)} placeholder="例：振込入金" />
          </label>

          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.04em", color: "#64748b", lineHeight: 1.55 }}>
            消込合計: {yen(allocSum)} / 消込対象額: {yen(allocTargetMinor)}
            {allocSum !== allocTargetMinor ? <span style={{ color: "#b91c1c", marginLeft: 8 }}>一致させてください</span> : null}
            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600 }}>
              振込金額 {yen(transferMinor)}
              {feeMinor > 0 ? (
                <>
                  {" "}
                  ／ 手数料 {yen(feeMinor)}（{payFeeBearer === "our" ? "当社負担→消込に加算" : "貴社負担→消込に含めない"}）
                </>
              ) : null}
            </div>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15, fontWeight: 600, letterSpacing: "0.03em" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#f8fafc" }}>
                  <th style={{ padding: 8, fontWeight: 800, letterSpacing: "0.05em" }}>日付</th>
                  <th style={{ padding: 8, fontWeight: 800, letterSpacing: "0.05em" }}>摘要</th>
                  <th style={{ padding: 8, textAlign: "right", fontWeight: 800, letterSpacing: "0.05em" }}>未消込</th>
                  <th style={{ padding: 8, fontWeight: 800, letterSpacing: "0.05em" }}>消込額</th>
                </tr>
              </thead>
              <tbody>
                {openLines.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 12, color: "#64748b" }}>
                      {payCustomerId ? "未消込の売掛行がありません" : "顧客を選択してください"}
                    </td>
                  </tr>
                ) : (
                  openLines.map((l) => (
                    <tr key={l.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 8, whiteSpace: "nowrap" }}>{l.transactionDate}</td>
                      <td style={{ padding: 8 }}>{l.summary ?? "—"}</td>
                      <td style={{ padding: 8, textAlign: "right" }}>{yen(l.openMinor)}</td>
                      <td style={{ padding: 8 }}>
                        <input
                          style={{ ...inp, width: "100%", maxWidth: 140 }}
                          inputMode="numeric"
                          value={alloc[l.id] ?? ""}
                          onChange={(e) => setAlloc((prev) => ({ ...prev, [l.id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" style={btnGhost} onClick={() => payRef.current?.close()}>
              閉じる
            </button>
            <button
              type="button"
              style={btn}
              disabled={pending || !payCustomerId || !payDate || transferMinor <= 0 || allocSum !== allocTargetMinor || allocSum <= 0}
              onClick={submitPayment}
            >
              登録
            </button>
          </div>
        </div>
      </dialog>
    </main>
  );
}
