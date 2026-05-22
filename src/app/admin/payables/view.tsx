"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { MonthlyExportLinks } from "@/components/monthly-export-links";
import { AP_BOOK_LABELS, AP_BOOKS, type ApBook, apAdminPath, apPurchaseKindLabel } from "@/lib/ar-ap-books";
import { FiscalPeriodInlineTable } from "@/lib/fiscal-period-ui";
import { matchesListSearch } from "@/lib/list-search";
import { apAllocationTargetMinor, type TransferFeeBearer } from "@/lib/payment-transfer-fee";
import { deleteApHistoryLine, getApOpenLines, registerApPayment, registerApPurchase, updateApHistoryLine, type ApOpenLine } from "./actions";

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

function fifoAllocate(lines: ApOpenLine[], total: number): Record<string, number> {
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

export function PayablesView({
  book,
  balances,
  vendors,
  recentLines,
  fiscalStart,
  fiscalEnd,
}: {
  book: ApBook;
  balances: { id: string; name: string; balanceMinor: number }[];
  vendors: { id: string; name: string; code: string | null }[];
  fiscalStart?: string | null;
  fiscalEnd?: string | null;
  recentLines: {
    id: string;
    vendorId: string | null;
    transactionDate: string;
    vendorName: string | null;
    kind: string;
    amountMinor: number;
    summary: string | null;
    purchaseAllocationLocked: boolean;
  }[];
}) {
  const router = useRouter();
  const purchaseLabel = apPurchaseKindLabel(book);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [amountExcl, setAmountExcl] = useState("");
  const [taxRate, setTaxRate] = useState("10");
  const tax = useMemo(() => Math.floor((Math.max(0, Number(amountExcl || 0)) * Math.max(0, Number(taxRate || 0))) / 100), [amountExcl, taxRate]);
  const total = Math.floor(Math.max(0, Number(amountExcl || 0))) + tax;

  const payRef = useRef<HTMLDialogElement>(null);
  const [payVendorId, setPayVendorId] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payTotal, setPayTotal] = useState("");
  const [payFee, setPayFee] = useState("");
  const [payFeeBearer, setPayFeeBearer] = useState<TransferFeeBearer>("counterparty");
  const [paySummary, setPaySummary] = useState("");
  const [openLines, setOpenLines] = useState<ApOpenLine[]>([]);
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
      const kind = r.kind === "ap_purchase" ? purchaseLabel : "支払";
      const hay = [r.transactionDate, kind, r.vendorName ?? "", r.summary ?? "", String(r.amountMinor), yen(r.amountMinor)].join(" ");
      return matchesListSearch(hay, historySearch);
    });
  }, [recentLines, historySearch, purchaseLabel]);

  const editRef = useRef<HTMLDialogElement>(null);
  const [editLineId, setEditLineId] = useState("");
  const [editKind, setEditKind] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editVendorId, setEditVendorId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editPurchaseAllocationLocked, setEditPurchaseAllocationLocked] = useState(false);

  const openEditHistory = (r: (typeof recentLines)[number]) => {
    setMsg("");
    setEditLineId(r.id);
    setEditKind(r.kind);
    setEditDate(r.transactionDate);
    setEditVendorId(r.vendorId ?? "");
    setEditAmount(String(r.amountMinor));
    setEditSummary(r.summary ?? "");
    setEditPurchaseAllocationLocked(r.purchaseAllocationLocked);
    editRef.current?.showModal();
  };

  const submitEditHistory = () => {
    startTransition(() => {
      if (!editLineId) return;
      const payload =
        editKind === "ap_purchase"
          ? {
              transactionDate: editDate,
              summary: editSummary.trim() || null,
              ...(editPurchaseAllocationLocked
                ? {}
                : {
                    vendorId: editVendorId,
                    amountMinor: Math.floor(Number(editAmount || 0)),
                  }),
            }
          : { transactionDate: editDate, summary: editSummary.trim() || null };
      void updateApHistoryLine(editLineId, book, payload)
        .then(() => {
          setMsg("履歴を更新しました");
          editRef.current?.close();
          router.refresh();
        })
        .catch((e: Error) => setMsg(e?.message ?? "更新に失敗しました"));
    });
  };

  const loadOpen = (vid: string) => {
    if (!vid) {
      setOpenLines([]);
      setAlloc({});
      return;
    }
    startTransition(() =>
      void getApOpenLines(vid, book)
        .then((lines) => {
          setOpenLines(lines);
          const sum = lines.reduce((s, l) => s + l.openMinor, 0);
          setPayTotal(String(sum));
          const m = fifoAllocate(lines, sum);
          const next: Record<string, string> = {};
          for (const l of lines) next[l.id] = String(m[l.id] ?? 0);
          setAlloc(next);
        })
        .catch((e) => setMsg(e?.message ?? "未払行の取得に失敗しました"))
    );
  };

  const allocSum = useMemo(
    () => Object.values(alloc).reduce((s, v) => s + Math.max(0, Math.floor(Number(v || 0))), 0),
    [alloc]
  );

  const transferMinor = Math.max(0, Math.floor(Number(payTotal || 0)));
  const feeMinor = Math.max(0, Math.floor(Number(payFee || 0)));
  const allocTargetMinor = useMemo(
    () => apAllocationTargetMinor(transferMinor, feeMinor, payFeeBearer),
    [transferMinor, feeMinor, payFeeBearer]
  );

  const openPayment = (vendorId: string) => {
    setMsg("");
    setPayVendorId(vendorId);
    setPayDate(new Date().toISOString().slice(0, 10));
    loadOpen(vendorId);
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
      .map((l) => ({ purchaseApCreditTransactionId: l.id, amountMinor: Math.floor(Number(alloc[l.id] || 0)) }))
      .filter((a) => a.amountMinor > 0);
    startTransition(() =>
      void registerApPayment({
        book,
        vendorId: payVendorId,
        transactionDate: payDate,
        summary: paySummary.trim() || null,
        transferMinor,
        transferFeeMinor: feeMinor,
        feeBearer: payFeeBearer,
        allocations,
      })
        .then(() => {
          setMsg("支払消込を登録しました");
          payRef.current?.close();
        })
        .catch((e) => setMsg(e?.message ?? "登録に失敗しました"))
    );
  };

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <h1 className="m-0 text-3xl font-extrabold tracking-[0.08em] sm:text-4xl">買掛管理（{AP_BOOK_LABELS[book]}）</h1>
        <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 14, fontWeight: 700 }}>
          {AP_BOOKS.map((b) => (
            <Link
              key={b}
              href={apAdminPath(b)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: b === book ? "2px solid #3b82f6" : "1px solid #94a3b8",
                background: b === book ? "#eff6ff" : "#f8fafc",
                color: b === book ? "#1d4ed8" : "#334155",
                textDecoration: "none",
              }}
            >
              {AP_BOOK_LABELS[b]}
            </Link>
          ))}
        </nav>
      </div>
      {msg ? (
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.04em", color: msg.includes("失敗") ? "#b91c1c" : "#15803d" }}>{msg}</div>
      ) : null}

      <form
        action={(fd) =>
          startTransition(() =>
            void registerApPurchase(fd)
              .then(() => setMsg(`${purchaseLabel}を登録しました`))
              .catch((e) => setMsg(e?.message ?? "登録に失敗しました"))
          )
        }
        style={{ ...card, display: "grid", gap: 8 }}
      >
        <input type="hidden" name="book" value={book} />
        <h3 className="m-0 text-xl font-extrabold tracking-[0.06em]">{book === "gaichu" ? "外注費登録" : "仕入登録"}</h3>
        <select style={inp} name="vendorId" required>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.code ? `${v.code} - ` : ""}
              {v.name}
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
        <h3 className="mt-0 text-xl font-extrabold tracking-[0.06em]">仕入先別未払残高</h3>
        <label style={{ display: "grid", gap: 6, margin: "8px 0 10px", maxWidth: 440, fontSize: 14, fontWeight: 700, color: "#475569" }}>
          この一覧を検索（仕入先名・金額の数字など）
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
                <th style={{ padding: "10px 8px", color: "#64748b", fontWeight: 800, letterSpacing: "0.06em" }}>仕入先</th>
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
                      支払消込
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
          <h3 className="m-0 text-xl font-extrabold tracking-[0.06em]">買掛登録履歴</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input style={inp} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <MonthlyExportLinks
              month={month}
              pdfHref={`/admin/payables/monthly-pdf?book=${book}`}
              csvHref={`/admin/exports/payables-monthly?book=${book}`}
              pdfLabel="月次明細 PDF"
              csvLabel="月別支払 CSV"
            />
            <MonthlyExportLinks
              month={month}
              pdfHref={`/admin/payables/vendor-monthly-pdf?book=${book}`}
              csvHref={`/admin/exports/vendor-payments?book=${book}`}
              pdfLabel="仕入先振込 PDF"
              csvLabel="仕入先振込 CSV"
            />
          </div>
        </div>
        <FiscalPeriodInlineTable fiscalStart={fiscalStart} fiscalEnd={fiscalEnd} />
        <label style={{ display: "grid", gap: 6, margin: "10px 0 0", maxWidth: 440, fontSize: 14, fontWeight: 700, color: "#475569" }}>
          この履歴一覧を検索（日付・仕入先・摘要・金額など）
          <input
            type="search"
            style={inp}
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder={`例: ${purchaseLabel} / 2025`}
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
                <th style={{ padding: 8 }}>仕入先</th>
                <th style={{ padding: 8, textAlign: "right" }}>金額</th>
                <th style={{ padding: 8 }}>摘要</th>
                <th style={{ padding: 8 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecentLines.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 8 }}>{r.transactionDate}</td>
                  <td style={{ padding: 8 }}>{r.kind === "ap_purchase" ? purchaseLabel : "支払"}</td>
                  <td style={{ padding: 8 }}>{r.vendorName ?? "—"}</td>
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
                        if (!window.confirm(`${r.kind === "ap_purchase" ? purchaseLabel : "支払"} の履歴を削除しますか？関連する仕訳もまとめて削除されます。`)) return;
                        startTransition(() =>
                          void deleteApHistoryLine(r.id, book)
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
            {editKind === "ap_purchase"
              ? editPurchaseAllocationLocked
                ? `消込済みの${purchaseLabel}は日付・摘要のみ変更できます。金額・仕入先を直す場合は支払側を削除してからやり直してください。`
                : `${purchaseLabel}の日付・仕入先・税込金額・摘要を変更します（複式の相手勘定にも反映されます）。`
              : "支払の日付・摘要のみ変更できます。金額・消込内容を変える場合は一度削除して登録し直してください。"}
          </p>
          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em" }}>
            日付
            <input style={inp} type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          </label>
          {editKind === "ap_purchase" ? (
            <>
              <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em" }}>
                仕入先
                <select
                  style={inp}
                  disabled={editPurchaseAllocationLocked || pending}
                  value={editVendorId}
                  onChange={(e) => setEditVendorId(e.target.value)}
                >
                  <option value="">選択してください</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code ? `${v.code} - ` : ""}
                      {v.name}
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
                  disabled={editPurchaseAllocationLocked || pending}
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
                (editKind === "ap_purchase" &&
                  !editPurchaseAllocationLocked &&
                  (!editVendorId || Math.floor(Number(editAmount || 0)) <= 0))
              }
              onClick={submitEditHistory}
            >
              保存
            </button>
          </div>
        </div>
      </dialog>

      <dialog ref={payRef} style={{ border: "none", borderRadius: 12, padding: 0, maxWidth: 720, width: "94vw" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", fontWeight: 800, letterSpacing: "0.08em", fontSize: 18 }}>支払消込</div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em" }}>
            仕入先
            <select
              style={inp}
              value={payVendorId}
              onChange={(e) => {
                setPayVendorId(e.target.value);
                loadOpen(e.target.value);
              }}
            >
              <option value="">選択してください</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code ? `${v.code} - ` : ""}
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em" }}>
            支払日
            <input style={inp} type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em" }}>
            振込金額・支払額（税込・円）
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
                  name="apFeeBearer"
                  checked={payFeeBearer === "our"}
                  onChange={() => setPayFeeBearer("our")}
                />
                当社負担（消込＝支払額のまま）
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="apFeeBearer"
                  checked={payFeeBearer === "counterparty"}
                  onChange={() => setPayFeeBearer("counterparty")}
                />
                貴社負担（消込＝支払額−手数料）
              </label>
            </div>
          </fieldset>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={btnGhost} onClick={applyFifo} disabled={!openLines.length}>
              支払額を古い順に自動配分
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
              未払を全額指定
            </button>
          </div>
          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em" }}>
            摘要
            <input style={inp} value={paySummary} onChange={(e) => setPaySummary(e.target.value)} placeholder="例：振込支払" />
          </label>

          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.04em", color: "#64748b", lineHeight: 1.55 }}>
            消込合計: {yen(allocSum)} / 消込対象額: {yen(allocTargetMinor)}
            {allocSum !== allocTargetMinor ? <span style={{ color: "#b91c1c", marginLeft: 8 }}>一致させてください</span> : null}
            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600 }}>
              支払額（振込） {yen(transferMinor)}
              {feeMinor > 0 && payFeeBearer === "counterparty" ? (
                <>
                  <br />
                  消込 {yen(allocTargetMinor)} ＋ 手数料 {yen(feeMinor)} ＝ 支払額 {yen(transferMinor)}
                </>
              ) : feeMinor > 0 ? (
                <> ／ 手数料 {yen(feeMinor)}（当社負担・支払額はそのまま消込）</>
              ) : null}
            </div>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15, fontWeight: 600, letterSpacing: "0.03em" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#f8fafc" }}>
                  <th style={{ padding: 8, fontWeight: 800, letterSpacing: "0.05em" }}>日付</th>
                  <th style={{ padding: 8, fontWeight: 800, letterSpacing: "0.05em" }}>摘要</th>
                  <th style={{ padding: 8, textAlign: "right", fontWeight: 800, letterSpacing: "0.05em" }}>未払</th>
                  <th style={{ padding: 8, fontWeight: 800, letterSpacing: "0.05em" }}>消込額</th>
                </tr>
              </thead>
              <tbody>
                {openLines.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 12, color: "#64748b" }}>
                      {payVendorId
                        ? book === "gaichu"
                          ? "未払の外注費行がありません"
                          : "未払の買掛行がありません"
                        : "仕入先を選択してください"}
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
              disabled={
                pending ||
                !payVendorId ||
                !payDate ||
                transferMinor <= 0 ||
                (payFeeBearer === "counterparty" && feeMinor > transferMinor) ||
                allocSum !== allocTargetMinor ||
                allocSum <= 0
              }
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
