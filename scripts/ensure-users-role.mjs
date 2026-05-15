import "dotenv/config";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

try {
  await client.execute(`ALTER TABLE users ADD COLUMN role text`);
  console.log("added column users.role");
} catch (e) {
  const msg = String(e?.message ?? e ?? "");
  if (!msg.includes("duplicate column") && !msg.includes("already exists")) {
    console.warn("skip users.role add:", msg);
  }
}

// レガシー環境では role 未設定行を使用者扱いにせず運用復旧できるよう admin に寄せる
await client.execute(`UPDATE users SET role = 'admin' WHERE role IS NULL OR trim(role) = ''`);
console.log("users.role backfill OK");
