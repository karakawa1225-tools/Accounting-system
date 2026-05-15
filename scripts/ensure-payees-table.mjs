import "dotenv/config";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

await client.execute(`
CREATE TABLE IF NOT EXISTS payees (
  id text PRIMARY KEY NOT NULL,
  code text,
  name text NOT NULL,
  category text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);
`);

try {
  await client.execute("ALTER TABLE transactions ADD COLUMN payee_id text REFERENCES payees(id)");
  console.log("added transactions.payee_id");
} catch (e) {
  const msg = String(e?.message ?? e);
  if (!msg.includes("duplicate column") && !msg.includes("Duplicate column")) throw e;
}

console.log("payees table OK");
