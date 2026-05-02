import { useCallback, useEffect, useState } from "react";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import { listTenantUsers, type TenantUserRow } from "../api/tenantUsers";
import { useAuth } from "../context/AuthContext";

export function UsersPage() {
  const { me } = useAuth();
  const tenantId = me?.user_id ?? "";
  const [rows, setRows] = useState<TenantUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { res, body } = await listTenantUsers(tenantId);
      if (res.status === 401 || body.code === 401) {
        setError("未授权");
        setRows([]);
        return;
      }
      if (body.code !== 0) {
        setError(body.message || `错误码 ${body.code}`);
        setRows([]);
        return;
      }
      setRows(Array.isArray(body.data) ? body.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ marginTop: 0 }}>用户与角色</h1>
      <p className="muted">
        数据来自 <code>GET /api/v1/tenants/&lt;当前用户 id&gt;/users</code>（与 RAGFlow 团队列表一致；path 中的租户 id
        须与登录用户 id 相同）。
      </p>

      {error ? (
        <ApiErrorBanner
          onRetry={() => void load()}
          retryLabel="重试加载"
          retryDisabled={loading || !tenantId}
          retryBusy={loading}
        >
          {error}
        </ApiErrorBanner>
      ) : null}

      <p>
        <button type="button" onClick={() => void load()} disabled={loading || !tenantId}>
          {loading ? "刷新中…" : "刷新"}
        </button>
      </p>

      {!tenantId ? (
        <p className="muted">等待用户信息…</p>
      ) : loading && rows.length === 0 ? (
        <p className="muted">加载中…</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              background: "#fff",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.95rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border-subtle)", textAlign: "left" }}>
                <th style={{ padding: "0.5rem" }}>邮箱</th>
                <th style={{ padding: "0.5rem" }}>昵称</th>
                <th style={{ padding: "0.5rem" }}>角色</th>
                <th style={{ padding: "0.5rem" }}>user_id</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted" style={{ padding: "1rem" }}>
                    暂无成员记录（或仅包含不在此列表中的账户类型）。
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={String(r.user_id ?? r.id ?? i)} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "0.5rem" }}>{String(r.email ?? "—")}</td>
                    <td style={{ padding: "0.5rem" }}>{String(r.nickname ?? "—")}</td>
                    <td style={{ padding: "0.5rem" }}>{String(r.role ?? "—")}</td>
                    <td style={{ padding: "0.5rem", fontFamily: "monospace", fontSize: "0.85rem" }}>
                      {String(r.user_id ?? "—")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
