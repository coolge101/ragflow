import { getAuthorizationHeader } from "../auth/session";

import { readJsonBody } from "./readJsonBody";

export type DatasetRow = Record<string, unknown> & {
  id?: string;
  name?: string;
};

/** Single-dataset detail from `GET /api/v1/datasets/:id` (keys after server remap). */
export type DatasetDetail = Record<string, unknown> & {
  id?: string;
  name?: string;
  description?: string | null;
  embedding_model?: string | null;
  chunk_method?: string | null;
  parser_config?: Record<string, unknown> | null;
  permission?: string | null;
  chunk_count?: number;
  document_count?: number;
};

export type ListDatasetsJson = {
  code: number;
  message?: string;
  data?: DatasetRow[];
  /** RAGFlow `GET /api/v1/datasets` pagination total (see `get_result`). */
  total_datasets?: number;
  total?: number;
};

/** Total row count from list datasets response (`total_datasets` is canonical on RAGFlow REST). */
export function datasetsListTotal(body: ListDatasetsJson): number {
  if (typeof body.total_datasets === "number") {
    return body.total_datasets;
  }
  if (typeof body.total === "number") {
    return body.total;
  }
  return Array.isArray(body.data) ? body.data.length : 0;
}

export type GetDatasetJson = {
  code: number;
  message?: string;
  data?: DatasetDetail;
};

export type UpdateDatasetJson = {
  code: number;
  message?: string;
  data?: DatasetDetail;
};

export type CreateDatasetJson = {
  code: number;
  message?: string;
  data?: DatasetDetail;
};

/** Body keys align with `POST /api/v1/datasets` (CreateDatasetReq public names). */
export type CreateDatasetInput = {
  name: string;
  description?: string;
  permission?: "me" | "team";
  /** Maps to server `parser_id`; default in UI is `naive`. */
  chunk_method?: string;
  embedding_model?: string | null;
};

function authHeaders(): HeadersInit {
  const a = getAuthorizationHeader();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (a) {
    h.Authorization = a;
  }
  return h;
}

export async function listDatasets(params: {
  page?: number;
  page_size?: number;
}): Promise<{ res: Response; body: ListDatasetsJson }> {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.page_size ?? 30));
  const res = await fetch(`/api/v1/datasets?${q.toString()}`, {
    headers: authHeaders(),
  });
  const body = await readJsonBody<ListDatasetsJson>(res);
  return { res, body };
}

export async function createDataset(
  input: CreateDatasetInput,
): Promise<{ res: Response; body: CreateDatasetJson }> {
  const payload: Record<string, unknown> = { name: input.name.trim() };
  if (input.description != null && input.description !== "") {
    payload.description = input.description;
  }
  if (input.permission) {
    payload.permission = input.permission;
  }
  if (input.chunk_method) {
    payload.chunk_method = input.chunk_method;
  }
  if (input.embedding_model != null && input.embedding_model !== "") {
    payload.embedding_model = input.embedding_model;
  }
  const res = await fetch("/api/v1/datasets", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await readJsonBody<CreateDatasetJson>(res);
  return { res, body };
}

export async function deleteDatasets(ids: string[]): Promise<{ res: Response; body: ListDatasetsJson }> {
  const res = await fetch("/api/v1/datasets", {
    method: "DELETE",
    headers: authHeaders(),
    body: JSON.stringify({ ids }),
  });
  const body = await readJsonBody<ListDatasetsJson>(res);
  return { res, body };
}

export async function getDataset(datasetId: string): Promise<{ res: Response; body: GetDatasetJson }> {
  const res = await fetch(`/api/v1/datasets/${encodeURIComponent(datasetId)}`, {
    headers: authHeaders(),
  });
  const body = await readJsonBody<GetDatasetJson>(res);
  return { res, body };
}

/** `PUT /api/v1/datasets/:id` — body uses public names (`embedding_model`, `chunk_method`, …). */
export async function updateDataset(
  datasetId: string,
  body: Record<string, unknown>,
): Promise<{ res: Response; body: UpdateDatasetJson }> {
  const res = await fetch(`/api/v1/datasets/${encodeURIComponent(datasetId)}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const out = await readJsonBody<UpdateDatasetJson>(res);
  return { res, body: out };
}
