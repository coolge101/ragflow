/**
 * 将 SPA 路径映射到 `journeySteps.ts` 中的 `id`，供「本页验收」面板与 `/review/step/:id` 共用数据。
 */
export function pathToJourneyStepId(pathname: string): string | null {
  if (pathname === "/login") {
    return null;
  }
  if (pathname === "/review" || pathname.startsWith("/review/")) {
    return null;
  }
  if (pathname === "/apps" || pathname.startsWith("/apps/")) {
    return "chat-apps";
  }
  const exact: Record<string, string> = {
    "/": "chat",
    "/search": "search",
    "/documents": "documents",
    "/crawl": "crawl",
    "/kb": "kb",
    "/audit": "audit",
    "/users": "users",
    "/no-permission": "errors",
  };
  if (exact[pathname]) {
    return exact[pathname];
  }
  return "errors";
}
