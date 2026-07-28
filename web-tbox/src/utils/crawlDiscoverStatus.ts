import type { CrawlHealthReport } from "../api/crawlHealth";

export type DiscoverStatusTone = "ok" | "warn" | "bad" | "unknown";

export type DiscoverStatusView = {
  tone: DiscoverStatusTone;
  label: string;
  detail: string;
  recommended: string;
};

const TONE_COLOR: Record<DiscoverStatusTone, string> = {
  ok: "#16a34a",
  warn: "#ca8a04",
  bad: "#dc2626",
  unknown: "#6b7280",
};

export function discoverStatusColor(tone: DiscoverStatusTone): string {
  return TONE_COLOR[tone];
}

export function buildDiscoverStatus(report: CrawlHealthReport | null | undefined): DiscoverStatusView {
  if (!report) {
    return {
      tone: "unknown",
      label: "Discover 状态未知",
      detail: "尚未加载子系统健康",
      recommended: "—",
    };
  }

  const recommended = String(report.recommended_discover_provider || "none");
  const searxng = report.searxng || {};
  const tavily = report.tavily || {};
  const enginesOk = Number(searxng.engines_ok ?? 0);
  const proxyBits: string[] = [];
  if (report.proxy?.http_proxy_configured) {
    proxyBits.push("HTTP 代理");
  }
  if (report.proxy?.https_proxy_configured) {
    proxyBits.push("HTTPS 代理");
  }
  const proxyNote = proxyBits.length ? `；${proxyBits.join("、")}已配置` : "";

  if (recommended === "searxng" && !searxng.degraded) {
    return {
      tone: "ok",
      label: "Discover 可用（SearXNG）",
      detail: `引擎可用 ${enginesOk}；结果 ${searxng.results_count ?? 0}${proxyNote}`,
      recommended,
    };
  }

  if (recommended === "tavily" || (searxng.degraded && tavily.api_key_present)) {
    return {
      tone: searxng.reachable ? "warn" : "warn",
      label: "Discover 降级（推荐 Tavily）",
      detail: `SearXNG ${searxng.reachable ? "degraded" : "不可用"}；Tavily Key ${tavily.api_key_present ? "已配置" : "未配置"}${proxyNote}`,
      recommended,
    };
  }

  if (recommended === "searxng_degraded" || searxng.degraded) {
    return {
      tone: "warn",
      label: "Discover 降级（SearXNG）",
      detail: `引擎可用 ${enginesOk}；unresponsive ${(searxng.unresponsive_engines || []).length}${proxyNote}`,
      recommended,
    };
  }

  if (!searxng.configured && !tavily.api_key_present) {
    return {
      tone: "bad",
      label: "Discover 未配置",
      detail: `请配置 TBOX_CRAWL_SEARXNG_BASE_URL 或 Tavily Key${proxyNote}`,
      recommended,
    };
  }

  return {
    tone: "bad",
    label: "Discover 不可用",
    detail: String(searxng.error || "SearXNG/Tavily 均不可用") + proxyNote,
    recommended,
  };
}
