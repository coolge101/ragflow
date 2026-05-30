import { useCallback, useEffect, useMemo, useState } from "react";
import { flattenLlmList, listLlmModels, type FlatLlmOption } from "../api/llmModelList";

/** 下拉最后一项：手动输入完整 `模型@厂商`。 */
export const MODEL_SELECT_OTHER = "__tbox_model_other__";

type Preset = { value: string; label: string };

type Props = {
  modelType: string;
  /** 当前值：`模型@厂商` */
  value: string;
  onChange: (next: string) => void;
  presets?: Preset[];
  disabled?: boolean;
  placeholderLabel?: string;
};

function mergeOptions(api: FlatLlmOption[], presets: Preset[] | undefined): FlatLlmOption[] {
  const byVal = new Map<string, FlatLlmOption>();
  for (const p of presets ?? []) {
    if (p.value && !byVal.has(p.value)) {
      byVal.set(p.value, { value: p.value, label: p.label, available: true });
    }
  }
  for (const o of api) {
    if (!byVal.has(o.value)) {
      byVal.set(o.value, o);
    }
  }
  return Array.from(byVal.values()).sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
}

export function ModelIdSelect({
  modelType,
  value,
  onChange,
  presets,
  disabled,
  placeholderLabel = "请选择模型",
}: Props) {
  const [apiOpts, setApiOpts] = useState<FlatLlmOption[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otherMode, setOtherMode] = useState(false);
  const [otherDraft, setOtherDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { res, body } = await listLlmModels(modelType);
      if (res.status === 401 || body.code === 401) {
        setErr("未授权");
        setApiOpts([]);
        return;
      }
      if (body.code !== 0) {
        setErr(body.message || `加载模型列表失败（${body.code}）`);
        setApiOpts([]);
        return;
      }
      setApiOpts(flattenLlmList(body.data));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setApiOpts([]);
    } finally {
      setLoading(false);
    }
  }, [modelType]);

  useEffect(() => {
    void load();
  }, [load]);

  const options = useMemo(() => mergeOptions(apiOpts, presets), [apiOpts, presets]);

  const valueInList = useMemo(() => (value ? options.some((o) => o.value === value) : false), [options, value]);

  useEffect(() => {
    if (!value) {
      setOtherMode(false);
      setOtherDraft("");
      return;
    }
    if (valueInList) {
      setOtherMode(false);
      setOtherDraft("");
      return;
    }
    setOtherMode(true);
    setOtherDraft(value);
  }, [value, valueInList]);

  const selectValue = otherMode ? MODEL_SELECT_OTHER : value || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <select
          value={selectValue}
          disabled={disabled || loading}
          onChange={(e) => {
            const v = e.target.value;
            if (v === MODEL_SELECT_OTHER) {
              setOtherMode(true);
              const inList = options.some((o) => o.value === value);
              const seed = value && !inList ? value : "";
              setOtherDraft(seed);
              onChange(seed.trim());
              return;
            }
            setOtherMode(false);
            setOtherDraft("");
            onChange(v);
          }}
          style={{ minWidth: 280, flex: "1 1 220px", padding: "0.4rem" }}
        >
          <option value="">{loading ? "加载模型列表…" : placeholderLabel}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.available === false}>
              {o.label}
            </option>
          ))}
          <option value={MODEL_SELECT_OTHER}>其他（手动输入 模型@厂商）</option>
        </select>
        <button type="button" disabled={disabled || loading} onClick={() => void load()} style={{ fontSize: "0.85rem" }}>
          刷新列表
        </button>
      </div>
      {otherMode ? (
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="muted" style={{ fontSize: "0.82rem" }}>
            手动输入完整 ID（<code>模型名@厂商</code>，与后端约定一致；含 DeepSeek、智谱、SiliconFlow 等）
          </span>
          <input
            value={otherDraft}
            disabled={disabled}
            onChange={(e) => {
              const t = e.target.value;
              setOtherDraft(t);
              onChange(t.trim());
            }}
            placeholder="例如 deepseek-v4-flash@DeepSeek"
            style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.88rem" }}
          />
        </label>
      ) : null}
      {err ? <span style={{ color: "#b91c1c", fontSize: "0.82rem" }}>{err}</span> : null}
    </div>
  );
}
