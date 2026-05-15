"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ACCOUNT_CATEGORY_LABEL_JA, ACCOUNT_CATEGORY_SELECT_OPTIONS } from "@/lib/account-category";
import { matchesListSearch } from "@/lib/list-search";
import {
  createAccount,
  createAccountDivision,
  createCustomer,
  createPayee,
  createVendor,
  deleteAccount,
  deleteAccountDivision,
  deleteCustomer,
  deletePayee,
  deleteVendor,
  importAccountDivisionsCsv,
  importAccountsCsv,
  importCustomersCsv,
  importPayeesCsv,
  importVendorsCsv,
  runCleanupNonCsvMasters,
  saveOpeningBalances,
  updateAccount,
  updateAccountDivision,
  updateCustomer,
  updatePayee,
  updateVendor,
} from "./actions";

const card: React.CSSProperties = { background: "#fff", border: "1px solid #cdd4de", borderRadius: 12, padding: 20 };
const btn: React.CSSProperties = {
  border: "none",
  color: "#fff",
  borderRadius: 8,
  padding: "10px 16px",
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
  padding: "8px 12px",
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "0.1em",
  background: "#f8fafc",
  cursor: "pointer",
};
const btnDanger: React.CSSProperties = { ...btnGhost, borderColor: "#fca5a5", color: "#b91c1c", background: "#fef2f2" };
const inp: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", fontSize: 16, fontWeight: 600, letterSpacing: "0.04em" };
const guideCircle: React.CSSProperties = {
  width: 116,
  height: 116,
  borderRadius: 9999,
  border: "3px solid #67c9dd",
  background: "linear-gradient(180deg,#ffffff,#f2fbff)",
  display: "grid",
  placeItems: "center",
  fontWeight: 800,
  letterSpacing: "0.08em",
  color: "#0f4f69",
  boxShadow: "0 8px 18px rgba(15,79,105,.12)",
  cursor: "pointer",
};

type MastersTab = "accounts" | "balances" | "customers" | "vendors" | "payees" | "other";

function guideCircleStyle(active: boolean): React.CSSProperties {
  return {
    ...guideCircle,
    border: active ? "3px solid #0284c7" : guideCircle.border,
    boxShadow: active ? "0 10px 24px rgba(2,132,199,.28)" : guideCircle.boxShadow,
    outline: active ? "2px solid rgba(14,165,233,.45)" : undefined,
  };
}

type AccountRow = Record<string, unknown>;
type CustomerRow = Record<string, unknown>;
type VendorRow = Record<string, unknown>;
type PayeeRow = Record<string, unknown>;

const catLabel: Record<string, string> = ACCOUNT_CATEGORY_LABEL_JA;

function sortedDivisions(divisions: Record<string, unknown>[]) {
  return [...divisions].sort((a, b) => {
    const ao = Number(a.sortOrder ?? 0);
    const bo = Number(b.sortOrder ?? 0);
    if (ao !== bo) return ao - bo;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""), "ja");
  });
}

function divisionsSelectableForAccount(divisions: Record<string, unknown>[], selectedAccountDivisionId?: string) {
  const sid = selectedAccountDivisionId ? String(selectedAccountDivisionId) : "";
  return sortedDivisions(divisions).filter((d) => d.isActive !== false || String(d.id) === sid);
}

function accountDivisionDisplayName(account: Record<string, unknown>, divisions: Record<string, unknown>[]): string {
  const id = account.accountDivisionId != null ? String(account.accountDivisionId) : "";
  if (id) {
    const d = divisions.find((x) => String(x.id) === id);
    if (d) return String(d.name ?? "—");
  }
  return catLabel[String(account.category)] ?? String(account.category ?? "—");
}

type BulkDeleteFailure = { id: string; message: string };

