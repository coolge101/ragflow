/**
 * RAGFlow `UpdateDatasetReq` / `CreateDatasetReq` 使用严格 `ParserConfig`（extra=forbid）。
 * `GET /api/v1/datasets/:id` 返回的 `parser_config` 可能含历史/文档级字段（如 llm_id、image_context_size），
 * 直接 PUT 会报 Extra inputs are not permitted。保存前用本函数裁剪为 API 允许的顶层键。
 *
 * 与 `api/utils/validation_utils.py` 中 `ParserConfig` 字段保持一致。
 */
const PARSER_CONFIG_TOP_KEYS = new Set([
  "auto_keywords",
  "auto_questions",
  "chunk_token_num",
  "delimiter",
  "graphrag",
  "html4excel",
  "layout_recognize",
  "parent_child",
  "raptor",
  "tag_kb_ids",
  "topn_tags",
  "filename_embd_weight",
  "task_page_size",
  "pages",
  "ext",
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** 顶层误放的 children_delimiter 归并到 parent_child（Pydantic 只允许在 parent_child 下）。 */
function relocateTopLevelChildrenDelimiter(src: Record<string, unknown>): void {
  if (!("children_delimiter" in src)) {
    return;
  }
  const del = src.children_delimiter;
  delete src.children_delimiter;
  let pc: Record<string, unknown>;
  if (isPlainObject(src.parent_child)) {
    pc = { ...src.parent_child };
  } else {
    pc = { use_parent_child: false, children_delimiter: "\\n" };
  }
  if (pc.children_delimiter === undefined || pc.children_delimiter === "\\n") {
    pc.children_delimiter = typeof del === "string" ? del : String(del ?? "\\n");
  }
  src.parent_child = pc;
}

/**
 * 返回仅含 API 允许顶层键的 parser_config；移除 llm_id、image_context_size、table_context_size、metadata 等。
 */
export function sanitizeParserConfigForDatasetUpdate(raw: unknown): Record<string, unknown> {
  if (!isPlainObject(raw)) {
    return {};
  }
  const src = { ...raw };
  relocateTopLevelChildrenDelimiter(src);
  delete src.llm_id;
  delete src.image_context_size;
  delete src.table_context_size;
  delete src.enable_metadata;
  delete src.metadata;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (PARSER_CONFIG_TOP_KEYS.has(k)) {
      out[k] = v;
    }
  }
  return out;
}
