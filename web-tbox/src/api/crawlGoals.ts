import { getAuthorizationHeader } from "../auth/session";
import { readJsonBody } from "./readJsonBody";

function authHeaders(): HeadersInit {
  const a = getAuthorizationHeader();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (a) {
    h.Authorization = a;
  }
  return h;
}

type PlatformJson<T> = {
  code: number;
  message?: string;
  data?: T;
};

export type GoalCard = {
  domain: string;
  title: string;
  must_have_facets: string[];
  nice_to_have_facets?: string[];
  search_queries: string[];
  preferred_source_types?: string[];
  host_allow_hints?: string[];
  success_criteria?: string;
  legal_constraints?: string;
  parser?: string;
  nl_text?: string;
  status?: string;
  goal_id?: string;
};

export type GoalRow = {
  id: string;
  domain: string;
  title: string;
  status: string;
  nl_text: string;
  card_json: GoalCard;
  created_at?: string;
};

export type GoalRunRow = {
  id: string;
  goal_id: string;
  status: string;
  report_json: Record<string, unknown>;
  created_at?: string;
  finished_at?: string | null;
};

export async function planCrawlGoal(payload: {
  text: string;
  domain?: string;
  confirm?: boolean;
}): Promise<{ res: Response; body: PlatformJson<GoalCard> }> {
  const res = await fetch("/v1/tbox/crawl/platform/goals/plan", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = (await readJsonBody(res)) as PlatformJson<GoalCard>;
  return { res, body };
}

export async function listCrawlGoals(params?: {
  domain?: string;
  limit?: number;
}): Promise<{ res: Response; body: PlatformJson<{ items: GoalRow[]; total: number }> }> {
  const q = new URLSearchParams();
  if (params?.domain) q.set("domain", params.domain);
  q.set("limit", String(params?.limit ?? 50));
  const res = await fetch(`/v1/tbox/crawl/platform/goals?${q}`, { headers: authHeaders() });
  const body = (await readJsonBody(res)) as PlatformJson<{ items: GoalRow[]; total: number }>;
  return { res, body };
}

export async function confirmCrawlGoal(
  goalId: string,
): Promise<{ res: Response; body: PlatformJson<{ confirmed: boolean; goal: GoalRow }> }> {
  const res = await fetch(`/v1/tbox/crawl/platform/goals/${encodeURIComponent(goalId)}/confirm`, {
    method: "POST",
    headers: authHeaders(),
    body: "{}",
  });
  const body = (await readJsonBody(res)) as PlatformJson<{ confirmed: boolean; goal: GoalRow }>;
  return { res, body };
}

export async function triggerGoalOptimize(
  goalId: string,
  opts?: { dry_run?: boolean },
): Promise<{
  res: Response;
  body: PlatformJson<{ started: boolean; goal_id: string; pid: number; dry_run: boolean }>;
}> {
  const res = await fetch(`/v1/tbox/crawl/platform/goals/${encodeURIComponent(goalId)}/optimize`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ dry_run: Boolean(opts?.dry_run) }),
  });
  const body = (await readJsonBody(res)) as PlatformJson<{
    started: boolean;
    goal_id: string;
    pid: number;
    dry_run: boolean;
  }>;
  return { res, body };
}

export async function listGoalRuns(
  goalId: string,
  limit = 20,
): Promise<{ res: Response; body: PlatformJson<{ items: GoalRunRow[]; total: number }> }> {
  const q = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(
    `/v1/tbox/crawl/platform/goals/${encodeURIComponent(goalId)}/runs?${q}`,
    { headers: authHeaders() },
  );
  const body = (await readJsonBody(res)) as PlatformJson<{ items: GoalRunRow[]; total: number }>;
  return { res, body };
}
