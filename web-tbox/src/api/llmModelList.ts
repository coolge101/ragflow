import { getAuthorizationHeader } from "../auth/session";

import { readJsonBody } from "./readJsonBody";

export type LlmListItem = {
  llm_name?: string;
  fid?: string;
  model_type?: string;
  available?: boolean;
  id?: string | null;
};

/** `GET /v1/llm/list` — 按厂商分组的模型；`model_type` 传 `embedding` / `chat` 等与后端 LLMType 一致。 */
export type LlmListJson = {
  code: number;
  message?: string;
  data?: Record<string, LlmListItem[]>;
};

function authHeaders(): HeadersInit {
  const a = getAuthorizationHeader();
  const h: Record<string, string> = {};
  if (a) {
    h.Authorization = a;
  }
  return h;
}

export async function listLlmModels(modelType: string): Promise<{ res: Response; body: LlmListJson }> {
  const q = new URLSearchParams();
  q.set("model_type", modelType);
  const res = await fetch(`/v1/llm/list?${q.toString()}`, { headers: authHeaders() });
  const body = await readJsonBody<LlmListJson>(res);
  return { res, body };
}

export type FlatLlmOption = {
  value: string;
  label: string;
  available: boolean;
};

/** 将 `/v1/llm/list` 的 data 展平为 `模型名@厂商` 选项（与 RAGFlow 约定一致）。 */
export function flattenLlmList(data: Record<string, LlmListItem[]> | undefined): FlatLlmOption[] {
  if (!data || typeof data !== "object") {
    return [];
  }
  const out: FlatLlmOption[] = [];
  for (const [factoryKey, items] of Object.entries(data)) {
    if (!Array.isArray(items)) {
      continue;
    }
    for (const m of items) {
      const name = m.llm_name != null ? String(m.llm_name).trim() : "";
      const fid = m.fid != null ? String(m.fid).trim() : factoryKey;
      if (!name) {
        continue;
      }
      const value = `${name}@${fid}`;
      out.push({
        value,
        label: `${name} @ ${fid}${m.available === false ? "（未配置 Key）" : ""}`,
        available: m.available !== false,
      });
    }
  }
  const seen = new Set<string>();
  return out.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
}
