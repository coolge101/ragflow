import { getAuthorizationHeader } from "../auth/session";

import { readJsonBody } from "./readJsonBody";

export type ChatRow = Record<string, unknown> & {
  id?: string;
  name?: string;
  description?: string;
};

export type ListChatsJson = {
  code: number;
  message?: string;
  data?: { chats?: ChatRow[]; total?: number };
};

export type SessionMessage = { role?: string; content?: string; id?: string };

export type CreateSessionJson = {
  code: number;
  message?: string;
  data?: {
    id?: string;
    chat_id?: string;
    name?: string;
    messages?: SessionMessage[];
  };
};

/** 列表/详情中的会话摘要（字段以后端为准） */
export type SessionSummary = {
  id?: string;
  name?: string;
  messages?: SessionMessage[];
};

export type ListSessionsJson = {
  code: number;
  message?: string;
  data?: SessionSummary[];
};

export type GetSessionJson = {
  code: number;
  message?: string;
  data?: SessionSummary & { avatar?: string };
};

function authHeaders(): HeadersInit {
  const a = getAuthorizationHeader();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (a) {
    h.Authorization = a;
  }
  return h;
}

function authHeadersGet(): HeadersInit {
  const a = getAuthorizationHeader();
  return a ? { Authorization: a } : {};
}

/** GET /api/v1/chats — 当前用户可见的应用（对话配置）列表 */
export async function listChats(params: { page?: number; page_size?: number } = {}): Promise<{
  res: Response;
  body: ListChatsJson;
}> {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.page_size ?? 80));
  const res = await fetch(`/api/v1/chats?${q.toString()}`, {
    headers: authHeaders(),
  });
  const body = await readJsonBody<ListChatsJson>(res);
  return { res, body };
}

/** POST /api/v1/chats/:chatId/sessions — 创建会话（含开场白消息） */
export async function createChatSession(
  chatId: string,
  name = "新会话",
): Promise<{ res: Response; body: CreateSessionJson }> {
  const res = await fetch(`/api/v1/chats/${encodeURIComponent(chatId)}/sessions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  const body = await readJsonBody<CreateSessionJson>(res);
  return { res, body };
}

/** GET /api/v1/chats/:chatId/sessions — 会话列表 */
export async function listSessions(
  chatId: string,
  params: { page?: number; page_size?: number } = {},
): Promise<{ res: Response; body: ListSessionsJson }> {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.page_size ?? 50));
  q.set("orderby", "update_time");
  q.set("desc", "true");
  const res = await fetch(
    `/api/v1/chats/${encodeURIComponent(chatId)}/sessions?${q.toString()}`,
    { headers: authHeadersGet() },
  );
  const body = await readJsonBody<ListSessionsJson>(res);
  return { res, body };
}

/** GET /api/v1/chats/:chatId/sessions/:sessionId — 会话详情（含完整 messages） */
export async function getSession(
  chatId: string,
  sessionId: string,
): Promise<{ res: Response; body: GetSessionJson }> {
  const res = await fetch(
    `/api/v1/chats/${encodeURIComponent(chatId)}/sessions/${encodeURIComponent(sessionId)}`,
    { headers: authHeadersGet() },
  );
  const body = await readJsonBody<GetSessionJson>(res);
  return { res, body };
}
