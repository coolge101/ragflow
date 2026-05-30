import { ModelIdSelect } from "../ModelIdSelect";
import type { SectionProps } from "./sectionProps";

export function ChatAppRetrievalSection({ form, onChange, disabled }: SectionProps) {
  const setNumber = (key: "top_n" | "top_k", raw: string) => {
    const n = raw === "" ? 0 : Number(raw);
    onChange({ [key]: Number.isNaN(n) ? 0 : n });
  };

  const setRange = (key: "similarity_threshold" | "vector_similarity_weight", raw: string) => {
    const n = raw === "" ? 0 : Number(raw);
    onChange({ [key]: Number.isNaN(n) ? 0 : n });
  };

  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>检索参数</h2>
      <div style={{ display: "grid", gap: "0.75rem", maxWidth: 720 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "0.65rem",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="muted">top_n</span>
            <input
              type="number"
              min={1}
              step={1}
              disabled={disabled}
              value={form.top_n}
              onChange={(e) => setNumber("top_n", e.target.value)}
              style={{ padding: "0.4rem" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="muted">top_k</span>
            <input
              type="number"
              min={1}
              step={1}
              disabled={disabled}
              value={form.top_k}
              onChange={(e) => setNumber("top_k", e.target.value)}
              style={{ padding: "0.4rem" }}
            />
          </label>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "0.65rem",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="muted">similarity_threshold（0–1）</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              disabled={disabled}
              value={form.similarity_threshold}
              onChange={(e) => setRange("similarity_threshold", e.target.value)}
              style={{ padding: "0.4rem" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="muted">vector_similarity_weight（0–1）</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              disabled={disabled}
              value={form.vector_similarity_weight}
              onChange={(e) => setRange("vector_similarity_weight", e.target.value)}
              style={{ padding: "0.4rem" }}
            />
          </label>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="muted">重排模型 rerank</span>
          <ModelIdSelect
            modelType="rerank"
            value={form.rerank_id}
            onChange={(next) => onChange({ rerank_id: next })}
            disabled={disabled}
            placeholderLabel="不使用 rerank（留空）"
          />
          <span className="muted" style={{ fontSize: "0.82rem" }}>
            留空表示不使用 rerank
          </span>
        </label>
      </div>
    </section>
  );
}
