import { getAuthorizationHeader } from "../auth/session";

import { readJsonBody } from "./readJsonBody";

export type ManagedUserRow = {
  user_tenant_id?: string;
  user_id?: string;
  email?: string;
  nickname?: string;
  role?: string;
  status?: string | number;
  is_superuser?: boolean;
  permissions?: string[];
  uses_permission_override?: boolean;
  update_date?: string | null;
  delta_seconds?: number | null;
};

export type ManagedUsersListJson = {
  code: number;
  message?: string;
  data?: ManagedUserRow[];
};

function authHeaders(): HeadersInit {
  const a = getAuthorizationHeader();
  const h: Record<string, string> = {};
  if (a) {
    h.Authorization = a;
  }
  return h;
}

export async function listManagedUsers(
  tenantId: string,
): Promise<{ res: Response; body: ManagedUsersListJson }> {
  const res = await fetch(`/v1/tbox/workspaces/${encodeURIComponent(tenantId)}/managed-users`, {
    headers: authHeaders(),
  });
  const body = await readJsonBody<ManagedUsersListJson>(res);
  return { res, body };
}

export type ManagedUserMutationJson = {
  code: number;
  message?: string;
  data?: ManagedUserRow | boolean;
};

export async function createManagedUser(
  tenantId: string,
  body: {
    email: string;
    nickname: string;
    password: string;
    role: string;
    permissions?: string[] | null;
  },
): Promise<{ res: Response; body: ManagedUserMutationJson }> {
  const res = await fetch(`/v1/tbox/workspaces/${encodeURIComponent(tenantId)}/managed-users`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const out = await readJsonBody<ManagedUserMutationJson>(res);
  return { res, body: out };
}

export async function patchManagedUser(
  tenantId: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<{ res: Response; body: ManagedUserMutationJson }> {
  const res = await fetch(
    `/v1/tbox/workspaces/${encodeURIComponent(tenantId)}/managed-users/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const out = await readJsonBody<ManagedUserMutationJson>(res);
  return { res, body: out };
}

export async function deleteManagedUser(
  tenantId: string,
  userId: string,
): Promise<{ res: Response; body: ManagedUserMutationJson }> {
  const res = await fetch(
    `/v1/tbox/workspaces/${encodeURIComponent(tenantId)}/managed-users/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );
  const out = await readJsonBody<ManagedUserMutationJson>(res);
  return { res, body: out };
}
