/** Content-Disposition（ASCII fallback + UTF-8 filename*） */
function buildContentDisposition(filename: string): string {
  const ascii =
    filename
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "export.csv";
  const utf8 = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

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
      "Content-Disposition": buildContentDisposition(filename),
    },
  });
}
