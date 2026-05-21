/**
 * 「页面确认」评审路由开关：`/review`、`/review/step/:id`。
 * - 开发（`import.meta.env.DEV`）默认开启。
 * - 任意环境设置 `VITE_REVIEW_PAGES=0` 可关闭。
 * - 生产预览设置 `VITE_REVIEW_PAGES=1` 开启。
 */
export function reviewPagesEnabled(): boolean {
  const v = import.meta.env.VITE_REVIEW_PAGES;
  if (v === "0" || v === "false") {
    return false;
  }
  if (import.meta.env.DEV) {
    return true;
  }
  return v === "1" || v === "true";
}
