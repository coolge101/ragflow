import { getAuthorizationHeader } from "../auth/session";
import { TBOX_PERMISSIONS, type TboxPermission } from "../constants/permissions";

import { readJsonBody } from "./readJsonBody";

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

export type TboxMeResponse = {
  code: number;
  message?: string;
  data?: {
    user_id?: string;
    email?: string;
    nickname?: string;
    is_superuser?: boolean;
    tenants?: Array<{ tenant_id: string; role: string; tbox_permissions?: string | null }>;
    /** Server-computed UI permissions (contract v3+). */
    permissions?: string[];
  };
};

export async function fetchTboxMe(): Promise<{ res: Response; body: TboxMeResponse }> {
  const auth = getAuthorizationHeader();
  const res = await fetch("/v1/tbox/me", {
    headers: auth ? { Authorization: auth } : {},
  });
  const body = await readJsonBody<TboxMeResponse>(res);
  return { res, body };
}

/** True when the server has no TBOX `/me` (e.g. stock image) or route not found. */
export function isTboxMeUnavailable(res: Response, body: TboxMeResponse): boolean {
  if (res.status === 404 || body.code === 404) {
    return true;
  }
  const offline = import.meta.env.VITE_TBOX_OFFLINE_PERMISSIONS === "1";
  if (offline && body.code !== 0 && body.code !== 401) {
    return true;
  }
  return false;
}

/** Public route — no auth (same as `tbox_app.contract`). */
export async function fetchTboxContract(): Promise<{ res: Response; body: TboxContractResponse }> {
  const res = await fetch("/v1/tbox/contract");
  const body = await readJsonBody<TboxContractResponse>(res);
  return { res, body };
}

/** Public route — no auth (same as `tbox_app.health`). */
export async function fetchTboxHealth(): Promise<{ res: Response; body: TboxHealthResponse }> {
  const res = await fetch("/v1/tbox/health");
  const body = await readJsonBody<TboxHealthResponse>(res);
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
