import { chunkCount, splitCitationMarkers } from "../utils/citationUtils";

type Props = {
  content: string;
  reference?: unknown;
  activeCitationIndex?: number | null;
  onCitation?: (chunkIndex: number) => void;
};

export function ChatMessageContent({
  content,
  reference,
  activeCitationIndex = null,
  onCitation,
}: Props) {
  const parts = splitCitationMarkers(content);
  const total = chunkCount(reference);

  if (parts.length === 0) {
    return <>{content}</>;
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.kind === "text") {
          return (
            <span key={`t-${i}`} style={{ whiteSpace: "pre-wrap" }}>
              {part.value}
            </span>
          );
        }
        const valid = !Number.isNaN(part.chunkIndex) && part.chunkIndex >= 0 && part.chunkIndex < total;
        const active = valid && activeCitationIndex === part.chunkIndex;
        const label = Number.isNaN(part.chunkIndex) ? "?" : String(part.chunkIndex + 1);

        if (!onCitation || !valid) {
          return (
            <span
              key={`c-${i}`}
              className="muted"
              style={{ fontSize: "0.75rem", verticalAlign: "super", marginInline: 2 }}
            >
              [{label}]
            </span>
          );
        }

        return (
          <button
            key={`c-${i}`}
            type="button"
            aria-label={`引用片段 ${label}`}
            aria-pressed={active}
            onClick={() => onCitation(part.chunkIndex)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "1.5rem",
              height: "1.5rem",
              padding: "0 0.35rem",
              marginInline: 3,
              verticalAlign: "super",
              fontSize: "0.75rem",
              fontWeight: 700,
              lineHeight: 1,
              borderRadius: 999,
              border: active ? "2px solid var(--color-primary)" : "1px solid var(--border-subtle)",
              background: active ? "#eff6ff" : "#fff",
              color: active ? "var(--color-primary)" : "var(--text-muted)",
              cursor: "pointer",
              boxShadow: active ? "0 0 0 2px rgba(37, 99, 235, 0.15)" : undefined,
            }}
          >
            {label}
          </button>
        );
      })}
    </>
  );
}
