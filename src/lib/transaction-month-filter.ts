import { and, gte, lt, type Column, type SQL } from "drizzle-orm";

/** YYYY-MM の翌月1日（排他的上限） */
export function nextMonthStart(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error("月指定が不正です");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo === 12) return `${y + 1}-01-01`;
  return `${y}-${String(mo + 1).padStart(2, "0")}-01`;
}

/** transaction_date（YYYY-MM-DD 想定）が指定月に含まれる条件 */
export function transactionDateInMonth(column: Column, month: string): SQL {
  const start = `${month}-01`;
  const end = nextMonthStart(month);
  return and(gte(column, start), lt(column, end))!;
}

export function formatMonthLabel(ym: string) {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[1]}年${Number(m[2])}月`;
  return ym;
}
