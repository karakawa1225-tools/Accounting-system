import "server-only";

import type { Client } from "@libsql/client";
import type { Database } from "@/db";
import { getLibsqlClient } from "@/db";

const BOOTSTRAP_TS = 1735689600000;

async function execSql(client: Client, sqlStr: string) {
  await client.execute({ sql: sqlStr, args: [] });
}

async function execSqlIgnore(client: Client, sqlStr: string, ignoreSubstrings: string[]) {
  try {
    await execSql(client, sqlStr);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!ignoreSubstrings.some((s) => msg.includes(s))) throw e;
  }
}

async function bootstrapAccountDivisionsSchema(client: Client) {
  await execSql(
    client,
    `CREATE TABLE IF NOT EXISTS account_divisions (
      id text PRIMARY KEY NOT NULL,
      code text,
      name text NOT NULL,
      statement_category text NOT NULL,
      sort_order integer DEFAULT 0 NOT NULL,
      is_active integer DEFAULT 1 NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    )`
  );
  await execSqlIgnore(client, "CREATE UNIQUE INDEX IF NOT EXISTS account_divisions_code_unique ON account_divisions (code)", []);
  await execSqlIgnore(client, "CREATE INDEX IF NOT EXISTS account_divisions_sort_idx ON account_divisions (sort_order)", []);

  await execSqlIgnore(client, "ALTER TABLE accounts ADD COLUMN account_division_id text REFERENCES account_divisions (id)", [
    "duplicate column",
  ]);

  await execSqlIgnore(client, "CREATE INDEX IF NOT EXISTS accounts_division_idx ON accounts (account_division_id)", []);

}

async function ensureAccountsDivisionColumn(client: Client) {
  try {
    await client.execute({ sql: "SELECT account_division_id FROM accounts LIMIT 1", args: [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("no such column") && !msg.includes("account_division_id")) throw e;
    await execSqlIgnore(client, "ALTER TABLE accounts ADD COLUMN account_division_id text REFERENCES account_divisions (id)", [
      "duplicate column",
    ]);
    await execSqlIgnore(client, "CREATE INDEX IF NOT EXISTS accounts_division_idx ON accounts (account_division_id)", []);
    await execSql(
      client,
      "UPDATE accounts SET account_division_id = 'd1000000-0000-4000-8000-000000000001' WHERE category = 'asset' AND account_division_id IS NULL"
    );
    await execSql(
      client,
      "UPDATE accounts SET account_division_id = 'd1000000-0000-4000-8000-000000000002' WHERE category = 'liability' AND account_division_id IS NULL"
    );
    await execSql(
      client,
      "UPDATE accounts SET account_division_id = 'd1000000-0000-4000-8000-000000000003' WHERE category = 'equity' AND account_division_id IS NULL"
    );
    await execSql(
      client,
      "UPDATE accounts SET account_division_id = 'd1000000-0000-4000-8000-000000000004' WHERE category = 'revenue' AND account_division_id IS NULL"
    );
    await execSql(
      client,
      "UPDATE accounts SET account_division_id = 'd1000000-0000-4000-8000-000000000005' WHERE category = 'expense' AND account_division_id IS NULL"
    );
  }
}

/** マイグレーション未適用DB向け。このモジュールは server-only のためクライアントには含まれない。 */
export async function ensureAccountDivisionsSchemaAtRuntime(_db: Database) {
  const client = getLibsqlClient();
  try {
    await client.execute({ sql: "SELECT 1 FROM account_divisions LIMIT 1", args: [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/no such table/i.test(msg)) throw e;
    await bootstrapAccountDivisionsSchema(client);
    return;
  }
  await ensureAccountsDivisionColumn(client);
}
