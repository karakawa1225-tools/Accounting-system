import { asc, eq, isNull, or } from "drizzle-orm";
import type { Database } from "@/db";
import { accountDivisions, type AccountCategory } from "@/db/schema";
import { isCsvStyleDivisionCode } from "@/lib/csv-master-policy";

/** 財務区分に対応する Y 区分（CSV取込）の ID。無い場合は先頭の Y 区分。 */
export async function resolveYDivisionForCategory(db: Database, category: AccountCategory): Promise<string | null> {
  const rows = await db
    .select({ id: accountDivisions.id, code: accountDivisions.code, statementCategory: accountDivisions.statementCategory })
    .from(accountDivisions)
    .where(or(eq(accountDivisions.isActive, true), isNull(accountDivisions.isActive)))
    .orderBy(asc(accountDivisions.sortOrder), asc(accountDivisions.code));

  const yRows = rows.filter((r) => isCsvStyleDivisionCode(r.code));
  const matched = yRows.find((r) => r.statementCategory === category);
  return matched?.id ?? yRows[0]?.id ?? null;
}
