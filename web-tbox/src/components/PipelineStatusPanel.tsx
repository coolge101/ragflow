import { useCallback, useEffect, useState } from "react";

import {
  fetchPlatformOverview,
  togglePlatformDomain,
  triggerPlatformCrawl,
  triggerPlatformExpandFrontier,
  type PlatformOverview,
} from "../api/crawlPlatform";
import { DiscoveryPanel } from "./DiscoveryPanel";

type Props = {
  canManage: boolean;
};

function fmtTime(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  return iso.replace("T", " ").slice(0, 19);
}

export function PipelineStatusPanel({ canManage }: Props) {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { res, body } = await fetchPlatformOverview(7);
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
    const id = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(id);
  }, [refresh]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }

  async function onToggle(domain: string, enabled: boolean) {
    if (!canManage) {
      return;
    }
    setBusy(`toggle-${domain}`);
    try {
      const { body } = await togglePlatformDomain(domain, enabled);
      if (body.code !== 0) {
        showToast(body.message || "切换失败");
        return;
      }
      showToast(`${domain} 已${enabled ? "启用" : "停用"}`);
      await refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onCrawl(domain: string) {
    if (!canManage) {
      return;
    }
    setBusy(`crawl-${domain}`);
    try {
      const { body } = await triggerPlatformCrawl(domain);
      if (body.code !== 0) {
        showToast(body.message || "触发失败");
        return;
      }
      showToast(`已触发抓取 ${domain} (pid ${body.data?.pid ?? "?"})`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onExpand() {
    if (!canManage) {
      return;
    }
    setBusy("expand");
    try {
      const { body } = await triggerPlatformExpandFrontier();
      if (body.code !== 0) {
        showToast(body.message || "扩展失败");
        return;
      }
      showToast(`已触发前沿扩展 (pid ${body.data?.pid ?? "?"})`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const unavailable = overview && overview.available === false;
  const engine = overview?.engine ?? {};
  const frontier = overview?.frontier ?? {};

  return (
    <>
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
          <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.05rem" }}>Pipeline 状态（Unified Crawl）</h2>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            四域默认任务 · 前沿增长 · 数据来自 PostgreSQL（<code>tbox-pipelines</code>）
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {canManage ? (
            <>
              <button type="button" disabled={!!busy} onClick={() => void onCrawl("all")}>
                ▶ 触发全部抓取
              </button>
              <button type="button" disabled={!!busy} onClick={() => void onExpand()}>
                ＋ 扩展前沿
              </button>
            </>
          ) : null}
          <button type="button" disabled={loading} onClick={() => void refresh()}>
            ⟳ 刷新
          </button>
        </div>
      </div>

      {toast ? (
        <p style={{ margin: "0.65rem 0 0", fontSize: "0.85rem", color: "var(--accent, #0369a1)" }}>{toast}</p>
      ) : null}

      {loading && !overview ? <p style={{ marginTop: "0.75rem" }}>加载 Pipeline 状态…</p> : null}

      {error ? (
        <p style={{ marginTop: "0.75rem", color: "#b91c1c" }}>{error}</p>
      ) : null}

      {unavailable ? (
        <p style={{ marginTop: "0.75rem", color: "#b45309", fontSize: "0.9rem" }}>
          Pipeline 未就绪：{overview?.error || "请配置 RAGFlow API 环境变量 TBOX_POSTGRES_DSN、TBOX_PIPELINES_HOME"}
        </p>
      ) : null}

      {overview && !unavailable ? (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginTop: "0.75rem" }}>
            {[
              ["统一引擎", engine.new_engine_enabled],
              ["域扩展", engine.domain_expansion_enabled],
              ["前沿合并", engine.load_db_frontier_enabled],
              ["JS渲染兜底", engine.render_hub_fallback_enabled],
            ].map(([label, on]) => (
              <span
                key={String(label)}
                style={{
                  fontSize: "0.75rem",
                  padding: "2px 8px",
                  borderRadius: 999,
                  border: "1px solid var(--border-subtle)",
                  background: on ? "#ecfdf5" : "#fff",
                  color: on ? "#047857" : "#64748b",
                }}
              >
                {label}: {on ? "开" : "关"}
              </span>
            ))}
            <span className="muted" style={{ fontSize: "0.75rem" }}>
              topic≥{engine.min_topic_score ?? "—"} · substance≥{engine.min_substance_score ?? "—"}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "0.65rem",
              marginTop: "0.85rem",
            }}
          >
            {(overview.tasks ?? []).map((t) => (
              <div
                key={t.domain}
                style={{
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 8,
                  padding: "0.65rem 0.75rem",
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "0.92rem" }}>{t.label}</strong>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      padding: "1px 7px",
                      borderRadius: 999,
                      background: t.enabled ? "#ecfdf5" : "#fef2f2",
                      color: t.enabled ? "#047857" : "#b91c1c",
                    }}
                  >
                    {t.enabled ? "启用" : "停用"}
                  </span>
                </div>
                <p className="muted" style={{ margin: "0.35rem 0", fontSize: "0.78rem" }}>
                  {t.domain} · 源 {t.active_sources}/{t.discovered_sources} · 入库 {t.ingested_docs} · 隔离{" "}
                  {t.quarantine_docs}
                </p>
                <p className="muted" style={{ margin: "0 0 0.45rem", fontSize: "0.75rem" }}>
                  最近: {t.last_run_status ?? "—"} {fmtTime(t.last_run_at)}
                </p>
                {canManage ? (
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={!!busy}
                      style={{ fontSize: "0.78rem", padding: "3px 8px" }}
                      onClick={() => void onToggle(t.domain, !t.enabled)}
                    >
                      {t.enabled ? "停用" : "启用"}
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      style={{ fontSize: "0.78rem", padding: "3px 8px" }}
                      onClick={() => void onCrawl(t.domain.toLowerCase())}
                    >
                      ▶ 抓取
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
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
            <strong>前沿增长（最近 {frontier.lookback_days ?? 7} 天）</strong>
            <span className="muted" style={{ marginLeft: "0.5rem" }}>
              种子 {frontier.total_sources ?? 0} · discovered +{frontier.discovered_recent ?? 0} · 近期入库{" "}
              {frontier.docs_ingested_recent ?? 0}
            </span>
            {(frontier.recent_discovered ?? []).length > 0 ? (
              <ul style={{ margin: "0.45rem 0 0", paddingLeft: "1.1rem" }}>
                {(frontier.recent_discovered ?? []).slice(0, 4).map((r) => (
                  <li key={r.url} className="muted" style={{ wordBreak: "break-all" }}>
                    [{r.domain}] {r.url.slice(0, 72)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                暂无 discovered 前沿种子
              </p>
            )}
          </div>
        </>
      ) : null}
    </section>
    <DiscoveryPanel canManage={canManage} />
    </>
  );
}
