import type { ChatPromptConfig } from "../../types/chatApp";
import { patchPromptConfig, type SectionProps } from "./sectionProps";

const SWITCH_FIELDS: { key: keyof Pick<
  ChatPromptConfig,
  "quote" | "keyword" | "tts" | "refine_multiturn" | "use_kg" | "reasoning" | "toc_enhance"
>; label: string }[] = [
  { key: "quote", label: "引用来源 quote" },
  { key: "keyword", label: "关键词 keyword" },
  { key: "tts", label: "语音合成 tts" },
  { key: "refine_multiturn", label: "多轮优化 refine_multiturn" },
  { key: "use_kg", label: "知识图谱 use_kg" },
  { key: "reasoning", label: "推理 reasoning" },
  { key: "toc_enhance", label: "目录增强 toc_enhance" },
];

export function ChatAppSwitchesSection({ form, onChange, disabled }: SectionProps) {
  const { prompt_config } = form;

  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>功能开关</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "0.5rem",
          maxWidth: 720,
        }}
      >
        {SWITCH_FIELDS.map(({ key, label }) => (
          <label
            key={key}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem", cursor: disabled ? "default" : "pointer" }}
          >
            <input
              type="checkbox"
              checked={Boolean(prompt_config[key])}
              disabled={disabled}
              onChange={(e) => patchPromptConfig(onChange, { [key]: e.target.checked })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
