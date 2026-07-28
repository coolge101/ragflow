import type { DatasetRow } from "../../api/datasets";
import type { SectionProps } from "./sectionProps";

type Props = SectionProps & {
  datasets: DatasetRow[];
};

export function ChatAppBasicSection({ form, onChange, disabled, datasets }: Props) {
  const toggleDataset = (id: string, checked: boolean) => {
    onChange((prev) => ({
      ...prev,
      dataset_ids: checked
        ? prev.dataset_ids.includes(id)
          ? prev.dataset_ids
          : [...prev.dataset_ids, id]
        : prev.dataset_ids.filter((x) => x !== id),
    }));
  };

  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>基本信息</h2>
      <div style={{ display: "grid", gap: "0.75rem", maxWidth: 720 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="muted">
            应用名称 <span style={{ color: "#b91c1c" }}>*</span>
          </span>
          <input
            value={form.name}
            disabled={disabled}
            required
            onChange={(e) => onChange({ name: e.target.value })}
            style={{ padding: "0.4rem" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="muted">描述</span>
          <textarea
            value={form.description}
            disabled={disabled}
            rows={3}
            onChange={(e) => onChange({ description: e.target.value })}
            style={{ padding: "0.4rem", resize: "vertical" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="muted">语言 language</span>
          <select
            value={form.language}
            disabled={disabled}
            onChange={(e) =>
              onChange({ language: e.target.value === "English" ? "English" : "Chinese" })
            }
            style={{ padding: "0.4rem", maxWidth: 240 }}
          >
            <option value="Chinese">Chinese</option>
            <option value="English">English</option>
          </select>
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="muted">关联知识库 dataset_ids</span>
          {datasets.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.88rem", margin: 0 }}>
              暂无知识库，请先在「文档 / 知识库」页创建。
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "0.5rem 0.65rem",
                border: "1px solid var(--border-subtle)",
                borderRadius: 6,
                background: "#fff",
              }}
            >
              {datasets.map((d) => {
                const id = String(d.id ?? "");
                if (!id) {
                  return null;
                }
                const label = String(d.name ?? id);
                const checked = form.dataset_ids.includes(id);
                return (
                  <label
                    key={id}
                    style={{ display: "flex", alignItems: "center", gap: 8, cursor: disabled ? "default" : "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => toggleDataset(id, e.target.checked)}
                    />
                    <span>{label}</span>
                    <span className="muted" style={{ fontSize: "0.82rem" }}>
                      ({id})
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
