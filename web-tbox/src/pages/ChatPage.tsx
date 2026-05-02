import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { streamChatCompletions } from "../api/chatCompletion";
import {
  createChatSession,
  getSession,
  listChats,
  listSessions,
  type ChatRow,
  type SessionMessage,
  type SessionSummary,
} from "../api/chats";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import { ReferenceChunks } from "../components/ReferenceChunks";

type ChatMessage = { role: "user" | "assistant"; content: string };

function mapSessionMessages(raw: SessionMessage[] | undefined): ChatMessage[] {
  if (!raw?.length) {
    return [];
  }
  return raw
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content ?? ""),
    }));
}

function toApiMessages(msgs: ChatMessage[]): Array<{ role: string; content: string; id?: string }> {
  return msgs.map((m, i) => ({
    role: m.role,
    content: m.content,
    ...(i === msgs.length - 1 ? { id: `m-${Date.now()}` } : {}),
  }));
}

export function ChatPage() {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState("");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [liveReference, setLiveReference] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadChats = useCallback(async () => {
    setChatsLoading(true);
    setChatsError(null);
    try {
      const { res, body } = await listChats({ page: 1, page_size: 80 });
      if (res.status === 401 || body.code === 401) {
        setChatsError("未授权");
        setChats([]);
        return;
      }
      if (body.code !== 0) {
        setChatsError(body.message || `错误码 ${body.code}`);
        setChats([]);
        return;
      }
      const list = body.data?.chats ?? [];
      setChats(Array.isArray(list) ? list : []);
    } catch (e) {
      setChatsError(e instanceof Error ? e.message : String(e));
      setChats([]);
    } finally {
      setChatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  const reloadSessions = useCallback(async () => {
    if (!selectedChatId) {
      setSessions([]);
      return;
    }
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const { res, body } = await listSessions(selectedChatId, { page: 1, page_size: 50 });
      if (res.status === 401 || body.code === 401) {
        setSessionsError("未授权");
        setSessions([]);
        return;
      }
      if (body.code !== 0) {
        setSessionsError(body.message || `错误码 ${body.code}`);
        setSessions([]);
        return;
      }
      setSessions(Array.isArray(body.data) ? body.data : []);
    } catch (e) {
      setSessionsError(e instanceof Error ? e.message : String(e));
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [selectedChatId]);

  useEffect(() => {
    void reloadSessions();
  }, [reloadSessions]);

  function onChatChange(nextId: string) {
    setSelectedChatId(nextId);
    setSessionId(null);
    setMessages([]);
    setSessions([]);
    setLiveReference(null);
    setError(null);
    setChatsError(null);
    setSessionsError(null);
  }

  async function onSessionChange(nextSessionId: string) {
    if (!selectedChatId) {
      return;
    }
    setError(null);
    if (!nextSessionId) {
      setSessionId(null);
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      const { res, body } = await getSession(selectedChatId, nextSessionId);
      if (res.status === 401 || body.code === 401) {
        setError("未授权");
        return;
      }
      if (body.code !== 0) {
        setError(body.message || `错误码 ${body.code}`);
        return;
      }
      setSessionId(nextSessionId);
      setMessages(mapSessionMessages(body.data?.messages));
      setLiveReference(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onNewSession() {
    if (!selectedChatId || loading) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { res, body } = await createChatSession(selectedChatId, "新会话");
      if (res.status === 401 || body.code === 401) {
        setError("未授权");
        return;
      }
      if (body.code !== 0) {
        setError(body.message || `错误码 ${body.code}`);
        return;
      }
      const sid = body.data?.id;
      if (!sid) {
        setError("未返回 session id");
        return;
      }
      setSessionId(sid);
      setMessages(mapSessionMessages(body.data?.messages));
      setLiveReference(null);
      await reloadSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || loading) {
        return;
      }
      setInput("");
      setError(null);
      setLiveReference(null);

      let baseMessages = messages;
      let sid = sessionId;

      if (selectedChatId) {
        if (!sid) {
          setLoading(true);
          try {
            const { res, body } = await createChatSession(selectedChatId, "新会话");
            if (res.status === 401 || body.code === 401) {
              setError("未授权");
              setLoading(false);
              return;
            }
            if (body.code !== 0) {
              setError(body.message || `错误码 ${body.code}`);
              setLoading(false);
              return;
            }
            const newSid = body.data?.id;
            if (!newSid) {
              setError("未返回 session id");
              setLoading(false);
              return;
            }
            sid = newSid;
            baseMessages = mapSessionMessages(body.data?.messages);
            setSessionId(newSid);
            setMessages(baseMessages);
            await reloadSessions();
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setLoading(false);
          }
        }
      }

      const userMsg: ChatMessage = { role: "user", content: text };
      const nextMessages = [...baseMessages, userMsg];
      setMessages(nextMessages);
      setLoading(true);
      setStreaming("");

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      const apiMessages = toApiMessages(nextMessages);
      const payload: Parameters<typeof streamChatCompletions>[0] = {
        messages: apiMessages,
        stream: true,
      };
      if (selectedChatId && sid) {
        payload.chat_id = selectedChatId;
        payload.session_id = sid;
      }

      let acc = "";

      try {
        await streamChatCompletions(
          payload,
          (ev) => {
            if (ev.type === "delta") {
              acc += ev.answer;
              setStreaming(acc);
              if (ev.reference !== undefined && ev.reference !== null) {
                const ref = ev.reference as Record<string, unknown>;
                if (Object.keys(ref).length > 0) {
                  setLiveReference(ev.reference);
                }
              }
            } else if (ev.type === "done") {
              if (acc.trim()) {
                setMessages((prev) => [...prev, { role: "assistant", content: acc }]);
              }
              setStreaming(null);
            } else if (ev.type === "error") {
              setError(ev.message);
              setStreaming(null);
              if (!acc.trim()) {
                setMessages((prev) => prev.slice(0, -1));
              } else {
                setMessages((prev) => [...prev, { role: "assistant", content: acc }]);
              }
            }
          },
          signal,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStreaming(null);
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [input, loading, messages, selectedChatId, sessionId, reloadSessions],
  );

  function onStop() {
    abortRef.current?.abort();
  }

  return (
    <div style={{ display: "flex", gap: "1rem", alignItems: "stretch", maxWidth: 1120 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ marginTop: 0 }}>对话</h1>
        <p className="muted">
          选择<strong>应用</strong>后可切换<strong>历史会话</strong>（加载完整消息），或选「首次发送时新建」由发送时创建会话；「仅模型」不传{" "}
          <code>chat_id</code>。接口：<code>POST /api/v1/chat/completions</code>（SSE）。
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="muted">应用</span>
            <select
              value={selectedChatId}
              onChange={(ev) => onChatChange(ev.target.value)}
              disabled={chatsLoading || loading}
              style={{ minWidth: 220, padding: "0.35rem 0.5rem" }}
            >
              <option value="">仅模型（无知识库应用）</option>
              {chats.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {(c.name as string) || c.id}
                </option>
              ))}
            </select>
          </label>
          {selectedChatId ? (
            <>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="muted">会话</span>
                <select
                  value={sessionId ?? ""}
                  onChange={(ev) => void onSessionChange(ev.target.value)}
                  disabled={sessionsLoading || loading}
                  style={{ minWidth: 200, padding: "0.35rem 0.5rem" }}
                >
                  <option value="">首次发送时新建会话</option>
                  {sessions.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {(s.name as string) || s.id}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" disabled={loading} onClick={() => void onNewSession()}>
                新建会话
              </button>
              <button type="button" disabled={loading || !selectedChatId} onClick={() => void reloadSessions()}>
                刷新会话列表
              </button>
            </>
          ) : null}
          <button type="button" disabled={chatsLoading} onClick={() => void loadChats()}>
            {chatsLoading ? "…" : "刷新应用"}
          </button>
          {chatsLoading ? <span className="muted">加载应用列表…</span> : null}
          {selectedChatId && sessionsLoading ? <span className="muted">加载会话…</span> : null}
        </div>

        {chatsError ? (
          <ApiErrorBanner
            onRetry={() => void loadChats()}
            retryLabel="重试加载应用"
            retryDisabled={chatsLoading}
            retryBusy={chatsLoading}
          >
            应用列表：{chatsError}
          </ApiErrorBanner>
        ) : null}
        {selectedChatId && sessionsError ? (
          <ApiErrorBanner
            onRetry={() => void reloadSessions()}
            retryLabel="重试加载会话"
            retryDisabled={sessionsLoading}
            retryBusy={sessionsLoading}
          >
            会话列表：{sessionsError}
          </ApiErrorBanner>
        ) : null}
        {error ? (
          <ApiErrorBanner style={{ marginBottom: "1rem" }}>
            {error}
          </ApiErrorBanner>
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            marginBottom: "1rem",
            minHeight: 200,
          }}
        >
          {messages.map((m, i) => (
            <div
              key={`msg-${i}`}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "92%",
                padding: "0.65rem 0.9rem",
                borderRadius: 10,
                background: m.role === "user" ? "rgba(37, 99, 235, 0.12)" : "#fff",
                border: "1px solid var(--border-subtle)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              <div className="muted" style={{ fontSize: "0.75rem", marginBottom: 4 }}>
                {m.role === "user" ? "你" : "助手"}
              </div>
              {m.content}
            </div>
          ))}
          {streaming !== null ? (
            <div
              style={{
                alignSelf: "flex-start",
                maxWidth: "92%",
                padding: "0.65rem 0.9rem",
                borderRadius: 10,
                background: "#fff",
                border: "1px dashed var(--color-primary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              <div className="muted" style={{ fontSize: "0.75rem", marginBottom: 4 }}>
                助手（生成中…）
              </div>
              {streaming || "…"}
            </div>
          ) : null}
        </div>

        <form onSubmit={(ev) => void onSubmit(ev)} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(ev) => setInput(ev.target.value)}
            placeholder="输入消息后发送（Shift+Enter 换行）"
            rows={3}
            disabled={loading}
            style={{ flex: 1, padding: "0.5rem", resize: "vertical", minHeight: 72 }}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                void onSubmit(ev as unknown as FormEvent);
              }
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button type="submit" disabled={loading || !input.trim()}>
              {loading ? "发送中…" : "发送"}
            </button>
            {loading ? (
              <button type="button" onClick={onStop}>
                停止
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <aside
        style={{
          width: 300,
          flexShrink: 0,
          background: "#fff",
          border: "1px solid var(--border-subtle)",
          borderRadius: 10,
          padding: "0.75rem 1rem",
          alignSelf: "flex-start",
          position: "sticky",
          top: 12,
          maxHeight: "min(70vh, 520px)",
          overflow: "auto",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>本轮引用</h2>
        <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 0.75rem" }}>
          流式片段中含 <code>reference</code> 时更新；新发送会清空。
        </p>
        <ReferenceChunks reference={liveReference} />
      </aside>
    </div>
  );
}
