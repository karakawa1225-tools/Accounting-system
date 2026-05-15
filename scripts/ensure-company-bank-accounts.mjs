import "dotenv/config";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

await client.execute(`
CREATE TABLE IF NOT EXISTS company_bank_accounts (
  id text PRIMARY KEY NOT NULL,
  company_id text NOT NULL,
  label text,
  bank_name text,
  branch_name text,
  account_type text,
  account_number text,
  account_holder text,
  account_id text NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  is_active integer DEFAULT 1 NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE cascade,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);
`);
await client.execute(
  "CREATE INDEX IF NOT EXISTS company_bank_accounts_company_idx ON company_bank_accounts (company_id)"
);
await client.execute(
  "CREATE INDEX IF NOT EXISTS company_bank_accounts_account_idx ON company_bank_accounts (account_id)"
);

try {
  await client.execute(
    "ALTER TABLE company_bank_accounts ADD COLUMN fiscal_end_balance_minor integer DEFAULT 0 NOT NULL"
  );
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (!msg.includes("duplicate column")) throw e;
}

console.log("company_bank_accounts OK");
