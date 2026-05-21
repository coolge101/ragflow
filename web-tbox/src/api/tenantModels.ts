import { getAuthorizationHeader } from "../auth/session";

import { readJsonBody } from "./readJsonBody";

export type TenantModelsInfo = {
  tenant_id?: string;
  name?: string;
  role?: string;
  llm_id?: string;
  embd_id?: string;
  asr_id?: string;
  img2txt_id?: string;
  rerank_id?: string;
  tts_id?: string;
  parser_ids?: string;
};

export type TenantModelsJson = {
  code: number;
  message?: string;
  data?: TenantModelsInfo;
};

function authHeaders(): HeadersInit {
  const a = getAuthorizationHeader();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (a) {
    h.Authorization = a;
  }
  return h;
}

/** `GET /api/v1/users/me/models` — owner 空间默认模型 ID（含 embd_id）。 */
export async function getTenantModels(): Promise<{ res: Response; body: TenantModelsJson }> {
  const res = await fetch("/api/v1/users/me/models", { headers: authHeaders() });
  const body = await readJsonBody<TenantModelsJson>(res);
  return { res, body };
}

/**
 * `PATCH /api/v1/users/me/models` — 后端要求 body 含 tenant_id、llm_id、embd_id、asr_id、img2txt_id。
 * 其它键可一并传入（如 rerank_id、tts_id）由服务端处理。
 */
export type PatchTenantModelsJson = {
  code: number;
  message?: string;
  data?: unknown;
};

export async function patchTenantModels(payload: Record<string, unknown>): Promise<{ res: Response; body: PatchTenantModelsJson }> {
  const res = await fetch("/api/v1/users/me/models", {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await readJsonBody<PatchTenantModelsJson>(res);
  return { res, body };
}
