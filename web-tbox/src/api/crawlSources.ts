import { getAuthorizationHeader } from "../auth/session";
import { readJsonBody } from "./readJsonBody";

export type CrawlSourceRow = {
  id: string;
  tenant_id: string;
  topic: string;
  label: string;
  url: string;
  domain: string;
  enabled: boolean;
  created_by?: string;
  create_time?: number | null;
  update_time?: number | null;
};

export type CrawlSourceListJson = {
  code: number;
  message?: string;
  data?: {
    total: number;
    page: number;
    page_size: number;
    items: CrawlSourceRow[];
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

export async function listCrawlSources(params: {
  tenant_id?: string;
  topic?: string;
  page?: number;
  page_size?: number;
}): Promise<{ res: Response; body: CrawlSourceListJson }> {
  const q = new URLSearchParams();
  if (params.tenant_id) {
    q.set("tenant_id", params.tenant_id);
  }
  if (params.topic) {
    q.set("topic", params.topic);
  }
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.page_size ?? 50));
  const res = await fetch(`/v1/tbox/crawl/sources?${q.toString()}`, { headers: authHeaders() });
  const body = await readJsonBody<CrawlSourceListJson>(res);
  return { res, body };
}

export async function createCrawlSource(payload: {
  tenant_id?: string;
  topic: string;
  label: string;
  url: string;
  enabled?: boolean;
}): Promise<{ res: Response; body: CrawlSourceListJson }> {
  const res = await fetch("/v1/tbox/crawl/sources", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await readJsonBody<CrawlSourceListJson>(res);
  return { res, body };
}

export async function deleteCrawlSource(sourceId: string): Promise<{ res: Response; body: CrawlSourceListJson }> {
  const res = await fetch(`/v1/tbox/crawl/sources/${encodeURIComponent(sourceId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const body = await readJsonBody<CrawlSourceListJson>(res);
  return { res, body };
}

export async function importSourcesToTask(
  taskId: string,
  payload: { topic: string; replace?: boolean },
): Promise<{ res: Response; body: { code: number; message?: string; data?: unknown } }> {
  const res = await fetch(`/v1/tbox/crawl/tasks/${encodeURIComponent(taskId)}/import-sources`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await readJsonBody<{ code: number; message?: string; data?: unknown }>(res);
  return { res, body };
}
