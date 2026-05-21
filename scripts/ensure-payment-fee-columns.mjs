import { createClient } from "@libsql/client";
import "dotenv/config";

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("TURSO_DATABASE_URL is required");

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

async function columnExists(table, col) {
  const rs = await client.execute(`PRAGMA table_info(${table})`);
  return rs.rows.some((r) => r.name === col);
}

async function main() {
  if (!(await columnExists("transactions", "transfer_fee_minor"))) {
    await client.execute("ALTER TABLE transactions ADD COLUMN transfer_fee_minor integer");
    console.log("Added transactions.transfer_fee_minor");
  }
  if (!(await columnExists("transactions", "fee_bearer"))) {
    await client.execute("ALTER TABLE transactions ADD COLUMN fee_bearer text");
    console.log("Added transactions.fee_bearer");
  }
  console.log("Payment fee columns OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
