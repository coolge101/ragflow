export type DocumentMetaFields = Record<string, unknown> & {
  source_url?: string;
  source_read_url?: string;
};

const WEB_SOURCE_PREFIXES = ["http://", "https://"];

/** Resolve a public URL for opening the publisher page (not the ingested file). */
export function resolveSourceReadUrl(
  metaFields: DocumentMetaFields | null | undefined,
): string | null {
  if (!metaFields) {
    return null;
  }
  const preferred = metaFields.source_read_url ?? metaFields.source_url;
  const url = String(preferred ?? "").trim();
  if (!url) {
    return null;
  }
  const normalized = url.toLowerCase();
  if (WEB_SOURCE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return url;
  }
  return null;
}

export function openWebSourceUrl(url: string): { ok: boolean; error?: string } {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    return { ok: false, error: "浏览器拦截了新窗口，请允许弹窗后重试" };
  }
  return { ok: true };
}
