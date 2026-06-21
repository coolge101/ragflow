import { FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
import { ChatMessageContent } from "../components/ChatMessageContent";
import { ReferenceChunks } from "../components/ReferenceChunks";
import { hasPermission } from "../constants/permissions";
import { CHAT_APP_SCENARIOS } from "../utils/chatAppScenarioTemplates";
import { useAuth } from "../context/AuthContext";
import { useNarrowLayout } from "../hooks/useNarrowLayout";
import { sanitizeChatFinal } from "../utils/chatStreamSanitize";
import {
  buildChatPrintHtml,
  downloadUtf8File,
  exportFilenameDatePrefix,
  formatChatMarkdown,
  printHtmlDocument,
} from "../utils/exportConsultationResult";
import {
  confirmLargeExport,
  exportChatToDocx,
  exportChatToPptx,
  LARGE_EXPORT_CHAT_THRESHOLD,
} from "../utils/exportOffice";

type ChatMessage = { role: "user" | "assistant"; content: string; reference?: unknown };

function mapSessionMessages(raw: SessionMessage[] | undefined): ChatMessage[] {
  if (!raw?.length) {
    return [];
  }
  return raw
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content:
        m.role === "assistant" ? sanitizeChatFinal(String(m.content ?? "")) : String(m.content ?? ""),
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
  const { permissions } = useAuth();
  const canConfigureKb = hasPermission(permissions, "kb.configure");
  const narrow = useNarrowLayout();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
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
  const [activeCitationIndex, setActiveCitationIndex] = useState<number | null>(null);
  const liveReferenceRef = useRef<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const onCitation = useCallback((chunkIndex: number, reference?: unknown) => {
    if (reference !== undefined && reference !== null) {
      setLiveReference(reference);
    }
    setActiveCitationIndex(chunkIndex);
  }, []);

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

  useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

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
    liveReferenceRef.current = null;
    setActiveCitationIndex(null);
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
      liveReferenceRef.current = null;
      setActiveCitationIndex(null);
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
      liveReferenceRef.current = null;
      setActiveCitationIndex(null);
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
      liveReferenceRef.current = null;
      setActiveCitationIndex(null);

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
              setStreaming(sanitizeChatFinal(acc));
              if (ev.reference !== undefined && ev.reference !== null) {
                const ref = ev.reference as Record<string, unknown>;
                if (Object.keys(ref).length > 0) {
                  liveReferenceRef.current = ev.reference;
                  setLiveReference(ev.reference);
                }
              }
            } else if (ev.type === "done") {
              const finalText = sanitizeChatFinal(acc);
              if (finalText.trim()) {
                const ref = liveReferenceRef.current;
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: finalText, reference: ref ?? undefined },
                ]);
              }
              setStreaming(null);
            } else if (ev.type === "error") {
              if (ev.message === "已取消") {
                setStreaming(null);
                setError(null);
                const finalText = sanitizeChatFinal(acc);
                if (finalText.trim()) {
                  const ref = liveReferenceRef.current;
                  setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: finalText, reference: ref ?? undefined },
                  ]);
                }
                return;
              }
              setError(ev.message);
              setStreaming(null);
              if (!acc.trim()) {
                setMessages((prev) => prev.slice(0, -1));
              } else {
                const finalText = sanitizeChatFinal(acc);
                const ref = liveReferenceRef.current;
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: finalText, reference: ref ?? undefined },
                ]);
              }
            }
          },
          signal,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setError(null);
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
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

  const selectedAppLabel = selectedChatId
    ? String(chats.find((c) => String(c.id) === selectedChatId)?.name ?? selectedChatId)
    : "仅模型";

  function onExportMarkdown() {
    if (!messages.length) {
      return;
    }
    const md = formatChatMarkdown({
      title: "TBOX 对话记录",
      messages,
      appLabel: selectedAppLabel,
    });
    downloadUtf8File(`tbox-chat-${exportFilenameDatePrefix()}.md`, md);
  }

  function onExportPdf() {
    if (!messages.length) {
      return;
    }
    try {
      const html = buildChatPrintHtml({
        title: "TBOX 对话记录",
        messages,
        appLabel: selectedAppLabel,
      });
      printHtmlDocument(html, "TBOX 对话记录");
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法打开打印窗口");
    }
  }

  async function onExportWord() {
    if (!messages.length) {
      return;
    }
    if (!confirmLargeExport(messages.length, "对话消息", LARGE_EXPORT_CHAT_THRESHOLD)) {
      return;
    }
    try {
      await exportChatToDocx({
        title: "TBOX 对话记录",
        messages,
        appLabel: selectedAppLabel,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Word 导出失败");
    }
  }

  async function onExportPptx() {
    if (!messages.length) {
      return;
    }
    if (!confirmLargeExport(messages.length, "对话消息（幻灯片）", LARGE_EXPORT_CHAT_THRESHOLD)) {
      return;
    }
    try {
      await exportChatToPptx({
        title: "TBOX 对话记录",
        messages,
        appLabel: selectedAppLabel,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "PPT 导出失败");
    }
  }

  const showAppsEmpty = !chatsLoading && !chatsError && chats.length === 0;
  const showThreadEmpty = messages.length === 0 && streaming === null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: narrow ? "column" : "row",
        gap: "1rem",
        alignItems: "stretch",
        maxWidth: 1120,
      }}
    >
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
          <button
            type="button"
            disabled={messages.length === 0 || loading || streaming !== null}
            onClick={onExportMarkdown}
            title="下载当前会话为 Markdown 文件"
          >
            导出 Markdown
          </button>
          <button
            type="button"
            disabled={messages.length === 0 || loading || streaming !== null}
            onClick={onExportPdf}
            title="在新窗口打印，可选择另存为 PDF"
          >
            导出 PDF…
          </button>
          <button
            type="button"
            disabled={messages.length === 0 || loading || streaming !== null}
            onClick={() => void onExportWord()}
            title="下载当前会话为 Word (.docx) 文件"
          >
            导出 Word
          </button>
          <button
            type="button"
            disabled={messages.length === 0 || loading || streaming !== null}
            onClick={() => void onExportPptx()}
            title="下载当前会话为 PowerPoint (.pptx) 文件"
          >
            导出 PPT
          </button>
          {canConfigureKb ? <Link to="/apps">管理应用</Link> : null}
          {chatsLoading ? <span className="muted">加载应用列表…</span> : null}
          {selectedChatId && sessionsLoading ? <span className="muted">加载会话…</span> : null}
        </div>

        {showAppsEmpty ? (
          <div
            className="muted"
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              background: "#fff",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              fontSize: "0.92rem",
            }}
          >
            {canConfigureKb ? (
              <>
                当前暂无可用对话应用。可{" "}
                <Link to="/apps/new">新建空白应用</Link>
                {CHAT_APP_SCENARIOS.map((s, i) => (
                  <span key={s.id}>
                    {i === 0 ? "，或从模板创建：" : "、"}
                    <Link to={`/apps/new?template=${s.id}`}>{s.label}</Link>
                  </span>
                ))}
                ；创建后点「刷新应用」。在此之前仍可使用「仅模型」对话。
              </>
            ) : (
              <>当前暂无可用对话应用。请联系管理员配置；在此之前仍可使用「仅模型」对话。</>
            )}
          </div>
        ) : null}

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
          {showThreadEmpty ? (
            <div
              className="muted"
              style={{
                alignSelf: "stretch",
                padding: "1rem 1.1rem",
                borderRadius: 10,
                border: "1px dashed var(--border-subtle)",
                background: "#f8fafc",
                fontSize: "0.92rem",
              }}
            >
              {selectedChatId
                ? sessionId
                  ? "本会话尚无消息，在下方输入后发送即可开始。"
                  : "已选择应用：将使用「首次发送时新建会话」创建会话，或直接选择历史会话加载记录。"
                : "未选择应用：使用「仅模型」模式与默认模型对话（不传知识库应用）。"}
            </div>
          ) : null}
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
                wordBreak: "break-word",
              }}
            >
              <div className="muted" style={{ fontSize: "0.75rem", marginBottom: 4 }}>
                {m.role === "user" ? "你" : "助手"}
              </div>
              {m.role === "assistant" ? (
                <ChatMessageContent
                  content={m.content}
                  reference={m.reference ?? liveReference}
                  activeCitationIndex={activeCitationIndex}
                  onCitation={(idx) => onCitation(idx, m.reference ?? liveReference)}
                />
              ) : (
                <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
              )}
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
                wordBreak: "break-word",
              }}
            >
              <div className="muted" style={{ fontSize: "0.75rem", marginBottom: 4 }}>
                助手（生成中…）
              </div>
              <ChatMessageContent
                content={streaming || "…"}
                reference={liveReference}
                activeCitationIndex={activeCitationIndex}
                onCitation={(idx) => onCitation(idx, liveReference)}
              />
            </div>
          ) : null}
          <div ref={messagesEndRef} aria-hidden />
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
          width: narrow ? "100%" : 300,
          flexShrink: 0,
          background: "#fff",
          border: "1px solid var(--border-subtle)",
          borderRadius: 10,
          padding: "0.75rem 1rem",
          alignSelf: narrow ? "stretch" : "flex-start",
          position: narrow ? "static" : "sticky",
          top: narrow ? undefined : 12,
          maxHeight: narrow ? "none" : "min(70vh, 520px)",
          overflow: "auto",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>本轮引用</h2>
        <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 0.75rem" }}>
          点击回答中的引用编号或下方片段可联动高亮；新发送会清空。
        </p>
        <ReferenceChunks
          reference={liveReference}
          activeChunkIndex={activeCitationIndex}
          onSelectChunk={(idx) => onCitation(idx, liveReference)}
        />
      </aside>
    </div>
  );
}
