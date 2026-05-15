import type { AccountCategory } from "@/db/schema";

/** 画面上の「区分」表示（貸借対照表・損益計算書の章立てに近い表記） */
export const ACCOUNT_CATEGORY_LABEL_JA: Record<AccountCategory, string> = {
  asset: "資産の部",
  liability: "負債の部",
  equity: "純資産の部",
  revenue: "収益",
  expense: "費用",
};

/** フォーム用。value は DB の category 列と一致 */
export const ACCOUNT_CATEGORY_SELECT_OPTIONS: { value: AccountCategory; label: string }[] = (
  ["asset", "liability", "equity", "revenue", "expense"] as const
).map((value) => ({ value, label: ACCOUNT_CATEGORY_LABEL_JA[value] }));

function norm(s: string) {
  return s.trim().replace(/\s+/g, "");
}

/** 区分コード列（CSV 1列目など）。半角・全角数字を正規化 */
function normCode(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

/**
 * サンプル勘定科目表・業務ソフトの「区分」「勘定科目属性」に近い表記から
 * 内部区分（5分類）へ寄せる。CSV 取込で使用。
 */
export function mapAccountCategoryFromImport(codeRaw: string, labelRaw: string): AccountCategory {
  const code = normCode(codeRaw);
  const label = norm(labelRaw);

  if (["1", "10", "101", "asset", "a"].includes(code)) return "asset";
  if (["2", "20", "201", "liability", "l"].includes(code)) return "liability";
  if (["3", "30", "301", "equity", "e", "capital"].includes(code)) return "equity";
  if (["4", "40", "401", "revenue", "r"].includes(code)) return "revenue";
  if (["5", "50", "501", "expense", "x"].includes(code)) return "expense";

  const assetLabels = new Set([
    "資産",
    "資産の部",
    "流動資産",
    "固定資産",
    "繰延資産",
    "現金預金",
    "当座資産",
    "売掛債権",
    "棚卸資産",
    "その他流動資産",
    "その他の流動資産",
    "他流動資産",
    "有形固定資産",
    "その他の有形固定資産",
    "他有形固定資産",
    "無形固定資産",
    "その他の無形固定資産",
    "他無形固定資産",
    "投資その他の資産",
    "繰延税金資産",
    "繰延資産",
    "その他の繰延資産",
    "他繰延資産",
  ]);
  const liabilityLabels = new Set([
    "負債",
    "負債の部",
    "流動負債",
    "固定負債",
    "その他流動負債",
    "その他の流動負債",
    "他流動負債",
    "その他固定負債",
    "その他の固定負債",
    "他固定負債",
    "繰延税金負債",
  ]);
  const equityLabels = new Set(["純資産", "純資産の部", "資本", "資本の部", "株主資本"]);
  const revenueLabels = new Set([
    "収益",
    "売上高",
    "営業外収益",
    "その他の営業外収益",
    "他営業外収益",
    "特別利益",
    "収益の部",
  ]);
  const expenseLabels = new Set([
    "費用",
    "売上原価",
    "商品売上原価",
    "製造原価",
    "販売費及び一般管理費",
    "販管費",
    "販売費",
    "一般管理費",
    "営業外費用",
    "その他の営業外費用",
    "他営業外費用",
    "特別損失",
    "法人税等",
    "法人税、住民税及び事業税",
    "費用の部",
  ]);

  if (assetLabels.has(label)) return "asset";
  if (liabilityLabels.has(label)) return "liability";
  if (equityLabels.has(label)) return "equity";
  if (revenueLabels.has(label)) return "revenue";
  if (expenseLabels.has(label)) return "expense";

  return "asset";
}
