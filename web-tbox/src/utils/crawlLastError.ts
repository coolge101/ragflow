/** Matches worker ``last_error`` lines from ``common/tbox_crawl_last_error.format_crawl_worker_error``. */
const TBOX_ERR_PREFIX = /^\[tbox:([A-Z0-9_]+)\]\s*(.*)$/i;
const TICK_STAT_PAIR = /(\w+)=(-?\d+)/g;

const LABELS: Record<string, string> = {
  HTTP_PROBE: "HTTP 探测失败",
  INGEST_STATIC: "静态页入库失败",
  INGEST_RSS: "RSS 入库失败",
  INGEST_API: "API 入库失败",
  DATASET_TENANT: "知识库与租户不匹配",
  KB_NOT_FOUND: "知识库不存在",
  WORKER_EXCEPTION: "Worker 异常",
  WORKER_STUB: "Stub 联调失败",
  DISCOVER_NO_KEY: "未配置 Tavily Key",
  DISCOVER_NO_SEARXNG: "未配置 SearXNG",
  DISCOVER_EMPTY: "搜索发现无可用 URL",
  DISCOVER: "搜索发现失败",
  DISCOVER_QUOTA: "搜索发现配额/限流",
  DISCOVER_PROVIDER: "搜索发现 Provider 错误",
  STRATEGY: "策略过滤后无 URL",
  TICK_OK: "最近 tick",
};

const TICK_STAT_LABELS: Record<string, string> = {
  discover_hits: "SERP命中",
  skipped_serp_rank: "SERP过滤",
  discover_rank_kept: "rank保留",
  ingested: "入库",
  discovered: "发现",
};

function trunc(s: string, max: number): string {
  if (max <= 0) {
    return "";
  }
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

export type CrawlTickStatSnapshot = {
  discover_hits?: number;
  skipped_serp_rank?: number;
  discover_rank_kept?: number;
  ingested?: number;
  discovered?: number;
};

/** Parse ``key=value`` pairs from worker tick / error detail text. */
export function parseCrawlTickStats(detail: string): CrawlTickStatSnapshot {
  const out: CrawlTickStatSnapshot = {};
  for (const m of detail.matchAll(TICK_STAT_PAIR)) {
    const key = String(m[1] || "");
    const num = Number(m[2]);
    if (!Number.isFinite(num)) {
      continue;
    }
    if (key === "discover_hits") {
      out.discover_hits = num;
    } else if (key === "skipped_serp_rank") {
      out.skipped_serp_rank = num;
    } else if (key === "discover_rank_kept") {
      out.discover_rank_kept = num;
    } else if (key === "ingested") {
      out.ingested = num;
    } else if (key === "discovered") {
      out.discovered = num;
    }
  }
  return out;
}

function formatTickStatSummary(stats: CrawlTickStatSnapshot): string {
  const parts: string[] = [];
  const push = (key: keyof CrawlTickStatSnapshot) => {
    const v = stats[key];
    if (v == null) {
      return;
    }
    const label = TICK_STAT_LABELS[String(key)] ?? String(key);
    parts.push(`${label}${v}`);
  };
  push("discover_hits");
  push("skipped_serp_rank");
  push("discover_rank_kept");
  push("ingested");
  return parts.join("、");
}

function formatTickOkDetail(detail: string, maxLen: number): string {
  const stats = parseCrawlTickStats(detail);
  const summary = formatTickStatSummary(stats);
  if (!summary) {
    return trunc(detail, maxLen);
  }
  return trunc(summary, maxLen);
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
  const formattedDetail = code === "TICK_OK" ? formatTickOkDetail(detail, maxLen) : detail;
  const sep = "：";
  const restBudget = maxLen - label.length - sep.length;
  if (restBudget <= 0) {
    return trunc(label + sep + formattedDetail, maxLen);
  }
  return `${label}${sep}${trunc(formattedDetail, restBudget)}`;
}
