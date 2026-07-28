/** 咨询/检索结果 Office 导出（Word .docx、Excel .xlsx、PowerPoint .pptx）— 纯前端，按需加载库 */

import type { ExportMessage } from "./exportConsultationResult";
import { exportFilenameDatePrefix } from "./exportConsultationResult";

export const LARGE_EXPORT_CHAT_THRESHOLD = 200;
export const LARGE_EXPORT_SEARCH_THRESHOLD = 500;

const SLIDE_FONT = "Microsoft YaHei";
const SLIDE_BODY_MAX = 6000;

export type SearchExportRow = {
  index: number;
  document: string;
  similarity: string;
  snippet: string;
};

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function confirmLargeExport(count: number, label: string, threshold: number): boolean {
  if (count <= threshold) {
    return true;
  }
  return window.confirm(`当前${label}共 ${count} 条，导出可能较慢或文件较大。是否继续？`);
}

function splitParagraphLines(text: string): string[] {
  const t = text.trim();
  if (!t) {
    return ["（空）"];
  }
  const lines = t.split(/\r?\n/u);
  return lines.length ? lines : [t];
}

export async function exportChatToDocx(params: {
  title: string;
  messages: ExportMessage[];
  appLabel?: string;
}): Promise<void> {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");

  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ text: params.title, heading: HeadingLevel.HEADING_1 }),
  ];

  const meta = (text: string) =>
    new Paragraph({
      children: [new TextRun({ text, color: "64748B", size: 20 })],
      spacing: { after: 120 },
    });

  if (params.appLabel) {
    children.push(meta(`应用：${params.appLabel}`));
  }
  children.push(meta(`导出时间：${new Date().toLocaleString()}`));

  for (const m of params.messages) {
    const label = m.role === "user" ? "用户" : "助手";
    children.push(
      new Paragraph({
        text: label,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 80 },
      }),
    );
    for (const line of splitParagraphLines(m.content)) {
      children.push(
        new Paragraph({
          children: [new TextRun(line)],
          spacing: { after: 60 },
        }),
      );
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(`tbox-chat-${exportFilenameDatePrefix()}.docx`, blob);
}

export function parseSearchChunkRow(c: Record<string, unknown>, index: number): SearchExportRow {
  const documentName = String(c.document_keyword ?? c.docnm_kwd ?? "");
  const content = String(c.content_with_weight ?? c.content_ltks ?? c.content ?? "");
  const similarity =
    c.similarity != null && c.similarity !== "" ? Number(c.similarity).toFixed(3) : "";
  return {
    index,
    document: documentName,
    similarity,
    snippet: content.slice(0, 32000),
  };
}

export async function exportSearchToXlsx(params: {
  title: string;
  datasetLabel: string;
  question: string;
  total: number;
  rows: SearchExportRow[];
}): Promise<void> {
  const XLSX = await import("xlsx");

  const header = ["序号", "文档", "相似度", "片段内容"];
  const data = params.rows.map((r) => [r.index, r.document, r.similarity, r.snippet]);
  const meta = [
    ["标题", params.title],
    ["知识库", params.datasetLabel],
    ["问题", params.question],
    ["命中数", params.total],
    ["导出时间", new Date().toLocaleString()],
    [],
    header,
    ...data,
  ];

  const ws = XLSX.utils.aoa_to_sheet(meta);
  ws["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 10 }, { wch: 80 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "检索结果");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  downloadBlob(
    `tbox-search-${exportFilenameDatePrefix()}.xlsx`,
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}

function slideBody(text: string, max = SLIDE_BODY_MAX): string {
  const t = text.trim() || "（空）";
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function addTitleSlide(pptx: Awaited<ReturnType<typeof createPptx>>, title: string, lines: string[]): void {
  const slide = pptx.addSlide();
  slide.addText(title, {
    x: 0.6,
    y: 0.8,
    w: 8.8,
    h: 1.2,
    fontSize: 28,
    bold: true,
    fontFace: SLIDE_FONT,
    color: "0F172A",
  });
  if (lines.length) {
    slide.addText(lines.join("\n"), {
      x: 0.6,
      y: 2.2,
      w: 8.8,
      h: 3.5,
      fontSize: 14,
      fontFace: SLIDE_FONT,
      color: "64748B",
      valign: "top",
      wrap: true,
    });
  }
}

async function loadPptxGen() {
  const mod = await import("pptxgenjs");
  return mod.default;
}

async function createPptx() {
  const pptxgen = await loadPptxGen();
  return new pptxgen();
}

export async function exportChatToPptx(params: {
  title: string;
  messages: ExportMessage[];
  appLabel?: string;
}): Promise<void> {
  const pptx = await createPptx();
  pptx.author = "TBOX";
  pptx.title = params.title;
  pptx.layout = "LAYOUT_16x9";

  const meta: string[] = [`导出时间：${new Date().toLocaleString()}`];
  if (params.appLabel) {
    meta.unshift(`应用：${params.appLabel}`);
  }
  addTitleSlide(pptx, params.title, meta);

  for (const m of params.messages) {
    const label = m.role === "user" ? "用户" : "助手";
    const slide = pptx.addSlide();
    slide.addText(label, {
      x: 0.6,
      y: 0.45,
      w: 8.8,
      h: 0.6,
      fontSize: 20,
      bold: true,
      fontFace: SLIDE_FONT,
      color: m.role === "user" ? "1D4ED8" : "334155",
    });
    slide.addText(slideBody(m.content), {
      x: 0.6,
      y: 1.15,
      w: 8.8,
      h: 5.6,
      fontSize: 14,
      fontFace: SLIDE_FONT,
      color: "0F172A",
      valign: "top",
      wrap: true,
    });
  }

  await pptx.writeFile({ fileName: `tbox-chat-${exportFilenameDatePrefix()}.pptx` });
}

export async function exportSearchToPptx(params: {
  title: string;
  datasetLabel: string;
  question: string;
  total: number;
  rows: SearchExportRow[];
}): Promise<void> {
  const pptx = await createPptx();
  pptx.author = "TBOX";
  pptx.title = params.title;
  pptx.layout = "LAYOUT_16x9";

  addTitleSlide(pptx, params.title, [
    `知识库：${params.datasetLabel}`,
    `问题：${params.question}`,
    `命中数：${params.total}`,
    `导出时间：${new Date().toLocaleString()}`,
  ]);

  for (const row of params.rows) {
    const slide = pptx.addSlide();
    slide.addText(`片段 ${row.index}`, {
      x: 0.6,
      y: 0.45,
      w: 8.8,
      h: 0.6,
      fontSize: 20,
      bold: true,
      fontFace: SLIDE_FONT,
      color: "334155",
    });
    const parts: string[] = [];
    if (row.document) {
      parts.push(`文档：${row.document}`);
    }
    if (row.similarity) {
      parts.push(`相似度：${row.similarity}`);
    }
    parts.push(slideBody(row.snippet));
    const body = parts.join("\n\n");
    slide.addText(body, {
      x: 0.6,
      y: 1.15,
      w: 8.8,
      h: 5.6,
      fontSize: 13,
      fontFace: SLIDE_FONT,
      color: "0F172A",
      valign: "top",
      wrap: true,
    });
  }

  await pptx.writeFile({ fileName: `tbox-search-${exportFilenameDatePrefix()}.pptx` });
}
