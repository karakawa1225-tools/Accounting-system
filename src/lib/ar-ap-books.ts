import type { getSystemAccounts } from "@/lib/system-accounts";

/** 売掛管理の区分（施工部＝従来の SYS_AR / SYS_SALES） */
export const AR_BOOKS = ["seko", "kiko"] as const;
export type ArBook = (typeof AR_BOOKS)[number];

/** 買掛管理の区分（買掛金＝従来の SYS_AP / SYS_PURCHASES） */
export const AP_BOOKS = ["kaikake", "gaichu"] as const;
export type ApBook = (typeof AP_BOOKS)[number];

export const AR_BOOK_LABELS: Record<ArBook, string> = {
  seko: "施工部",
  kiko: "機工部",
};

export const AP_BOOK_LABELS: Record<ApBook, string> = {
  kaikake: "買掛金",
  gaichu: "外注費",
};

/** 買掛履歴・月次 PDF の ap_purchase 区分表示名 */
export function apPurchaseKindLabel(book: ApBook): string {
  return book === "gaichu" ? "外注費" : "仕入";
}

/** 月次 PDF フッタの登録合計ラベル */
export function apPurchaseTotalLabel(book: ApBook): string {
  return book === "gaichu" ? "外注費合計" : "仕入合計";
}

/** 売掛管理画面のクエリ名（部署） */
export const AR_DEPT_QUERY = "dept";

export function parseArBook(raw: string | null | undefined): ArBook {
  return raw === "kiko" ? "kiko" : "seko";
}

export function parseApBook(raw: string | null | undefined): ApBook {
  return raw === "gaichu" ? "gaichu" : "kaikake";
}

export function arAdminPath(book: ArBook) {
  return `/admin/receivables?${AR_DEPT_QUERY}=${book}`;
}

export function apAdminPath(book: ApBook) {
  return `/admin/payables/${book}`;
}

export function arRevalidatePaths(book: ArBook): string[] {
  return [arAdminPath(book), "/admin/receivables", "/admin/bank-transactions", "/dashboard"];
}

export function apRevalidatePaths(book: ApBook): string[] {
  return [
    apAdminPath(book),
    "/admin/payables",
    "/admin/bank-transactions",
    "/dashboard",
    "/admin/exports/payables-monthly",
    "/admin/exports/vendor-payments",
  ];
}

type SystemAccounts = Awaited<ReturnType<typeof getSystemAccounts>>;

export function resolveArAccounts(sys: SystemAccounts, book: ArBook) {
  if (book === "kiko") {
    return { arId: sys.arKikoId, salesId: sys.salesKikoId };
  }
  return { arId: sys.arId, salesId: sys.salesId };
}

/** 売掛勘定IDから部署を判定（施工部＝従来の SYS_AR） */
export function resolveArBookFromArAccountId(sys: SystemAccounts, accountId: string): ArBook | null {
  if (accountId === sys.arKikoId) return "kiko";
  if (accountId === sys.arId) return "seko";
  return null;
}

export function revalidateAllArPaths(books: ArBook[]) {
  const paths = new Set<string>();
  for (const b of books) {
    for (const p of arRevalidatePaths(b)) paths.add(p);
  }
  return [...paths];
}

export function resolveApAccounts(sys: SystemAccounts, book: ApBook) {
  if (book === "gaichu") {
    return { apId: sys.apOutsourceId, expenseId: sys.outsourceExpenseId };
  }
  return { apId: sys.apId, expenseId: sys.purchasesId };
}
