import { useEffect, useRef } from "react";
import type { ChunkDisplayItem } from "../utils/chunkDisplay";
import { formatSimilaritySuffix } from "../utils/chunkDisplay";

type Props = {
  items: ChunkDisplayItem[];
  activeIndex?: number | null;
  onSelectChunk?: (index: number) => void;
  ariaLabel: string;
  emptyMessage?: string;
  listAs?: "ul" | "ol";
  /** compact：引用侧栏；comfortable：检索结果 */
  density?: "compact" | "comfortable";
  selectLabelPrefix?: string;
};

const DENSITY = {
  compact: { gap: "0.65rem", btnPad: "0.45rem 0.55rem", btnBg: "#fafafa", marginLeft: "-1rem" },
  comfortable: { gap: "0.75rem", btnPad: "0.75rem 1rem", btnBg: "#fff", marginLeft: undefined as string | undefined },
} as const;

/** 可点击高亮的 chunk 列表（对话引用侧栏 / 检索结果共用） */
export function ChunkListPanel({
  items,
  activeIndex = null,
  onSelectChunk,
  ariaLabel,
  emptyMessage = "暂无内容",
  listAs = "ul",
  density = "compact",
  selectLabelPrefix = "片段",
}: Props) {
  const itemRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const ListTag = listAs;
  const d = DENSITY[density];
  const clickable = Boolean(onSelectChunk);

  useEffect(() => {
    if (activeIndex == null) return;
    itemRefs.current.get(activeIndex)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIndex]);

  if (items.length === 0) {
    return <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>{emptyMessage}</p>;
  }

  return (
    <ListTag
      aria-label={ariaLabel}
      style={{
        margin: 0,
        paddingLeft: clickable ? 0 : listAs === "ol" ? "1.2rem" : "1rem",
        display: "flex",
        flexDirection: "column",
        gap: d.gap,
        listStyle: clickable ? "none" : undefined,
      }}
    >
      {items.map((item, i) => {
        const sim = formatSimilaritySuffix(item.similarity);
        const active = activeIndex === i;

        return (
          <li
            key={item.key}
            ref={(el) => {
              if (el) itemRefs.current.set(i, el);
              else itemRefs.current.delete(i);
            }}
            style={{
              fontSize: "0.82rem",
              lineHeight: 1.45,
              listStyle: clickable ? "none" : undefined,
              marginLeft: clickable ? d.marginLeft : undefined,
            }}
          >
            {clickable ? (
              <button
                type="button"
                aria-label={`${selectLabelPrefix} ${i + 1}：${item.doc}`}
                aria-pressed={active}
                onClick={() => onSelectChunk?.(i)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: d.btnPad,
                  borderRadius: 8,
                  border: active ? "1px solid var(--color-primary)" : "1px solid var(--border-subtle)",
                  background: active ? "rgba(37, 99, 235, 0.08)" : d.btnBg,
                  cursor: "pointer",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                <ChunkBody doc={item.doc} sim={sim} text={item.text} index={i} />
              </button>
            ) : (
              <ChunkBody doc={item.doc} sim={sim} text={item.text} index={i} />
            )}
          </li>
        );
      })}
    </ListTag>
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
