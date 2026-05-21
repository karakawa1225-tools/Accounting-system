import "dotenv/config";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set");
  process.exit(1);
}

/** @type {{ code: string; name: string; category: string }[]} */
const SYSTEM = [
  { code: "SYS_AR", name: "売掛金", category: "asset" },
  { code: "SYS_SALES", name: "売上高", category: "revenue" },
  { code: "SYS_BANK", name: "普通預金", category: "asset" },
  { code: "SYS_AP", name: "買掛金", category: "liability" },
  { code: "SYS_PURCHASES", name: "仕入高", category: "expense" },
  { code: "SYS_OPENING", name: "期首貸借調整", category: "equity" },
  { code: "SYS_BANK_FEE", name: "振込手数料", category: "expense" },
];

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

async function resolveDivisionId(category) {
  const y = await client.execute({
    sql:
      "select id from account_divisions where code like 'Y%' and statement_category = ? and (is_active = 1 or is_active is null) order by sort_order, code limit 1",
    args: [category],
  });
  if (y.rows.length > 0) return y.rows[0].id;
  const any = await client.execute({
    sql:
      "select id from account_divisions where code like 'Y%' and (is_active = 1 or is_active is null) order by sort_order, code limit 1",
    args: [],
  });
  return any.rows[0]?.id ?? null;
}

for (const row of SYSTEM) {
  const check = await client.execute({
    sql: "select id from accounts where code = ? limit 1",
    args: [row.code],
  });
  if (check.rows.length > 0) continue;
  const divId = await resolveDivisionId(row.category);
  if (!divId) {
    console.error(`区分（Y始まり・${row.category}）がありません。勘定科目区分をCSV取込してから再実行してください。`);
    process.exit(1);
  }
  const id = crypto.randomUUID();
  const now = Date.now();
  await client.execute({
    sql:
      "insert into accounts (id, code, name, category, account_division_id, is_active, created_at, updated_at) values (?, ?, ?, ?, ?, 1, ?, ?)",
    args: [id, row.code, row.name, row.category, divId, now, now],
  });
  console.log("inserted system account:", row.code);
}

console.log("system accounts OK");
