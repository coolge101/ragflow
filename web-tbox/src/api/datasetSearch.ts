import { getAuthorizationHeader } from "../auth/session";

import { readJsonBody } from "./readJsonBody";

export type ChunkRow = Record<string, unknown>;

export type DatasetSearchJson = {
  code: number;
  message?: string;
  data?: {
    chunks?: ChunkRow[];
    total?: number;
    labels?: unknown[];
  };
};

function authHeaders(): HeadersInit {
  const a = getAuthorizationHeader();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (a) {
    h.Authorization = a;
  }
  return h;
}

/** POST /api/v1/datasets/:id/search — 知识库内检索试用 */
export async function searchDataset(
  datasetId: string,
  payload: { question: string; top_k?: number; page?: number; size?: number; keyword?: boolean },
): Promise<{ res: Response; body: DatasetSearchJson }> {
  const res = await fetch(`/api/v1/datasets/${encodeURIComponent(datasetId)}/search`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      top_k: 8,
      page: 1,
      size: 10,
      keyword: false,
      ...payload,
    }),
  });
  const body = await readJsonBody<DatasetSearchJson>(res);
  return { res, body };
}
