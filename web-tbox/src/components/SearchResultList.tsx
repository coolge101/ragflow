import { useEffect, useRef } from "react";
import type { ChunkRow } from "../api/datasetSearch";

type Props = {
  chunks: ChunkRow[];
  activeIndex?: number | null;
  onSelectChunk?: (index: number) => void;
};

function chunkDoc(c: ChunkRow, index: number): string {
  return (
    (c.document_keyword as string) ||
    (c.docnm_kwd as string) ||
    (c.document_id as string) ||
    `片段 ${index + 1}`
  );
}

function chunkText(c: ChunkRow): string {
  return (
    (c.content_with_weight as string) ||
    (c.content_ltks as string) ||
    (c.content as string) ||
    ""
  );
}

/** 检索结果列表：可点击高亮，与对话页引用侧栏交互一致 */
export function SearchResultList({ chunks, activeIndex = null, onSelectChunk }: Props) {
  const itemRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  useEffect(() => {
    if (activeIndex == null) return;
    itemRefs.current.get(activeIndex)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIndex]);

  const clickable = Boolean(onSelectChunk);

  return (
    <ol
      aria-label="检索结果片段"
      style={{
        paddingLeft: clickable ? 0 : "1.2rem",
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        listStyle: clickable ? "none" : undefined,
      }}
    >
      {chunks.map((c, i) => {
        const doc = chunkDoc(c, i);
        const text = chunkText(c);
        const sim = c.similarity != null ? ` · ${Number(c.similarity).toFixed(3)}` : "";
        const active = activeIndex === i;

        return (
          <li
            key={String(c.chunk_id ?? c.id ?? i)}
            ref={(el) => {
              if (el) itemRefs.current.set(i, el);
              else itemRefs.current.delete(i);
            }}
          >
            {clickable ? (
              <button
                type="button"
                aria-label={`结果 ${i + 1}：${doc}`}
                aria-pressed={active}
                onClick={() => onSelectChunk?.(i)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.75rem 1rem",
                  borderRadius: 8,
                  border: active ? "1px solid var(--color-primary)" : "1px solid var(--border-subtle)",
                  background: active ? "rgba(37, 99, 235, 0.08)" : "#fff",
                  cursor: "pointer",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                <ResultBody doc={doc} sim={sim} text={text} index={i} />
              </button>
            ) : (
              <div
                style={{
                  background: "#fff",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 8,
                  padding: "0.75rem 1rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                <ResultBody doc={doc} sim={sim} text={text} index={i} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ResultBody({ doc, sim, text, index }: { doc: string; sim: string; text: string; index: number }) {
  return (
    <>
      <div style={{ fontWeight: 600, color: "var(--color-primary)", marginBottom: 6 }}>
        <span className="muted" style={{ fontWeight: 500, marginRight: 6 }}>
          {index + 1}.
        </span>
        {doc}
        <span className="muted" style={{ fontWeight: 400 }}>
          {sim}
        </span>
      </div>
      <div className="muted">{text.slice(0, 1200)}{text.length > 1200 ? "…" : ""}</div>
    </>
  );
}

export function searchChunkSnippet(c: ChunkRow): string {
  const doc = chunkDoc(c, 0);
  const text = chunkText(c);
  const sim = c.similarity != null ? `相似度 ${Number(c.similarity).toFixed(3)}` : "";
  return [doc && `【${doc}】`, sim, text.slice(0, 500)].filter(Boolean).join("\n");
}
