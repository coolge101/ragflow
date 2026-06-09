import { getAuthorizationHeader } from "../auth/session";

import { readJsonBody } from "./readJsonBody";

export type CrawlHealthReport = {
  proxy?: {
    http_proxy_configured?: boolean;
    https_proxy_configured?: boolean;
  };
  searxng?: {
    configured?: boolean;
    reachable?: boolean;
    base_url?: string;
    results_count?: number;
    engines_ok?: number;
    unresponsive_engines?: string[];
    engine_allowlist?: string[];
    effective_engines?: string | null;
    degraded?: boolean;
    error?: string;
  };
  tavily?: {
    configured?: boolean;
    api_key_present?: boolean;
  };
  recommended_discover_provider?: string;
  self_heal_phase?: string;
};

export type CrawlUrlHealthRow = {
  id: string;
  url: string;
  url_canonical: string;
  source: string;
  success_count: number;
  fail_count: number;
  last_outcome: string;
  health_score: number;
  auto_disabled: boolean;
  create_time?: number | null;
  update_time?: number | null;
};

export type CrawlHealLogRow = {
  id: string;
  task_id: string;
  action: string;
  before_json?: Record<string, unknown>;
  after_json?: Record<string, unknown>;
  reason?: string;
  created_by?: string;
  create_time?: number | null;
  update_time?: number | null;
};

type ApiJson<T> = {
  code: number;
  message?: string;
  data?: T;
};

type PaginatedItems<T> = {
  total: number;
  page: number;
  page_size: number;
  items: T[];
};

function authHeaders(): HeadersInit {
  const a = getAuthorizationHeader();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (a) {
    h.Authorization = a;
  }
  return h;
}

export async function getCrawlHealth(): Promise<{ res: Response; body: ApiJson<CrawlHealthReport> }> {
  const res = await fetch("/v1/tbox/crawl/health", { headers: authHeaders() });
  const body = await readJsonBody<ApiJson<CrawlHealthReport>>(res);
  return { res, body };
}

export async function listTaskUrlHealth(
  taskId: string,
  params?: { page?: number; page_size?: number },
): Promise<{ res: Response; body: ApiJson<PaginatedItems<CrawlUrlHealthRow>> }> {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("page_size", String(params?.page_size ?? 20));
  const res = await fetch(`/v1/tbox/crawl/tasks/${encodeURIComponent(taskId)}/url-health?${q}`, {
    headers: authHeaders(),
  });
  const body = await readJsonBody<ApiJson<PaginatedItems<CrawlUrlHealthRow>>>(res);
  return { res, body };
}

export async function listTaskHealLog(
  taskId: string,
  params?: { page?: number; page_size?: number },
): Promise<{ res: Response; body: ApiJson<PaginatedItems<CrawlHealLogRow>> }> {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("page_size", String(params?.page_size ?? 20));
  const res = await fetch(`/v1/tbox/crawl/tasks/${encodeURIComponent(taskId)}/heal-log?${q}`, {
    headers: authHeaders(),
  });
  const body = await readJsonBody<ApiJson<PaginatedItems<CrawlHealLogRow>>>(res);
  return { res, body };
}
