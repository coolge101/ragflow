import { useCallback, useEffect, useState } from "react";

import {
  fetchDiscoveryOverview,
  setDiscoveryQueryStatus,
  triggerDiscoveryRun,
  type DiscoveryOverview,
} from "../api/crawlPlatform";

type Props = {
  canManage: boolean;
};

const ACTIVE_STATUSES = new Set(["active", "boosted"]);

function fmtPercent(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) {
    return "—";
  }
  return `${Math.round(v * 100)}%`;
}

export function DiscoveryPanel({ canManage }: Props) {
  const [overview, setOverview] = useState<DiscoveryOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { res, body } = await fetchDiscoveryOverview(7);
      if (res.status === 401 || body.code === 401) {
        setError("未授权");
        setOverview(null);
        return;
      }
      if (body.code !== 0 || !body.data) {
        setError(body.message || `加载失败 (${body.code})`);
        setOverview(null);
        return;
      }
      setOverview(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 20000);
    return () => window.clearInterval(id);
  }, [refresh]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }

  async function onRunDiscovery() {
    if (!canManage) {
      return;
    }
    setBusy("run");
    try {
      const { body } = await triggerDiscoveryRun("TD,RS");
      if (body.code !== 0) {
        showToast(body.message || "触发失败");
        return;
      }
      showToast(`已触发发现 (pid ${body.data?.pid ?? "?"})`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onToggleQuery(queryId: string, nextStatus: string) {
    if (!canManage) {
      return;
    }
    setBusy(`query-${queryId}`);
    try {
      const { body } = await setDiscoveryQueryStatus(queryId, nextStatus);
      if (body.code !== 0) {
        showToast(body.message || "更新失败");
        return;
      }
      showToast(`查询已${nextStatus === "dormant" ? "停用" : "启用"}`);
      await refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const unavailable = overview && overview.available === false;
  const byProvider = overview?.by_provider ?? {};
  const searchContribution = overview?.search_contribution ?? {};
  const seedContribution = overview?.seed_contribution ?? {};
  const queries = overview?.queries ?? [];
  const recent = overview?.recent ?? [];

  return (
    <section
      style={{
        marginTop: "1.25rem",
        marginBottom: "1.25rem",
        padding: "1rem 1.1rem",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        background: "#f8fafc",
        maxWidth: 960,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.05rem" }}>搜索优先发现（Search-First Discovery）</h2>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            查询库增长 · Tavily/SearXNG 搜索贡献 · 数据来自 PostgreSQL（<code>tbox-pipelines</code>）
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {canManage ? (
            <button type="button" disabled={!!busy} onClick={() => void onRunDiscovery()}>
              🔎 仅发现
            </button>
          ) : null}
          <button type="button" disabled={loading} onClick={() => void refresh()}>
            ⟳ 刷新
          </button>
        </div>
      </div>

      {toast ? (
        <p style={{ margin: "0.65rem 0 0", fontSize: "0.85rem", color: "var(--accent, #0369a1)" }}>{toast}</p>
      ) : null}

      {loading && !overview ? <p style={{ marginTop: "0.75rem" }}>加载发现数据…</p> : null}

      {error ? <p style={{ marginTop: "0.75rem", color: "#b91c1c" }}>{error}</p> : null}

      {unavailable ? (
        <p style={{ marginTop: "0.75rem", color: "#b45309", fontSize: "0.9rem" }}>
          发现接口未就绪：{overview?.error || "请配置 RAGFlow API 环境变量 TBOX_POSTGRES_DSN、TBOX_PIPELINES_HOME"}
        </p>
      ) : null}

      {overview && !unavailable ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "0.65rem",
              marginTop: "0.85rem",
            }}
          >
            <div
              style={{
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                padding: "0.65rem 0.75rem",
                background: "#fff",
              }}
            >
              <strong style={{ fontSize: "0.85rem" }}>搜索提供商（最近 7 天）</strong>
              {Object.keys(byProvider).length === 0 ? (
                <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.8rem" }}>
                  暂无搜索事件
                </p>
              ) : (
                <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1.1rem", fontSize: "0.82rem" }}>
                  {Object.entries(byProvider).map(([provider, n]) => (
                    <li key={provider}>
                      {provider}: {n}
                    </li>
                  ))}
                </ul>
              )}
              <p className="muted" style={{ margin: "0.45rem 0 0", fontSize: "0.78rem" }}>
                已注册来源: <strong>{overview.registered}</strong>
              </p>
            </div>

            <div
              style={{
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                padding: "0.65rem 0.75rem",
                background: "#fff",
              }}
            >
              <strong style={{ fontSize: "0.85rem" }}>搜索贡献</strong>
              <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.8rem" }}>
                ready {searchContribution.ready ?? 0} · quarantine {searchContribution.quarantine ?? 0} · ingested{" "}
                {searchContribution.ingested ?? 0}
              </p>
              <strong style={{ fontSize: "0.85rem", display: "block", marginTop: "0.5rem" }}>种子贡献</strong>
              <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.8rem" }}>
                ready {seedContribution.ready ?? 0} · quarantine {seedContribution.quarantine ?? 0} · ingested{" "}
                {seedContribution.ingested ?? 0}
              </p>
            </div>
          </div>

          <div style={{ marginTop: "0.85rem" }}>
            <strong style={{ fontSize: "0.9rem" }}>查询库（Query Bank）</strong>
            <div style={{ overflowX: "auto", marginTop: "0.5rem" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  fontSize: "0.85rem",
                  background: "#fff",
                }}
              >
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "0.4rem" }}>域</th>
                    <th style={{ padding: "0.4rem" }}>查询词</th>
                    <th style={{ padding: "0.4rem" }}>来源</th>
                    <th style={{ padding: "0.4rem" }}>状态</th>
                    <th style={{ padding: "0.4rem" }}>分数</th>
                    <th style={{ padding: "0.4rem" }}>通过率</th>
                    {canManage ? <th style={{ padding: "0.4rem" }}>操作</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {queries.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 7 : 6} className="muted" style={{ padding: "0.6rem" }}>
                        暂无查询库条目
                      </td>
                    </tr>
                  ) : null}
                  {queries.map((q) => {
                    const isActive = ACTIVE_STATUSES.has(q.status);
                    return (
                      <tr key={q.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.4rem" }}>{q.domain}</td>
                        <td style={{ padding: "0.4rem", maxWidth: 280, wordBreak: "break-word" }}>{q.query_text}</td>
                        <td style={{ padding: "0.4rem" }}>{q.origin}</td>
                        <td style={{ padding: "0.4rem" }}>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              padding: "1px 7px",
                              borderRadius: 999,
                              background: isActive ? "#ecfdf5" : "#fef2f2",
                              color: isActive ? "#047857" : "#b91c1c",
                            }}
                          >
                            {q.status}
                          </span>
                        </td>
                        <td style={{ padding: "0.4rem" }}>{q.score?.toFixed?.(2) ?? q.score}</td>
                        <td style={{ padding: "0.4rem" }}>{fmtPercent(q.pass_rate)}</td>
                        {canManage ? (
                          <td style={{ padding: "0.4rem" }}>
                            <button
                              type="button"
                              disabled={!!busy}
                              style={{ fontSize: "0.78rem", padding: "3px 8px" }}
                              onClick={() => void onToggleQuery(q.id, isActive ? "dormant" : "active")}
                            >
                              {isActive ? "停用" : "启用"}
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div
            style={{
              marginTop: "0.85rem",
              padding: "0.65rem 0.75rem",
              border: "1px dashed var(--border-subtle)",
              borderRadius: 8,
              background: "#fff",
              fontSize: "0.82rem",
            }}
          >
            <strong>最近发现 URL</strong>
            {recent.length > 0 ? (
              <ul style={{ margin: "0.45rem 0 0", paddingLeft: "1.1rem" }}>
                {recent.slice(0, 8).map((r, idx) => (
                  <li key={`${r.url}-${idx}`} className="muted" style={{ wordBreak: "break-all" }}>
                    [{r.provider ?? "—"}/{r.doc_status ?? "—"}] {(r.title || r.url || "").slice(0, 60)}
                    {r.query_text ? ` · 来自「${r.query_text}」` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                暂无最近发现的 URL
              </p>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
