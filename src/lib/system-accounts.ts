import { eq, inArray } from "drizzle-orm";
import type { Database } from "@/db";
import { resolveYDivisionForCategory } from "@/lib/account-division-resolve";
import { accounts, type AccountCategory } from "@/db/schema";

/** DB に未投入の環境向け。ensure スクリプトと同じ内容をコード側でも補完する。 */
const SYSTEM_ACCOUNT_ROWS: { code: string; name: string; category: AccountCategory }[] = [
  { code: "SYS_AR", name: "売掛金（施工部）", category: "asset" },
  { code: "SYS_SALES", name: "売上高（施工部）", category: "revenue" },
  { code: "SYS_AR_KIKO", name: "売掛金（機工部）", category: "asset" },
  { code: "SYS_SALES_KIKO", name: "売上高（機工部）", category: "revenue" },
  { code: "SYS_BANK", name: "普通預金", category: "asset" },
  { code: "SYS_AP", name: "買掛金", category: "liability" },
  { code: "SYS_PURCHASES", name: "仕入高", category: "expense" },
  { code: "SYS_AP_GAICHU", name: "未払外注費", category: "liability" },
  { code: "SYS_GAICHU", name: "外注費", category: "expense" },
  { code: "SYS_OPENING", name: "期首貸借調整", category: "equity" },
  { code: "SYS_BANK_FEE", name: "振込手数料", category: "expense" },
];

/** 未投入の標準勘定行だけ挿入する。削除後の復旧用（ミドルウェア／各画面では呼ばず、明示的な操作や seed のみ）。 */
export async function ensureSystemAccountRows(db: Database) {
  for (const row of SYSTEM_ACCOUNT_ROWS) {
    const [hit] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, row.code)).limit(1);
    if (hit) continue;
    const accountDivisionId = await resolveYDivisionForCategory(db, row.category);
    if (!accountDivisionId) {
      throw new Error(
        `標準勘定「${row.name}」を作成できません。先に勘定科目区分をCSV取込（区分コードはY始まり）してください。`
      );
    }
    await db.insert(accounts).values({
      code: row.code,
      name: row.name,
      category: row.category,
      accountDivisionId,
      isActive: true,
    });
  }
}

export const SYSTEM_ACCOUNT_CODES = {
  AR: "SYS_AR",
  SALES: "SYS_SALES",
  AR_KIKO: "SYS_AR_KIKO",
  SALES_KIKO: "SYS_SALES_KIKO",
  BANK: "SYS_BANK",
  AP: "SYS_AP",
  PURCHASES: "SYS_PURCHASES",
  AP_GAICHU: "SYS_AP_GAICHU",
  GAICHU: "SYS_GAICHU",
  /** 期首残高の貸借差額を吸収する純資産勘定（ユーザー入力の合計と複式で釣り合わせる） */
  OPENING: "SYS_OPENING",
  BANK_FEE: "SYS_BANK_FEE",
} as const;

export async function getSystemAccounts(db: Database) {
  const codes = Object.values(SYSTEM_ACCOUNT_CODES);
  let rows = await db.select().from(accounts).where(inArray(accounts.code, codes));
  let map = new Map(rows.map((r) => [r.code, r.id]));
  let missing = codes.filter((c) => !map.has(c));
  if (missing.length) {
    const { ensureAccountDivisionsSchemaAtRuntime } = await import("@/lib/account-divisions-bootstrap");
    await ensureAccountDivisionsSchemaAtRuntime(db);
    await ensureSystemAccountRows(db);
    rows = await db.select().from(accounts).where(inArray(accounts.code, codes));
    map = new Map(rows.map((r) => [r.code, r.id]));
    missing = codes.filter((c) => !map.has(c));
  }
  if (missing.length) {
    throw new Error(
      `標準勘定（${missing.join(", ")}）がありません。銀行・売掛・買掛・期首残高の自動仕訳などに必要です。復旧する場合はターミナルで \`node scripts/ensure-system-accounts.mjs\` を実行するか、同じコードの勘定科目を手動で作成してください。`
    );
  }
  return {
    arId: map.get(SYSTEM_ACCOUNT_CODES.AR)!,
    salesId: map.get(SYSTEM_ACCOUNT_CODES.SALES)!,
    arKikoId: map.get(SYSTEM_ACCOUNT_CODES.AR_KIKO)!,
    salesKikoId: map.get(SYSTEM_ACCOUNT_CODES.SALES_KIKO)!,
    bankId: map.get(SYSTEM_ACCOUNT_CODES.BANK)!,
    apId: map.get(SYSTEM_ACCOUNT_CODES.AP)!,
    purchasesId: map.get(SYSTEM_ACCOUNT_CODES.PURCHASES)!,
    apOutsourceId: map.get(SYSTEM_ACCOUNT_CODES.AP_GAICHU)!,
    outsourceExpenseId: map.get(SYSTEM_ACCOUNT_CODES.GAICHU)!,
    openingId: map.get(SYSTEM_ACCOUNT_CODES.OPENING)!,
    bankFeeId: map.get(SYSTEM_ACCOUNT_CODES.BANK_FEE)!,
  };
}
