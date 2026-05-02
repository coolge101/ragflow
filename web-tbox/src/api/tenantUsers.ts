import { getAuthorizationHeader } from "../auth/session";

export type TenantUserRow = Record<string, unknown> & {
  user_id?: string;
  email?: string;
  nickname?: string;
  role?: string;
  status?: string | number;
};

export type TenantUsersJson = {
  code: number;
  message?: string;
  data?: TenantUserRow[];
};

function authHeaders(): HeadersInit {
  const a = getAuthorizationHeader();
  const h: Record<string, string> = {};
  if (a) {
    h.Authorization = a;
  }
  return h;
}

/**
 * GET /api/v1/tenants/:tenantId/users
 * RAGFlow 要求 path 中的 tenantId 与当前登录用户 id 一致（个人空间/租户 id）。
 */
export async function listTenantUsers(
  tenantId: string,
): Promise<{ res: Response; body: TenantUsersJson }> {
  const res = await fetch(`/api/v1/tenants/${encodeURIComponent(tenantId)}/users`, {
    headers: authHeaders(),
  });
  const body = (await res.json()) as TenantUsersJson;
  return { res, body };
}
