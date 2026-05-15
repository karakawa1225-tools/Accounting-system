import { relations } from "drizzle-orm";
import { sqliteTable, text, integer, index, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";

export const companies = sqliteTable("companies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  postalCode: text("postal_code"),
  address: text("address"),
  phone: text("phone"),
  fax: text("fax"),
  representativeName: text("representative_name"),
  taxId: text("tax_id"),
  invoiceRegistrationNumber: text("invoice_registration_number"),
  bankName: text("bank_name"),
  bankBranchName: text("bank_branch_name"),
  bankAccountType: text("bank_account_type"),
  bankAccountNumber: text("bank_account_number"),
  bankAccountHolder: text("bank_account_holder"),
  /** 会計期間開始日（YYYY-MM-DD） */
  fiscalPeriodStart: text("fiscal_period_start"),
  /** 会計期間終了日（YYYY-MM-DD） */
  fiscalPeriodEnd: text("fiscal_period_end"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const accountCategoryEnum = ["asset", "liability", "equity", "revenue", "expense"] as const;
export type AccountCategory = (typeof accountCategoryEnum)[number];

/**
 * 勘定科目区分マスタ（表示・CSVはここで自由に追加）。
 * accounts.category は財務上の5区分（statement_category）を同期維持する。
 */
export const accountDivisions = sqliteTable(
  "account_divisions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    /** CSV・勘定側の区分コードと照合するときに使用（空可） */
    code: text("code"),
    name: text("name").notNull(),
    statementCategory: text("statement_category", { enum: accountCategoryEnum }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("account_divisions_code_unique").on(t.code), index("account_divisions_sort_idx").on(t.sortOrder)]
);

export const transactionKindEnum = [
  "ar_sale",
  "ar_payment",
  "ap_purchase",
  "ap_payment",
  "cash",
  "expense",
  "journal",
] as const;
export type TransactionKind = (typeof transactionKindEnum)[number];

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    code: text("code"),
    categoryCode: text("category_code"),
    name: text("name").notNull(),
    category: text("category", { enum: accountCategoryEnum }).notNull(),
    /** 勘定科目区分マスタ（画面上の区分の実体）。未設定時は category のみ参照。 */
    accountDivisionId: text("account_division_id").references(() => accountDivisions.id),
    barcodeCode: text("barcode_code"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("accounts_category_idx").on(t.category), index("accounts_division_idx").on(t.accountDivisionId)]
);

/** 自社の銀行口座（入出金で選択。各口座は勘定科目に紐づく） */
export const companyBankAccounts = sqliteTable(
  "company_bank_accounts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** 画面表示名（例: 本店普通） */
    label: text("label"),
    bankName: text("bank_name"),
    branchName: text("branch_name"),
    accountType: text("account_type"),
    accountNumber: text("account_number"),
    accountHolder: text("account_holder"),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    /** 前期末時点の帳簿残高（円・借方プラス）。今期期首の期首残高へ連携して入出金残高の基準にする */
    fiscalEndBalanceMinor: integer("fiscal_end_balance_minor").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("company_bank_accounts_company_idx").on(t.companyId), index("company_bank_accounts_account_idx").on(t.accountId)]
);

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code"),
  name: text("name").notNull(),
  barcodeCode: text("barcode_code"),
  postalCode: text("postal_code"),
  address: text("address"),
  phone: text("phone"),
  closingDay: integer("closing_day"),
  /** @deprecated 移行用。新規は paymentSiteTerms を使用 */
  paymentSiteDays: integer("payment_site_days"),
  /** 支払条件の表記（例: 末締め翌末払い） */
  paymentSiteTerms: text("payment_site_terms"),
  email: text("email"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const vendors = sqliteTable("vendors", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code"),
  name: text("name").notNull(),
  barcodeCode: text("barcode_code"),
  postalCode: text("postal_code"),
  address: text("address"),
  phone: text("phone"),
  bankName: text("bank_name"),
  branchName: text("branch_name"),
  accountType: text("account_type"),
  accountNumber: text("account_number"),
  email: text("email"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/** 入出金などの支払先マスタ（給与・役員報酬・仕入先以外の支払など） */
export const payees = sqliteTable("payees", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code"),
  name: text("name").notNull(),
  category: text("category"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/** 期首日の各勘定の残高（円・借方をプラスとする符号）。自社の会計期間開始日と複合キー。 */
export const openingBalanceLines = sqliteTable(
  "opening_balance_lines",
  {
    fiscalPeriodStart: text("fiscal_period_start").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    /** 借方基準（資産・費用は通常プラス、負債・純資産・収益はマイナスで貸方残） */
    balanceMinor: integer("balance_minor").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.fiscalPeriodStart, t.accountId] }),
    accIdx: index("opening_balance_account_idx").on(t.accountId),
  })
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    entryGroupId: text("entry_group_id"),
    transactionDate: text("transaction_date").notNull(),
    accountId: text("account_id").notNull().references(() => accounts.id),
    customerId: text("customer_id").references(() => customers.id),
    vendorId: text("vendor_id").references(() => vendors.id),
    payeeId: text("payee_id").references(() => payees.id),
    amountMinor: integer("amount_minor"),
    debitAmountMinor: integer("debit_amount_minor").notNull().default(0),
    creditAmountMinor: integer("credit_amount_minor").notNull().default(0),
    summary: text("summary"),
    kind: text("kind", { enum: transactionKindEnum }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index("transactions_date_idx").on(t.transactionDate),
    index("transactions_account_idx").on(t.accountId),
    index("transactions_entry_group_idx").on(t.entryGroupId),
    index("transactions_customer_idx").on(t.customerId),
    index("transactions_vendor_idx").on(t.vendorId),
    index("transactions_payee_idx").on(t.payeeId),
  ]
);

export const arAllocations = sqliteTable(
  "ar_allocations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    customerId: text("customer_id").notNull().references(() => customers.id),
    paymentArCreditTransactionId: text("payment_ar_credit_transaction_id").notNull().references(() => transactions.id),
    salesArDebitTransactionId: text("sales_ar_debit_transaction_id").notNull().references(() => transactions.id),
    amountMinor: integer("amount_minor").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("ar_alloc_customer_idx").on(t.customerId), index("ar_alloc_sales_idx").on(t.salesArDebitTransactionId)]
);

export const apAllocations = sqliteTable(
  "ap_allocations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    vendorId: text("vendor_id").notNull().references(() => vendors.id),
    paymentApDebitTransactionId: text("payment_ap_debit_transaction_id").notNull().references(() => transactions.id),
    purchaseApCreditTransactionId: text("purchase_ap_credit_transaction_id").notNull().references(() => transactions.id),
    amountMinor: integer("amount_minor").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("ap_alloc_vendor_idx").on(t.vendorId), index("ap_alloc_purchase_idx").on(t.purchaseApCreditTransactionId)]
);

