import type { ChatParameter } from "../../types/chatApp";
import { patchPromptConfig, type SectionProps } from "./sectionProps";

function visibleParameters(parameters: ChatParameter[]): ChatParameter[] {
  return parameters.filter((p) => p.key.trim() !== "");
}

export function ChatAppPromptSection({ form, onChange, disabled }: SectionProps) {
  const { prompt_config } = form;
  const { parameters } = prompt_config;

  const setParameters = (next: ChatParameter[]) => {
    patchPromptConfig(onChange, { parameters: next });
  };

  const updateParameter = (index: number, patch: Partial<ChatParameter>) => {
    setParameters(parameters.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const addParameter = () => {
    setParameters([...parameters, { key: "", optional: false }]);
  };

  const displayed = visibleParameters(parameters);

  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>提示词</h2>
      <div style={{ display: "grid", gap: "0.75rem", maxWidth: 720 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="muted">
            System Prompt <code>prompt_config.system</code>
          </span>
          <textarea
            value={prompt_config.system}
            disabled={disabled}
            rows={8}
            onChange={(e) => patchPromptConfig(onChange, { system: e.target.value })}
            style={{ padding: "0.4rem", resize: "vertical", fontFamily: "monospace", fontSize: "0.88rem" }}
          />
          <span className="muted" style={{ fontSize: "0.82rem" }}>
            绑定知识库时建议包含 <code>{"{knowledge}"}</code> 占位符。
          </span>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="muted">开场白 prologue</span>
          <textarea
            value={prompt_config.prologue}
            disabled={disabled}
            rows={3}
            onChange={(e) => patchPromptConfig(onChange, { prologue: e.target.value })}
            style={{ padding: "0.4rem", resize: "vertical" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="muted">空回复 empty_response</span>
          <textarea
            value={prompt_config.empty_response}
            disabled={disabled}
            rows={3}
            onChange={(e) => patchPromptConfig(onChange, { empty_response: e.target.value })}
            style={{ padding: "0.4rem", resize: "vertical" }}
          />
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span className="muted">动态变量 parameters</span>
            <button type="button" disabled={disabled} onClick={addParameter} style={{ fontSize: "0.85rem" }}>
              添加变量
            </button>
          </div>
          {parameters.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.88rem", margin: 0 }}>
              暂无变量
            </p>
          ) : (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {parameters.map((p, index) => (
                <div
                  key={`param-${index}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: "0.5rem",
                    alignItems: "center",
                  }}
                >
                  <input
                    value={p.key}
                    disabled={disabled}
                    placeholder="变量名，如 knowledge"
                    onChange={(e) => updateParameter(index, { key: e.target.value })}
                    style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.88rem" }}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                    <input
                      type="checkbox"
                      checked={p.optional}
                      disabled={disabled}
                      onChange={(e) => updateParameter(index, { optional: e.target.checked })}
                    />
                    可选
                  </label>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => removeParameter(index)}
                    style={{ fontSize: "0.85rem" }}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}
          {displayed.length > 0 ? (
            <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>
              已配置 {displayed.length} 个变量（空 key 不会保存）
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
