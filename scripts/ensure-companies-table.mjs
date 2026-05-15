import "dotenv/config";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

await client.execute(`
CREATE TABLE IF NOT EXISTS companies (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  postal_code text,
  address text,
  phone text,
  fax text,
  representative_name text,
  tax_id text,
  invoice_registration_number text,
  bank_name text,
  bank_branch_name text,
  bank_account_type text,
  bank_account_number text,
  bank_account_holder text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);
`);

const optionalColumns = [
  ["postal_code", "text"],
  ["address", "text"],
  ["phone", "text"],
  ["fax", "text"],
  ["representative_name", "text"],
  ["tax_id", "text"],
  ["invoice_registration_number", "text"],
  ["bank_name", "text"],
  ["bank_branch_name", "text"],
  ["bank_account_type", "text"],
  ["bank_account_number", "text"],
  ["bank_account_holder", "text"],
  ["fiscal_period_start", "text"],
  ["fiscal_period_end", "text"],
];

for (const [col, typ] of optionalColumns) {
  try {
    await client.execute(`ALTER TABLE companies ADD COLUMN ${col} ${typ}`);
    console.log(`added column companies.${col}`);
  } catch (e) {
    const msg = String(e?.message ?? e ?? "");
    if (!msg.includes("duplicate column") && !msg.includes("already exists")) {
      console.warn(`skip companies.${col}:`, msg);
    }
  }
}

console.log("companies table OK");
