/** 展示 RAGFlow `structure_answer` 返回的 reference.chunks（已 chunks_format） */
export function ReferenceChunks({ reference }: { reference: unknown }) {
  if (!reference || typeof reference !== "object") {
    return <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>暂无引用</p>;
  }
  const chunks = (reference as { chunks?: unknown }).chunks;
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>暂无引用</p>;
  }

  return (
    <ul style={{ margin: 0, paddingLeft: "1rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
      {chunks.map((c, i) => {
        const row = c as Record<string, unknown>;
        const doc =
          (row.document_keyword as string) ||
          (row.docnm_kwd as string) ||
          (row.document_id as string) ||
          `片段 ${i + 1}`;
        const text =
          (row.content_with_weight as string) ||
          (row.content as string) ||
          (row.content_ltks as string) ||
          "";
        const sim = row.similarity != null ? ` · ${Number(row.similarity).toFixed(3)}` : "";
        return (
          <li key={String(row.chunk_id ?? row.id ?? i)} style={{ fontSize: "0.82rem", lineHeight: 1.45 }}>
            <div style={{ fontWeight: 600, color: "var(--color-primary)", marginBottom: 4 }}>
              {doc}
              <span className="muted" style={{ fontWeight: 400 }}>
                {sim}
              </span>
            </div>
            <div className="muted" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {text.slice(0, 1200)}
              {text.length > 1200 ? "…" : ""}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
