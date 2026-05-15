/** 複数業務一覧で共通利用する会計期間一行表（データは自社設定） */
export function FiscalPeriodInlineTable({
  fiscalStart,
  fiscalEnd,
}: {
  fiscalStart?: string | null;
  fiscalEnd?: string | null;
}) {
  if (!fiscalStart?.trim() && !fiscalEnd?.trim()) return null;
  return (
    <div style={{ overflowX: "auto", marginBottom: 14 }}>
      <table style={{ width: "100%", maxWidth: 560, borderCollapse: "collapse", fontSize: 14, fontWeight: 600, letterSpacing: "0.04em" }}>
        <caption style={{ captionSide: "top", textAlign: "left", paddingBottom: 8, color: "#64748b", fontWeight: 800, letterSpacing: "0.08em" }}>
          自社設定の会計期間
        </caption>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #cbd5e1", background: "#f8fafc" }}>
            <th style={{ padding: "10px 8px", fontWeight: 800 }}>区分</th>
            <th style={{ padding: "10px 8px", fontWeight: 800 }}>期首（開始）</th>
            <th style={{ padding: "10px 8px", fontWeight: 800 }}>期末（終了）</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderTop: "1px solid #f1f5f9" }}>
            <td style={{ padding: "10px 8px" }}>当期（登録）</td>
            <td style={{ padding: "10px 8px" }}>{fiscalStart?.trim() || "—"}</td>
            <td style={{ padding: "10px 8px" }}>{fiscalEnd?.trim() || "—"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
