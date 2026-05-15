import type { AccountCategory } from "@/db/schema";

/** マイグレーション seed と同一の既定勘定科目区分ID（サーバーだけでなく型参照も安全な薄いファイル） */
export const DEFAULT_DIVISION_IDS: Record<AccountCategory, string> = {
  asset: "d1000000-0000-4000-8000-000000000001",
  liability: "d1000000-0000-4000-8000-000000000002",
  equity: "d1000000-0000-4000-8000-000000000003",
  revenue: "d1000000-0000-4000-8000-000000000004",
  expense: "d1000000-0000-4000-8000-000000000005",
};

export const DEFAULT_DIVISION_SEED_ROWS: {
  id: string;
  code: string | null;
  name: string;
  statementCategory: AccountCategory;
  sortOrder: number;
}[] = [
  { id: DEFAULT_DIVISION_IDS.asset, code: "1", name: "資産の部", statementCategory: "asset", sortOrder: 10 },
  { id: DEFAULT_DIVISION_IDS.liability, code: "2", name: "負債の部", statementCategory: "liability", sortOrder: 20 },
  { id: DEFAULT_DIVISION_IDS.equity, code: "3", name: "純資産の部", statementCategory: "equity", sortOrder: 30 },
  { id: DEFAULT_DIVISION_IDS.revenue, code: "4", name: "収益", statementCategory: "revenue", sortOrder: 40 },
  { id: DEFAULT_DIVISION_IDS.expense, code: "5", name: "費用", statementCategory: "expense", sortOrder: 50 },
];
