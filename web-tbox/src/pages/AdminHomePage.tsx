import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPlatformOverview, type PlatformOverview } from "../api/crawlPlatform";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import { hasPermission } from "../constants/permissions";
import { useAuth } from "../context/AuthContext";

type QuickLink = {
  to: string;
  label: string;
  desc: string;
};

export function AdminHomePage() {
  const { permissions } = useAuth();
  const canCrawl = hasPermission(permissions, "crawl.manage");
  const canViewDocs = hasPermission(permissions, "doc.view");
  const canSearch = hasPermission(permissions, "search.use");

  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!canCrawl) {
      return;
    }
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
  }, [canCrawl]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const ingestedTotal = useMemo(() => {
    if (!overview?.tasks?.length) {
      return null;
    }
    return overview.tasks.reduce((n, t) => n + (t.ingested_docs ?? 0), 0);
  }, [overview]);

  const quickLinks = useMemo((): QuickLink[] => {
    const links: QuickLink[] = [];
    if (canCrawl) {
      links.push({ to: "/admin/crawl/goals", label: "采集目标", desc: "自然语言定义采集需求" });
      links.push({ to: "/admin/crawl", label: "采集任务", desc: "Pipeline 状态与抓取" });
    }
    if (canViewDocs) {
      links.push({ to: "/admin/documents", label: "文档 / 入库", desc: "查看与管理入库文档" });
    }
    if (canSearch) {
      links.push({ to: "/search", label: "打开检索", desc: "前往使用端检索工作台" });
    }
    return links;
  }, [canCrawl, canViewDocs, canSearch]);

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ fontSize: "1.35rem", marginBottom: "0.35rem" }}>管理概览</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        管线状态与常用管理入口。
      </p>

      {canCrawl ? (
        <section
          style={{
            marginTop: "1.25rem",
            marginBottom: "1.25rem",
            padding: "1rem 1.1rem",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-surface)",
          }}
          aria-label="Pipeline 概览"
        >
          <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.05rem" }}>Unified Crawl Pipeline</h2>
          <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>
            近 7 天窗口 · 数据来自 PostgreSQL
          </p>

          {error ? (
            <ApiErrorBanner
              style={{ marginBottom: "0.75rem" }}
              onRetry={() => void loadOverview()}
              retryBusy={loading}
            >
              {error}
            </ApiErrorBanner>
          ) : null}

          {loading && !overview ? <p className="muted">加载 Pipeline 状态…</p> : null}

          {overview ? (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", marginBottom: "0.85rem" }}>
                <span
                  style={{
                    fontSize: "0.78rem",
                    padding: "3px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--border-subtle)",
                    background: overview.available !== false ? "#ecfdf5" : "#fef2f2",
                    color: overview.available !== false ? "#047857" : "#b91c1c",
                  }}
                >
                  {overview.available !== false ? "●" : "○"} Pipeline 可用
                </span>
                <span
                  style={{
                    fontSize: "0.78rem",
                    padding: "3px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--border-subtle)",
                    background: overview.postgres_ok !== false ? "#ecfdf5" : "#fef2f2",
                    color: overview.postgres_ok !== false ? "#047857" : "#b91c1c",
                  }}
                >
                  {overview.postgres_ok !== false ? "●" : "○"} PostgreSQL
                </span>
              </div>

              {overview.available === false ? (
                <p style={{ color: "#b45309", fontSize: "0.9rem", margin: "0 0 0.75rem" }}>
                  Pipeline 未就绪：{overview.error || "请检查 TBOX_POSTGRES_DSN 等环境变量"}
                </p>
              ) : null}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "0.65rem",
                }}
              >
                <div
                  style={{
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "0.65rem 0.75rem",
                    background: "var(--bg-page)",
                  }}
                >
                  <b style={{ fontSize: "1.25rem", display: "block" }}>{ingestedTotal ?? "—"}</b>
                  <span className="muted" style={{ fontSize: "0.82rem" }}>
                    入库文档合计
                  </span>
                </div>
                <div
                  style={{
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "0.65rem 0.75rem",
                    background: "var(--bg-page)",
                  }}
                >
                  <b style={{ fontSize: "1.25rem", display: "block" }}>
                    {overview.frontier?.docs_ingested_recent ?? "—"}
                  </b>
                  <span className="muted" style={{ fontSize: "0.82rem" }}>
                    近 7 天新增入库
                  </span>
                </div>
              </div>

              {(overview.tasks ?? []).length > 0 ? (
                <ul className="muted" style={{ margin: "0.85rem 0 0", paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
                  {(overview.tasks ?? []).map((t) => (
                    <li key={t.domain}>
                      {t.label} ({t.domain})：入库 {t.ingested_docs ?? 0}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {quickLinks.length > 0 ? (
        <section aria-label="快捷入口">
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.65rem" }}>快捷入口</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "0.65rem",
            }}
          >
            {quickLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  display: "block",
                  padding: "0.75rem 0.85rem",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-surface)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <strong style={{ display: "block", marginBottom: "0.2rem" }}>{link.label}</strong>
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  {link.desc}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <p className="muted">当前账号无可用快捷入口。</p>
      )}
    </div>
  );
}
