/** 搜索发现键（写入任务 extra_config；worker 消费 Tavily / 未来 SearXNG） */

export const EXTRA_SEARCH_PROVIDER = "tbox_crawl_search_provider";
export const EXTRA_SEARCH_QUERIES = "tbox_crawl_search_queries";
export const EXTRA_SEARCH_LOCALE = "tbox_crawl_search_locale";
export const EXTRA_DISCOVER_MAX_URLS = "tbox_crawl_discover_max_urls";
export const EXTRA_DISCOVER_MAX_QUERIES = "tbox_crawl_discover_max_queries";
export const EXTRA_DISCOVER_MAX_RESULTS = "tbox_crawl_discover_max_results_per_query";
export const EXTRA_TAVILY_DEPTH = "tbox_crawl_tavily_depth";

export const DISCOVER_EXTRA_KEYS = new Set([
  EXTRA_SEARCH_PROVIDER,
  EXTRA_SEARCH_QUERIES,
  EXTRA_SEARCH_LOCALE,
  EXTRA_DISCOVER_MAX_URLS,
  EXTRA_DISCOVER_MAX_QUERIES,
  EXTRA_DISCOVER_MAX_RESULTS,
  EXTRA_TAVILY_DEPTH,
]);

export type DiscoverProvider = "none" | "tavily" | "searxng";
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
};

export const EMPTY_DISCOVER_FIELDS: DiscoverFields = {
  provider: "none",
  queries: "",
  locale: "both",
  maxUrls: "",
  maxQueries: "",
  maxResultsPerQuery: "",
  tavilyDepth: "basic",
};

function parseDiscoverProvider(raw: unknown): DiscoverProvider {
  const s = String(raw || "none").trim().toLowerCase();
  if (s === "tavily") {
    return "tavily";
  }
  if (s === "searxng") {
    return "searxng";
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
  };
}

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

  if ((fields.provider === "tavily" || fields.provider === "searxng") && queries.length) {
    out[EXTRA_SEARCH_PROVIDER] = fields.provider;
    out[EXTRA_SEARCH_QUERIES] = queries;
    out[EXTRA_SEARCH_LOCALE] = fields.locale;
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
    out[EXTRA_TAVILY_DEPTH] = fields.tavilyDepth;
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
  const provider = String(ex[EXTRA_SEARCH_PROVIDER] || "none").toLowerCase();
  if (provider !== "tavily" && provider !== "searxng") {
    return "";
  }
  const queries = ex[EXTRA_SEARCH_QUERIES];
  const n = Array.isArray(queries) ? queries.length : 0;
  const locale = String(ex[EXTRA_SEARCH_LOCALE] || "both");
  const label = provider === "searxng" ? "SearXNG" : "Tavily";
  return n > 0 ? `发现/${label}×${n}（${locale}）` : `发现/${label}`;
}
