/** Canonical permission keys — aligned with `docs/TBOX_UI_DESIGN_DETAIL.md` §2.2 */
export const TBOX_PERMISSIONS = [
  "chat.use",
  "search.use",
  "doc.view",
  "doc.upload",
  "doc.delete",
  "doc.reparse",
  "doc.version.manage",
  "kb.configure",
  "kb.dangerous",
  "export.data",
  "audit.read",
  "stats.read",
  "user.manage",
  "crawl.manage",
] as const;

export type TboxPermission = (typeof TBOX_PERMISSIONS)[number];

export function isTboxPermission(s: string): s is TboxPermission {
  return (TBOX_PERMISSIONS as readonly string[]).includes(s);
}

export function hasPermission(perms: readonly string[] | undefined, key: TboxPermission): boolean {
  return Boolean(perms?.includes(key));
}
