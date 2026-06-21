import { getAuthorizationHeader } from "../auth/session";

import { downloadBlob } from "./exportOffice";

function authOnly(): HeadersInit {
  const a = getAuthorizationHeader();
  return a ? { Authorization: a } : {};
}

/** Blob preview defaults to Latin-1 unless charset is set on text/* types. */
export function withUtf8Charset(contentType: string | undefined): string | undefined {
  if (!contentType) {
    return contentType;
  }
  const base = contentType.split(";")[0]?.trim().toLowerCase();
  if (!base || !["text/html", "text/plain", "text/markdown", "text/csv"].includes(base)) {
    return contentType;
  }
  if (/charset=/i.test(contentType)) {
    return contentType;
  }
  return `${base};charset=utf-8`;
}

/** GET /api/v1/documents/:id/preview — raw file bytes (upload + crawl ingest). */
export async function fetchDocumentOriginalBlob(
  docId: string,
): Promise<{ blob: Blob | null; contentType?: string; error?: string }> {
  const res = await fetch(`/api/v1/documents/${encodeURIComponent(docId)}/preview`, {
    headers: authOnly(),
  });
  if (res.status === 401) {
    return { blob: null, error: "未授权" };
  }
  if (!res.ok) {
    let msg = `无法读取原文 HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string };
      if (j.message) {
        msg = j.message;
      }
    } catch {
      /* binary or empty */
    }
    return { blob: null, error: msg };
  }
  const blob = await res.blob();
  const contentType = res.headers.get("Content-Type") || undefined;
  return { blob, contentType };
}

function safeFilename(name: string, fallback: string): string {
  const base = (name || fallback).trim() || fallback;
  return base.replace(/[/\\?%*:|"<>]/g, "_");
}

/** Open original file in a new browser tab (HTML/PDF/图片/文本等). */
export async function openDocumentOriginalInNewTab(
  docId: string,
  filename: string,
): Promise<{ ok: boolean; error?: string }> {
  const { blob, contentType, error } = await fetchDocumentOriginalBlob(docId);
  if (error || !blob) {
    return { ok: false, error: error || "无法读取原文" };
  }
  const rawType =
    contentType && contentType !== "application/octet-stream" ? contentType : guessMimeFromName(filename);
  const type = withUtf8Charset(rawType);
  const viewBlob = type && blob.type !== type ? blob.slice(0, blob.size, type) : blob;
  const url = URL.createObjectURL(viewBlob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    URL.revokeObjectURL(url);
    return { ok: false, error: "浏览器拦截了新窗口，请允许弹窗或改用「下载原文」" };
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return { ok: true };
}

export async function downloadDocumentOriginal(
  docId: string,
  filename: string,
): Promise<{ ok: boolean; error?: string }> {
  const { blob, error } = await fetchDocumentOriginalBlob(docId);
  if (error || !blob) {
    return { ok: false, error: error || "无法下载原文" };
  }
  downloadBlob(safeFilename(filename, docId), blob);
  return { ok: true };
}

function guessMimeFromName(name: string): string | undefined {
  const lower = name.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return "text/html;charset=utf-8";
  }
  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return "text/plain;charset=utf-8";
  }
  if (lower.endsWith(".json")) {
    return "application/json;charset=utf-8";
  }
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(lower)) {
    const ext = lower.split(".").pop() || "png";
    return ext === "jpg" ? "image/jpeg" : `image/${ext === "svg" ? "svg+xml" : ext}`;
  }
  return undefined;
}
