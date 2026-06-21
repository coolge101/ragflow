import { useEffect, useRef } from "react";
import type { ChunkDisplayItem } from "../utils/chunkDisplay";
import { formatSimilarityPercent, splitHighlightSegments } from "../utils/chunkDisplay";

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
  highlightQuery?: string;
};

const DENSITY = {
  compact: { gap: "0.65rem", btnPad: "0.55rem 0.65rem", btnBg: "#fafafa", marginLeft: "-1rem" },
  comfortable: { gap: "0.75rem", btnPad: "0.85rem 1rem", btnBg: "#fff", marginLeft: undefined as string | undefined },
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
  highlightQuery = "",
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
        const pct = formatSimilarityPercent(item.similarity);
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
                  borderLeft: active ? "3px solid var(--color-primary)" : "1px solid var(--border-subtle)",
                  background: active ? "#eff6ff" : d.btnBg,
                  cursor: "pointer",
                  wordBreak: "break-word",
                }}
              >
                <ChunkBody
                  doc={item.doc}
                  pct={pct}
                  text={item.text}
                  index={i}
                  highlightQuery={highlightQuery}
                  snippetLines={density === "comfortable" ? 4 : 2}
                />
              </button>
            ) : (
              <ChunkBody
                doc={item.doc}
                pct={pct}
                text={item.text}
                index={i}
                highlightQuery={highlightQuery}
                snippetLines={density === "comfortable" ? 4 : 2}
              />
            )}
          </li>
        );
      })}
    </ListTag>
  );
}

function ChunkBody({
  doc,
  pct,
  text,
  index,
  highlightQuery,
  snippetLines,
}: {
  doc: string;
  pct: string | null;
  text: string;
  index: number;
  highlightQuery: string;
  snippetLines: number;
}) {
  const segments = splitHighlightSegments(text.slice(0, 1200), highlightQuery);

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
          minWidth: 0,
        }}
      >
        <span className="muted" style={{ fontWeight: 500, flexShrink: 0 }}>
          {index + 1}.
        </span>
        <span
          style={{
            fontWeight: 600,
            color: "var(--color-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
          title={doc}
        >
          {doc}
        </span>
        {pct ? (
          <span
            style={{
              flexShrink: 0,
              fontSize: "0.72rem",
              fontWeight: 600,
              padding: "0.1rem 0.45rem",
              borderRadius: 999,
              background: "#e0e7ff",
              color: "#3730a3",
            }}
          >
            {pct}
          </span>
        ) : null}
      </div>
      <div
        className="muted"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: snippetLines,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          wordBreak: "break-word",
        }}
      >
        {segments.map((seg, si) =>
          seg.kind === "mark" ? (
            <mark
              key={si}
              style={{ background: "#fef08a", color: "inherit", padding: "0 0.1em", borderRadius: 2 }}
            >
              {seg.value}
            </mark>
          ) : (
            <span key={si}>{seg.value}</span>
          ),
        )}
        {text.length > 1200 ? "…" : ""}
      </div>
    </>
  );
}
