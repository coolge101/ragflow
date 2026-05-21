import { getAuthorizationHeader } from "../auth/session";

import { readJsonBody } from "./readJsonBody";

export type LlmFactoryRow = {
  name?: string;
  model_types?: string[];
  [key: string]: unknown;
};

export type LlmFactoriesJson = {
  code: number;
  message?: string;
  data?: LlmFactoryRow[];
};

export type LlmMutationJson = {
  code: number;
  message?: string;
  data?: unknown;
};

function authHeaders(): HeadersInit {
  const a = getAuthorizationHeader();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (a) {
    h.Authorization = a;
  }
  return h;
}

/** `GET /v1/llm/factories` — 允许接入的模型厂商列表。 */
export async function listLlmFactories(): Promise<{ res: Response; body: LlmFactoriesJson }> {
  const res = await fetch("/v1/llm/factories", { headers: authHeaders() });
  const body = await readJsonBody<LlmFactoriesJson>(res);
  return { res, body };
}

/**
 * `POST /v1/llm/set_api_key` — 为某厂商下已声明的模型写入租户级 API Key（服务端会试连 embedding/chat 等）。
 * 典型 body: `{ "llm_factory": "OpenAI", "api_key": "sk-...", "base_url": "" }`
 */
export async function setLlmApiKey(body: {
  llm_factory: string;
  api_key: string;
  base_url?: string;
}): Promise<{ res: Response; body: LlmMutationJson }> {
  const res = await fetch("/v1/llm/set_api_key", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      llm_factory: body.llm_factory,
      api_key: body.api_key,
      base_url: body.base_url ?? "",
    }),
  });
  const out = await readJsonBody<LlmMutationJson>(res);
  return { res, body: out };
}
