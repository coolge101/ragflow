/** Matches worker ``last_error`` lines from ``common/tbox_crawl_last_error.format_crawl_worker_error``. */
const TBOX_ERR_PREFIX = /^\[tbox:([A-Z0-9_]+)\]\s*(.*)$/i;

const LABELS: Record<string, string> = {
  HTTP_PROBE: "HTTP 探测失败",
  INGEST_STATIC: "静态页入库失败",
  INGEST_RSS: "RSS 入库失败",
  DATASET_TENANT: "知识库与租户不匹配",
  KB_NOT_FOUND: "知识库不存在",
  WORKER_EXCEPTION: "Worker 异常",
  WORKER_STUB: "Stub 联调失败",
};

function trunc(s: string, max: number): string {
  if (max <= 0) {
    return "";
  }
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

/**
 * Table cell: replace ``[tbox:CODE]`` with a short Chinese label; keep detail after the prefix (truncated).
 */
export function formatCrawlLastErrorDisplay(raw: unknown, maxLen: number): string {
  if (raw == null || raw === "") {
    return "—";
  }
  const s = String(raw).trim();
  const m = s.match(TBOX_ERR_PREFIX);
  if (!m) {
    return trunc(s, maxLen);
  }
  const code = String(m[1] || "").toUpperCase();
  const detail = String(m[2] || "").trim();
  const label = LABELS[code] ?? `错误（${code}）`;
  if (!detail) {
    return trunc(label, maxLen);
  }
  const sep = "：";
  const restBudget = maxLen - label.length - sep.length;
  if (restBudget <= 0) {
    return trunc(label + sep + detail, maxLen);
  }
  return `${label}${sep}${trunc(detail, restBudget)}`;
}
