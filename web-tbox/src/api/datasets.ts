import { getAuthorizationHeader } from "../auth/session";

export type DatasetRow = Record<string, unknown> & {
  id?: string;
  name?: string;
};

export type ListDatasetsJson = {
  code: number;
  message?: string;
  data?: DatasetRow[];
  total?: number;
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
  const body = (await res.json()) as ListDatasetsJson;
  return { res, body };
}

export async function deleteDatasets(ids: string[]): Promise<{ res: Response; body: ListDatasetsJson }> {
  const res = await fetch("/api/v1/datasets", {
    method: "DELETE",
    headers: authHeaders(),
    body: JSON.stringify({ ids }),
  });
  const body = (await res.json()) as ListDatasetsJson;
  return { res, body };
}
