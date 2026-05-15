/** UTF-8 BOM 付き CSV をブラウザダウンロード用 Response で返す */
export function csvDownloadResponse(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map((c) => escape(String(c ?? ""))).join(","))];
  const body = "\uFEFF" + lines.join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
