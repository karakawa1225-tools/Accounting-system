const linkStyle: React.CSSProperties = {
  border: "1px solid #94a3b8",
  color: "#334155",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: "0.06em",
  background: "#f8fafc",
  textDecoration: "none",
  display: "inline-block",
};

export function MonthlyExportLinks({
  month,
  pdfHref,
  csvHref,
  pdfLabel = "PDF",
  csvLabel = "CSV",
}: {
  month: string;
  pdfHref: string;
  csvHref: string;
  pdfLabel?: string;
  csvLabel?: string;
}) {
  const m = `month=${encodeURIComponent(month)}`;
  const pdf = pdfHref.includes("?") ? `${pdfHref}&${m}` : `${pdfHref}?${m}`;
  const csv = csvHref.includes("?") ? `${csvHref}&${m}` : `${csvHref}?${m}`;

  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <a href={pdf} target="_blank" rel="noreferrer" style={linkStyle}>
        {pdfLabel}
      </a>
      <a href={csv} style={{ ...linkStyle, borderColor: "#06b6d4", color: "#0e7490", background: "#ecfeff" }}>
        {csvLabel}
      </a>
    </span>
  );
}
