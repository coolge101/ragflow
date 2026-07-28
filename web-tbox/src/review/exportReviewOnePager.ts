import { JOURNEY_STEPS, type JourneyStep } from "./journeySteps";
import { readChecklistForStep, readNoteForStep } from "./reviewStorage";

export function escapeHtml(s: string): string {
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

const ONE_PAGER_STYLES = `
  :root { color: #0f172a; }
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    line-height: 1.5;
    margin: 0;
    padding: 1rem 1.25rem 2rem;
    max-width: 900px;
    margin-left: auto;
    margin-right: auto;
  }
  h1 { font-size: 1.35rem; margin: 0 0 0.75rem; }
  h2 { font-size: 1.12rem; margin: 1.25rem 0 0.5rem; page-break-after: avoid; }
  h3 { font-size: 1rem; margin: 0.85rem 0 0.35rem; page-break-after: avoid; }
  .meta, .muted { color: #64748b; font-size: 0.88rem; }
  .meta { margin-bottom: 1.25rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.75rem; }
  section.step {
    margin-bottom: 1.25rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e2e8f0;
    page-break-inside: avoid;
  }
  section.step:last-of-type { border-bottom: none; }
  ul { margin: 0.35rem 0 0; padding-left: 1.2rem; }
  li { margin: 0.25rem 0; }
  .summary { margin: 0.35rem 0 0.65rem; color: #475569; font-size: 0.92rem; }
  .note {
    margin: 0.5rem 0 0;
    padding: 0.55rem 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.92rem;
    white-space: pre-wrap;
  }
  code { font-size: 0.88em; background: #f1f5f9; padding: 0.1em 0.35em; border-radius: 4px; }
  footer { margin-top: 2rem; font-size: 0.82rem; color: #64748b; }
  @page { size: A4; margin: 14mm; }
  @media print {
    body { padding: 0; max-width: none; }
    a { color: #0f172a; text-decoration: none; }
  }
`;

function wrapDocument(title: string, body: string, exportedAtIso: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${ONE_PAGER_STYLES}</style>
</head>
<body>
${body}
<footer>TBOX 页面确认导出 · 生成时间（UTC）${escapeHtml(exportedAtIso)}</footer>
</body>
</html>`;
}

function renderStepSection(step: JourneyStep, checks: boolean[], note: string, origin: string): string {
  const items = step.acceptance
    .map((line, i) => `<li>${checks[i] ? "☑" : "☐"} ${escapeHtml(line)}</li>`)
    .join("\n");
  const reviewUrl = `${origin}/review/step/${encodeURIComponent(step.id)}`;
  const noteBlock =
    note.trim().length > 0
      ? `<div class="note">${nl2br(note.trim())}</div>`
      : `<p class="muted">（无备注）</p>`;

  return `<section class="step">
<h2>动线 ${step.order} — ${escapeHtml(step.title)}</h2>
<p class="summary">${escapeHtml(step.summary)}</p>
<p><strong>点验路径</strong> <code>${escapeHtml(step.targetPath)}</code></p>
<p><strong>确认页</strong> <code>${escapeHtml(reviewUrl)}</code></p>
<h3>验收要点</h3>
<ul>
${items}
</ul>
<h3>确认备注</h3>
${noteBlock}
</section>`;
}

export type BuildSingleStepExportOpts = {
  step: JourneyStep;
  /** 与页面一致：未传则从 localStorage 读 */
  checklist?: boolean[];
  note?: string;
};

/** 单步一页 HTML（含打印样式，可用浏览器「打印 → 另存为 PDF」） */
export function buildSingleStepOnePagerHtml(opts: BuildSingleStepExportOpts): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const exportedAt = new Date().toISOString();
  const checks = opts.checklist ?? readChecklistForStep(opts.step);
  const note = opts.note ?? readNoteForStep(opts.step.id);
  const body = `
<h1>确认：${escapeHtml(opts.step.title)}</h1>
<p class="meta">动线序号 ${opts.step.order} · 本文件为离线评审一页纸，勾选与备注以导出时为准。</p>
${renderStepSection(opts.step, checks, note, origin)}
`;
  return wrapDocument(`确认：${opts.step.title} · TBOX`, body, exportedAt);
}

/** 全部动线合并为一页 HTML */
export function buildFullJourneyOnePagerHtml(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const exportedAt = new Date().toISOString();
  const sorted = [...JOURNEY_STEPS].sort((a, b) => a.order - b.order);
  const sections = sorted
    .map((s) => {
      const checks = readChecklistForStep(s);
      const note = readNoteForStep(s.id);
      return renderStepSection(s, checks, note, origin);
    })
    .join("\n");

  const body = `
<h1>TBOX 页面确认 — 全部动线</h1>
<p class="meta">共 ${sorted.length} 步；验收勾选与备注来自本机浏览器 localStorage。</p>
${sections}
`;
  return wrapDocument("TBOX 页面确认 — 全部动线", body, exportedAt);
}

export function downloadHtmlFile(filename: string, html: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
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

/** 新窗口打开并唤起打印（用户可选择「另存为 PDF」） */
export function printHtmlInNewWindow(html: string): boolean {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    return false;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  window.setTimeout(() => {
    try {
      w.print();
    } catch {
      /* ignore */
    }
  }, 300);
  return true;
}

export function exportFilenameDatePrefix(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
