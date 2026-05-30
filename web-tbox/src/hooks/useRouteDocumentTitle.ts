import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { reviewDocumentTitle } from "../review/journeySteps";

const SUFFIX = " · TBOX 知识库";

/** Maps pathname to short title; design: `TBOX_UI_DESIGN_DETAIL.md` §2.1 */
export function routeTitle(pathname: string): string {
  const review = reviewDocumentTitle(pathname);
  if (review) {
    return review;
  }
  if (pathname === "/login") {
    return "登录";
  }
  if (pathname === "/no-permission") {
    return "无访问权限";
  }
  const exact: Record<string, string> = {
    "/": "对话",
    "/search": "检索",
    "/documents": "文档 / 知识库",
    "/crawl": "采集",
    "/kb": "知识库配置",
    "/apps": "对话应用",
    "/audit": "审计",
    "/users": "用户与角色",
  };
  if (exact[pathname]) {
    return exact[pathname];
  }
  if (pathname === "/apps/new") {
    return "新建对话应用";
  }
  if (pathname.startsWith("/apps/")) {
    return "编辑对话应用";
  }
  return "页面不存在";
}

/** Sets `document.title` from the current route (call once under `BrowserRouter`). */
export function useRouteDocumentTitle(): void {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    document.title = routeTitle(pathname) + SUFFIX;
  }, [pathname]);
}
