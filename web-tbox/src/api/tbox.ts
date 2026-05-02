import { getAuthorizationHeader } from "../auth/session";
import { TBOX_PERMISSIONS, type TboxPermission } from "../constants/permissions";

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
  const body = (await res.json()) as TboxMeResponse;
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
