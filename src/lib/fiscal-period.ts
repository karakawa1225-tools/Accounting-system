/** YYYY-MM-DD の1日前（前期の期末日＝今期期首の前日） */
export function getPriorPeriodEndDate(fiscalPeriodStart: string | null | undefined): string | null {
  const s = fiscalPeriodStart?.trim();
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() - 1);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
