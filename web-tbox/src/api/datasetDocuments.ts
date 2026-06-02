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

/** List all documents (paginated server-side). */
export async function listAllDocuments(
  datasetId: string,
  pageSize = 100,
): Promise<{ docs: DocRow[]; error?: string }> {
  const all: DocRow[] = [];
  let page = 1;
  let total = 0;
  for (;;) {
    const { res, body } = await listDocuments(datasetId, { page, page_size: pageSize });
    if (res.status === 401 || body.code === 401) {
      return { docs: [], error: "未授权" };
    }
    if (body.code !== 0) {
      return { docs: [], error: body.message || `错误码 ${body.code}` };
    }
    const batch = Array.isArray(body.data?.docs) ? body.data.docs : [];
    total = typeof body.data?.total === "number" ? body.data.total : batch.length;
    all.push(...batch);
    if (all.length >= total || batch.length === 0) {
      break;
    }
    page += 1;
    if (page > 500) {
      return { docs: all, error: "文档数量过多，已截断分页" };
    }
  }
  return { docs: all };
}

/** GET /v1/document/get/:docId — original bytes (legacy path; prefer preview API). */
export async function downloadDocumentBlob(docId: string): Promise<{ blob: Blob | null; error?: string }> {
  const res = await fetch(`/api/v1/documents/${encodeURIComponent(docId)}/preview`, { headers: authOnly() });
  if (res.status === 401) {
    return { blob: null, error: "未授权" };
  }
  if (!res.ok) {
    return { blob: null, error: `下载失败 HTTP ${res.status}` };
  }
  const blob = await res.blob();
  return { blob };
}

/**
 * POST /api/v1/documents/ingest — re-run parsing (official UI path).
 * `run=1` (RUNNING); `delete=true` clears existing chunks before re-index.
 */
export async function reparseDocuments(
  documentIds: string[],
  options?: { delete?: boolean; applyKb?: boolean },
): Promise<{ res: Response; body: MutationJson }> {
  const res = await fetch("/api/v1/documents/ingest", {
    method: "POST",
    headers: { ...authOnly(), "Content-Type": "application/json" },
    body: JSON.stringify({
      doc_ids: documentIds,
      run: 1,
      delete: options?.delete ?? true,
      apply_kb: options?.applyKb ?? false,
    }),
  });
  const body = await readJsonBody<MutationJson>(res);
  return { res, body };
}
