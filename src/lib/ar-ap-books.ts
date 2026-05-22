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

export function parseArBook(raw: string | null | undefined): ArBook {
  return raw === "kiko" ? "kiko" : "seko";
}

export function parseApBook(raw: string | null | undefined): ApBook {
  return raw === "gaichu" ? "gaichu" : "kaikake";
}

export function arAdminPath(book: ArBook) {
  return `/admin/receivables/${book}`;
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

export function resolveApAccounts(sys: SystemAccounts, book: ApBook) {
  if (book === "gaichu") {
    return { apId: sys.apOutsourceId, expenseId: sys.outsourceExpenseId };
  }
  return { apId: sys.apId, expenseId: sys.purchasesId };
}
