/** Phase 68 质量相关 extra_config 键 */

export const EXTRA_URL_QUALITY_MODE = "tbox_crawl_url_quality_mode";
export const EXTRA_DISCOVER_SKIP_BFS = "tbox_crawl_discover_skip_bfs";
export const EXTRA_EXTRACT_MAIN_CONTENT = "tbox_crawl_extract_main_content";
export const EXTRA_MIN_EXTRACT_CHARS = "tbox_crawl_min_extract_chars";

export const QUALITY_EXTRA_KEYS = new Set([
  EXTRA_URL_QUALITY_MODE,
  EXTRA_DISCOVER_SKIP_BFS,
  EXTRA_EXTRACT_MAIN_CONTENT,
  EXTRA_MIN_EXTRACT_CHARS,
]);

export type UrlQualityMode = "strict" | "normal" | "off";

export type CrawlQualityFields = {
  urlQualityMode: UrlQualityMode;
  discoverSkipBfs: boolean;
  extractMainContent: boolean;
  minExtractChars: string;
};

export const EMPTY_QUALITY_FIELDS: CrawlQualityFields = {
  urlQualityMode: "normal",
  discoverSkipBfs: true,
  extractMainContent: true,
  minExtractChars: "200",
};

export function qualityFieldsFromExtra(ex: Record<string, unknown> | undefined): CrawlQualityFields {
  const modeRaw = String(ex?.[EXTRA_URL_QUALITY_MODE] || "normal").toLowerCase();
  const urlQualityMode: UrlQualityMode =
    modeRaw === "strict" || modeRaw === "off" ? modeRaw : "normal";
  const skipRaw = ex?.[EXTRA_DISCOVER_SKIP_BFS];
  const discoverSkipBfs = skipRaw === undefined ? true : Boolean(skipRaw);
  const extractRaw = ex?.[EXTRA_EXTRACT_MAIN_CONTENT];
  const extractMainContent = extractRaw === undefined ? true : Boolean(extractRaw);
  const minRaw = ex?.[EXTRA_MIN_EXTRACT_CHARS];
  const minExtractChars =
    typeof minRaw === "number" && Number.isFinite(minRaw) ? String(minRaw) : typeof minRaw === "string" ? minRaw : "200";
  return { urlQualityMode, discoverSkipBfs, extractMainContent, minExtractChars };
}

export function mergeQualityIntoExtra(
  base: Record<string, unknown> | undefined,
  fields: CrawlQualityFields,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(base || {}) };
  out[EXTRA_URL_QUALITY_MODE] = fields.urlQualityMode;
  out[EXTRA_DISCOVER_SKIP_BFS] = fields.discoverSkipBfs;
  out[EXTRA_EXTRACT_MAIN_CONTENT] = fields.extractMainContent;
  const minTrim = fields.minExtractChars.trim();
  const minNum = minTrim === "" ? NaN : Number(minTrim);
  if (Number.isFinite(minNum) && minNum >= 1) {
    out[EXTRA_MIN_EXTRACT_CHARS] = Math.floor(minNum);
  } else {
    delete out[EXTRA_MIN_EXTRACT_CHARS];
  }
  return out;
}

export function stripQualityKeys(ex: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...ex };
  for (const k of QUALITY_EXTRA_KEYS) {
    delete out[k];
  }
  return out;
}

export function formatQualitySummary(ex: Record<string, unknown> | undefined): string {
  if (!ex) {
    return "";
  }
  const parts: string[] = [];
  const mode = String(ex[EXTRA_URL_QUALITY_MODE] || "normal");
  if (mode !== "off") {
    parts.push(`URL质量=${mode}`);
  }
  if (ex[EXTRA_EXTRACT_MAIN_CONTENT] !== false) {
    parts.push("正文抽取");
  }
  return parts.join("、");
}
