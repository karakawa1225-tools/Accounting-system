import "dotenv/config";
import { getDb } from "../src/db";
import { cleanupNonCsvMasters } from "../src/lib/cleanup-non-csv-masters";

async function main() {
  const db = getDb();
  const result = await cleanupNonCsvMasters(db);
  console.log("cleanup-non-csv-masters:", result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
