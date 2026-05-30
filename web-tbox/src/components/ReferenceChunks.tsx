import { useEffect, useRef } from "react";

type Props = {
  reference: unknown;
  activeChunkIndex?: number | null;
  onSelectChunk?: (chunkIndex: number) => void;
};

/** 展示 RAGFlow `structure_answer` 返回的 reference.chunks（已 chunks_format） */
export function ReferenceChunks({ reference, activeChunkIndex = null, onSelectChunk }: Props) {
  const itemRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  useEffect(() => {
    if (activeChunkIndex == null) return;
    const el = itemRefs.current.get(activeChunkIndex);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeChunkIndex]);

  if (!reference || typeof reference !== "object") {
    return <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>暂无引用</p>;
  }
  const chunks = (reference as { chunks?: unknown }).chunks;
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>暂无引用</p>;
  }

  return (
    <ul aria-label="引用片段" style={{ margin: 0, paddingLeft: "1rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
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
        const active = activeChunkIndex === i;
        const clickable = Boolean(onSelectChunk);

        return (
          <li
            key={String(row.chunk_id ?? row.id ?? i)}
            ref={(el) => {
              if (el) itemRefs.current.set(i, el);
              else itemRefs.current.delete(i);
            }}
            style={{
              fontSize: "0.82rem",
              lineHeight: 1.45,
              listStyle: clickable ? "none" : undefined,
              marginLeft: clickable ? "-1rem" : undefined,
            }}
          >
            {clickable ? (
              <button
                type="button"
                aria-label={`引用 ${i + 1}：${doc}`}
                aria-pressed={active}
                onClick={() => onSelectChunk?.(i)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.45rem 0.55rem",
                  borderRadius: 8,
                  border: active ? "1px solid var(--color-primary)" : "1px solid var(--border-subtle)",
                  background: active ? "rgba(37, 99, 235, 0.08)" : "#fafafa",
                  cursor: "pointer",
                }}
              >
                <ChunkBody doc={doc} sim={sim} text={text} index={i} />
              </button>
            ) : (
              <ChunkBody doc={doc} sim={sim} text={text} index={i} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ChunkBody({ doc, sim, text, index }: { doc: string; sim: string; text: string; index: number }) {
  return (
    <>
      <div style={{ fontWeight: 600, color: "var(--color-primary)", marginBottom: 4 }}>
        <span className="muted" style={{ fontWeight: 500, marginRight: 6 }}>
          {index + 1}.
        </span>
        {doc}
        <span className="muted" style={{ fontWeight: 400 }}>
          {sim}
        </span>
      </div>
      <div className="muted" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {text.slice(0, 1200)}
        {text.length > 1200 ? "…" : ""}
      </div>
    </>
  );
}
