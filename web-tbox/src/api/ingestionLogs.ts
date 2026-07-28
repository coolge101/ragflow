import { getAuthorizationHeader } from "../auth/session";

import { readJsonBody } from "./readJsonBody";

export type IngestionLogRow = Record<string, unknown>;

export type ListIngestionLogsJson = {
  code: number;
  message?: string;
  data?: { total?: number; logs?: IngestionLogRow[] };
};

export type IngestionLogQuery = {
  page?: number;
  page_size?: number;
  log_type?: "dataset" | "file";
  orderby?: string;
  desc?: boolean;
  operation_status?: string[];
  create_date_from?: string;
  create_date_to?: string;
  keywords?: string;
};

function authGet(): HeadersInit {
  const a = getAuthorizationHeader();
  return a ? { Authorization: a } : {};
}

function appendIngestionQuery(q: URLSearchParams, params: IngestionLogQuery): void {
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.page_size ?? 50));
  q.set("log_type", params.log_type ?? "dataset");
  q.set("orderby", params.orderby ?? "create_time");
  q.set("desc", params.desc === false ? "false" : "true");
  if (params.keywords?.trim()) {
    q.set("keywords", params.keywords.trim());
  }
  if (params.create_date_from) {
    q.set("create_date_from", params.create_date_from);
  }
  if (params.create_date_to) {
    q.set("create_date_to", params.create_date_to);
  }
  for (const st of params.operation_status ?? []) {
    const s = st.trim();
    if (s) {
      q.append("operation_status", s);
    }
  }
}

/** GET /api/v1/datasets/:datasetId/ingestions — 流水线/入库操作日志（dataset 或 file 维度） */
export async function listIngestionLogs(
  datasetId: string,
  params: IngestionLogQuery = {},
): Promise<{ res: Response; body: ListIngestionLogsJson }> {
  const q = new URLSearchParams();
  appendIngestionQuery(q, params);
  const res = await fetch(
    `/api/v1/datasets/${encodeURIComponent(datasetId)}/ingestions?${q.toString()}`,
    { headers: authGet() },
  );
  const body = await readJsonBody<ListIngestionLogsJson>(res);
  return { res, body };
}

/** 按当前筛选拉取全部页（导出用；单页 100，最多 2000 条） */
export async function listAllIngestionLogs(
  datasetId: string,
  query: IngestionLogQuery,
  opts?: { pageSize?: number; maxRows?: number },
): Promise<{ logs: IngestionLogRow[]; total: number; error?: string; truncated?: boolean }> {
  const pageSize = opts?.pageSize ?? 100;
  const maxRows = opts?.maxRows ?? 2000;
  const all: IngestionLogRow[] = [];
  let page = 1;
  let total = 0;

  for (;;) {
    const { res, body } = await listIngestionLogs(datasetId, {
      ...query,
      page,
      page_size: pageSize,
    });
    if (res.status === 401 || body.code === 401) {
      return { logs: [], total: 0, error: "未授权" };
    }
    if (body.code !== 0) {
      return { logs: [], total: 0, error: body.message || `错误码 ${body.code}` };
    }
    const batch = Array.isArray(body.data?.logs) ? body.data.logs : [];
    total = typeof body.data?.total === "number" ? body.data.total : batch.length;
    all.push(...batch);
    if (all.length >= total || batch.length === 0 || all.length >= maxRows) {
      break;
    }
    page += 1;
    if (page > 50) {
      break;
    }
  }

  if (total > maxRows && all.length >= maxRows) {
    return { logs: all.slice(0, maxRows), total, truncated: true };
  }
  return { logs: all, total };
}
