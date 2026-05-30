import { ModelIdSelect } from "../ModelIdSelect";
import { CHAT_MODEL_PRESETS } from "../../constants/modelPresets";
import type { ChatLlmSetting } from "../../types/chatApp";
import { patchLlmSetting, type SectionProps } from "./sectionProps";

const LLM_SETTING_FIELDS: { key: keyof ChatLlmSetting; label: string }[] = [
  { key: "temperature", label: "temperature" },
  { key: "top_p", label: "top_p" },
  { key: "max_tokens", label: "max_tokens" },
  { key: "frequency_penalty", label: "frequency_penalty" },
  { key: "presence_penalty", label: "presence_penalty" },
];

export function ChatAppModelSection({ form, onChange, disabled }: SectionProps) {
  const setLlmNumber = (key: keyof ChatLlmSetting, raw: string) => {
    const n = raw === "" ? undefined : Number(raw);
    patchLlmSetting(onChange, { [key]: Number.isNaN(n) ? undefined : n });
  };

  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>对话模型</h2>
      <div style={{ display: "grid", gap: "0.75rem", maxWidth: 720 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="muted">
            对话模型 <code>llm_id</code>
          </span>
          <ModelIdSelect
            modelType="chat"
            value={form.llm_id}
            onChange={(next) => onChange({ llm_id: next })}
            presets={CHAT_MODEL_PRESETS}
            disabled={disabled}
            placeholderLabel="请选择对话模型"
          />
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="muted">
            生成参数 <code>llm_setting</code>
          </span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "0.65rem",
            }}
          >
            {LLM_SETTING_FIELDS.map(({ key, label }) => (
              <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="muted" style={{ fontSize: "0.82rem" }}>
                  {label}
                </span>
                <input
                  type="number"
                  step={0.1}
                  disabled={disabled}
                  value={form.llm_setting[key] ?? ""}
                  onChange={(e) => setLlmNumber(key, e.target.value)}
                  style={{ padding: "0.4rem" }}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
