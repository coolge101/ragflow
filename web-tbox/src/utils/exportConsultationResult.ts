/** 咨询/对话结果导出（Markdown 下载、HTML 打印为 PDF） */

import { sanitizeChatFinal } from "./chatStreamSanitize";

export type ExportMessage = { role: "user" | "assistant"; content: string };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function exportFilenameDatePrefix(d = new Date()): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

export function formatChatMarkdown(params: {
  title: string;
  messages: ExportMessage[];
  appLabel?: string;
}): string {
  const lines: string[] = [`# ${params.title}`, ""];
  if (params.appLabel) {
    lines.push(`- **应用**：${params.appLabel}`, "");
  }
  lines.push(`- **导出时间**：${new Date().toLocaleString()}`, "", "---", "");

  for (const m of params.messages) {
    const heading = m.role === "user" ? "## 用户" : "## 助手";
    const body =
      m.role === "assistant" ? sanitizeChatFinal(m.content.trim()) : m.content.trim();
    lines.push(heading, "", body || "（空）", "", "---", "");
  }

  return lines.join("\n").replace(/\n---\n\n$/u, "\n");
}

export function downloadUtf8File(filename: string, content: string, mimeType = "text/markdown;charset=utf-8"): void {
  const blob = new Blob([content], { type: mimeType });
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(s: string): string {
  return escapeHtml(s).replace(/\n/g, "<br/>");
}

export function buildChatPrintHtml(params: {
  title: string;
  messages: ExportMessage[];
  appLabel?: string;
}): string {
  const meta = params.appLabel
    ? `<p class="muted">应用：${escapeHtml(params.appLabel)} · 导出：${escapeHtml(new Date().toLocaleString())}</p>`
    : `<p class="muted">导出：${escapeHtml(new Date().toLocaleString())}</p>`;

  const blocks = params.messages
    .map((m) => {
      const label = m.role === "user" ? "用户" : "助手";
      const raw = m.role === "assistant" ? sanitizeChatFinal(m.content.trim()) : m.content.trim();
      return `<section class="msg"><h2>${label}</h2><div class="body">${nl2br(raw || "（空）")}</div></section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(params.title)}</title>
  <style>
    body { font-family: system-ui, "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.55; margin: 1.2rem 1.5rem 2rem; color: #0f172a; max-width: 800px; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    .muted { color: #64748b; font-size: 0.9rem; }
    .msg { margin: 1rem 0; page-break-inside: avoid; }
    .msg h2 { font-size: 1rem; margin: 0 0 0.35rem; color: #334155; }
    .body { white-space: normal; word-break: break-word; }
    @media print { body { margin: 0.5in; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(params.title)}</h1>
  ${meta}
  ${blocks}
</body>
</html>`;
}

export type SearchExportChunk = { index: number; snippet: string };

export function formatSearchMarkdown(params: {
  title: string;
  datasetLabel: string;
  question: string;
  total: number;
  chunks: SearchExportChunk[];
}): string {
  const lines: string[] = [
    `# ${params.title}`,
    "",
    `- **知识库**：${params.datasetLabel}`,
    `- **问题**：${params.question}`,
    `- **命中数**：${params.total}`,
    `- **导出时间**：${new Date().toLocaleString()}`,
    "",
    "---",
    "",
  ];

  if (params.chunks.length === 0) {
    lines.push("（无命中片段）", "");
  } else {
    for (const c of params.chunks) {
      lines.push(`## 片段 ${c.index}`, "", c.snippet.trim() || "（空）", "", "---", "");
    }
  }

  return lines.join("\n").replace(/\n---\n\n$/u, "\n");
}

export function buildSearchPrintHtml(params: {
  title: string;
  datasetLabel: string;
  question: string;
  total: number;
  chunks: SearchExportChunk[];
}): string {
  const meta = `<p class="muted">知识库：${escapeHtml(params.datasetLabel)} · 问题：${escapeHtml(params.question)} · 命中 ${params.total} · 导出：${escapeHtml(new Date().toLocaleString())}</p>`;

  const blocks =
    params.chunks.length === 0
      ? `<p class="muted">（无命中片段）</p>`
      : params.chunks
          .map(
            (c) =>
              `<section class="msg"><h2>片段 ${c.index}</h2><div class="body">${nl2br(c.snippet.trim() || "（空）")}</div></section>`,
          )
          .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(params.title)}</title>
  <style>
    body { font-family: system-ui, "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.55; margin: 1.2rem 1.5rem 2rem; color: #0f172a; max-width: 800px; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    .muted { color: #64748b; font-size: 0.9rem; }
    .msg { margin: 1rem 0; page-break-inside: avoid; }
    .msg h2 { font-size: 1rem; margin: 0 0 0.35rem; color: #334155; }
    .body { white-space: normal; word-break: break-word; }
    @media print { body { margin: 0.5in; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(params.title)}</h1>
  ${meta}
  ${blocks}
</body>
</html>`;
}

/** 打开新窗口并触发打印（用户可选「另存为 PDF」） */
export function printHtmlDocument(html: string, windowTitle: string): void {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    throw new Error("无法打开打印窗口，请允许弹出窗口后重试。");
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = windowTitle;
  w.focus();
  window.setTimeout(() => {
    w.print();
  }, 300);
}
