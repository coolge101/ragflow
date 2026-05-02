import { getAuthorizationHeader } from "../auth/session";
import { TBOX_PERMISSIONS, type TboxPermission } from "../constants/permissions";

export type TboxContractResponse = {
  code: number;
  message?: string;
  data?: {
    tbox_api_contract_version?: number;
    docs?: string;
    delivery_harness?: string;
  };
};

export type TboxHealthResponse = {
  code: number;
  message?: string;
  data?: {
    status?: string;
    tbox_api_contract_version?: number;
    path?: string;
  };
};

/** Parse TBOX JSON bodies even when the server returns HTML or empty (proxy misconfig). */
async function readTboxJson<T extends { code?: number; message?: string }>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    return { code: -1, message: "空响应体" } as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return { code: -1, message: "响应不是有效 JSON" } as T;
  }
}

export type TboxMeResponse = {
  code: number;
  message?: string;
  data?: {
    user_id?: string;
    email?: string;
    nickname?: string;
    is_superuser?: boolean;
    tenants?: Array<{ tenant_id: string; role: string }>;
    /** Server-computed UI permissions (contract v3+). */
    permissions?: string[];
  };
};

export async function fetchTboxMe(): Promise<{ res: Response; body: TboxMeResponse }> {
  const auth = getAuthorizationHeader();
  const res = await fetch("/v1/tbox/me", {
    headers: auth ? { Authorization: auth } : {},
  });
  const body = await readTboxJson<TboxMeResponse>(res);
  return { res, body };
}

/** Public route — no auth (same as `tbox_app.contract`). */
export async function fetchTboxContract(): Promise<{ res: Response; body: TboxContractResponse }> {
  const res = await fetch("/v1/tbox/contract");
  const body = await readTboxJson<TboxContractResponse>(res);
  return { res, body };
}

/** Public route — no auth (same as `tbox_app.health`). */
export async function fetchTboxHealth(): Promise<{ res: Response; body: TboxHealthResponse }> {
  const res = await fetch("/v1/tbox/health");
  const body = await readTboxJson<TboxHealthResponse>(res);
  return { res, body };
}

/** When backend omits `permissions` (older server), derive a safe minimum from flags. */
export function fallbackPermissions(data: TboxMeResponse["data"] | null | undefined): TboxPermission[] {
  if (!data) {
    return [];
  }
  const fromServer = data.permissions?.filter((p): p is TboxPermission =>
    (TBOX_PERMISSIONS as readonly string[]).includes(p),
  );
  if (fromServer?.length) {
    return fromServer;
  }
  if (data.is_superuser) {
    return [...TBOX_PERMISSIONS];
  }
  return ["chat.use", "search.use", "doc.view"];
}
