import { asc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { accountDivisions, type AccountCategory } from "@/db/schema";
import { DEFAULT_DIVISION_IDS, DEFAULT_DIVISION_SEED_ROWS } from "@/lib/default-account-division-constants";
import { mapAccountCategoryFromImport } from "@/lib/account-category";

export { DEFAULT_DIVISION_IDS } from "@/lib/default-account-division-constants";

async function syncAccountDivisionsSchema(db: Database) {
  const { ensureAccountDivisionsSchemaAtRuntime } = await import("@/lib/account-divisions-bootstrap");
  await ensureAccountDivisionsSchemaAtRuntime(db);
}

/** 空なら標準の5区分を投入（マイグレーション未実行環境のフォールバック） */
export async function ensureDefaultAccountDivisions(db: Database) {
  await syncAccountDivisionsSchema(db);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(accountDivisions);
  if (n > 0) return;
  const now = new Date();
  await db.insert(accountDivisions).values(
    DEFAULT_DIVISION_SEED_ROWS.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      statementCategory: r.statementCategory,
      sortOrder: r.sortOrder,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }))
  );
}

export function defaultDivisionIdForCategory(cat: AccountCategory): string {
  return DEFAULT_DIVISION_IDS[cat];
}

/** 勘定CSVの区分コード・区分名からマスタ行を決定する */
export async function resolveAccountDivisionFromImport(db: Database, categoryCodeRaw: string, categoryLabelRaw: string) {
  await ensureDefaultAccountDivisions(db);
  const cc = categoryCodeRaw.trim();
  const cl = categoryLabelRaw.trim();

  if (cc) {
    const [hit] = await db.select().from(accountDivisions).where(eq(accountDivisions.code, cc)).limit(1);
    if (hit) return hit;
  }
  if (cl) {
    const [hit] = await db.select().from(accountDivisions).where(eq(accountDivisions.name, cl)).limit(1);
    if (hit) return hit;
  }

  const stmt = mapAccountCategoryFromImport(categoryCodeRaw, categoryLabelRaw);
  const rows = await db
    .select()
    .from(accountDivisions)
    .where(eq(accountDivisions.statementCategory, stmt))
    .orderBy(asc(accountDivisions.sortOrder))
    .limit(1);
  return rows[0] ?? null;
}

/** statement_category と同じ既定区分を返す（主に標準勘定の新規作成） */
export async function resolveDefaultDivisionForCategory(db: Database, cat: AccountCategory) {
  await ensureDefaultAccountDivisions(db);
  const rows = await db
    .select()
    .from(accountDivisions)
    .where(eq(accountDivisions.statementCategory, cat))
    .orderBy(asc(accountDivisions.sortOrder))
    .limit(1);
  return rows[0] ?? null;
}
