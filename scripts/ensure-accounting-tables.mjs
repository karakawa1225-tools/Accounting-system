import "dotenv/config";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

await client.execute(`
CREATE TABLE IF NOT EXISTS ar_allocations (
  id text PRIMARY KEY NOT NULL,
  customer_id text NOT NULL,
  payment_ar_credit_transaction_id text NOT NULL,
  sales_ar_debit_transaction_id text NOT NULL,
  amount_minor integer NOT NULL,
  created_at integer NOT NULL
);
`);

await client.execute(`
CREATE TABLE IF NOT EXISTS ap_allocations (
  id text PRIMARY KEY NOT NULL,
  vendor_id text NOT NULL,
  payment_ap_debit_transaction_id text NOT NULL,
  purchase_ap_credit_transaction_id text NOT NULL,
  amount_minor integer NOT NULL,
  created_at integer NOT NULL
);
`);

const transactionColumns = [
  ["entry_group_id", "text"],
  ["account_id", "text"],
  ["debit_amount_minor", "integer NOT NULL DEFAULT 0"],
  ["credit_amount_minor", "integer NOT NULL DEFAULT 0"],
  ["amount_minor", "integer"],
  ["summary", "text"],
];

for (const [col, typ] of transactionColumns) {
  try {
    await client.execute(`ALTER TABLE transactions ADD COLUMN ${col} ${typ}`);
    console.log(`added column transactions.${col}`);
  } catch (e) {
    const msg = String(e?.message ?? e ?? "");
    if (!msg.includes("duplicate column") && !msg.includes("already exists")) {
      console.warn(`skip transactions.${col}:`, msg);
    }
  }
}

console.log("accounting tables OK");

