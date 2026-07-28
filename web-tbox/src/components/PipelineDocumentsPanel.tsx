import { useCallback, useEffect, useState } from "react";

import {
  listPlatformDocuments,
  type PlatformDocumentRow,
} from "../api/crawlPlatform";

type Props = {
  enabled: boolean;
};

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "ready", label: "ready" },
  { value: "quarantine", label: "quarantine" },
  { value: "ingested", label: "ingested" },
] as const;

const DOMAIN_OPTIONS = [
  { value: "", label: "全部域" },
  { value: "RS", label: "RS" },
  { value: "TD", label: "TD" },
  { value: "MA", label: "MA" },
  { value: "COMP", label: "COMP" },
] as const;

function statusBadgeColor(status: string): string {
  switch (status) {
    case "ingested":
      return "#166534";
    case "ready":
      return "#1d4ed8";
    case "quarantine":
      return "#b45309";
    default:
      return "#475569";
  }
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  return iso.replace("T", " ").slice(0, 19);
}

export function PipelineDocumentsPanel({ enabled }: Props) {
  const [status, setStatus] = useState("");
  const [domain, setDomain] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const [rows, setRows] = useState<PlatformDocumentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { res, body } = await listPlatformDocuments({
        status: status || undefined,
        domain: domain || undefined,
        limit,
        offset,
      });
      if (res.status === 401 || body.code === 401) {
        setError("未授权");
        setRows([]);
        setTotal(0);
        return;
      }
      if (body.code !== 0 || !body.data) {
        setError(body.message || `加载失败 (${body.code})`);
        setRows([]);
        setTotal(0);
        return;
      }
      if (body.data.available === false) {
        setError(body.data.error || "Pipeline 文档接口不可用");
        setRows([]);
        setTotal(0);
        return;
      }
      setRows(Array.isArray(body.data.items) ? body.data.items : []);
      setTotal(Number(body.data.total || 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [enabled, status, domain, limit, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [status, domain]);

  if (!enabled) {
    return null;
  }

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <section style={{ marginTop: "1rem" }}>
      <p className="muted" style={{ maxWidth: 960, marginTop: 0 }}>
        数据来自 PostgreSQL <code>tbox_meta.documents</code>（爬取管线）。默认展示{" "}
        <strong>ready / quarantine / ingested</strong>。已可检索内容请切换到「知识库」Tab。
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <label style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
          <span className="muted">状态</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
          <span className="muted">域</span>
          <select value={domain} onChange={(e) => setDomain(e.target.value)}>
            {DOMAIN_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "刷新中…" : "刷新"}
        </button>
        <span className="muted">
          共 <strong>{total}</strong> 条 · 第 {page} / {totalPages} 页
        </span>
      </div>

      {error ? (
        <p style={{ color: "#b91c1c" }}>{error}</p>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            maxWidth: 1100,
            fontSize: "0.9rem",
            background: "#fff",
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ padding: "0.5rem" }}>标题</th>
              <th style={{ padding: "0.5rem" }}>域</th>
              <th style={{ padding: "0.5rem" }}>状态</th>
              <th style={{ padding: "0.5rem" }}>分</th>
              <th style={{ padding: "0.5rem" }}>问题</th>
              <th style={{ padding: "0.5rem" }}>时间</th>
              <th style={{ padding: "0.5rem" }}>来源</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} style={{ padding: "0.75rem" }} className="muted">
                  暂无文档
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "0.5rem", maxWidth: 320 }}>
                  <div style={{ fontWeight: 600 }}>{row.title || "（无标题）"}</div>
                </td>
                <td style={{ padding: "0.5rem" }}>{row.category_hint || "—"}</td>
                <td style={{ padding: "0.5rem" }}>
                  <span style={{ color: statusBadgeColor(row.status), fontWeight: 600 }}>
                    {row.status}
                  </span>
                </td>
                <td style={{ padding: "0.5rem" }}>
                  {row.quality_score ?? "—"}
                  {row.topic_score != null || row.substance_score != null ? (
                    <div className="muted" style={{ fontSize: "0.75rem" }}>
                      t{row.topic_score ?? "—"}/s{row.substance_score ?? "—"}
                    </div>
                  ) : null}
                </td>
                <td style={{ padding: "0.5rem", maxWidth: 220 }} className="muted">
                  {(row.quality_issues || []).slice(0, 3).join(", ") || "—"}
                </td>
                <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{fmtTime(row.fetched_at)}</td>
                <td style={{ padding: "0.5rem" }}>
                  {row.source_url ? (
                    <a href={row.source_url} target="_blank" rel="noreferrer">
                      打开
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button
            type="button"
            disabled={loading || offset <= 0}
            onClick={() => setOffset((v) => Math.max(0, v - limit))}
          >
            上一页
          </button>
          <button
            type="button"
            disabled={loading || page >= totalPages}
            onClick={() => setOffset((v) => v + limit)}
          >
            下一页
          </button>
        </div>
      ) : null}
    </section>
  );
}
