import type { MetaDataFilter, MetaDataFilterManualCondition } from "../../types/chatApp";
import { patchPromptConfig, type SectionProps } from "./sectionProps";

const FILTER_METHODS = ["disabled", "auto", "manual", "semi_auto"] as const;
const MANUAL_OPS = ["=", "!=", ">", "<", "contains", "in", "not in"] as const;

export type ChatAppAdvancedSectionProps = SectionProps & {
  metadataKeys: string[];
};

function patchMetaDataFilter(
  onChange: SectionProps["onChange"],
  patch: Partial<MetaDataFilter>,
): void {
  onChange((prev) => ({
    ...prev,
    meta_data_filter: { ...prev.meta_data_filter, ...patch },
  }));
}

function crossLanguagesToText(langs: string[] | undefined): string {
  return (langs ?? []).join(", ");
}

function parseCrossLanguages(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ChatAppAdvancedSection({
  form,
  onChange,
  disabled,
  metadataKeys,
}: ChatAppAdvancedSectionProps) {
  const { prompt_config, meta_data_filter } = form;
  const rm = prompt_config.reference_metadata ?? { include: false, fields: [] };
  const selectedFields = new Set(rm.fields ?? []);
  const method = (meta_data_filter.method ?? "disabled") as (typeof FILTER_METHODS)[number];
  const manual = meta_data_filter.manual ?? [];
  const semiAuto = meta_data_filter.semi_auto ?? [];

  const setManual = (next: MetaDataFilterManualCondition[]) => {
    patchMetaDataFilter(onChange, { manual: next });
  };

  const setSemiAuto = (next: string[]) => {
    patchMetaDataFilter(onChange, { semi_auto: next });
  };

  const toggleReferenceField = (key: string, checked: boolean) => {
    const fields = new Set(rm.fields ?? []);
    if (checked) {
      fields.add(key);
    } else {
      fields.delete(key);
    }
    patchPromptConfig(onChange, {
      reference_metadata: {
        include: true,
        fields: [...fields],
      },
    });
  };

  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>高级配置</h2>
      <div style={{ display: "grid", gap: "0.85rem", maxWidth: 720 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="muted">Tavily API Key</span>
          <input
            type="password"
            autoComplete="off"
            disabled={disabled}
            value={prompt_config.tavily_api_key ?? ""}
            onChange={(e) =>
              patchPromptConfig(onChange, {
                tavily_api_key: e.target.value || undefined,
              })
            }
            placeholder="留空表示不使用 Tavily"
            style={{ padding: "0.4rem" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="muted">跨语言检索 cross_languages（逗号分隔）</span>
          <input
            type="text"
            disabled={disabled}
            value={crossLanguagesToText(prompt_config.cross_languages)}
            onChange={(e) =>
              patchPromptConfig(onChange, {
                cross_languages: parseCrossLanguages(e.target.value),
              })
            }
            placeholder="例如 Chinese, English"
            style={{ padding: "0.4rem" }}
          />
        </label>

        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: disabled ? "default" : "pointer" }}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={Boolean(rm.include)}
              onChange={(e) =>
                patchPromptConfig(onChange, {
                  reference_metadata: {
                    include: e.target.checked,
                    fields: e.target.checked ? rm.fields : undefined,
                  },
                })
              }
            />
            <span>引用元数据 reference_metadata.include</span>
          </label>
          {rm.include ? (
            <div style={{ marginTop: "0.5rem", marginLeft: "1.5rem" }}>
              {metadataKeys.length === 0 ? (
                <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                  请先绑定知识库以加载 metadata 字段列表。
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                    gap: "0.35rem",
                  }}
                >
                  {metadataKeys.map((key) => (
                    <label
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "0.88rem",
                        cursor: disabled ? "default" : "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={selectedFields.has(key)}
                        onChange={(e) => toggleReferenceField(key, e.target.checked)}
                      />
                      <span>{key}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="muted">元数据过滤 meta_data_filter.method</span>
          <select
            disabled={disabled}
            value={method}
            onChange={(e) =>
              patchMetaDataFilter(onChange, {
                method: e.target.value as MetaDataFilter["method"],
              })
            }
            style={{ padding: "0.4rem", maxWidth: 280 }}
          >
            {FILTER_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        {method === "disabled" ? (
          <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
            已关闭元数据过滤，检索时不按文档 metadata 额外筛选。
          </p>
        ) : null}

        {method === "auto" ? (
          <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
            自动模式：由检索流程根据上下文推断 metadata 过滤条件，无需在此手工配置。
          </p>
        ) : null}

        {method === "manual" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span className="muted">手工条件 manual</span>
              <button
                type="button"
                disabled={disabled}
                style={{ fontSize: "0.85rem" }}
                onClick={() =>
                  setManual([
                    ...manual,
                    { key: metadataKeys[0] ?? "", op: "=", value: "" },
                  ])
                }
              >
                添加条件
              </button>
            </div>
            {manual.length === 0 ? (
              <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                暂无条件；点「添加条件」创建。
              </p>
            ) : (
              manual.map((row, index) => (
                <div
                  key={index}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto 1fr auto",
                    gap: "0.4rem",
                    alignItems: "end",
                  }}
                >
                  <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className="muted" style={{ fontSize: "0.78rem" }}>
                      key
                    </span>
                    <select
                      disabled={disabled}
                      value={row.key}
                      onChange={(e) => {
                        const next = [...manual];
                        next[index] = { ...row, key: e.target.value };
                        setManual(next);
                      }}
                      style={{ padding: "0.35rem" }}
                    >
                      <option value="">—</option>
                      {metadataKeys.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className="muted" style={{ fontSize: "0.78rem" }}>
                      op
                    </span>
                    <select
                      disabled={disabled}
                      value={row.op}
                      onChange={(e) => {
                        const next = [...manual];
                        next[index] = { ...row, op: e.target.value };
                        setManual(next);
                      }}
                      style={{ padding: "0.35rem" }}
                    >
                      {MANUAL_OPS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 2, gridColumn: "span 2" }}>
                    <span className="muted" style={{ fontSize: "0.78rem" }}>
                      value
                    </span>
                    <input
                      type="text"
                      disabled={disabled}
                      value={typeof row.value === "string" ? row.value : String(row.value ?? "")}
                      onChange={(e) => {
                        const next = [...manual];
                        next[index] = { ...row, value: e.target.value };
                        setManual(next);
                      }}
                      style={{ padding: "0.35rem" }}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={disabled}
                    style={{ fontSize: "0.85rem", marginBottom: 2 }}
                    onClick={() => setManual(manual.filter((_, i) => i !== index))}
                  >
                    删除
                  </button>
                </div>
              ))
            )}
          </div>
        ) : null}

        {method === "semi_auto" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span className="muted">半自动字段 semi_auto（每行一个 key）</span>
              <button
                type="button"
                disabled={disabled}
                style={{ fontSize: "0.85rem" }}
                onClick={() => setSemiAuto([...semiAuto.map(String), ""])}
              >
                添加字段
              </button>
            </div>
            {semiAuto.length === 0 ? (
              <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                暂无字段；点「添加字段」创建。
              </p>
            ) : (
              semiAuto.map((item, index) => {
                const keyStr = typeof item === "string" ? item : String(item?.key ?? "");
                return (
                  <div key={index} style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    <input
                      type="text"
                      disabled={disabled}
                      value={keyStr}
                      placeholder="metadata key"
                      onChange={(e) => {
                        const next = semiAuto.map(String);
                        next[index] = e.target.value;
                        setSemiAuto(next);
                      }}
                      style={{ flex: 1, padding: "0.35rem" }}
                    />
                    <button
                      type="button"
                      disabled={disabled}
                      style={{ fontSize: "0.85rem" }}
                      onClick={() => setSemiAuto(semiAuto.map(String).filter((_, i) => i !== index))}
                    >
                      删除
                    </button>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
