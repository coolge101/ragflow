import { getAuthorizationHeader } from "../auth/session";

import { readJsonBody } from "./readJsonBody";

export type TenantUserRow = Record<string, unknown> & {
  /** `user_tenant` row id */
  id?: string;
  user_id?: string;
  email?: string;
  nickname?: string;
  role?: string;
  status?: string | number;
  update_date?: string;
  /** Seconds since `update_date` (from RAGFlow list API). */
  delta_seconds?: number;
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
  const body = await readJsonBody<TenantUsersJson>(res);
  return { res, body };
}

export type PatchTenantUserRoleJson = {
  code: number;
  message?: string;
  data?: unknown;
};

/** PATCH /api/v1/tenants/:tenantId/users — body `{ user_id, role }` (`admin` | `normal` | `invite`). */
export async function patchTenantUserRole(
  tenantId: string,
  payload: { user_id: string; role: string },
): Promise<{ res: Response; body: PatchTenantUserRoleJson }> {
  const res = await fetch(`/api/v1/tenants/${encodeURIComponent(tenantId)}/users`, {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await readJsonBody<PatchTenantUserRoleJson>(res);
  return { res, body };
}

export type InviteTenantUserJson = {
  code: number;
  message?: string;
  data?: unknown;
};

/** POST /api/v1/tenants/:tenantId/users — body `{ email }` (user must already exist in RAGFlow). */
export async function postTenantInvite(
  tenantId: string,
  email: string,
): Promise<{ res: Response; body: InviteTenantUserJson }> {
  const res = await fetch(`/api/v1/tenants/${encodeURIComponent(tenantId)}/users`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim() }),
  });
  const body = await readJsonBody<InviteTenantUserJson>(res);
  return { res, body };
}

export type DeleteTenantMemberJson = {
  code: number;
  message?: string;
  data?: unknown;
};

/** DELETE /api/v1/tenants/:tenantId/users — body `{ user_id }`. */
export async function deleteTenantMember(
  tenantId: string,
  userId: string,
): Promise<{ res: Response; body: DeleteTenantMemberJson }> {
  const res = await fetch(`/api/v1/tenants/${encodeURIComponent(tenantId)}/users`, {
    method: "DELETE",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  const body = await readJsonBody<DeleteTenantMemberJson>(res);
  return { res, body };
}
