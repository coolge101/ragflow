import { getAuthorizationHeader } from "../auth/session";

import { readJsonBody } from "./readJsonBody";

export type DocRow = Record<string, unknown> & {
  id?: string;
  name?: string;
  run?: string;
  chunk_count?: number;
  size?: number;
  /** 0~1 为主，失败时后端可能为 -1 */
  progress?: number;
  progress_msg?: string | null;
};

export type ListDocumentsJson = {
  code: number;
  message?: string;
  data?: { docs?: DocRow[]; total?: number };
};

export type MutationJson = {
  code: number;
  message?: string;
  data?: unknown;
};

function authOnly(): HeadersInit {
  const a = getAuthorizationHeader();
  return a ? { Authorization: a } : {};
}

/** GET /api/v1/datasets/:id/documents */
export async function listDocuments(
  datasetId: string,
  params: { page?: number; page_size?: number } = {},
): Promise<{ res: Response; body: ListDocumentsJson }> {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.page_size ?? 50));
  const res = await fetch(
    `/api/v1/datasets/${encodeURIComponent(datasetId)}/documents?${q.toString()}`,
    { headers: authOnly() },
  );
  const body = await readJsonBody<ListDocumentsJson>(res);
  return { res, body };
}

/**
 * POST /api/v1/datasets/:id/documents — multipart，字段名 `file`（可多文件）。
 * 勿手动设置 Content-Type，以便浏览器带上 boundary。
 */
export async function uploadDocuments(
  datasetId: string,
  files: File[],
): Promise<{ res: Response; body: MutationJson }> {
  const fd = new FormData();
  for (const f of files) {
    fd.append("file", f);
  }
  const res = await fetch(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents`, {
    method: "POST",
    headers: authOnly(),
    body: fd,
  });
  const body = await readJsonBody<MutationJson>(res);
  return { res, body };
}

/** `POST /api/v1/datasets/:id/documents/parse` — start chunking / embedding pipeline for given document ids. */
export async function parseDocuments(
  datasetId: string,
  documentIds: string[],
): Promise<{ res: Response; body: MutationJson }> {
  const res = await fetch(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents/parse`, {
    method: "POST",
    headers: { ...authOnly(), "Content-Type": "application/json" },
    body: JSON.stringify({ document_ids: documentIds }),
  });
  const body = await readJsonBody<MutationJson>(res);
  return { res, body };
}

/** DELETE /api/v1/datasets/:id/documents — body `{ ids: string[] }` */
export async function deleteDocuments(
  datasetId: string,
  ids: string[],
): Promise<{ res: Response; body: MutationJson }> {
  const res = await fetch(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents`, {
    method: "DELETE",
    headers: { ...authOnly(), "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const body = await readJsonBody<MutationJson>(res);
  return { res, body };
}
