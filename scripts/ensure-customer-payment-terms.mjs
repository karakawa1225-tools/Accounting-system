import "dotenv/config";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

try {
  await client.execute("ALTER TABLE customers ADD COLUMN payment_site_terms text");
  console.log("added customers.payment_site_terms");
} catch (e) {
  const msg = String(e?.message ?? e);
  if (!msg.includes("duplicate column") && !msg.includes("Duplicate column")) throw e;
}

console.log("customer payment_site_terms OK");
