import { getAuthorizationHeader } from "../auth/session";

export type ChatStreamEvent =
  | { type: "delta"; answer: string; reference?: unknown }
  | { type: "done" }
  | { type: "error"; message: string };

function parseSseBlock(block: string, onEvent: (ev: ChatStreamEvent) => void): void {
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) {
      continue;
    }
    const jsonStr = line.slice(5).trim();
    if (!jsonStr) {
      continue;
    }
    let parsed: { code?: number; message?: string; data?: unknown };
    try {
      parsed = JSON.parse(jsonStr) as { code?: number; message?: string; data?: unknown };
    } catch {
      continue;
    }

    if (parsed.data === true) {
      onEvent({ type: "done" });
      continue;
    }

    if (parsed.code !== undefined && parsed.code !== 0) {
      onEvent({ type: "error", message: parsed.message || `code ${parsed.code}` });
      continue;
    }

    if (parsed.data && typeof parsed.data === "object") {
      const d = parsed.data as { answer?: string; reference?: unknown };
      if ("answer" in d) {
        onEvent({ type: "delta", answer: d.answer ?? "", reference: d.reference });
      }
    }
  }
}

function authJsonHeaders(): HeadersInit {
  const a = getAuthorizationHeader();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (a) {
    h.Authorization = a;
  }
  return h;
}

/**
 * POST /api/v1/chat/completions with stream: true (SSE).
 * Solo 模式：不传 chat_id 时使用租户默认对话模型（与官方 `web/` 一致）。
 */
export async function streamChatCompletions(
  payload: {
    messages: Array<{ role: string; content: string; id?: string }>;
    chat_id?: string;
    session_id?: string;
    stream?: boolean;
  },
  onEvent: (ev: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const streamFailed = (e: unknown) => {
    if (signal?.aborted) {
      onEvent({ type: "error", message: "已取消" });
      return;
    }
    onEvent({ type: "error", message: e instanceof Error ? e.message : String(e) });
  };

  try {
    const res = await fetch("/api/v1/chat/completions", {
      method: "POST",
      headers: authJsonHeaders(),
      body: JSON.stringify({ stream: true, ...payload }),
      signal,
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      onEvent({ type: "error", message: t || `HTTP ${res.status}` });
      return;
    }

    if (!res.body) {
      onEvent({ type: "error", message: "无响应体" });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          parseSseBlock(block, onEvent);
        }
      }

      if (buffer.trim()) {
        for (const block of buffer.split("\n\n")) {
          parseSseBlock(block, onEvent);
        }
      }
    } catch (e) {
      streamFailed(e);
    }
  } catch (e) {
    streamFailed(e);
  }
}
