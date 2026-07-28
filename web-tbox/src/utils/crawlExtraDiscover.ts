/** 搜索发现键（写入任务 extra_config；worker 消费 Tavily / 未来 SearXNG） */

export const EXTRA_SEARCH_PROVIDER = "tbox_crawl_search_provider";
export const EXTRA_SEARCH_QUERIES = "tbox_crawl_search_queries";
export const EXTRA_SEARCH_LOCALE = "tbox_crawl_search_locale";
export const EXTRA_DISCOVER_MAX_URLS = "tbox_crawl_discover_max_urls";
export const EXTRA_DISCOVER_MAX_QUERIES = "tbox_crawl_discover_max_queries";
export const EXTRA_DISCOVER_MAX_RESULTS = "tbox_crawl_discover_max_results_per_query";
export const EXTRA_TAVILY_DEPTH = "tbox_crawl_tavily_depth";
export const EXTRA_QUERY_TEMPLATE = "tbox_crawl_query_template";
export const EXTRA_DISCOVER_RANK_MODE = "tbox_crawl_discover_rank_mode";
export const EXTRA_DISCOVER_RANK_MIN_SCORE = "tbox_crawl_discover_rank_min_score";

export const QUERY_TEMPLATES = [
  { value: "", label: "无" },
  { value: "tech_trend", label: "技术趋势" },
] as const;

export type QueryTemplateValue = (typeof QUERY_TEMPLATES)[number]["value"];

export const DISCOVER_EXTRA_KEYS = new Set([
  EXTRA_SEARCH_PROVIDER,
  EXTRA_SEARCH_QUERIES,
  EXTRA_SEARCH_LOCALE,
  EXTRA_DISCOVER_MAX_URLS,
  EXTRA_DISCOVER_MAX_QUERIES,
  EXTRA_DISCOVER_MAX_RESULTS,
  EXTRA_TAVILY_DEPTH,
  EXTRA_QUERY_TEMPLATE,
  EXTRA_DISCOVER_RANK_MODE,
  EXTRA_DISCOVER_RANK_MIN_SCORE,
]);

export type DiscoverProvider = "none" | "tavily" | "searxng" | "auto";
export type DiscoverLocale = "zh" | "en" | "both";
export type TavilyDepth = "basic" | "advanced";

export type DiscoverFields = {
  provider: DiscoverProvider;
  queries: string;
  locale: DiscoverLocale;
  maxUrls: string;
  maxQueries: string;
  maxResultsPerQuery: string;
  tavilyDepth: TavilyDepth;
  queryTemplate: QueryTemplateValue;
};

export const EMPTY_DISCOVER_FIELDS: DiscoverFields = {
  provider: "none",
  queries: "",
  locale: "both",
  maxUrls: "",
  maxQueries: "",
  maxResultsPerQuery: "",
  tavilyDepth: "basic",
  queryTemplate: "",
};

function parseQueryTemplate(raw: unknown): QueryTemplateValue {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "tech_trend") {
    return "tech_trend";
  }
  return "";
}

function parseDiscoverProvider(raw: unknown): DiscoverProvider {
  const s = String(raw || "none").trim().toLowerCase();
  if (s === "tavily") {
    return "tavily";
  }
  if (s === "searxng") {
    return "searxng";
  }
  if (s === "auto") {
    return "auto";
  }
  return "none";
}

function parseDiscoverLocale(raw: unknown): DiscoverLocale {
  const s = String(raw || "both").trim().toLowerCase();
  if (s === "zh" || s === "en") {
    return s;
  }
  return "both";
}

function parseTavilyDepth(raw: unknown): TavilyDepth {
  const s = String(raw || "basic").trim().toLowerCase();
  return s === "advanced" ? "advanced" : "basic";
}

export function discoverFieldsFromExtra(ex: Record<string, unknown> | undefined): DiscoverFields {
  const queriesRaw = ex?.[EXTRA_SEARCH_QUERIES];
  const queries = Array.isArray(queriesRaw)
    ? queriesRaw.map(String).join("\n")
    : typeof queriesRaw === "string"
      ? queriesRaw
      : "";

  const numStr = (key: string) => {
    const v = ex?.[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      return String(v);
    }
    return typeof v === "string" ? v : "";
  };

  return {
    provider: parseDiscoverProvider(ex?.[EXTRA_SEARCH_PROVIDER]),
    queries,
    locale: parseDiscoverLocale(ex?.[EXTRA_SEARCH_LOCALE]),
    maxUrls: numStr(EXTRA_DISCOVER_MAX_URLS),
    maxQueries: numStr(EXTRA_DISCOVER_MAX_QUERIES),
    maxResultsPerQuery: numStr(EXTRA_DISCOVER_MAX_RESULTS),
    tavilyDepth: parseTavilyDepth(ex?.[EXTRA_TAVILY_DEPTH]),
    queryTemplate: parseQueryTemplate(ex?.[EXTRA_QUERY_TEMPLATE]),
  };
}

