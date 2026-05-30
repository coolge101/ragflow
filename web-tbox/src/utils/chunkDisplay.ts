/** 从 RAGFlow chunk / reference 行提取展示字段（对话引用与检索共用） */

export type ChunkDisplayItem = {
  key: string;
  doc: string;
  text: string;
  similarity: number | null;
};

export function chunkRowToDisplayItem(row: Record<string, unknown>, index: number): ChunkDisplayItem {
  const doc =
    (row.document_keyword as string) ||
    (row.docnm_kwd as string) ||
    (row.document_id as string) ||
    `片段 ${index + 1}`;
  const text =
    (row.content_with_weight as string) ||
    (row.content as string) ||
    (row.content_ltks as string) ||
    "";
  const simRaw = row.similarity;
  const similarity = simRaw != null && simRaw !== "" ? Number(simRaw) : null;
  return {
    key: String(row.chunk_id ?? row.id ?? index),
    doc,
    text,
    similarity: Number.isFinite(similarity) ? similarity : null,
  };
}

export function chunksFromReference(reference: unknown): ChunkDisplayItem[] {
  if (!reference || typeof reference !== "object") {
    return [];
  }
  const chunks = (reference as { chunks?: unknown }).chunks;
  if (!Array.isArray(chunks)) {
    return [];
  }
  return chunks.map((c, i) => chunkRowToDisplayItem(c as Record<string, unknown>, i));
}

export function formatSimilaritySuffix(similarity: number | null): string {
  return similarity != null ? ` · ${similarity.toFixed(3)}` : "";
}

export function formatChunkSnippet(item: ChunkDisplayItem, textLimit = 500): string {
  const sim = item.similarity != null ? `相似度 ${item.similarity.toFixed(3)}` : "";
  return [item.doc && `【${item.doc}】`, sim, item.text.slice(0, textLimit)].filter(Boolean).join("\n");
}
