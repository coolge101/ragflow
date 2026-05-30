/** G1 多格式入库向导 — 与 docs/TBOX_INGEST_FORMAT_SMOKE.md / ExcelParser 约定对齐。 */

export type G1FormatKind = "pdf" | "word" | "excel" | "image" | "other";

export type G1FormatRow = {
  kind: G1FormatKind;
  label: string;
  extensions: string;
  chunkMethod: string;
  note: string;
};

export const G1_FORMAT_ROWS: G1FormatRow[] = [
  {
    kind: "pdf",
    label: "PDF",
    extensions: ".pdf",
    chunkMethod: "naive",
    note: "含可复制文本即可；扫描件依赖 deepdoc OCR",
  },
  {
    kind: "word",
    label: "Word",
    extensions: ".docx",
    chunkMethod: "naive",
    note: "推荐 .docx",
  },
  {
    kind: "excel",
    label: "Excel",
    extensions: ".xlsx",
    chunkMethod: "naive 或 table",
    note: "须表头行 + 至少一行数据；单行单元格易 0 chunk",
  },
  {
    kind: "image",
    label: "图片",
    extensions: ".png / .jpg",
    chunkMethod: "picture",
    note: "OCR 提取文字；未配 image2text 时仍可用 OCR 文本入库",
  },
];

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i;
const EXCEL_EXT = /\.(xlsx?|csv)$/i;
const WORD_EXT = /\.(docx?|doc)$/i;
const PDF_EXT = /\.pdf$/i;

export function detectG1FormatFromFilename(filename: string): G1FormatKind {
  const n = filename.toLowerCase();
  if (PDF_EXT.test(n)) {
    return "pdf";
  }
  if (WORD_EXT.test(n)) {
    return "word";
  }
  if (EXCEL_EXT.test(n)) {
    return "excel";
  }
  if (IMAGE_EXT.test(n)) {
    return "image";
  }
  return "other";
}

/** 新建知识库时，按主要格式预选分块方式。 */
export function suggestChunkMethodForFormat(kind: G1FormatKind): string {
  if (kind === "image") {
    return "picture";
  }
  if (kind === "excel") {
    return "table";
  }
  return "naive";
}

function normalizeMethod(m: string): string {
  return m.trim().toLowerCase();
}

/** 当前库分块方式与待上传文件是否可能不匹配（仅 G1 四类）。 */
export function g1UploadChunkMethodWarning(
  files: File[],
  currentChunkMethod: string | null | undefined,
): string | null {
  const method = normalizeMethod(currentChunkMethod || "naive");
  const kinds = new Set(files.map((f) => detectG1FormatFromFilename(f.name)));

  if (kinds.has("image") && method !== "picture") {
    return "所选文件含图片，建议将本分块方式改为 picture（知识库配置），或使用 picture 分块的新库。";
  }
  if (kinds.has("excel") && method === "naive") {
    return "Excel 在 naive 下须含表头行 + 数据行；表格为主时建议在知识库配置改用 table 分块。";
  }
  return null;
}

export function g1CreateModalHint(chunkMethod: string): string | null {
  const m = normalizeMethod(chunkMethod);
  if (m === "picture") {
    return "picture：适合 PNG/JPG 等图片 OCR 入库。";
  }
  if (m === "table") {
    return "table：适合 Excel/CSV 结构化表格。";
  }
  if (m === "naive") {
    return "naive：PDF/Word 通用；Excel 须表头+数据行；图片请选 picture。";
  }
  return null;
}
