import type { TboxMeResponse } from "../api/tbox";
import { hasPermission, type TboxPermission } from "../constants/permissions";

type MeLike = TboxMeResponse["data"] | null | undefined;

export function tenantIdsEqual(a: unknown, b: unknown): boolean {
  return String(a ?? "") === String(b ?? "") && String(a ?? "") !== "";
}

/** True if the user has any active membership on this workspace (read member list, leave team, etc.). */
export function isMemberOfWorkspace(me: MeLike, workspaceId: string): boolean {
  if (!workspaceId) {
    return false;
  }
  if (Boolean(me?.is_superuser)) {
    return true;
  }
  if (!me?.user_id) {
    return false;
  }
  if (tenantIdsEqual(me.user_id, workspaceId)) {
    return true;
  }
  return (me.tenants ?? []).some((t) => tenantIdsEqual(t.tenant_id, workspaceId));
}

/** True if the user is workspace owner or admin on at least one tenant (RAGFlow team management). */
export function canManageAnyWorkspaceTenant(me: MeLike): boolean {
  if (!me?.user_id) {
    return false;
  }
  if (Boolean(me.is_superuser)) {
    return true;
  }
  for (const t of me.tenants ?? []) {
    const r = String(t.role ?? "").trim().toLowerCase();
    if (r === "owner" || r === "admin") {
      return true;
    }
  }
  return false;
}

/** Unique workspace (tenant) ids the user can open from `/v1/tbox/me` + personal id. */
export function workspaceIdsFromMe(me: MeLike): string[] {
  const ids = new Set<string>();
  if (me?.user_id) {
    ids.add(String(me.user_id));
  }
  for (const t of me?.tenants ?? []) {
    if (t.tenant_id != null && String(t.tenant_id) !== "") {
      ids.add(String(t.tenant_id));
    }
  }
  return [...ids];
}

/** First workspace id where `predicate` holds (e.g. default tab for admin UI). */
export function firstWorkspaceWhere(me: MeLike, predicate: (workspaceId: string) => boolean): string {
  for (const id of workspaceIdsFromMe(me)) {
    if (predicate(id)) {
      return id;
    }
  }
  return "";
}

/** Whether the UI may invite / change roles / remove others on this workspace (server enforces too). */
export function canManageTenantUsers(me: MeLike, workspaceId: string): boolean {
  if (!me?.user_id || !workspaceId) {
    return false;
  }
  if (Boolean(me.is_superuser)) {
    return true;
  }
  if (tenantIdsEqual(me.user_id, workspaceId)) {
    return true;
  }
  const row = (me.tenants ?? []).find((t) => tenantIdsEqual(t.tenant_id, workspaceId));
  const role = String(row?.role ?? "").trim().toLowerCase();
  return role === "owner" || role === "admin";
}

/**
 * Show member-management actions (create / patch / delete). Matches server `managed-users` write rules,
 * with a UI fallback when `tenants[].tenant_id` type/shape mismatches but merged `user.manage` is present.
 */
export function canShowManagedUserActions(
  me: MeLike,
  workspaceId: string,
  permissions: readonly TboxPermission[] | undefined,
): boolean {
  if (!workspaceId) {
    return false;
  }
  if (canManageTenantUsers(me, workspaceId)) {
    return true;
  }
  return Boolean(isMemberOfWorkspace(me, workspaceId) && hasPermission(permissions, "user.manage"));
}
