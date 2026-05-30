import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import { deleteChat, listChats, type ChatRow } from "../api/chats";
import { CHAT_APP_SCENARIOS } from "../utils/chatAppScenarioTemplates";

const PAGE_SIZE = 80;

function fmtTime(v: unknown): string {
  if (v == null || v === "") {
    return "—";
  }
  const s = String(v);
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (n > 1e12) {
      return new Date(n).toLocaleString();
    }
    if (n > 1e9) {
      return new Date(n * 1000).toLocaleString();
    }
  }
  return s;
}

function kbBindingCount(row: ChatRow): number | null {
  const ids = row.dataset_ids;
  if (Array.isArray(ids)) {
    return ids.length;
  }
  const names = row.kb_names;
  if (Array.isArray(names)) {
    return names.length;
  }
  return null;
}

function kbBindingDetail(row: ChatRow): string | null {
  const names = row.kb_names;
  if (Array.isArray(names) && names.length > 0) {
    return names.join("、");
  }
  return null;
}

export function ChatAppsPage() {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { res, body } = await listChats({ page_size: PAGE_SIZE });
      if (res.status === 401 || body.code === 401) {
        setError("未授权，请重新登录");
        setChats([]);
        setTotal(0);
        return;
      }
      if (body.code !== 0) {
        setError(body.message || `错误码 ${body.code}`);
        setChats([]);
        setTotal(0);
        return;
      }
      const rows = Array.isArray(body.data?.chats) ? body.data.chats : [];
      setChats(rows);
      setTotal(typeof body.data?.total === "number" ? body.data.total : rows.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setChats([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDelete(row: ChatRow) {
    const id = row.id as string | undefined;
    const name = (row.name as string) || id;
    if (!id) {
      return;
    }
    if (
      !window.confirm(
        `确定删除对话应用「${name}」？\n对应 DELETE /api/v1/chats/${id}，不可撤销。`,
      )
    ) {
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const { res, body } = await deleteChat(id);
      if (res.status === 401 || body.code === 401) {
        setError("未授权，请重新登录");
        return;
      }
      if (body.code !== 0) {
        setError(body.message || `删除失败 (${body.code})`);
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>对话应用</h1>
      <p className="muted" style={{ maxWidth: 880 }}>
        管理 RAG 对话应用配置（<code>GET /api/v1/chats</code>）。每个应用可绑定知识库、选择 LLM 与提示词模板，供对话页或 OpenAPI 会话使用。
      </p>

      {error ? (
        <ApiErrorBanner
          style={{ marginTop: "1rem", marginBottom: "0.5rem", padding: "0.75rem 1rem", gap: "0.75rem" }}
          onRetry={() => void load()}
          retryLabel="重试加载列表"
          retryDisabled={loading}
          retryBusy={loading}
        >
          {error}
        </ApiErrorBanner>
      ) : null}

      {loading ? (
        <p>加载中…</p>
      ) : (
        <>
          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "center",
              justifyContent: "space-between",
              maxWidth: 960,
            }}
          >
            <p className="muted" style={{ margin: 0 }}>
              共 <strong>{total}</strong> 个对话应用
              {total > PAGE_SIZE ? `（本页最多 ${PAGE_SIZE} 条）` : null}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
              <Link to="/apps/new">新建对话应用</Link>
              {CHAT_APP_SCENARIOS.map((s) => (
                <Link key={s.id} to={`/apps/new?template=${s.id}`} title={s.description}>
                  从模板：{s.label}
                </Link>
              ))}
            </div>
          </div>

          {chats.length === 0 ? (
            <div
              className="muted"
              style={{
                marginTop: "1.25rem",
                padding: "1.25rem 1.5rem",
                background: "#fff",
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                maxWidth: 960,
                fontSize: "0.95rem",
              }}
            >
              <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
                暂无对话应用。可创建空白应用，或从<strong>咨询 / 决策 / 辅导</strong>场景模板预填提示词与检索参数。
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                <Link to="/apps/new">新建空白应用</Link>
                {CHAT_APP_SCENARIOS.map((s) => (
                  <Link key={s.id} to={`/apps/new?template=${s.id}`}>
                    {s.label}模板
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto", marginTop: "1rem" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  maxWidth: 960,
                  fontSize: "0.95rem",
                  background: "#fff",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-subtle)", textAlign: "left" }}>
                    <th style={{ padding: "0.5rem" }}>名称</th>
                    <th style={{ padding: "0.5rem" }}>绑定知识库</th>
                    <th style={{ padding: "0.5rem" }}>LLM</th>
                    <th style={{ padding: "0.5rem" }}>更新时间</th>
                    <th style={{ padding: "0.5rem" }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {chats.map((row) => {
                    const id = row.id as string | undefined;
                    const name = (row.name as string) || "—";
                    const llmId = (row.llm_id as string | undefined) || "—";
                    const updateTime = fmtTime(row.update_time ?? row.update_date);
                    const kbCount = kbBindingCount(row);
                    const kbDetail = kbBindingDetail(row);
                    return (
                      <tr key={id || name} style={{ borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                        <td style={{ padding: "0.5rem" }}>{name}</td>
                        <td style={{ padding: "0.5rem" }}>
                          {kbCount != null ? (
                            <>
                              <strong>{kbCount}</strong> 个
                              {kbDetail ? (
                                <div
                                  className="muted"
                                  style={{ fontSize: "0.82rem", marginTop: 4, lineHeight: 1.35 }}
                                  title={kbDetail}
                                >
                                  {kbDetail}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ padding: "0.5rem", fontFamily: "monospace", fontSize: "0.85rem" }}>
                          {llmId}
                        </td>
                        <td style={{ padding: "0.5rem", fontSize: "0.88rem" }}>{updateTime}</td>
                        <td style={{ padding: "0.5rem" }}>
                          {id ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                              <Link to={`/apps/${encodeURIComponent(id)}`}>编辑</Link>
                              <button
                                type="button"
                                disabled={busyId === id}
                                onClick={() => void onDelete(row)}
                                style={{ color: "#b91c1c" }}
                              >
                                {busyId === id ? "删除中…" : "删除"}
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p style={{ marginTop: "1rem" }}>
            <button type="button" onClick={() => void load()} disabled={loading}>
              刷新列表
            </button>
          </p>
        </>
      )}
    </div>
  );
}
