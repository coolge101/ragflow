import { getAuthorizationHeader } from "../auth/session";

import { readJsonBody } from "./readJsonBody";

export type CrawlTaskRow = {
  id: string;
  tenant_id: string;
  dataset_id?: string | null;
  name: string;
  source_type: string;
  seed_urls: string[];
  schedule_cron: string;
  enabled: boolean;
  run_state: string;
  last_run_at?: string | null;
  last_error?: string;
  extra_config?: Record<string, unknown>;
  created_by?: string;
  create_time?: number | null;
  update_time?: number | null;
  status?: string;
};

export type ListCrawlTasksJson = {
  code: number;
  message?: string;
  data?: {
    total: number;
    page: number;
    page_size: number;
    items: CrawlTaskRow[];
  };
};

export type CrawlTaskMutationJson = {
  code: number;
  message?: string;
  data?: CrawlTaskRow;
};

function authHeaders(): HeadersInit {
  const a = getAuthorizationHeader();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (a) {
    h.Authorization = a;
  }
  return h;
}

export async function listCrawlTasks(params: {
  page?: number;
  page_size?: number;
  tenant_id?: string;
  dataset_id?: string;
}): Promise<{ res: Response; body: ListCrawlTasksJson }> {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.page_size ?? 20));
  if (params.tenant_id) {
    q.set("tenant_id", params.tenant_id);
  }
  if (params.dataset_id) {
    q.set("dataset_id", params.dataset_id);
  }
  const res = await fetch(`/v1/tbox/crawl/tasks?${q.toString()}`, {
    headers: authHeaders(),
  });
  const body = await readJsonBody<ListCrawlTasksJson>(res);
  return { res, body };
}

export async function createCrawlTask(payload: {
  tenant_id?: string;
  name: string;
  seed_urls: string[];
  source_type?: string;
  run_state?: string;
  schedule_cron?: string;
  enabled?: boolean;
  extra_config?: Record<string, unknown>;
  dataset_id?: string | null;
}): Promise<{ res: Response; body: CrawlTaskMutationJson }> {
  const res = await fetch("/v1/tbox/crawl/tasks", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await readJsonBody<CrawlTaskMutationJson>(res);
  return { res, body };
}

export async function patchCrawlTask(
  taskId: string,
  payload: Record<string, unknown>,
): Promise<{ res: Response; body: CrawlTaskMutationJson }> {
  const res = await fetch(`/v1/tbox/crawl/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await readJsonBody<CrawlTaskMutationJson>(res);
  return { res, body };
}

export async function deleteCrawlTask(taskId: string): Promise<{ res: Response; body: { code: number; message?: string } }> {
  const res = await fetch(`/v1/tbox/crawl/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const body = await readJsonBody<{ code: number; message?: string }>(res);
  return { res, body };
}

/** Manual stub run (same as worker tick): updates last_run_at / last_error. */
export async function runCrawlTask(taskId: string): Promise<{ res: Response; body: CrawlTaskMutationJson }> {
  const res = await fetch(`/v1/tbox/crawl/tasks/${encodeURIComponent(taskId)}/run`, {
    method: "POST",
    headers: authHeaders(),
  });
  const body = await readJsonBody<CrawlTaskMutationJson>(res);
  return { res, body };
}
