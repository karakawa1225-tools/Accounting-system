import "dotenv/config";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

await client.execute(`
CREATE TABLE IF NOT EXISTS opening_balance_lines (
  fiscal_period_start text NOT NULL,
  account_id text NOT NULL,
  balance_minor integer NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  PRIMARY KEY (fiscal_period_start, account_id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);
`);

await client.execute(`CREATE INDEX IF NOT EXISTS opening_balance_account_idx ON opening_balance_lines(account_id);`);

console.log("opening_balance_lines OK");
