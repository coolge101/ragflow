/** 爬取策略键（写入任务 extra_config；后端可逐步消费） */

export const EXTRA_CRAWL_KEYWORDS = "tbox_crawl_keywords";
export const EXTRA_CRAWL_MAX_DEPTH = "tbox_crawl_max_depth";
export const EXTRA_CRAWL_ALLOWED_DOMAINS = "tbox_crawl_allowed_domains";

export const STRATEGY_EXTRA_KEYS = new Set([
  EXTRA_CRAWL_KEYWORDS,
  EXTRA_CRAWL_MAX_DEPTH,
  EXTRA_CRAWL_ALLOWED_DOMAINS,
]);

export type CrawlStrategyFields = {
  keywords: string;
  maxDepth: string;
  allowedDomains: string;
};

export function parseLineList(text: string): string[] {
  return text
    .split(/[\n,，;；]+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function strategyFieldsFromExtra(ex: Record<string, unknown> | undefined): CrawlStrategyFields {
  const keywordsRaw = ex?.[EXTRA_CRAWL_KEYWORDS];
  const domainsRaw = ex?.[EXTRA_CRAWL_ALLOWED_DOMAINS];
  const depthRaw = ex?.[EXTRA_CRAWL_MAX_DEPTH];

  const keywords = Array.isArray(keywordsRaw)
    ? keywordsRaw.map(String).join("\n")
    : typeof keywordsRaw === "string"
      ? keywordsRaw
      : "";

  const allowedDomains = Array.isArray(domainsRaw)
    ? domainsRaw.map(String).join("\n")
    : typeof domainsRaw === "string"
      ? domainsRaw
      : "";

  const maxDepth =
    typeof depthRaw === "number" && Number.isFinite(depthRaw)
      ? String(depthRaw)
      : typeof depthRaw === "string"
        ? depthRaw
        : "";

  return { keywords, maxDepth, allowedDomains };
}

export function mergeStrategyIntoExtra(
  base: Record<string, unknown> | undefined,
  fields: CrawlStrategyFields,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(base || {}) };
  const kw = parseLineList(fields.keywords);
  const domains = parseLineList(fields.allowedDomains);
  const depthTrim = fields.maxDepth.trim();
  const depthNum = depthTrim === "" ? NaN : Number(depthTrim);

  if (kw.length) {
    out[EXTRA_CRAWL_KEYWORDS] = kw;
  } else {
    delete out[EXTRA_CRAWL_KEYWORDS];
  }

  if (domains.length) {
    out[EXTRA_CRAWL_ALLOWED_DOMAINS] = domains;
  } else {
    delete out[EXTRA_CRAWL_ALLOWED_DOMAINS];
  }

  if (depthTrim !== "" && Number.isFinite(depthNum) && depthNum >= 0) {
    out[EXTRA_CRAWL_MAX_DEPTH] = Math.floor(depthNum);
  } else {
    delete out[EXTRA_CRAWL_MAX_DEPTH];
  }

  return out;
}

export function stripStrategyKeys(ex: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...ex };
  for (const k of STRATEGY_EXTRA_KEYS) {
    delete out[k];
  }
  return out;
}

export function formatStrategySummary(ex: Record<string, unknown> | undefined): string {
  if (!ex) {
    return "";
  }
  const parts: string[] = [];
  const kw = ex[EXTRA_CRAWL_KEYWORDS];
  if (Array.isArray(kw) && kw.length) {
    parts.push(`关键词×${kw.length}`);
  }
  const depth = ex[EXTRA_CRAWL_MAX_DEPTH];
  if (typeof depth === "number") {
    parts.push(`深度≤${depth}`);
  }
  const domains = ex[EXTRA_CRAWL_ALLOWED_DOMAINS];
  if (Array.isArray(domains) && domains.length) {
    parts.push(`域名×${domains.length}`);
  }
  return parts.join("、");
}

export type CrawlTaskMode = "scheduled" | "special";

export function crawlTaskModeFromFields(cron: string, enabled: boolean): CrawlTaskMode {
  const c = cron.trim();
  if (!c && !enabled) {
    return "special";
  }
  return "scheduled";
}

export function applyCrawlTaskMode(mode: CrawlTaskMode): { cron: string; enabled: boolean; runState: "draft" | "ready" | "paused" } {
  if (mode === "special") {
    return { cron: "", enabled: false, runState: "ready" };
  }
  return { cron: "", enabled: false, runState: "draft" };
}