/** BizGO 経費精算書 CSV 明細 */
export const bizgoExpenseLines = sqliteTable(
  "bizgo_expense_lines",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    importBatchId: text("import_batch_id").notNull(),
    settlementMonth: text("settlement_month").notNull(),
    subject: text("subject"),
    detailDate: text("detail_date"),
    categoryLabel: text("category_label").notNull(),
    accountId: text("account_id").references(() => accounts.id),
    amountInclTaxMinor: integer("amount_incl_tax_minor").notNull().default(0),
    taxCategory: text("tax_category"),
    amountExclTaxMinor: integer("amount_excl_tax_minor").notNull().default(0),
    taxAmountMinor: integer("tax_amount_minor").notNull().default(0),
    summary: text("summary"),
    hasReceipt: text("has_receipt"),
    invoiceFlag: text("invoice_flag"),
    registrationNumber: text("registration_number"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index("bizgo_expense_month_idx").on(t.settlementMonth),
    index("bizgo_expense_batch_idx").on(t.importBatchId),
    index("bizgo_expense_account_idx").on(t.accountId),
    index("bizgo_expense_category_idx").on(t.categoryLabel),
    index("bizgo_expense_tax_cat_idx").on(t.taxCategory),
  ]
);

/** BizGO 出張経費精算書 CSV 明細 */
export const bizgoTripExpenseLines = sqliteTable(
  "bizgo_trip_expense_lines",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    importBatchId: text("import_batch_id").notNull(),
    targetMonth: text("target_month").notNull(),
    subject: text("subject"),
    tripStartDate: text("trip_start_date"),
    tripEndDate: text("trip_end_date"),
    tripDays: text("trip_days"),
    oneWayDistanceKm: text("one_way_distance_km"),
    lodging: text("lodging"),
    dailyAllowanceTotalMinor: integer("daily_allowance_total_minor").notNull().default(0),
    detailDate: text("detail_date"),
    categoryLabel: text("category_label").notNull(),
    accountId: text("account_id").references(() => accounts.id),
    amountInclTaxMinor: integer("amount_incl_tax_minor").notNull().default(0),
    taxCategory: text("tax_category"),
    amountExclTaxMinor: integer("amount_excl_tax_minor").notNull().default(0),
    taxAmountMinor: integer("tax_amount_minor").notNull().default(0),
    summary: text("summary"),
    hasReceipt: text("has_receipt"),
    invoiceFlag: text("invoice_flag"),
    registrationNumber: text("registration_number"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index("bizgo_trip_month_idx").on(t.targetMonth),
    index("bizgo_trip_batch_idx").on(t.importBatchId),
    index("bizgo_trip_account_idx").on(t.accountId),
    index("bizgo_trip_category_idx").on(t.categoryLabel),
    index("bizgo_trip_tax_cat_idx").on(t.taxCategory),
  ]
);

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  /** admin: 全機能 / user: 会計運用のみ（ユーザー管理・会計設定は不可） */
  role: text("role").notNull().default("user"),
  displayName: text("display_name"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const accountDivisionsRelations = relations(accountDivisions, ({ many }) => ({
  accounts: many(accounts),
}));
export const accountsRelations = relations(accounts, ({ one, many }) => ({
  division: one(accountDivisions, { fields: [accounts.accountDivisionId], references: [accountDivisions.id] }),
  transactions: many(transactions),
}));
export const customersRelations = relations(customers, ({ many }) => ({ transactions: many(transactions), arAllocations: many(arAllocations) }));
export const vendorsRelations = relations(vendors, ({ many }) => ({ transactions: many(transactions), apAllocations: many(apAllocations) }));
export const payeesRelations = relations(payees, ({ many }) => ({ transactions: many(transactions) }));
export const bizgoExpenseLinesRelations = relations(bizgoExpenseLines, ({ one }) => ({
  account: one(accounts, { fields: [bizgoExpenseLines.accountId], references: [accounts.id] }),
}));
export const bizgoTripExpenseLinesRelations = relations(bizgoTripExpenseLines, ({ one }) => ({
  account: one(accounts, { fields: [bizgoTripExpenseLines.accountId], references: [accounts.id] }),
}));
