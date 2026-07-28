/** Phase 69.3 入库前相关性 extra_config 键 */

export const EXTRA_RELEVANCE_MODE = "tbox_crawl_relevance_mode";
export const EXTRA_RELEVANCE_MIN_SCORE = "tbox_crawl_relevance_min_score";
export const EXTRA_RELEVANCE_TOPIC = "tbox_crawl_relevance_topic";

export const RELEVANCE_EXTRA_KEYS = new Set([
  EXTRA_RELEVANCE_MODE,
  EXTRA_RELEVANCE_MIN_SCORE,
  EXTRA_RELEVANCE_TOPIC,
]);

export type RelevanceMode = "off" | "rules" | "llm" | "rules_then_llm";

export type CrawlRelevanceFields = {
  relevanceMode: RelevanceMode;
  relevanceMinScore: string;
  relevanceTopic: string;
};

export const EMPTY_RELEVANCE_FIELDS: CrawlRelevanceFields = {
  relevanceMode: "off",
  relevanceMinScore: "60",
  relevanceTopic: "",
};

export function relevanceFieldsFromExtra(ex: Record<string, unknown> | undefined): CrawlRelevanceFields {
  const modeRaw = String(ex?.[EXTRA_RELEVANCE_MODE] || "off").toLowerCase();
  const relevanceMode: RelevanceMode =
    modeRaw === "rules" || modeRaw === "llm" || modeRaw === "rules_then_llm" ? modeRaw : "off";
  const minRaw = ex?.[EXTRA_RELEVANCE_MIN_SCORE];
  const relevanceMinScore =
    typeof minRaw === "number" && Number.isFinite(minRaw) ? String(minRaw) : typeof minRaw === "string" ? minRaw : "60";
  const relevanceTopic = typeof ex?.[EXTRA_RELEVANCE_TOPIC] === "string" ? ex[EXTRA_RELEVANCE_TOPIC] : "";
  return { relevanceMode, relevanceMinScore, relevanceTopic };
}

export function mergeRelevanceIntoExtra(
  base: Record<string, unknown> | undefined,
  fields: CrawlRelevanceFields,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(base || {}) };
  if (fields.relevanceMode === "off") {
    delete out[EXTRA_RELEVANCE_MODE];
    delete out[EXTRA_RELEVANCE_MIN_SCORE];
    delete out[EXTRA_RELEVANCE_TOPIC];
    return out;
  }
  out[EXTRA_RELEVANCE_MODE] = fields.relevanceMode;
  const minTrim = fields.relevanceMinScore.trim();
  const minNum = minTrim === "" ? NaN : Number(minTrim);
  if (Number.isFinite(minNum) && minNum >= 0 && minNum <= 100) {
    out[EXTRA_RELEVANCE_MIN_SCORE] = Math.floor(minNum);
  } else {
    delete out[EXTRA_RELEVANCE_MIN_SCORE];
  }
  const topic = fields.relevanceTopic.trim();
  if (topic) {
    out[EXTRA_RELEVANCE_TOPIC] = topic;
  } else {
    delete out[EXTRA_RELEVANCE_TOPIC];
  }
  return out;
}

export function formatRelevanceSummary(ex: Record<string, unknown> | undefined): string {
  const mode = String(ex?.[EXTRA_RELEVANCE_MODE] || "off");
  if (mode === "off") {
    return "";
  }
  const min = ex?.[EXTRA_RELEVANCE_MIN_SCORE];
  return `相关性=${mode}${min != null ? `(≥${min})` : ""}`;
}

export function stripRelevanceKeys(ex: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...ex };
  for (const k of RELEVANCE_EXTRA_KEYS) {
    delete out[k];
  }
  return out;
}
