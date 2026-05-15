"use client";

import { useMemo, useState, useTransition } from "react";
import { getPriorPeriodEndDate } from "@/lib/fiscal-period";
import { updateCompany } from "./actions";

const card: React.CSSProperties = { background: "#fff", border: "1px solid #cdd4de", borderRadius: 12, padding: 22, maxWidth: 720 };
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
  padding: "8px 14px",
  fontSize: 14,
  fontWeight: 700,
  background: "#f8fafc",
  cursor: "pointer",
};
const field: React.CSSProperties = { display: "grid", gap: 8 };
const labelText: React.CSSProperties = { fontSize: 15, fontWeight: 700, letterSpacing: "0.05em" };
const inp: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", fontSize: 15, fontWeight: 600, letterSpacing: "0.04em" };

type BankFormRow = {
  id?: string;
  label: string;
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  accountHolder: string;
  accountId: string;
  fiscalEndBalanceMinor: string;
};

function emptyBankRow(accountId = ""): BankFormRow {
  return {
    label: "",
    bankName: "",
    branchName: "",
    accountType: "",
    accountNumber: "",
    accountHolder: "",
    accountId,
    fiscalEndBalanceMinor: "0",
  };
}

export function CompanySettingsView({
  company,
  initialBanks,
  ledgerAccounts,
}: {
  company: Record<string, unknown>;
  initialBanks: {
    id: string;
    label: string | null;
    bankName: string | null;
    branchName: string | null;
    accountType: string | null;
    accountNumber: string | null;
    accountHolder: string | null;
    accountId: string;
    fiscalEndBalanceMinor: number;
  }[];
  ledgerAccounts: { id: string; code: string | null; name: string; category: string }[];
}) {
  const priorPeriodEnd = getPriorPeriodEndDate(
    typeof company.fiscalPeriodStart === "string" ? company.fiscalPeriodStart : null
  );
  const priorBalanceLabel = priorPeriodEnd
    ? `前期末残高（${priorPeriodEnd} 時点・円）`
    : "前期末残高（円）";
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [banks, setBanks] = useState<BankFormRow[]>(() =>
    initialBanks.length
      ? initialBanks.map((b) => ({
          id: b.id,
          label: b.label ?? "",
          bankName: b.bankName ?? "",
          branchName: b.branchName ?? "",
          accountType: b.accountType ?? "",
          accountNumber: b.accountNumber ?? "",
          accountHolder: b.accountHolder ?? "",
          accountId: b.accountId,
          fiscalEndBalanceMinor: String(b.fiscalEndBalanceMinor ?? 0),
        }))
      : [emptyBankRow(ledgerAccounts[0]?.id ?? "")]
  );

  const defaultAccountId = useMemo(() => ledgerAccounts[0]?.id ?? "", [ledgerAccounts]);

  const updateBank = (index: number, patch: Partial<BankFormRow>) => {
    setBanks((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addBank = () => setBanks((prev) => [...prev, emptyBankRow(defaultAccountId)]);
  const removeBank = (index: number) => setBanks((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div>
        <h1 className="m-0 text-3xl font-extrabold tracking-[0.08em] sm:text-4xl">自社設定</h1>
        <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 16, fontWeight: 600, letterSpacing: "0.05em", lineHeight: 1.65 }}>
          請求書や帳票に載せる基本情報と、入出金で使う銀行口座を管理します。
        </p>
      </div>
      {msg ? (
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.04em", color: msg.startsWith("保存") ? "#15803d" : "#b91c1c" }}>{msg}</div>
      ) : null}
      <form
        action={(fd) => {
          fd.set(
            "banksJson",
            JSON.stringify(
              banks.map((b) => ({
                ...b,
                fiscalEndBalanceMinor: Math.floor(Number(String(b.fiscalEndBalanceMinor).replace(/,/g, "") || 0)) || 0,
              }))
            )
          );
          startTransition(() =>
            void updateCompany(fd)
              .then(() => setMsg("保存しました"))
              .catch((e) => setMsg(e?.message ?? "保存に失敗しました"))
          );
        }}
        style={{ ...card, display: "grid", gap: 12 }}
      >
        <label style={field}>
          <span style={labelText}>社名（必須）</span>
          <input style={inp} name="name" required defaultValue={String(company.name ?? "")} />
        </label>
        <label style={field}>
          <span style={labelText}>郵便番号</span>
          <input style={inp} name="postalCode" defaultValue={String(company.postalCode ?? "")} />
        </label>
        <label style={field}>
          <span style={labelText}>住所</span>
          <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }} name="address" defaultValue={String(company.address ?? "")} />
        </label>
        <label style={field}>
          <span style={labelText}>電話番号</span>
          <input style={inp} name="phone" defaultValue={String(company.phone ?? "")} />
        </label>
        <label style={field}>
          <span style={labelText}>FAX</span>
          <input style={inp} name="fax" defaultValue={String(company.fax ?? "")} />
        </label>
        <label style={field}>
          <span style={labelText}>代表者名</span>
          <input style={inp} name="representativeName" defaultValue={String(company.representativeName ?? "")} />
        </label>
        <label style={field}>
          <span style={labelText}>法人番号など</span>
          <input style={inp} name="taxId" defaultValue={String(company.taxId ?? "")} />
        </label>
        <label style={field}>
          <span style={labelText}>インボイス登録番号</span>
          <input style={inp} name="invoiceRegistrationNumber" defaultValue={String(company.invoiceRegistrationNumber ?? "")} />
        </label>
        <div style={{ borderTop: "1px solid #e2e8f0", margin: "12px 0 4px", paddingTop: 12 }}>
          <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 800, letterSpacing: "0.06em", color: "#334155" }}>会計期間</p>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#64748b" }}>現在の会計年度の開始日・終了日</p>
        </div>
        <label style={field}>
          <span style={labelText}>期首（開始日）</span>
          <input style={inp} type="date" name="fiscalPeriodStart" defaultValue={String(company.fiscalPeriodStart ?? "")} />
        </label>
        <label style={field}>
          <span style={labelText}>期末（終了日）</span>
          <input style={inp} type="date" name="fiscalPeriodEnd" defaultValue={String(company.fiscalPeriodEnd ?? "")} />
        </label>

        <div style={{ borderTop: "1px solid #e2e8f0", marginTop: 8, paddingTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#334155" }}>銀行口座（複数登録可）</p>
              <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: "#64748b" }}>
                入出金画面で選べる口座です。前期末残高は「今期の期首」の残高として登録されます（会計期間の開始日が必要です。基準日は開始日の前日）。
              </p>
            </div>
            <button type="button" style={btnGhost} onClick={addBank}>
              ＋ 口座を追加
            </button>
          </div>

          <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
            {banks.map((row, index) => (
              <div
                key={row.id ?? `new-${index}`}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 14,
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontWeight: 800, color: "#475569" }}>口座 {index + 1}</span>
                  {banks.length > 1 ? (
                    <button type="button" style={{ ...btnGhost, color: "#b91c1c", borderColor: "#fca5a5" }} onClick={() => removeBank(index)}>
                      削除
                    </button>
                  ) : null}
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  <label style={field}>
                    <span style={labelText}>表示名（任意）</span>
                    <input style={inp} value={row.label} onChange={(e) => updateBank(index, { label: e.target.value })} placeholder="例: 本店普通" />
                  </label>
                  <label style={field}>
                    <span style={labelText}>銀行名</span>
                    <input style={inp} value={row.bankName} onChange={(e) => updateBank(index, { bankName: e.target.value })} />
                  </label>
                  <label style={field}>
                    <span style={labelText}>支店名</span>
                    <input style={inp} value={row.branchName} onChange={(e) => updateBank(index, { branchName: e.target.value })} />
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <label style={field}>
                      <span style={labelText}>口座区分</span>
                      <input style={inp} value={row.accountType} onChange={(e) => updateBank(index, { accountType: e.target.value })} placeholder="普通" />
                    </label>
                    <label style={field}>
                      <span style={labelText}>口座番号</span>
                      <input style={inp} value={row.accountNumber} onChange={(e) => updateBank(index, { accountNumber: e.target.value })} />
                    </label>
                  </div>
                  <label style={field}>
                    <span style={labelText}>口座名義</span>
                    <input style={inp} value={row.accountHolder} onChange={(e) => updateBank(index, { accountHolder: e.target.value })} />
                  </label>
                  <label style={field}>
                    <span style={labelText}>紐づく勘定科目（必須）</span>
                    <select
                      style={inp}
                      required
                      value={row.accountId}
                      onChange={(e) => updateBank(index, { accountId: e.target.value })}
                    >
                      <option value="">選択してください</option>
                      {ledgerAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code ? `${a.code} ` : ""}
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={field}>
                    <span style={labelText}>{priorBalanceLabel}</span>
                    <input
                      style={{ ...inp, fontFamily: "ui-monospace, monospace" }}
                      inputMode="numeric"
                      value={row.fiscalEndBalanceMinor}
                      onChange={(e) => updateBank(index, { fiscalEndBalanceMinor: e.target.value })}
                      placeholder="0"
                    />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>
                      前期の期末時点の預金残高です（今期期末ではありません）。保存すると今期期首の期首残高・入出金の基準残高に反映されます。
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={pending} style={btn}>
          {pending ? "保存中…" : "保存"}
        </button>
      </form>
    </main>
  );
}
