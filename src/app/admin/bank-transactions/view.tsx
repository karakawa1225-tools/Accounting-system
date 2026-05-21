"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ACCOUNT_CATEGORY_LABEL_JA } from "@/lib/account-category";
import { matchesListSearch } from "@/lib/list-search";
import { MonthlyExportLinks } from "@/components/monthly-export-links";
import { FiscalPeriodInlineTable } from "@/lib/fiscal-period-ui";
import { registerBankMovement, type BankLedgerLine } from "./actions";

function yen(v: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(v);
}

const accountCatLabel: Record<string, string> = ACCOUNT_CATEGORY_LABEL_JA;

const passbookWrap: React.CSSProperties = {
  background: "linear-gradient(180deg,#f8fafc 0%,#eef2f7 100%)",
  border: "2px solid #94a3b8",
  borderRadius: 12,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.9), 0 12px 28px rgba(15,23,42,.08)",
};

export function BankTransactionsView({
  fiscalStart,
  fiscalEnd,
  bankAccounts,
  bankAccountId,
  bankAccountName,
  hasCompanyBanks = true,
  initialBalanceMinor,
  lines,
  accounts,
  customers,
  payees,
}: {
  fiscalStart?: string | null;
  fiscalEnd?: string | null;
  bankAccounts: { id: string; code: string | null; name: string }[];
  bankAccountId: string;
  bankAccountName: string;
  hasCompanyBanks?: boolean;
  initialBalanceMinor: number;
  lines: BankLedgerLine[];
  accounts: { id: string; name: string; code: string | null; category: string; divisionName: string | null }[];
  customers: { id: string; name: string; code: string | null }[];
  payees: { id: string; name: string; code: string | null; category: string | null }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const dlg = useRef<HTMLDialogElement | null>(null);
  /** showModal の <dialog> は top-layer のため Select のリストを dialog 直下にポートする必要がある */
  const [dialogPortalHost, setDialogPortalHost] = useState<HTMLElement | null>(null);

  const bindDialogRef = (node: HTMLDialogElement | null) => {
    dlg.current = node;
    if (node && dialogPortalHost !== node) setDialogPortalHost(node);
  };

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [flowFilter, setFlowFilter] = useState<"all" | "in" | "out">("all");
  const [lineKeyword, setLineKeyword] = useState("");

  const filtered = useMemo(() => {
    return lines.filter((r) => {
      if (r.transactionDate.slice(0, 7) !== month) return false;
      if (flowFilter !== "all" && r.flow !== flowFilter) return false;
      if (lineKeyword.trim()) {
        const hay = [
          r.transactionDate,
          r.flow === "in" ? "入金" : "出金",
          String(r.amountMinor),
          yen(r.amountMinor),
          r.counterparty ?? "",
          r.accountName,
          r.summary ?? "",
        ].join(" ");
        if (!matchesListSearch(hay, lineKeyword)) return false;
      }
      return true;
    });
  }, [lines, month, flowFilter, lineKeyword]);

  const [direction, setDirection] = useState<"in" | "out">("in");
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amountStr, setAmountStr] = useState("");
  const [summary, setSummary] = useState("");
  const [counterAccountId, setCounterAccountId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [payeeId, setPayeeId] = useState<string>("");
  const [accountPickQuery, setAccountPickQuery] = useState("");

  const filteredPickAccounts = useMemo(() => {
    const q = accountPickQuery.trim();
    const list = !q
      ? accounts
      : accounts.filter((a) => {
          const cat = (a.divisionName && a.divisionName.trim()) || accountCatLabel[a.category] || a.category;
          return matchesListSearch([a.name, a.code, cat].filter(Boolean).join(" "), q);
        });
    // Radix Select は選択中の Item が DOM に無いとトリガーに表示されない（検索絞り込み直後の1回目が空になる）
    if (!counterAccountId) return list;
    const selected = accounts.find((a) => a.id === counterAccountId);
    if (!selected || list.some((a) => a.id === counterAccountId)) return list;
    return [selected, ...list];
  }, [accounts, accountPickQuery, counterAccountId]);

  const openDialog = () => {
    setMsg("");
    setTxDate(new Date().toISOString().slice(0, 10));
    setAmountStr("");
    setSummary("");
    setCounterAccountId("");
    setCustomerId("");
    setPayeeId("");
    setDirection("in");
    setAccountPickQuery("");
    dlg.current?.showModal();
  };

  const submit = () => {
    setMsg("");
    const amountMinor = Math.floor(Number(amountStr || 0));
    if (!counterAccountId || !amountMinor) {
      setMsg("勘定科目と金額を入力してください");
      return;
    }

    startTransition(() => {
      void registerBankMovement({
        bankAccountId,
        transactionDate: txDate,
        amountMinor,
        direction,
        counterAccountId,
        summary: summary.trim() || null,
        customerId: direction === "in" && customerId ? customerId : null,
        payeeId: direction === "out" && payeeId ? payeeId : null,
      })
        .then(() => {
          dlg.current?.close();
          router.refresh();
        })
        .catch((e: Error) => setMsg(e?.message ?? "登録に失敗しました"));
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-3xl font-black tracking-[0.08em] text-slate-900 sm:text-4xl">入出金管理</h1>
          <p className="mt-2 text-sm font-bold tracking-[0.06em] text-slate-600">銀行口座の通帳ビュー。入金は青、出金は赤で表示します。</p>
        </div>
        <button
          type="button"
          onClick={openDialog}
          disabled={pending}
          style={{
            border: "none",
            color: "#fff",
            borderRadius: 8,
            padding: "12px 18px",
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: "0.14em",
            background: "linear-gradient(90deg,#06b6d4,#0ea5e9,#3b82f6)",
            cursor: pending ? "wait" : "pointer",
            opacity: pending ? 0.7 : 1,
          }}
        >
          新規登録
        </button>
      </div>

      <FiscalPeriodInlineTable fiscalStart={fiscalStart} fiscalEnd={fiscalEnd} />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <Label className="text-xs font-bold tracking-widest text-slate-600">銀行口座（自社設定で登録した口座）</Label>
        <Select
          value={bankAccountId}
          onValueChange={(id) => router.push(`/admin/bank-transactions?account=${encodeURIComponent(id)}`)}
        >
          <SelectTrigger className="mt-2 max-w-md font-bold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {bankAccounts.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.code ? `${b.code} ` : ""}
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-2 text-xs font-semibold text-slate-500">
          {hasCompanyBanks
            ? "自社設定の銀行口座一覧から選びます。口座の追加・変更は会計設定（自社設定）で行います。"
            : "自社設定に銀行口座が未登録です。"}{" "}
          <Link href="/admin/company" className="font-bold text-cyan-700 underline">
            自社設定で銀行口座を登録
          </Link>
        </p>
      </section>

      <section
        className="rounded-2xl border border-cyan-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 px-6 py-7 text-slate-50 shadow-xl"
        style={{ letterSpacing: "0.06em" }}
      >
        <div className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-200/90">銀行残高</div>
        <div className="mt-1 text-base font-bold text-cyan-100/90">{bankAccountName}</div>
        <div className="mt-2 font-mono text-4xl font-black tracking-tight sm:text-5xl">{yen(initialBalanceMinor)}</div>
        <div className="mt-3 text-xs font-semibold text-slate-400">選択中の口座に紐づく入出金の合計残高です。</div>
      </section>

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1">
          <Label className="text-xs font-bold tracking-widest text-slate-600">対象月</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44 font-semibold" />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs font-bold tracking-widest text-slate-600">種類</Label>
          <Select value={flowFilter} onValueChange={(v) => setFlowFilter(v as typeof flowFilter)}>
            <SelectTrigger className="w-44 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="in">入金のみ</SelectItem>
              <SelectItem value="out">出金のみ</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1 min-w-[200px] flex-1">
          <Label className="text-xs font-bold tracking-widest text-slate-600">この月の明細を検索</Label>
          <Input
            type="search"
            value={lineKeyword}
            onChange={(e) => setLineKeyword(e.target.value)}
            placeholder="相手先・勘定・摘要・金額など"
            className="font-semibold"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="text-sm font-bold text-slate-600">
          {filtered.length} 件 <span className="font-semibold text-slate-400">（{month}）</span>
        </div>
        <MonthlyExportLinks
          month={month}
          pdfHref={`/admin/bank-transactions/monthly-pdf?account=${encodeURIComponent(bankAccountId)}`}
          csvHref={`/admin/exports/bank-monthly?account=${encodeURIComponent(bankAccountId)}`}
          pdfLabel="月次明細 PDF"
          csvLabel="月次明細 CSV"
        />
      </div>

      <div style={passbookWrap} className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-400/80 bg-slate-200/90 hover:bg-slate-200/90">
              <TableHead className="font-black tracking-wider text-slate-800">日付</TableHead>
              <TableHead className="font-black tracking-wider text-slate-800">種類</TableHead>
              <TableHead className="font-black tracking-wider text-slate-800">相手先</TableHead>
              <TableHead className="font-black tracking-wider text-slate-800">勘定科目</TableHead>
              <TableHead className="min-w-[160px] font-black tracking-wider text-slate-800">摘要・金額</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id} className="border-b border-slate-300/80 bg-white/60">
                <TableCell className="font-semibold text-slate-800">{r.transactionDate}</TableCell>
                <TableCell className="font-bold">
                  {r.flow === "in" ? (
                    <span className="text-sky-600">入金</span>
                  ) : (
                    <span className="text-red-600">出金</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[200px] break-words text-slate-800">{r.counterparty ?? "—"}</TableCell>
                <TableCell className="font-semibold text-slate-800">{r.accountName}</TableCell>
                <TableCell className="min-w-[160px] max-w-sm align-top text-slate-700">
                  <div className="break-words font-semibold">{r.summary?.trim() ? r.summary : "—"}</div>
                  <div
                    className={cn(
                      "mt-1 text-right font-mono text-base font-bold tabular-nums",
                      r.flow === "in" ? "text-sky-700" : "text-red-600"
                    )}
                  >
                    {r.flow === "in" ? "+" : "−"}
                    {yen(r.amountMinor).replace("¥", "")}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center font-bold text-slate-500">
                  該当する入出金がありません
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <dialog
        ref={bindDialogRef}
        className="w-full max-w-lg rounded-xl border border-slate-300 bg-white p-0 shadow-2xl backdrop:bg-black/40"
      >
        <div className="p-6">
          <h2 className="m-0 text-xl font-black tracking-[0.1em] text-slate-900">入出金の登録</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
            勘定科目はマスタ一覧から選択します。売掛・買掛の消込は行いません。入金の「顧客」・出金の「支払先」は任意で、通帳の「相手先」に表示します。
          </p>

          {msg ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">{msg}</div> : null}

          <div className="mt-5 grid gap-4">
            <div className="grid gap-2">
              <Label className="font-bold">種類</Label>
              <div
                className="flex gap-2 rounded-xl border border-slate-300 bg-slate-100/90 p-1.5 shadow-inner"
                role="group"
                aria-label="入金か出金か"
              >
                <button
                  type="button"
                  onClick={() => {
                    setDirection("in");
                    setPayeeId("");
                  }}
                  className={cn(
                    "min-h-[48px] flex-1 rounded-lg text-base font-black tracking-[0.12em] transition-all",
                    direction === "in"
                      ? "bg-gradient-to-r from-sky-500 to-cyan-600 text-white shadow-md"
                      : "bg-transparent text-slate-600 hover:bg-white/90"
                  )}
                >
                  入金
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDirection("out");
                    setCustomerId("");
                  }}
                  className={cn(
                    "min-h-[48px] flex-1 rounded-lg text-base font-black tracking-[0.12em] transition-all",
                    direction === "out"
                      ? "bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md"
                      : "bg-transparent text-slate-600 hover:bg-white/90"
                  )}
                >
                  出金
                </button>
              </div>
              <p className="text-xs font-semibold text-slate-500">
                {direction === "in" ? "預金が増える取引（普通預金の借方）" : "預金が減る取引（普通預金の貸方）"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="font-bold">日付</Label>
                <Input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} className="font-semibold" />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold">金額（円）</Label>
                <Input
                  inputMode="numeric"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="例: 120000"
                  className="font-mono font-semibold"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="font-bold">
                {direction === "in" ? "勘定科目名（貸方・相手科目）" : "勘定科目名（借方・相手科目）"}
              </Label>
              <p className="text-xs font-semibold text-slate-500">
                マスタ管理の勘定科目から選びます（有効な科目のみ・普通預金は除く・コード順）。
              </p>
              <Input
                type="search"
                value={accountPickQuery}
                onChange={(e) => setAccountPickQuery(e.target.value)}
                placeholder="勘定科目名・コードで絞り込み（例: 現金）"
                className="font-semibold"
                autoComplete="off"
                spellCheck={false}
              />
              {accounts.length === 0 ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
                  選べる勘定科目がありません。マスタ管理で勘定科目を作成するか、「有効」になっていることを確認してください（標準の売上高・仕入高等はここから選べます）。
                </p>
              ) : null}
              <Select
                value={counterAccountId || "__none__"}
                onValueChange={(v) => {
                  const id = v === "__none__" ? "" : v;
                  setCounterAccountId(id);
                  if (id) setAccountPickQuery("");
                }}
              >
                <SelectTrigger className="min-h-11 text-left">
                  <SelectValue placeholder="勘定科目名を選択" className="font-extrabold tracking-wide text-slate-900" />
                </SelectTrigger>
                <SelectContent container={dialogPortalHost} className="max-h-72">
                  <SelectItem value="__none__" textValue="選択してください">
                    選択してください
                  </SelectItem>
                  {filteredPickAccounts.map((a) => {
                    const cat = (a.divisionName && a.divisionName.trim()) || accountCatLabel[a.category] || a.category;
                    const textValue = [a.code, a.name].filter(Boolean).join(" ");
                    return (
                      <SelectItem key={a.id} value={a.id} textValue={textValue || a.name}>
                        <div className="flex flex-col gap-0.5 py-0.5 text-left">
                          <span className="text-base font-extrabold tracking-wide text-slate-900">{a.name}</span>
                          <span className="text-xs font-semibold text-slate-500">
                            {[a.code && `コード ${a.code}`, cat && `区分 ${cat}`].filter(Boolean).join(" · ") || "—"}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {direction === "in" ? (
              <div className="grid gap-2">
                <Label className="font-bold">顧客（任意）</Label>
                <Select value={customerId || "__none__"} onValueChange={(v) => setCustomerId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="font-semibold">
                    <SelectValue placeholder="選択しない" />
                  </SelectTrigger>
                  <SelectContent container={dialogPortalHost}>
                    <SelectItem value="__none__">なし</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code ? `${c.code} ` : ""}
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label className="font-bold">支払先（任意）</Label>
                <p className="text-xs font-semibold text-slate-500">マスタの「支払先」一覧です（給与・役員報酬・取引先など）。先にマスタ管理で登録してください。</p>
                <Select value={payeeId || "__none__"} onValueChange={(v) => setPayeeId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="font-semibold">
                    <SelectValue placeholder="選択しない" />
                  </SelectTrigger>
                  <SelectContent container={dialogPortalHost} className="max-h-72">
                    <SelectItem value="__none__">なし</SelectItem>
                    {payees.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code ? `${p.code} ` : ""}
                        {p.name}
                        {p.category ? `（${p.category}）` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label className="font-bold">摘要</Label>
              <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="例: 振込入金" className="font-semibold" />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => dlg.current?.close()}
              className="rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              style={{
                border: "none",
                color: "#fff",
                borderRadius: 8,
                padding: "10px 18px",
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: "0.12em",
                background: "linear-gradient(90deg,#06b6d4,#0ea5e9,#3b82f6)",
                cursor: pending ? "wait" : "pointer",
                opacity: pending ? 0.75 : 1,
              }}
            >
              登録
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
