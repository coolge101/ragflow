import { hasPermission, type TboxPermission } from "./permissions";
import { canManageAnyWorkspaceTenant } from "../utils/tenantWorkspace";
import type { TboxMeResponse } from "../api/tbox";

export type MeLike = TboxMeResponse["data"] | null | undefined;

const ADMIN_PERMS: TboxPermission[] = [
  "crawl.manage",
  "kb.configure",
  "audit.read",
  "user.manage",
  "kb.dangerous",
];

export function canAccessAdmin(permissions: string[] | null | undefined, me: MeLike): boolean {
  const p = permissions ?? undefined;
  if (ADMIN_PERMS.some((perm) => hasPermission(p, perm))) {
    return true;
  }
  return canManageAnyWorkspaceTenant(me);
}

export function resolveUserHomePath(permissions: string[] | null | undefined, me: MeLike): string {
  const p = permissions ?? undefined;
  if (hasPermission(p, "chat.use")) return "/";
  if (hasPermission(p, "search.use")) return "/search";
  if (canAccessAdmin(permissions, me)) return "/admin";
  return "/no-permission";
}

export type ShellNavItem = {
  to: string;
  label: string;
  perm: TboxPermission | null;
  end?: boolean;
  alsoIf?: (me: MeLike) => boolean;
};

export const USER_NAV_ITEMS: ShellNavItem[] = [
  { to: "/", label: "对话", perm: "chat.use", end: true },
  { to: "/search", label: "检索", perm: "search.use" },
];

export const ADMIN_NAV_ITEMS: ShellNavItem[] = [
  { to: "/admin", label: "概览", perm: null, end: true },
  { to: "/admin/crawl/goals", label: "采集目标", perm: "crawl.manage" },
  { to: "/admin/crawl", label: "采集任务", perm: "crawl.manage" },
  { to: "/admin/documents", label: "文档 / 入库", perm: "doc.view" },
  { to: "/admin/kb", label: "知识库配置", perm: "kb.configure" },
  { to: "/admin/apps", label: "对话应用", perm: "kb.configure" },
  { to: "/admin/audit", label: "审计", perm: "audit.read" },
  {
    to: "/admin/users",
    label: "用户与角色",
    perm: "user.manage",
    alsoIf: (m) => canManageAnyWorkspaceTenant(m),
  },
];

export function filterNavItems(
  items: ShellNavItem[],
  permissions: string[] | null | undefined,
  me: MeLike,
): ShellNavItem[] {
  return items.filter((item) => {
    if (item.perm === null) return true;
    const p = permissions ?? undefined;
    return hasPermission(p, item.perm) || (item.alsoIf?.(me) ?? false);
  });
}
