/** 金額文字列 → 円（整数）。カンマ・円記号を除去 */
export function parseYenAmount(raw: string): number {
  const s = raw.trim().replace(/[¥￥,\s]/g, "");
  if (!s || s === "—" || s === "-") return 0;
  const n = Math.floor(Number(s));
  return Number.isFinite(n) ? n : 0;
}

/** 精算月・対象月 → YYYY-MM */
export function normalizeBizgoMonth(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}`;
  const jp = s.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
  if (jp) return `${jp[1]}-${jp[2].padStart(2, "0")}`;
  if (/^\d{6}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}`;
  return s.slice(0, 7);
}

export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const jp = s.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (jp) return `${jp[1]}-${jp[2].padStart(2, "0")}-${jp[3].padStart(2, "0")}`;
  return s;
}

export function pickField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v.trim() !== "") return v.trim();
  }
  return "";
}
