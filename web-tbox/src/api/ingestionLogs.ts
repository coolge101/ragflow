import { getAuthorizationHeader } from "../auth/session";

import { readJsonBody } from "./readJsonBody";

export type IngestionLogRow = Record<string, unknown>;

export type ListIngestionLogsJson = {
  code: number;
  message?: string;
  data?: { total?: number; logs?: IngestionLogRow[] };
};

function authGet(): HeadersInit {
  const a = getAuthorizationHeader();
  return a ? { Authorization: a } : {};
}

/** GET /api/v1/datasets/:datasetId/ingestions — 流水线/入库操作日志（dataset 或 file 维度） */
export async function listIngestionLogs(
  datasetId: string,
  params: {
    page?: number;
    page_size?: number;
    log_type?: "dataset" | "file";
    orderby?: string;
    desc?: boolean;
  } = {},
): Promise<{ res: Response; body: ListIngestionLogsJson }> {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.page_size ?? 50));
  q.set("log_type", params.log_type ?? "dataset");
  q.set("orderby", params.orderby ?? "create_time");
  q.set("desc", params.desc === false ? "false" : "true");
  const res = await fetch(
    `/api/v1/datasets/${encodeURIComponent(datasetId)}/ingestions?${q.toString()}`,
    { headers: authGet() },
  );
  const body = await readJsonBody<ListIngestionLogsJson>(res);
  return { res, body };
}
