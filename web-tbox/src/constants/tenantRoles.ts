/** RAGFlow `UserTenantRole` values (tenant membership). */
export const TENANT_ROLE_VALUES = ["owner", "admin", "normal", "invite"] as const;

export type TenantRoleValue = (typeof TENANT_ROLE_VALUES)[number];

export function isTenantRoleValue(s: string): s is TenantRoleValue {
  return (TENANT_ROLE_VALUES as readonly string[]).includes(s);
}

/** Roles the workspace owner may assign to other members (not `owner`). */
export const TENANT_ASSIGNABLE_ROLES = ["admin", "normal", "invite"] as const;

export type TenantAssignableRole = (typeof TENANT_ASSIGNABLE_ROLES)[number];

export function isTenantAssignableRole(s: string): s is TenantAssignableRole {
  return (TENANT_ASSIGNABLE_ROLES as readonly string[]).includes(s);
}

const ROLE_LABELS: Record<TenantRoleValue, string> = {
  owner: "所有者",
  admin: "管理员",
  normal: "成员",
  invite: "待接受",
};

export function tenantRoleLabel(role: string | undefined | null): string {
  if (!role) {
    return "—";
  }
  const k = String(role).trim().toLowerCase();
  if (isTenantRoleValue(k)) {
    return ROLE_LABELS[k];
  }
  return String(role);
}