/** Phase 70：写入 query 模板与 SERP rank 键（质量/相关性由表单 merge，选择模板时在 UI 同步默认值）。 */
export function mergeQueryTemplateIntoExtra(
  out: Record<string, unknown>,
  queryTemplate: QueryTemplateValue,
): void {
  if (queryTemplate === "tech_trend") {
    out[EXTRA_QUERY_TEMPLATE] = "tech_trend";
    out[EXTRA_DISCOVER_RANK_MODE] = "rules";
    out[EXTRA_DISCOVER_RANK_MIN_SCORE] = 55;
    return;
  }
  delete out[EXTRA_QUERY_TEMPLATE];
  delete out[EXTRA_DISCOVER_RANK_MODE];
  delete out[EXTRA_DISCOVER_RANK_MIN_SCORE];
}

/** 选择 tech_trend 时在 Discover 区应用的默认闸门（可被质量/相关性表单覆盖）。 */
export const TECH_TREND_DISCOVER_DEFAULTS: Pick<DiscoverFields, "provider" | "queryTemplate"> = {
  provider: "auto",
  queryTemplate: "tech_trend",
};

function clampInt(text: string, fallback: number, lo: number, hi: number): number | null {
  const t = text.trim();
  if (!t) {
    return null;
  }
  const n = Number(t);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

export function mergeDiscoverIntoExtra(
  base: Record<string, unknown> | undefined,
  fields: DiscoverFields,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(base || {}) };
  const queries = fields.queries
    .split(/[\n,，;；]+/u)
    .map((s) => s.trim())
    .filter(Boolean);

  const discoverActive =
    fields.queryTemplate === "tech_trend" ||
    ((fields.provider === "tavily" || fields.provider === "searxng" || fields.provider === "auto") &&
      queries.length > 0);

  if (discoverActive) {
    if (fields.provider === "tavily" || fields.provider === "searxng" || fields.provider === "auto") {
      out[EXTRA_SEARCH_PROVIDER] = fields.provider;
      out[EXTRA_SEARCH_LOCALE] = fields.locale;
      out[EXTRA_TAVILY_DEPTH] = fields.tavilyDepth;
      const maxUrls = clampInt(fields.maxUrls, 10, 1, 100);
      const maxQueries = clampInt(fields.maxQueries, 3, 1, 20);
      const maxResults = clampInt(fields.maxResultsPerQuery, 5, 1, 10);
      if (maxUrls != null) {
        out[EXTRA_DISCOVER_MAX_URLS] = maxUrls;
      } else {
        delete out[EXTRA_DISCOVER_MAX_URLS];
      }
      if (maxQueries != null) {
        out[EXTRA_DISCOVER_MAX_QUERIES] = maxQueries;
      } else {
        delete out[EXTRA_DISCOVER_MAX_QUERIES];
      }
      if (maxResults != null) {
        out[EXTRA_DISCOVER_MAX_RESULTS] = maxResults;
      } else {
        delete out[EXTRA_DISCOVER_MAX_RESULTS];
      }
    }
    if (queries.length) {
      out[EXTRA_SEARCH_QUERIES] = queries;
    } else {
      delete out[EXTRA_SEARCH_QUERIES];
    }
    mergeQueryTemplateIntoExtra(out, fields.queryTemplate);
  } else {
    for (const k of DISCOVER_EXTRA_KEYS) {
      delete out[k];
    }
  }

  return out;
}

export function stripDiscoverKeys(ex: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...ex };
  for (const k of DISCOVER_EXTRA_KEYS) {
    delete out[k];
  }
  return out;
}

export function formatDiscoverSummary(ex: Record<string, unknown> | undefined): string {
  if (!ex) {
    return "";
  }
  const template = parseQueryTemplate(ex[EXTRA_QUERY_TEMPLATE]);
  const templateLabel = QUERY_TEMPLATES.find((t) => t.value === template)?.label;
  const provider = String(ex[EXTRA_SEARCH_PROVIDER] || "none").toLowerCase();
  if (provider !== "tavily" && provider !== "searxng" && provider !== "auto" && !template) {
    return "";
  }
  const queries = ex[EXTRA_SEARCH_QUERIES];
  const n = Array.isArray(queries) ? queries.length : 0;
  const locale = String(ex[EXTRA_SEARCH_LOCALE] || "both");
  const label =
    provider === "searxng" ? "SearXNG" : provider === "auto" ? "auto" : "Tavily";
  const providerPart =
    provider === "tavily" || provider === "searxng" || provider === "auto"
      ? n > 0
        ? `发现/${label}×${n}（${locale}）`
        : `发现/${label}`
      : "";
  const parts: string[] = [];
  if (templateLabel) {
    parts.push(`模板/${templateLabel}`);
  }
  if (providerPart) {
    parts.push(providerPart);
  }
  return parts.join("、");
}
