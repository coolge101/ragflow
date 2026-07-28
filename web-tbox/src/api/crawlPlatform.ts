import { getAuthorizationHeader } from "../auth/session";

import { readJsonBody } from "./readJsonBody";

export type PlatformTaskRow = {
  domain: string;
  label: string;
  enabled: boolean;
  active_sources: number;
  discovered_sources: number;
  ingested_docs: number;
  quarantine_docs: number;
  last_run_status?: string | null;
  last_run_at?: string | null;
  last_doc_at?: string | null;
};

export type PlatformOverview = {
  available?: boolean;
  error?: string;
  postgres_ok?: boolean;
  tasks: PlatformTaskRow[];
  engine: {
    new_engine_enabled?: boolean;
    domain_expansion_enabled?: boolean;
    load_db_frontier_enabled?: boolean;
    render_hub_fallback_enabled?: boolean;
    min_topic_score?: number;
    min_substance_score?: number;
    min_content_length?: number;
  };
  frontier: {
    lookback_days?: number;
    total_sources?: number;
    active_sources?: number;
    discovered_sources?: number;
    discovered_recent?: number;
    new_seeds_recent?: number;
    docs_ingested_recent?: number;
    by_domain?: Array<{ domain: string; active: number; discovered: number }>;
    recent_discovered?: Array<{
      domain: string;
      url: string;
      topic_score?: string;
      created_at?: string | null;
    }>;
  };
};

export type PlatformJson<T = unknown> = {
  code: number;
  message?: string;
  data?: T;
};

function authHeaders(): HeadersInit {
  const a = getAuthorizationHeader();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (a) {
    h.Authorization = a;
  }
  return h;
}

export async function fetchPlatformOverview(lookbackDays = 7): Promise<{
  res: Response;
  body: PlatformJson<PlatformOverview>;
}> {
  const q = new URLSearchParams({ lookback_days: String(lookbackDays) });
  const res = await fetch(`/v1/tbox/crawl/platform/overview?${q.toString()}`, {
    headers: authHeaders(),
  });
  const body = (await readJsonBody(res)) as PlatformJson<PlatformOverview>;
  return { res, body };
}

export async function togglePlatformDomain(
  domain: string,
  enabled: boolean,
): Promise<{ res: Response; body: PlatformJson<{ domain: string; enabled: boolean }> }> {
  const res = await fetch(`/v1/tbox/crawl/platform/tasks/${encodeURIComponent(domain)}/toggle`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ enabled }),
  });
  const body = (await readJsonBody(res)) as PlatformJson<{ domain: string; enabled: boolean }>;
  return { res, body };
}

export async function triggerPlatformCrawl(
  domain: string,
): Promise<{ res: Response; body: PlatformJson<{ started: boolean; domain: string; pid: number }> }> {
  const res = await fetch("/v1/tbox/crawl/platform/crawl", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ domain }),
  });
  const body = (await readJsonBody(res)) as PlatformJson<{
    started: boolean;
    domain: string;
    pid: number;
  }>;
  return { res, body };
}

export async function triggerPlatformExpandFrontier(): Promise<{
  res: Response;
  body: PlatformJson<{ started: boolean; pid: number }>;
}> {
  const res = await fetch("/v1/tbox/crawl/platform/expand-frontier", {
    method: "POST",
    headers: authHeaders(),
  });
  const body = (await readJsonBody(res)) as PlatformJson<{ started: boolean; pid: number }>;
  return { res, body };
}

export type PlatformDocumentRow = {
  id: string;
  title: string;
  source_url: string;
  status: string;
  category_hint?: string;
  quality_score?: number | null;
  quality_issues?: string[];
  substance_score?: number | null;
  topic_score?: number | null;
  source_channel?: string;
  fetched_at?: string | null;
};

export type PlatformDocumentsPayload = {
  available?: boolean;
  error?: string;
  postgres_ok?: boolean;
  total: number;
  items: PlatformDocumentRow[];
};

export type DiscoveryQueryRow = {
  id: string;
  domain: string;
  query_text: string;
  origin: string;
  status: string;
  score: number;
  stats_json?: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
  pass_rate?: number | null;
  ingested?: number | null;
};

export type DiscoveryRecentRow = {
  url: string;
  title?: string | null;
  query_text?: string | null;
  provider?: string | null;
  doc_status?: string | null;
};

export type DiscoveryContribution = {
  ready?: number;
  quarantine?: number;
  ingested?: number;
};

export type DiscoveryOverview = {
  available?: boolean;
  error?: string;
  by_provider: Record<string, number>;
  registered: number;
  search_contribution: DiscoveryContribution;
  seed_contribution: DiscoveryContribution;
  queries: DiscoveryQueryRow[];
  recent: DiscoveryRecentRow[];
};

export async function fetchDiscoveryOverview(lookbackDays = 7): Promise<{
  res: Response;
  body: PlatformJson<DiscoveryOverview>;
}> {
  const q = new URLSearchParams({ lookback_days: String(lookbackDays) });
  const res = await fetch(`/v1/tbox/crawl/platform/discovery/overview?${q.toString()}`, {
    headers: authHeaders(),
  });
  const body = (await readJsonBody(res)) as PlatformJson<DiscoveryOverview>;
  return { res, body };
}

export async function triggerDiscoveryRun(domains = "TD,RS"): Promise<{
  res: Response;
  body: PlatformJson<{ started: boolean; domains: string; pid: number }>;
}> {
  const res = await fetch("/v1/tbox/crawl/platform/discovery/run", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ domains }),
  });
  const body = (await readJsonBody(res)) as PlatformJson<{
    started: boolean;
    domains: string;
    pid: number;
  }>;
  return { res, body };
}

export async function setDiscoveryQueryStatus(
  queryId: string,
  status: string,
): Promise<{ res: Response; body: PlatformJson<{ query_id: string; status: string }> }> {
  const res = await fetch(`/v1/tbox/crawl/platform/discovery/queries/${encodeURIComponent(queryId)}/status`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  const body = (await readJsonBody(res)) as PlatformJson<{ query_id: string; status: string }>;
  return { res, body };
}

export async function listPlatformDocuments(params?: {
  status?: string;
  domain?: string;
  limit?: number;
  offset?: number;
}): Promise<{ res: Response; body: PlatformJson<PlatformDocumentsPayload> }> {
  const q = new URLSearchParams();
  if (params?.status) {
    q.set("status", params.status);
  }
  if (params?.domain) {
    q.set("domain", params.domain);
  }
  q.set("limit", String(params?.limit ?? 50));
  q.set("offset", String(params?.offset ?? 0));
  const res = await fetch(`/v1/tbox/crawl/platform/documents?${q.toString()}`, {
    headers: authHeaders(),
  });
  const body = (await readJsonBody(res)) as PlatformJson<PlatformDocumentsPayload>;
  return { res, body };
}