/** サーバーアクションを ID ごとに順に実行し、失敗だけ集める（一括削除用） */
async function bulkDeleteSequential(ids: string[], deleteOne: (id: string) => Promise<void>): Promise<{ failed: BulkDeleteFailure[] }> {
  const failed: BulkDeleteFailure[] = [];
  for (const id of ids) {
    try {
      await deleteOne(id);
    } catch (e) {
      failed.push({ id, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return { failed };
}

export function MastersClient({
  accounts,
  accountDivisions,
  customers,
  vendors,
  payees,
  fiscalPeriodStart,
  openingBalances,
  openingAccountId,
  openingBalanceFormKey,
}: {
  accounts: AccountRow[];
  accountDivisions: AccountRow[];
  customers: CustomerRow[];
  vendors: VendorRow[];
  payees: PayeeRow[];
  /** 自社設定の会計期間開始日（YYYY-MM-DD）。未設定でも入力は可。保存には必須 */
  fiscalPeriodStart: string | null;
  /** 当該期首日の勘定別残高（円・借方プラス）。未登録勘定は 0 */
  openingBalances: Record<string, number>;
  /** 期首貸借調整勘定（一覧から除外） */
  openingAccountId: string;
  /** サーバー反映後に入力欄を正しい既定値で再マウントするためのキー */
  openingBalanceFormKey: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [tab, setTab] = useState<MastersTab>("accounts");

  const accountsRef = useRef<HTMLElement | null>(null);
  const balancesRef = useRef<HTMLElement | null>(null);
  const customersRef = useRef<HTMLElement | null>(null);
  const vendorsRef = useRef<HTMLElement | null>(null);
  const payeesRef = useRef<HTMLElement | null>(null);
  const otherRef = useRef<HTMLElement | null>(null);

  const defaultNewAccountDivisionId = String(divisionsSelectableForAccount(accountDivisions)[0]?.id ?? "");

  const goTab = (next: MastersTab, scrollEl: HTMLElement | null) => {
    setTab(next);
    window.setTimeout(() => scrollEl?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const run = (f: () => Promise<void>) =>
    startTransition(() =>
      void f()
        .then(() => {
          setError("");
          setInfo("処理が完了しました");
          window.setTimeout(() => setInfo(""), 2500);
        })
        .catch((e) => setError(e?.message ?? "エラーが発生しました"))
    );

  const reportBulkOutcome = (failed: BulkDeleteFailure[], attempted: number) => {
    const ok = attempted - failed.length;
    if (failed.length) {
      const sample = failed
        .slice(0, 5)
        .map((f) => f.message)
        .join("； ");
      setError(`一括削除: ${attempted}件中 ${failed.length}件が失敗しました。${sample}${failed.length > 5 ? "…" : ""}`);
      if (ok > 0) setInfo(`${ok}件は処理済みです。`);
      else setInfo("");
    } else {
      setError("");
      setInfo(`${attempted}件を一括処理しました`);
      window.setTimeout(() => setInfo(""), 3500);
    }
  };

  const [openingTableSearch, setOpeningTableSearch] = useState("");

  const openingTableAccounts = useMemo(() => {
    const base = accounts.filter((a) => String(a.id) !== openingAccountId && a.isActive !== false);
    if (!openingTableSearch.trim()) return base;
    return base.filter((a) =>
      matchesListSearch(
        [a.code, a.name, accountDivisionDisplayName(a as Record<string, unknown>, accountDivisions)]
          .filter((x) => x != null && String(x) !== "")
          .join(" "),
        openingTableSearch
      )
    );
  }, [accounts, openingAccountId, openingTableSearch, accountDivisions]);

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <section
        style={{
          border: "1px solid #c3ccd6",
          borderRadius: 16,
          padding: 16,
          background: "linear-gradient(180deg,#f7fafc,#edf2f7)",
          boxShadow: "0 10px 24px rgba(30,41,59,.08)",
          display: "grid",
          gap: 14,
        }}
      >
        <h1 className="m-0 text-3xl font-extrabold tracking-[0.08em] sm:text-4xl">マスタ管理センター</h1>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#475569", lineHeight: 1.55 }}>
          下の丸ボタンで各マスタ画面へ移動します（勘定科目・期首残高・顧客・仕入先・支払先・その他）。
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <button type="button" style={guideCircleStyle(tab === "accounts")} onClick={() => goTab("accounts", accountsRef.current)}>
            基本設定
          </button>
          <button type="button" style={guideCircleStyle(tab === "balances")} onClick={() => goTab("balances", balancesRef.current)}>
            残高登録
          </button>
          <button type="button" style={guideCircleStyle(tab === "vendors")} onClick={() => goTab("vendors", vendorsRef.current)}>
            許容登録
          </button>
          <button type="button" style={guideCircleStyle(tab === "payees")} onClick={() => goTab("payees", payeesRef.current)}>
            支払先
          </button>
          <button type="button" style={guideCircleStyle(tab === "other")} onClick={() => goTab("other", otherRef.current)}>
            その他
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
          <GuidePanel title="基本設定" items={["会計基本情報", "勘定科目区分", "勘定科目", "補助科目"]} />
          <GuidePanel title="残高登録" items={["勘定科目残高", "補助科目残高", "期首残高（会計期間開始日）"]} />
          <GuidePanel title="許容登録" items={["摘要", "経費辞書", "仕訳辞書", "伝票辞書"]} />
          <GuidePanel title="支払先" items={["給与・役員報酬", "仕入先以外の支払", "入出金の相手先"]} />
          <GuidePanel title="その他" items={["外部連携", "プロジェクト", "社内項目"]} />
        </div>
      </section>

      {error ? <div style={{ color: "#b91c1c", fontSize: 16, fontWeight: 700, letterSpacing: "0.04em" }}>{error}</div> : null}
      {info ? <div style={{ color: "#15803d", fontSize: 16, fontWeight: 700, letterSpacing: "0.04em" }}>{info}</div> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 12, padding: 10 }}>
        <button type="button" style={{ ...btn, opacity: tab === "accounts" ? 1 : 0.85 }} onClick={() => goTab("accounts", accountsRef.current)}>
          勘定科目
        </button>
        <button type="button" style={{ ...btn, opacity: tab === "balances" ? 1 : 0.85 }} onClick={() => goTab("balances", balancesRef.current)}>
          期首残高
        </button>
        <button type="button" style={{ ...btn, opacity: tab === "customers" ? 1 : 0.85 }} onClick={() => goTab("customers", customersRef.current)}>
          顧客
        </button>
        <button type="button" style={{ ...btn, opacity: tab === "vendors" ? 1 : 0.85 }} onClick={() => goTab("vendors", vendorsRef.current)}>
          仕入先
        </button>
        <button type="button" style={{ ...btn, opacity: tab === "payees" ? 1 : 0.85 }} onClick={() => goTab("payees", payeesRef.current)}>
          支払先
        </button>
        <button type="button" style={{ ...btn, opacity: tab === "other" ? 1 : 0.85 }} onClick={() => goTab("other", otherRef.current)}>
          その他
        </button>
      </div>

      <section ref={accountsRef} id="masters-accounts" style={{ ...card, display: tab === "accounts" ? "block" : "none" }}>
          <h3 className="mt-0 text-xl font-extrabold tracking-[0.06em]">勘定科目・区分マスタ</h3>

          <h4 style={{ margin: "20px 0 8px", fontSize: 17, fontWeight: 800, letterSpacing: "0.06em" }}>勘定科目区分マスタ</h4>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#475569", lineHeight: 1.55 }}>
            CSV列: <strong>区分コード</strong>（<strong>Yで始まる</strong>）, <strong>区分名称</strong>, <strong>財務区分</strong>, <strong>表示順（任意）</strong>。
            区分コードが Y 始まり以外・勘定コードが数字以外の行は、下の整理ボタンで削除できます。
          </p>
          <CsvForm title="区分CSV取込" pending={pending} onAction={(fd) => run(() => importAccountDivisionsCsv(fd))} />
          <button
            type="button"
            style={{ ...btnGhost, marginTop: 8, borderColor: "#fca5a5", color: "#b91c1c" }}
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await runCleanupNonCsvMasters();
                setInfo(
                  `整理完了: 区分${r.divisionsDeleted}件削除、勘定${r.accountsDeleted}件削除・${r.accountsDeactivated}件無効化（Y区分・数字コード・SYS_*以外）`
                );
              })
            }
          >
            CSV以外の区分・勘定を整理
          </button>
          <form action={(fd) => run(() => createAccountDivision(fd))} style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <input style={inp} name="code" placeholder="区分コード（Y01 など・Yで始まる）" required />
            <input style={inp} name="name" placeholder="区分名称" required />
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>財務区分（決算書上の資産／負債／収益／費用の5類型）</span>
              <select style={inp} name="statementCategory" defaultValue="asset">
                {ACCOUNT_CATEGORY_SELECT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}（{o.value}）
                  </option>
                ))}
              </select>
            </label>
            <input style={inp} name="sortOrder" placeholder="表示順（数値・小さいほど先）" />
            <button type="submit" style={btn} disabled={pending}>
              区分を追加
            </button>
          </form>
          <MasterTable
            rows={sortedDivisions(accountDivisions)}
            pending={pending}
            columns={[
              { key: "code", label: "コード", render: (r) => String(r.code ?? "—") },
              { key: "name", label: "区分名称", ellipsis: true },
              {
                key: "statementCategory",
                label: "財務区分",
                render: (r) => catLabel[String(r.statementCategory)] ?? String(r.statementCategory ?? "—"),
              },
              {
                key: "sortOrder",
                label: "順",
                width: 56,
                render: (r) => String(r.sortOrder ?? "0"),
              },
              {
                key: "isActive",
                label: "状態",
                render: (r) => (r.isActive === false ? "無効" : "有効"),
              },
            ]}
            renderDetail={(r) => (
              <dl style={{ display: "grid", gap: 6, margin: 0 }}>
                <DetailItem k="ID" v={String(r.id)} />
                <DetailItem k="区分コード" v={r.code} />
                <DetailItem k="区分名称" v={r.name} />
                <DetailItem k="財務区分" v={catLabel[String(r.statementCategory)] ?? r.statementCategory} />
                <DetailItem k="表示順" v={r.sortOrder} />
                <DetailItem k="有効" v={r.isActive === false ? "いいえ" : "はい"} />
              </dl>
            )}
            renderEdit={(r, close) => (
              <form
                action={(fd) =>
                  run(async () => {
                    fd.set("id", String(r.id));
                    await updateAccountDivision(fd);
                    close();
                  })
                }
                style={{ display: "grid", gap: 10 }}
              >
                <input type="hidden" name="id" value={String(r.id)} />
                <label style={{ display: "grid", gap: 4 }}>
                  区分コード
                  <input style={inp} name="code" defaultValue={String(r.code ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  区分名称
                  <input style={inp} name="name" required defaultValue={String(r.name ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  財務区分
                  <select style={inp} name="statementCategory" defaultValue={String(r.statementCategory ?? "asset")}>
                    {ACCOUNT_CATEGORY_SELECT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}（{o.value}）
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  表示順
                  <input style={inp} name="sortOrder" defaultValue={String(r.sortOrder ?? 0)} />
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span>有効</span>
                  <select style={inp} name="isActive" defaultValue={r.isActive === false ? "0" : "1"}>
                    <option value="1">はい</option>
                    <option value="0">いいえ</option>
                  </select>
                </label>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" style={btnGhost} onClick={close}>
                    キャンセル
                  </button>
                  <button type="submit" style={btn} disabled={pending}>
                    保存
                  </button>
                </div>
              </form>
            )}
            deleteAction={(r) => run(() => deleteAccountDivision(mkfd("id", String(r.id))))}
            deleteConfirmText="この勘定科目区分を削除しますか？この区分を使用中の勘定がある場合は削除できません。"
            listSearch={{
              placeholder: "区分コード・区分名など",
              haystack: (r) =>
                [r.code, r.name, catLabel[String(r.statementCategory)] ?? r.statementCategory, r.sortOrder, r.isActive === false ? "無効" : "有効"]
                  .filter((x) => x != null && String(x) !== "")
                  .join(" "),
            }}
          />

          <h4 style={{ margin: "28px 0 8px", fontSize: 17, fontWeight: 800, letterSpacing: "0.06em" }}>勘定科目</h4>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#475569", lineHeight: 1.55 }}>
            CSV列: <strong>勘定側区分コード</strong>, <strong>勘定側区分名称</strong>, <strong>勘定科目コード</strong>, <strong>勘定科目名</strong>, <strong>
              バーコード
            </strong>
            （任意）。勘定側の区分列は「勘定科目区分マスタ」のコードまたは名称と一致させると紐づきます。
          </p>
          <CsvForm title="勘定CSV取込" pending={pending} onAction={(fd) => run(() => importAccountsCsv(fd))} />
          <form action={(fd) => run(() => createAccount(fd))} style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input style={inp} name="categoryCode" placeholder="勘定の補助・区分コード（任意）" />
              <select
                style={inp}
                name="accountDivisionId"
                required
                defaultValue={defaultNewAccountDivisionId}
              >
                {defaultNewAccountDivisionId === "" ? <option value="">区分を追加してください</option> : null}
                {divisionsSelectableForAccount(accountDivisions).map((d) => (
                  <option key={String(d.id)} value={String(d.id)}>
                    {d.code ? `${String(d.code)} · ` : ""}
                    {String(d.name)}
                  </option>
                ))}
              </select>
            </div>
            <input style={inp} name="code" placeholder="勘定科目コード" />
            <input style={inp} name="name" placeholder="勘定科目名" required />
            <input style={inp} name="barcodeCode" placeholder="バーコード用コード" />
            <button type="submit" style={btn} disabled={pending}>
              勘定科目を追加
            </button>
          </form>
          <MasterTable
            rows={accounts}
            pending={pending}
            columns={[
              { key: "code", label: "コード" },
              { key: "name", label: "名称" },
              {
                key: "accountDivisionId",
                label: "勘定科目区分",
                render: (r) => accountDivisionDisplayName(r, accountDivisions),
              },
              {
                key: "isActive",
                label: "状態",
                render: (r) => (r.isActive === false ? "無効" : "有効"),
              },
            ]}
            renderDetail={(r) => (
              <dl style={{ display: "grid", gap: 6, margin: 0 }}>
                <DetailItem k="ID" v={String(r.id)} />
                <DetailItem k="勘定の区分コード（補助）" v={r.categoryCode} />
                <DetailItem k="勘定科目区分" v={accountDivisionDisplayName(r, accountDivisions)} />
                <DetailItem k="財務区分（集計用・自動同期）" v={catLabel[String(r.category)] ?? r.category} />
                <DetailItem k="勘定科目コード" v={r.code} />
                <DetailItem k="勘定科目名" v={r.name} />
                <DetailItem k="バーコード用コード" v={r.barcodeCode} />
                <DetailItem k="有効" v={r.isActive === false ? "いいえ" : "はい"} />
              </dl>
            )}
            renderEdit={(r, close) => (
              <form
                action={(fd) =>
                  run(async () => {
                    fd.set("id", String(r.id));
                    await updateAccount(fd);
                    close();
                  })
                }
                style={{ display: "grid", gap: 10 }}
              >
                <input type="hidden" name="id" value={String(r.id)} />
                <label style={{ display: "grid", gap: 4 }}>
                  勘定の区分コード（補助）
                  <input style={inp} name="categoryCode" defaultValue={String(r.categoryCode ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  勘定科目区分（マスタ）
                  <select
                    style={inp}
                    name="accountDivisionId"
                    required
                    defaultValue={String(r.accountDivisionId ?? "")}
                  >
                    <option value="">選択してください</option>
                    {divisionsSelectableForAccount(accountDivisions, String(r.accountDivisionId ?? "")).map((d) => (
                      <option key={String(d.id)} value={String(d.id)}>
                        {d.code ? `${String(d.code)} · ` : ""}
                        {String(d.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  勘定科目コード
                  <input style={inp} name="code" defaultValue={String(r.code ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  勘定科目名
                  <input style={inp} name="name" required defaultValue={String(r.name ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  バーコード用コード
                  <input style={inp} name="barcodeCode" defaultValue={String(r.barcodeCode ?? "")} />
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span>有効</span>
                  <select style={inp} name="isActive" defaultValue={r.isActive === false ? "0" : "1"}>
                    <option value="1">はい</option>
                    <option value="0">いいえ</option>
                  </select>
                </label>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" style={btnGhost} onClick={close}>
                    キャンセル
                  </button>
                  <button type="submit" style={btn} disabled={pending}>
                    保存
                  </button>
                </div>
              </form>
            )}
            deleteMergeOptions={(r) => {
              const code = String(r.code ?? "").trim();
              const name = String(r.name ?? "").trim().toLowerCase();
              return accounts
                .filter((a) => {
                  if (String(a.id) === String(r.id)) return false;
                  const aCode = String(a.code ?? "").trim();
                  if (code && aCode === code) return true;
                  if (!code && name && String(a.name ?? "").trim().toLowerCase() === name) return true;
                  return false;
                })
                .map((a) => ({
                  id: String(a.id),
                  label: `${a.code ? `${String(a.code)} · ` : ""}${String(a.name)}`,
                }));
            }}
            deleteAction={(r, mergeInto) =>
              run(() => {
                const fd = mkfd("id", String(r.id));
                if (mergeInto) fd.set("mergeInto", mergeInto);
                return deleteAccount(fd);
              })
            }
            deleteConfirmText="この勘定科目を削除しますか？取引がある場合は無効化のみ。取引がなくても期首残高で参照されている場合は先に関連行を削除してから物理削除します。重複は統合先を選ぶと仕訳を付け替えてから削除できます。"
            bulkDeleteByIds={(ids) => bulkDeleteSequential(ids, (id) => deleteAccount(mkfd("id", id)))}
            bulkDeleteConfirmText="選択した勘定科目を、統合なしで順に削除します。重複の統合削除は行ごとの「削除」から行ってください。取引がある科目は無効化のみになる場合があります。"
            reportBulkOutcome={reportBulkOutcome}
            listSearch={{
              placeholder: "勘定科目名・コードなど（例: 現金）",
              haystack: (r) =>
                [r.code, r.name, r.barcodeCode, r.categoryCode, accountDivisionDisplayName(r, accountDivisions), r.isActive === false ? "無効" : "有効"]
                  .filter((x) => x != null && String(x) !== "")
                  .join(" "),
            }}
          />
      </section>

      <section ref={balancesRef} id="masters-balances" style={{ ...card, display: tab === "balances" ? "block" : "none" }}>
        <h3 className="mt-0 text-xl font-extrabold tracking-[0.06em]">期首残高（会計期間開始日）</h3>
        {!fiscalPeriodStart ? (
          <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 700, color: "#a16207", lineHeight: 1.6, background: "#fef9c3", padding: "10px 12px", borderRadius: 10, border: "1px solid #fde047" }}>
            会計期間の開始日が<strong>未登録</strong>のときは、期首残高は<strong>すべて 0</strong>として表示します。下の表で金額を編集できます。
            <strong>保存</strong>するには自社設定で開始日を登録してください。
            <Link href="/admin/company" style={{ marginLeft: 8, fontWeight: 800, color: "#0369a1" }}>
              自社設定へ
            </Link>
          </p>
        ) : (
          <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 600, color: "#475569", lineHeight: 1.65 }}>
            基準日: <strong>{fiscalPeriodStart}</strong> 。未登録の勘定は<strong>0</strong>です。金額は<strong>円・借方をプラス</strong>（貸方残の科目はマイナス）。保存すると同日付の仕訳「[期首残高]」が自動作成され、勘定「期首貸借調整」と複式で釣り合います。
          </p>
        )}
        <form
          key={openingBalanceFormKey}
          action={(fd) =>
            startTransition(() =>
              void saveOpeningBalances(fd)
                .then(() => {
                  setError("");
                  setInfo("期首残高を保存しました");
                  router.refresh();
                  window.setTimeout(() => setInfo(""), 2500);
                })
                .catch((e) => setError(e?.message ?? "保存に失敗しました"))
            )
          }
          style={{ marginTop: 14, display: "grid", gap: 10 }}
        >
          <label style={{ display: "grid", gap: 6, fontSize: 14, fontWeight: 700, color: "#475569" }}>
            この一覧を検索（勘定コード・名称・区分）
            <input
              type="search"
              style={{ ...inp, maxWidth: 440 }}
              placeholder="例: 現金"
              value={openingTableSearch}
              onChange={(e) => setOpeningTableSearch(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 10, maxHeight: "min(70vh, 560px)", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, fontWeight: 600 }}>
              <thead style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 1 }}>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: 10 }}>コード</th>
                  <th style={{ padding: 10 }}>勘定科目</th>
                  <th style={{ padding: 10 }}>区分</th>
                  <th style={{ padding: 10, minWidth: 140 }}>残高（円）</th>
                </tr>
              </thead>
              <tbody>
                {openingTableAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 14, color: "#64748b", fontWeight: 700 }}>
                      検索条件に一致する勘定がありません。
                    </td>
                  </tr>
                ) : (
                  openingTableAccounts.map((a) => (
                    <tr key={String(a.id)} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 10px" }}>{String(a.code ?? "—")}</td>
                      <td style={{ padding: "8px 10px" }}>{String(a.name ?? "")}</td>
                      <td style={{ padding: "8px 10px" }}>{accountDivisionDisplayName(a as Record<string, unknown>, accountDivisions)}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <input
                          style={{ ...inp, width: "100%", maxWidth: 160 }}
                          name={`ob_${String(a.id)}`}
                          inputMode="decimal"
                          defaultValue={String(openingBalances[String(a.id)] ?? 0)}
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="submit" style={btn} disabled={pending || !fiscalPeriodStart} title={!fiscalPeriodStart ? "会計期間開始日を自社設定で登録すると保存できます" : undefined}>
              期首残高を保存
            </button>
            <Link href="/admin/company" style={{ ...btnGhost, textDecoration: "none", display: "inline-block" }}>
              会計期間を変更
            </Link>
          </div>
        </form>
      </section>

      <section ref={customersRef} id="masters-customers" style={{ ...card, display: tab === "customers" ? "block" : "none" }}>
          <h3 className="mt-0 text-xl font-extrabold tracking-[0.06em]">顧客</h3>
          <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "#475569", lineHeight: 1.5 }}>
            CSV列: 顧客コード, 顧客名, バーコード用コード, 郵便番号, 住所, 電話, 締日,{" "}
            <strong>支払いサイト（文言）</strong>
            （例: 末締め翌末払い）。1行目はヘッダ。
          </p>
          <CsvForm title="CSV取込" pending={pending} onAction={(fd) => run(() => importCustomersCsv(fd))} />
          <form action={(fd) => run(() => createCustomer(fd))} style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <input style={inp} name="code" placeholder="顧客コード" />
            <input style={inp} name="name" placeholder="顧客名" required />
            <input style={inp} name="barcodeCode" placeholder="バーコード用コード" />
            <input style={inp} name="postalCode" placeholder="郵便番号" />
            <input style={inp} name="address" placeholder="住所" />
            <input style={inp} name="phone" placeholder="電話番号" />
            <input style={inp} name="closingDay" placeholder="締日（例: 末日・20日）" />
            <input style={inp} name="paymentSiteTerms" placeholder="支払いサイト（例: 末締め翌末払い）" />
            <input style={inp} name="email" placeholder="メール" />
            <textarea style={{ ...inp, minHeight: 64 }} name="notes" placeholder="備考" />
            <button type="submit" style={btn} disabled={pending}>
              追加
            </button>
          </form>
          <MasterTable
            rows={customers}
            pending={pending}
            columns={[
              { key: "code", label: "コード", width: 110 },
              { key: "name", label: "名称", width: 160, ellipsis: true },
              { key: "phone", label: "電話", width: 130 },
              { key: "closingDay", label: "締日", width: 70, render: (r) => String(r.closingDay ?? "—") },
              {
                key: "paymentSiteTerms",
                label: "支払サイト",
                width: 200,
                ellipsis: true,
                render: (r) => {
                  const t = r.paymentSiteTerms != null && String(r.paymentSiteTerms).trim() !== "" ? String(r.paymentSiteTerms) : null;
                  if (t) return t;
                  const d = r.paymentSiteDays;
                  return d != null ? `${d}日` : "—";
                },
              },
              { key: "postalCode", label: "郵便", width: 100 },
              { key: "address", label: "住所", ellipsis: true },
            ]}
            renderDetail={(r) => (
              <dl style={{ display: "grid", gap: 6, margin: 0 }}>
                <DetailItem k="ID" v={String(r.id)} />
                <DetailItem k="顧客コード" v={r.code} />
                <DetailItem k="顧客名" v={r.name} />
                <DetailItem k="バーコード用コード" v={r.barcodeCode} />
                <DetailItem k="郵便番号" v={r.postalCode} />
                <DetailItem k="住所" v={r.address} />
                <DetailItem k="電話番号" v={r.phone} />
                <DetailItem k="締日" v={r.closingDay} />
                <DetailItem
                  k="支払いサイト"
                  v={
                    r.paymentSiteTerms != null && String(r.paymentSiteTerms).trim() !== ""
                      ? r.paymentSiteTerms
                      : r.paymentSiteDays != null
                        ? `${r.paymentSiteDays}日（旧・日数）`
                        : null
                  }
                />
                <DetailItem k="メール" v={r.email} />
                <DetailItem k="備考" v={r.notes} />
              </dl>
            )}
            renderEdit={(r, close) => (
              <form
                action={(fd) =>
                  run(async () => {
                    fd.set("id", String(r.id));
                    await updateCustomer(fd);
                    close();
                  })
                }
                style={{ display: "grid", gap: 10 }}
              >
                <input type="hidden" name="id" value={String(r.id)} />
                <label style={{ display: "grid", gap: 4 }}>
                  顧客コード
                  <input style={inp} name="code" defaultValue={String(r.code ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  顧客名
                  <input style={inp} name="name" required defaultValue={String(r.name ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  バーコード用コード
                  <input style={inp} name="barcodeCode" defaultValue={String(r.barcodeCode ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  郵便番号
                  <input style={inp} name="postalCode" defaultValue={String(r.postalCode ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  住所
                  <input style={inp} name="address" defaultValue={String(r.address ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  電話番号
                  <input style={inp} name="phone" defaultValue={String(r.phone ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  締日
                  <input style={inp} name="closingDay" defaultValue={r.closingDay != null ? String(r.closingDay) : ""} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  支払いサイト（文言）
                  <input
                    style={inp}
                    name="paymentSiteTerms"
                    placeholder="例: 末締め翌末払い"
                    defaultValue={
                      r.paymentSiteTerms != null && String(r.paymentSiteTerms).trim() !== ""
                        ? String(r.paymentSiteTerms)
                        : r.paymentSiteDays != null
                          ? `${r.paymentSiteDays}日`
                          : ""
                    }
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  メール
                  <input style={inp} name="email" defaultValue={String(r.email ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  備考
                  <textarea style={{ ...inp, minHeight: 64 }} name="notes" defaultValue={String(r.notes ?? "")} />
                </label>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" style={btnGhost} onClick={close}>
                    キャンセル
                  </button>
                  <button type="submit" style={btn} disabled={pending}>
                    保存
                  </button>
                </div>
              </form>
            )}
            deleteAction={(r) => run(() => deleteCustomer(mkfd("id", String(r.id))))}
            deleteConfirmText="この顧客を削除しますか？（取引がある場合は削除できません）"
            bulkDeleteByIds={(ids) => bulkDeleteSequential(ids, (id) => deleteCustomer(mkfd("id", id)))}
            bulkDeleteConfirmText="選択した顧客を順に削除します。取引が紐づいている行は削除できず失敗として報告されます。"
            reportBulkOutcome={reportBulkOutcome}
            listSearch={{
              placeholder: "顧客コード・顧客名・住所・電話など",
              haystack: (r) =>
                [
                  r.code,
                  r.name,
                  r.barcodeCode,
                  r.postalCode,
                  r.address,
                  r.phone,
                  r.closingDay,
                  r.paymentSiteTerms,
                  r.paymentSiteDays != null ? `${r.paymentSiteDays}日` : "",
                  r.email,
                  r.notes,
                ]
                  .filter((x) => x != null && String(x).trim() !== "")
                  .join(" "),
            }}
          />
      </section>

      <section ref={vendorsRef} id="masters-vendors" style={{ ...card, display: tab === "vendors" ? "block" : "none" }}>
          <h3 className="mt-0 text-xl font-extrabold tracking-[0.06em]">仕入先</h3>
          <CsvForm title="CSV取込" pending={pending} onAction={(fd) => run(() => importVendorsCsv(fd))} />
          <form action={(fd) => run(() => createVendor(fd))} style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <input style={inp} name="code" placeholder="仕入先コード" />
            <input style={inp} name="name" placeholder="仕入先名" required />
            <input style={inp} name="barcodeCode" placeholder="バーコード用コード" />
            <input style={inp} name="bankName" placeholder="振込銀行名" />
            <input style={inp} name="branchName" placeholder="支店名" />
            <input style={inp} name="accountType" placeholder="口座区分" />
            <input style={inp} name="accountNumber" placeholder="口座番号" />
            <input style={inp} name="postalCode" placeholder="郵便番号" />
            <input style={inp} name="address" placeholder="住所" />
            <input style={inp} name="phone" placeholder="電話番号" />
            <input style={inp} name="email" placeholder="メール" />
            <textarea style={{ ...inp, minHeight: 64 }} name="notes" placeholder="備考" />
            <button type="submit" style={btn} disabled={pending}>
              追加
            </button>
          </form>
          <MasterTable
            rows={vendors}
            pending={pending}
            columns={[
              { key: "code", label: "コード", width: 110 },
              { key: "name", label: "名称", width: 160, ellipsis: true },
              { key: "bankName", label: "銀行", width: 120, ellipsis: true },
              { key: "branchName", label: "支店", width: 110 },
              { key: "accountType", label: "種別", width: 90 },
              { key: "accountNumber", label: "口座", width: 130 },
              { key: "phone", label: "電話", width: 130 },
            ]}
            renderDetail={(r) => (
              <dl style={{ display: "grid", gap: 6, margin: 0 }}>
                <DetailItem k="ID" v={String(r.id)} />
                <DetailItem k="仕入先コード" v={r.code} />
                <DetailItem k="仕入先名" v={r.name} />
                <DetailItem k="バーコード用コード" v={r.barcodeCode} />
                <DetailItem k="振込銀行名" v={r.bankName} />
                <DetailItem k="支店名" v={r.branchName} />
                <DetailItem k="口座区分" v={r.accountType} />
                <DetailItem k="口座番号" v={r.accountNumber} />
                <DetailItem k="郵便番号" v={r.postalCode} />
                <DetailItem k="住所" v={r.address} />
                <DetailItem k="電話番号" v={r.phone} />
                <DetailItem k="メール" v={r.email} />
                <DetailItem k="備考" v={r.notes} />
              </dl>
            )}
            renderEdit={(r, close) => (
              <form
                action={(fd) =>
                  run(async () => {
                    fd.set("id", String(r.id));
                    await updateVendor(fd);
                    close();
                  })
                }
                style={{ display: "grid", gap: 10 }}
              >
                <input type="hidden" name="id" value={String(r.id)} />
                <label style={{ display: "grid", gap: 4 }}>
                  仕入先コード
                  <input style={inp} name="code" defaultValue={String(r.code ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  仕入先名
                  <input style={inp} name="name" required defaultValue={String(r.name ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  バーコード用コード
                  <input style={inp} name="barcodeCode" defaultValue={String(r.barcodeCode ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  振込銀行名
                  <input style={inp} name="bankName" defaultValue={String(r.bankName ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  支店名
                  <input style={inp} name="branchName" defaultValue={String(r.branchName ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  口座区分
                  <input style={inp} name="accountType" defaultValue={String(r.accountType ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  口座番号
                  <input style={inp} name="accountNumber" defaultValue={String(r.accountNumber ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  郵便番号
                  <input style={inp} name="postalCode" defaultValue={String(r.postalCode ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  住所
                  <input style={inp} name="address" defaultValue={String(r.address ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  電話番号
                  <input style={inp} name="phone" defaultValue={String(r.phone ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  メール
                  <input style={inp} name="email" defaultValue={String(r.email ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  備考
                  <textarea style={{ ...inp, minHeight: 64 }} name="notes" defaultValue={String(r.notes ?? "")} />
                </label>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" style={btnGhost} onClick={close}>
                    キャンセル
                  </button>
                  <button type="submit" style={btn} disabled={pending}>
                    保存
                  </button>
                </div>
              </form>
            )}
            deleteAction={(r) => run(() => deleteVendor(mkfd("id", String(r.id))))}
            deleteConfirmText="この仕入先を削除しますか？（取引がある場合は削除できません）"
            bulkDeleteByIds={(ids) => bulkDeleteSequential(ids, (id) => deleteVendor(mkfd("id", id)))}
            bulkDeleteConfirmText="選択した仕入先を順に削除します。取引が紐づいている行は削除できず失敗として報告されます。"
            reportBulkOutcome={reportBulkOutcome}
            listSearch={{
              placeholder: "仕入先コード・名称・銀行・口座など",
              haystack: (r) =>
                [r.code, r.name, r.barcodeCode, r.bankName, r.branchName, r.accountType, r.accountNumber, r.postalCode, r.address, r.phone, r.email, r.notes]
                  .filter((x) => x != null && String(x).trim() !== "")
                  .join(" "),
            }}
          />
      </section>

      <section ref={payeesRef} id="masters-payees" style={{ ...card, display: tab === "payees" ? "block" : "none" }}>
          <h3 className="mt-0 text-xl font-extrabold tracking-[0.06em]">支払先</h3>
          <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "#475569" }}>
            CSV列順: 支払先コード, 支払先, 区分（1行目はヘッダ行としてスキップされます）
          </p>
          <CsvForm title="CSV取込" pending={pending} onAction={(fd) => run(() => importPayeesCsv(fd))} />
          <form action={(fd) => run(() => createPayee(fd))} style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <input style={inp} name="code" placeholder="支払先コード" />
            <input style={inp} name="name" placeholder="支払先" required />
            <input style={inp} name="category" placeholder="区分（例: 給与・役員報酬・仕入・その他）" />
            <button type="submit" style={btn} disabled={pending}>
              追加
            </button>
          </form>
          <MasterTable
            rows={payees}
            pending={pending}
            columns={[
              { key: "code", label: "支払先コード", width: 120 },
              { key: "name", label: "支払先", width: 180, ellipsis: true },
              { key: "category", label: "区分", width: 160, ellipsis: true },
            ]}
            renderDetail={(r) => (
              <dl style={{ display: "grid", gap: 6, margin: 0 }}>
                <DetailItem k="ID" v={String(r.id)} />
                <DetailItem k="支払先コード" v={r.code} />
                <DetailItem k="支払先" v={r.name} />
                <DetailItem k="区分" v={r.category} />
              </dl>
            )}
            renderEdit={(r, close) => (
              <form
                action={(fd) =>
                  run(async () => {
                    fd.set("id", String(r.id));
                    await updatePayee(fd);
                    close();
                  })
                }
                style={{ display: "grid", gap: 10 }}
              >
                <input type="hidden" name="id" value={String(r.id)} />
                <label style={{ display: "grid", gap: 4 }}>
                  支払先コード
                  <input style={inp} name="code" defaultValue={String(r.code ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  支払先
                  <input style={inp} name="name" required defaultValue={String(r.name ?? "")} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  区分
                  <input style={inp} name="category" defaultValue={String(r.category ?? "")} />
                </label>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" style={btnGhost} onClick={close}>
                    キャンセル
                  </button>
                  <button type="submit" style={btn} disabled={pending}>
                    保存
                  </button>
                </div>
              </form>
            )}
            deleteAction={(r) => run(() => deletePayee(mkfd("id", String(r.id))))}
            deleteConfirmText="この支払先を削除しますか？（入出金に紐づく場合は削除できません）"
            bulkDeleteByIds={(ids) => bulkDeleteSequential(ids, (id) => deletePayee(mkfd("id", id)))}
            bulkDeleteConfirmText="選択した支払先を順に削除します。入出金に紐づいている行は削除できず失敗として報告されます。"
            reportBulkOutcome={reportBulkOutcome}
            listSearch={{
              placeholder: "支払先コード・名称・区分など",
              haystack: (r) => [r.code, r.name, r.category].filter((x) => x != null && String(x).trim() !== "").join(" "),
            }}
          />
      </section>

      <section ref={otherRef} id="masters-other" style={{ ...card, display: tab === "other" ? "block" : "none" }}>
        <h3 className="mt-0 text-xl font-extrabold tracking-[0.06em]">その他</h3>
        <p style={{ margin: "8px 0 0", fontSize: 15, fontWeight: 600, color: "#475569", lineHeight: 1.65 }}>
          外部連携・プロジェクト・社内独自項目などの拡張用エリアです。現バージョンでは関連画面へのリンクをまとめています。
        </p>
        <ul style={{ margin: "12px 0 0", paddingLeft: 22, fontSize: 15, fontWeight: 600, color: "#334155", lineHeight: 1.9 }}>
          <li>
            <Link href="/admin/company" style={{ color: "#0369a1", fontWeight: 800 }}>
              自社設定・会計期間
            </Link>
          </li>
          <li>
            <Link href="/dashboard" style={{ color: "#0369a1", fontWeight: 800 }}>
              ダッシュボード
            </Link>
          </li>
          <li>
            <Link href="/admin/bank-transactions" style={{ color: "#0369a1", fontWeight: 800 }}>
              入出金管理
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}

function GuidePanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ border: "1px solid #c6d3e1", borderRadius: 10, background: "#ffffff", overflow: "hidden" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #dbe5ee", fontSize: 14, fontWeight: 800, color: "#25617e", letterSpacing: "0.08em" }}>
        {title}
      </div>
      <div style={{ display: "grid" }}>
        {items.map((item) => (
          <div key={item} style={{ padding: "10px 12px", borderTop: "1px solid #edf2f7", fontSize: 14, fontWeight: 700, color: "#334155" }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function mkfd(name: string, value: string) {
  const fd = new FormData();
  fd.set(name, value);
  return fd;
}

function DetailItem({ k, v }: { k: string; v: unknown }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, fontSize: 16, fontWeight: 600, letterSpacing: "0.04em" }}>
      <dt style={{ color: "#64748b", margin: 0 }}>{k}</dt>
      <dd style={{ margin: 0 }}>{v == null || v === "" ? "—" : String(v)}</dd>
    </div>
  );
}

function CsvForm({ title, pending, onAction }: { title: string; pending: boolean; onAction: (fd: FormData) => void }) {
  return (
    <form action={onAction} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <strong>{title}</strong>
      <input type="file" name="file" accept=".csv" required />
      <button type="submit" style={btn} disabled={pending}>
        取込
      </button>
    </form>
  );
}

function MasterTable({
  rows,
  pending,
  columns,
  renderDetail,
  renderEdit,
  deleteAction,
  deleteConfirmText,
  deleteMergeOptions,
  bulkDeleteByIds,
  bulkDeleteConfirmText,
  reportBulkOutcome,
  listSearch,
}: {
  rows: Record<string, unknown>[];
  pending: boolean;
  columns: { key: string; label: string; width?: number; ellipsis?: boolean; render?: (r: Record<string, unknown>) => string }[];
  renderDetail: (r: Record<string, unknown>) => React.ReactNode;
  renderEdit: (r: Record<string, unknown>, close: () => void) => React.ReactNode;
  deleteAction: (r: Record<string, unknown>, mergeInto?: string) => void;
  deleteConfirmText: string;
  /** 同一コード／同一名称の重複勘定を統合削除するときの候補（この行以外） */
  deleteMergeOptions?: (r: Record<string, unknown>) => { id: string; label: string }[];
  /** 指定時、行チェックと一括削除 UI を表示する */
  bulkDeleteByIds?: (ids: string[]) => Promise<{ failed: BulkDeleteFailure[] }>;
  bulkDeleteConfirmText?: string;
  reportBulkOutcome?: (failed: BulkDeleteFailure[], attempted: number) => void;
  /** この表専用のキーワード検索（他画面と共有しない） */
  listSearch?: { placeholder: string; haystack: (r: Record<string, unknown>) => string };
}) {
  const router = useRouter();
  const detailRef = useRef<HTMLDialogElement>(null);
  const editRef = useRef<HTMLDialogElement>(null);
  const delRef = useRef<HTMLDialogElement>(null);
  const bulkDelRef = useRef<HTMLDialogElement>(null);
  const headerSelectRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<Record<string, unknown> | null>(null);
  const [mergeInto, setMergeInto] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkPending, startBulkTransition] = useTransition();
  const [listQuery, setListQuery] = useState("");

  const displayRows = useMemo(() => {
    if (!listSearch) return rows;
    const q = listQuery.trim();
    if (!q) return rows;
    return rows.filter((r) => matchesListSearch(listSearch.haystack(r), q));
  }, [rows, listQuery, listSearch]);

  const rowIdsKey = displayRows.map((r) => String(r.id)).join("\u0001");
  useEffect(() => {
    setSelectedIds(new Set());
  }, [rowIdsKey, listQuery]);

  const allRowIds = displayRows.map((r) => String(r.id));
  const allSelected = allRowIds.length > 0 && allRowIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  useEffect(() => {
    if (headerSelectRef.current) headerSelectRef.current.indeterminate = someSelected;
  }, [someSelected]);

  useEffect(() => {
    const onClose = () => setActive(null);
    detailRef.current?.addEventListener("close", onClose);
    editRef.current?.addEventListener("close", onClose);
    delRef.current?.addEventListener("close", onClose);
    return () => {
      detailRef.current?.removeEventListener("close", onClose);
      editRef.current?.removeEventListener("close", onClose);
      delRef.current?.removeEventListener("close", onClose);
    };
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const openDetail = (r: Record<string, unknown>) => {
    setActive(r);
    detailRef.current?.showModal();
  };
  const openEdit = (r: Record<string, unknown>) => {
    setActive(r);
    editRef.current?.showModal();
  };
  const openDel = (r: Record<string, unknown>) => {
    setActive(r);
    setMergeInto("");
    delRef.current?.showModal();
  };
  const closeAll = () => {
    detailRef.current?.close();
    editRef.current?.close();
    delRef.current?.close();
    setActive(null);
  };

  const busy = pending || bulkPending;

  return (
    <>
      {listSearch ? (
        <label style={{ display: "grid", gap: 6, marginTop: 12, maxWidth: 440, fontSize: 14, fontWeight: 700, color: "#475569" }}>
          この一覧を検索
          <input
            type="search"
            style={inp}
            placeholder={listSearch.placeholder}
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      ) : null}
      {bulkDeleteByIds ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <button type="button" style={btnGhost} disabled={busy || displayRows.length === 0} onClick={() => setSelectedIds(new Set(allRowIds))}>
            すべて選択
          </button>
          <button type="button" style={btnGhost} disabled={busy || selectedIds.size === 0} onClick={() => setSelectedIds(new Set())}>
            選択解除
          </button>
          <button
            type="button"
            style={btnDanger}
            disabled={busy || selectedIds.size === 0}
            onClick={() => bulkDelRef.current?.showModal()}
          >
            選択した {selectedIds.size} 件を一括削除
          </button>
        </div>
      ) : null}
      <div style={{ overflowX: "auto", marginTop: bulkDeleteByIds ? 8 : 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 16, fontWeight: 600, letterSpacing: "0.04em" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
              {bulkDeleteByIds ? (
                <th style={{ padding: "10px 6px", width: 44, verticalAlign: "middle" }}>
                  <input
                    ref={headerSelectRef}
                    type="checkbox"
                    checked={allSelected}
                    disabled={busy || displayRows.length === 0}
                    onChange={() => {
                      if (allSelected) setSelectedIds(new Set());
                      else setSelectedIds(new Set(allRowIds));
                    }}
                    aria-label="一覧をすべて選択"
                  />
                </th>
              ) : null}
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ padding: "10px 8px", color: "#64748b", fontWeight: 800, letterSpacing: "0.06em", fontSize: 15, width: c.width }}
                >
                  {c.label}
                </th>
              ))}
              <th style={{ padding: "10px 8px", width: 220 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (bulkDeleteByIds ? 1 : 0) + 1}
                  style={{ padding: 16, color: "#64748b", fontWeight: 700 }}
                >
                  {rows.length === 0 ? "データがありません。" : "検索条件に一致する行がありません。"}
                </td>
              </tr>
            ) : (
              displayRows.map((r) => {
              const rid = String(r.id);
              return (
                <tr key={rid} style={{ borderTop: "1px solid #f1f5f9" }}>
                  {bulkDeleteByIds ? (
                    <td style={{ padding: "10px 6px", verticalAlign: "middle" }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(rid)}
                        disabled={busy}
                        onChange={() => toggleSelect(rid)}
                        aria-label={`行 ${rid} を選択`}
                      />
                    </td>
                  ) : null}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{
                        padding: "10px 8px",
                        maxWidth: c.width ? `${c.width}px` : undefined,
                        whiteSpace: c.ellipsis ? "nowrap" : undefined,
                        overflow: c.ellipsis ? "hidden" : undefined,
                        textOverflow: c.ellipsis ? "ellipsis" : undefined,
                      }}
                    >
                      {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                    </td>
                  ))}
                  <td style={{ padding: "10px 8px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" style={btnGhost} onClick={() => openDetail(r)}>
                      詳細
                    </button>
                    <button type="button" style={btnGhost} onClick={() => openEdit(r)}>
                      編集
                    </button>
                    <button type="button" style={btnDanger} onClick={() => openDel(r)}>
                      削除
                    </button>
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>

      <dialog ref={detailRef} style={{ border: "none", borderRadius: 12, padding: 0, maxWidth: 520, width: "92vw" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", fontWeight: 800, letterSpacing: "0.08em", fontSize: 18 }}>詳細</div>
        <div style={{ padding: 16 }}>{active ? <div key={`d-${String(active.id)}`}>{renderDetail(active)}</div> : null}</div>
        <div style={{ padding: 12, display: "flex", justifyContent: "flex-end", borderTop: "1px solid #e2e8f0" }}>
          <button type="button" style={btnGhost} onClick={() => detailRef.current?.close()}>
            閉じる
          </button>
        </div>
      </dialog>

      <dialog ref={editRef} style={{ border: "none", borderRadius: 12, padding: 0, maxWidth: 520, width: "92vw" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", fontWeight: 800, letterSpacing: "0.08em", fontSize: 18 }}>編集</div>
        <div style={{ padding: 16 }}>{active ? <div key={`e-${String(active.id)}`}>{renderEdit(active, closeAll)}</div> : null}</div>
      </dialog>

      <dialog ref={delRef} style={{ border: "none", borderRadius: 12, padding: 0, maxWidth: 480, width: "92vw" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", fontWeight: 800, letterSpacing: "0.08em", fontSize: 18 }}>削除の確認</div>
        <div style={{ padding: 16, lineHeight: 1.6 }}>{deleteConfirmText}</div>
        {active && deleteMergeOptions && deleteMergeOptions(active).length > 0 ? (
          <div style={{ padding: "0 16px 12px", borderBottom: "1px solid #f1f5f9" }}>
            <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#475569" }}>
              重複している可能性があります。仕訳・期首残高を残したまま、別の勘定へまとめてから削除できます。
            </p>
            <label style={{ display: "grid", gap: 6, fontSize: 14, fontWeight: 700 }}>
              統合先（この勘定へ付け替えてから削除）
              <select style={inp} value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
                <option value="">選ばない（下の通常削除）</option>
                {deleteMergeOptions(active).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <div style={{ padding: 12, display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #e2e8f0" }}>
          <button type="button" style={btnGhost} onClick={() => delRef.current?.close()}>
            キャンセル
          </button>
          <button
            type="button"
            style={{ ...btnDanger, fontWeight: 600 }}
            disabled={pending || !active}
            onClick={() => {
              if (active) deleteAction(active, mergeInto.trim() || undefined);
              delRef.current?.close();
            }}
          >
            {mergeInto.trim() ? "統合して削除" : "削除する"}
          </button>
        </div>
      </dialog>

      {bulkDeleteByIds ? (
        <dialog ref={bulkDelRef} style={{ border: "none", borderRadius: 12, padding: 0, maxWidth: 480, width: "92vw" }}>
          <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", fontWeight: 800, letterSpacing: "0.08em", fontSize: 18 }}>一括削除の確認</div>
          <div style={{ padding: 16, lineHeight: 1.65, fontSize: 15, fontWeight: 600, color: "#334155" }}>
            {bulkDeleteConfirmText ??
              `選択した ${selectedIds.size} 件を順に削除します。取引などの都合で削除できない行はスキップされ、最後に結果が表示されます。`}
          </div>
          <div style={{ padding: 12, display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #e2e8f0" }}>
            <button type="button" style={btnGhost} onClick={() => bulkDelRef.current?.close()}>
              キャンセル
            </button>
            <button
              type="button"
              style={{ ...btnDanger, fontWeight: 600 }}
              disabled={busy || selectedIds.size === 0}
              onClick={() => {
                const ids = [...selectedIds];
                bulkDelRef.current?.close();
                startBulkTransition(() => {
                  void (async () => {
                    const { failed } = await bulkDeleteByIds(ids);
                    reportBulkOutcome?.(failed, ids.length);
                    setSelectedIds(new Set());
                    router.refresh();
                  })();
                });
              }}
            >
              一括削除する
            </button>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
