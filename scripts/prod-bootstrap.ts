/**
 * 本番DBのスキーマ適用とレガシー補完テーブル作成。
 * デプロイ前後に1回実行: npm run db:prod-bootstrap
 */
import { execSync } from "node:child_process";
import "dotenv/config";
import { validateServerEnv } from "../src/lib/env";

const steps = [
  ["drizzle migrate", () => execSync("npx drizzle-kit migrate", { stdio: "inherit" })],
  ["companies", () => execSync("node scripts/ensure-companies-table.mjs", { stdio: "inherit" })],
  ["accounting tables", () => execSync("node scripts/ensure-accounting-tables.mjs", { stdio: "inherit" })],
  ["system accounts", () => execSync("node scripts/ensure-system-accounts.mjs", { stdio: "inherit" })],
  ["payees", () => execSync("node scripts/ensure-payees-table.mjs", { stdio: "inherit" })],
  ["customer payment terms", () => execSync("node scripts/ensure-customer-payment-terms.mjs", { stdio: "inherit" })],
  ["users role", () => execSync("node scripts/ensure-users-role.mjs", { stdio: "inherit" })],
  ["opening balances", () => execSync("node scripts/ensure-opening-balance-lines.mjs", { stdio: "inherit" })],
  ["bizgo", () => execSync("node scripts/ensure-bizgo-tables.mjs", { stdio: "inherit" })],
  ["company banks", () => execSync("node scripts/ensure-company-bank-accounts.mjs", { stdio: "inherit" })],
] as const;

async function main() {
  validateServerEnv();
  console.log("=== Production DB bootstrap ===\n");
  for (const [name, run] of steps) {
    console.log(`→ ${name}`);
    run();
  }
  console.log("\n=== Bootstrap complete ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
