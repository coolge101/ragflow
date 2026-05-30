/** 爬取高级源键（auth profile / http_api；写入 extra_config） */

export const EXTRA_CRAWL_AUTH_PROFILE = "tbox_crawl_auth_profile";
export const EXTRA_CRAWL_API_ITEMS_PATH = "tbox_crawl_api_items_path";
export const EXTRA_CRAWL_API_CONTENT_FIELDS = "tbox_crawl_api_content_fields";
export const EXTRA_CRAWL_API_ID_FIELD = "tbox_crawl_api_id_field";

export const ADVANCED_EXTRA_KEYS = new Set([
  EXTRA_CRAWL_AUTH_PROFILE,
  EXTRA_CRAWL_API_ITEMS_PATH,
  EXTRA_CRAWL_API_CONTENT_FIELDS,
  EXTRA_CRAWL_API_ID_FIELD,
]);

export type CrawlAdvancedFields = {
  authProfile: string;
  apiItemsPath: string;
  apiContentFields: string;
  apiIdField: string;
};

export type CrawlSourceType = "static_web" | "rss" | "http_api";

export function parseCrawlSourceType(raw: string | undefined): CrawlSourceType {
  if (raw === "rss" || raw === "http_api") {
    return raw;
  }
  return "static_web";
}

export function advancedFieldsFromExtra(ex: Record<string, unknown> | undefined): CrawlAdvancedFields {
  const authRaw = ex?.[EXTRA_CRAWL_AUTH_PROFILE];
  const pathRaw = ex?.[EXTRA_CRAWL_API_ITEMS_PATH];
  const fieldsRaw = ex?.[EXTRA_CRAWL_API_CONTENT_FIELDS];
  const idRaw = ex?.[EXTRA_CRAWL_API_ID_FIELD];

  const authProfile = typeof authRaw === "string" ? authRaw : "";

  const apiItemsPath = typeof pathRaw === "string" ? pathRaw : "";

  const apiContentFields = Array.isArray(fieldsRaw)
    ? fieldsRaw.map(String).join("\n")
    : typeof fieldsRaw === "string"
      ? fieldsRaw
      : "";

  const apiIdField = typeof idRaw === "string" ? idRaw : "";

  return { authProfile, apiItemsPath, apiContentFields, apiIdField };
}

export function mergeAdvancedIntoExtra(
  base: Record<string, unknown> | undefined,
  fields: CrawlAdvancedFields,
  sourceType: CrawlSourceType,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(base || {}) };
  const profile = fields.authProfile.trim();

  if (profile) {
    out[EXTRA_CRAWL_AUTH_PROFILE] = profile;
  } else {
    delete out[EXTRA_CRAWL_AUTH_PROFILE];
  }

  if (sourceType === "http_api") {
    const path = fields.apiItemsPath.trim();
    const idField = fields.apiIdField.trim();
    const contentFields = fields.apiContentFields
      .split(/[\n,，;；]+/u)
      .map((s) => s.trim())
      .filter(Boolean);

    if (path) {
      out[EXTRA_CRAWL_API_ITEMS_PATH] = path;
    } else {
      delete out[EXTRA_CRAWL_API_ITEMS_PATH];
    }

    if (contentFields.length) {
      out[EXTRA_CRAWL_API_CONTENT_FIELDS] = contentFields;
    } else {
      delete out[EXTRA_CRAWL_API_CONTENT_FIELDS];
    }

    if (idField) {
      out[EXTRA_CRAWL_API_ID_FIELD] = idField;
    } else {
      delete out[EXTRA_CRAWL_API_ID_FIELD];
    }
  } else {
    delete out[EXTRA_CRAWL_API_ITEMS_PATH];
    delete out[EXTRA_CRAWL_API_CONTENT_FIELDS];
    delete out[EXTRA_CRAWL_API_ID_FIELD];
  }

  return out;
}

export function stripAdvancedKeys(ex: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...ex };
  for (const k of ADVANCED_EXTRA_KEYS) {
    delete out[k];
  }
  return out;
}

export function formatAdvancedSummary(ex: Record<string, unknown> | undefined): string {
  if (!ex) {
    return "";
  }
  const parts: string[] = [];
  const profile = ex[EXTRA_CRAWL_AUTH_PROFILE];
  if (typeof profile === "string" && profile.trim()) {
    parts.push(`auth:${profile.trim()}`);
  }
  const path = ex[EXTRA_CRAWL_API_ITEMS_PATH];
  if (typeof path === "string" && path.trim()) {
    parts.push(`API路径:${path.trim()}`);
  }
  const fields = ex[EXTRA_CRAWL_API_CONTENT_FIELDS];
  if (Array.isArray(fields) && fields.length) {
    parts.push(`API字段×${fields.length}`);
  }
  return parts.join("、");
}
