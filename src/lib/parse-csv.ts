/** RFC4180 風の CSV パース（ダブルクォート・改行対応） */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (q) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      q = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function parseCsvWithHeader(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const all = parseCsv(content);
  if (all.length === 0) return { headers: [], rows: [] };
  const headers = all[0].map((h) => h.trim().replace(/^\uFEFF/, ""));
  const rows = all.slice(1).map((cells) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = (cells[i] ?? "").trim();
    });
    return rec;
  });
  return { headers, rows };
}
