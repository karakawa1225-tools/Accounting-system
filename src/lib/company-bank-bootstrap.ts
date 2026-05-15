import "server-only";

import type { Client } from "@libsql/client";
import { getLibsqlClient } from "@/db";

async function execSql(client: Client, sqlStr: string) {
  await client.execute({ sql: sqlStr, args: [] });
}

export async function ensureCompanyBankAccountsTableAtRuntime() {
  const client = getLibsqlClient();
  try {
    await client.execute({ sql: "SELECT 1 FROM company_bank_accounts LIMIT 1", args: [] });
    await ensureCompanyBankFiscalBalanceColumn();
    return;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/no such table/i.test(msg)) throw e;
  }
  await execSql(
    client,
    `CREATE TABLE IF NOT EXISTS company_bank_accounts (
      id text PRIMARY KEY NOT NULL,
      company_id text NOT NULL,
      label text,
      bank_name text,
      branch_name text,
      account_type text,
      account_number text,
      account_holder text,
      account_id text NOT NULL,
      fiscal_end_balance_minor integer DEFAULT 0 NOT NULL,
      sort_order integer DEFAULT 0 NOT NULL,
      is_active integer DEFAULT 1 NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE cascade,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    )`
  );
  await execSql(client, "CREATE INDEX IF NOT EXISTS company_bank_accounts_company_idx ON company_bank_accounts (company_id)");
  await execSql(client, "CREATE INDEX IF NOT EXISTS company_bank_accounts_account_idx ON company_bank_accounts (account_id)");
  await ensureCompanyBankFiscalBalanceColumn();
}

async function execSqlIgnore(client: Client, sqlStr: string, ignoreSubstrings: string[]) {
  try {
    await execSql(client, sqlStr);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!ignoreSubstrings.some((s) => msg.includes(s))) throw e;
  }
}

export async function ensureCompanyBankFiscalBalanceColumn() {
  const client = getLibsqlClient();
  await execSqlIgnore(
    client,
    "ALTER TABLE company_bank_accounts ADD COLUMN fiscal_end_balance_minor integer DEFAULT 0 NOT NULL",
    ["duplicate column", "duplicate column name"]
  );
}
