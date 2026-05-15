/** 一覧のローカル検索用。空クエリはすべて一致。部分一致（大文字小文字は無視） */
export function matchesListSearch(haystack: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const h = haystack.toLowerCase();
  const n = q.toLowerCase();
  return h.includes(n);
}
