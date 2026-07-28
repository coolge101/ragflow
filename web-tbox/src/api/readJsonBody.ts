const MAX_ERROR_BODY_SNIPPET = 500;

/**
 * Prefer JSON `message` / `error` from an API error body; otherwise return trimmed text (truncated if huge).
 */
export function messageFromUnknownResponseBody(text: string, fallback: string): string {
  const raw = (text ?? "").trim();
  if (!raw) {
    return fallback;
  }
  try {
    const j = JSON.parse(raw) as { message?: unknown; error?: unknown };
    if (typeof j.message === "string" && j.message.trim()) {
      return j.message.trim();
    }
    if (typeof j.error === "string" && j.error.trim()) {
      return j.error.trim();
    }
  } catch {
    /* not JSON */
  }
  return raw.length > MAX_ERROR_BODY_SNIPPET ? `${raw.slice(0, MAX_ERROR_BODY_SNIPPET)}…` : raw;
}

/**
 * Read JSON from a Response after `fetch`.
 * Tolerates empty body or non-JSON (e.g. HTML from a misconfigured proxy).
 * Callers should treat `code === -1` as a client-side parse fallback.
 */
export async function readJsonBody<T extends { code?: number; message?: string }>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    return { code: -1, message: "空响应体" } as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return { code: -1, message: "响应不是有效 JSON" } as T;
  }
}
