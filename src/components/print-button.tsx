"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        border: "1px solid #94a3b8",
        borderRadius: 8,
        padding: "8px 12px",
        background: "#f8fafc",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      印刷 / PDF保存
    </button>
  );
}

