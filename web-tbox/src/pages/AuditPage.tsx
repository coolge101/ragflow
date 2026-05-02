import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listDatasets, type DatasetRow } from "../api/datasets";
import { listIngestionLogs, type IngestionLogRow } from "../api/ingestionLogs";

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
  }
  return s;
}

export function AuditPage() {
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [kbLoading, setKbLoading] = useState(true);
  const [datasetId, setDatasetId] = useState("");
  const [logs, setLogs] = useState<IngestionLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [logType, setLogType] = useState<"dataset" | "file">("dataset");
  const [logsLoading, setLogsLoading] = useState(false);
  const [kbError, setKbError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);

  const reloadKbs = useCallback(async () => {
    setKbLoading(true);
    setKbError(null);
    try {
      const { res, body } = await listDatasets({ page: 1, page_size: 100 });
      if (res.status === 401 || body.code === 401) {
        setKbError("未授权");
        setDatasets([]);
        return;
      }
      if (body.code !== 0) {
        setKbError(body.message || `错误码 ${body.code}`);
        setDatasets([]);
        return;
      }
      const rows = Array.isArray(body.data) ? body.data : [];
      setDatasets(rows);
      setDatasetId((prev) => prev || (rows[0]?.id ? String(rows[0].id) : ""));
    } catch (e) {
      setKbError(e instanceof Error ? e.message : String(e));
      setDatasets([]);
    } finally {
      setKbLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    if (!datasetId) {
      setLogs([]);
      setTotal(0);
      return;
    }
    setLogsLoading(true);
    setLogsError(null);
    try {
      const { res, body } = await listIngestionLogs(datasetId, {
        page: 1,
        page_size: 50,
        log_type: logType,
      });
      if (res.status === 401 || body.code === 401) {
        setLogsError("未授权");
        setLogs([]);
        return;
      }
      if (body.code !== 0) {
        setLogsError(body.message || `错误码 ${body.code}`);
        setLogs([]);
        return;
      }
      const data = body.data;
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
      setTotal(typeof data?.total === "number" ? data.total : data?.logs?.length ?? 0);
    } catch (e) {
      setLogsError(e instanceof Error ? e.message : String(e));
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, [datasetId, logType]);

  useEffect(() => {
    void reloadKbs();
  }, [reloadKbs]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ marginTop: 0 }}>审计</h1>
      <p className="muted">
        下列为官方 <strong>知识库流水线/入库日志</strong>：<code>GET /api/v1/datasets/&lt;id&gt;/ingestions</code>（
        <code>log_type=dataset|file</code>）。完整安全审计与 TBOX 扩展见后续迭代。
      </p>

      {kbError ? (
        <div
          style={{
            marginBottom: "0.75rem",
            padding: "0.65rem 0.9rem",
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.65rem",
          }}
        >
          <span style={{ color: "#991b1b", flex: "1 1 12rem" }}>
            知识库列表：{kbError} <Link to="/login">去登录</Link>
          </span>
          <button type="button" disabled={kbLoading} onClick={() => void reloadKbs()} style={{ cursor: kbLoading ? "wait" : "pointer" }}>
            {kbLoading ? "重试中…" : "重试加载知识库"}
          </button>
        </div>
      ) : null}
      {logsError ? (
        <div
          style={{
            marginBottom: "0.75rem",
            padding: "0.65rem 0.9rem",
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.65rem",
          }}
        >
          <span style={{ color: "#991b1b", flex: "1 1 12rem" }}>
            入库日志：{logsError} <Link to="/login">去登录</Link>
          </span>
          <button
            type="button"
            disabled={logsLoading || !datasetId}
            onClick={() => void loadLogs()}
            style={{ cursor: logsLoading ? "wait" : "pointer" }}
          >
            {logsLoading ? "重试中…" : "重试加载日志"}
          </button>
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <label>
          <span className="muted" style={{ marginRight: 8 }}>
            知识库
          </span>
          <select
            value={datasetId}
            onChange={(ev) => setDatasetId(ev.target.value)}
            disabled={kbLoading}
            style={{ minWidth: 220, padding: "0.35rem" }}
          >
            {datasets.length === 0 ? (
              <option value="">暂无</option>
            ) : (
              datasets.map((d) => (
                <option key={String(d.id)} value={String(d.id)}>
                  {(d.name as string) || d.id}
                </option>
              ))
            )}
          </select>
        </label>
        <label>
          <span className="muted" style={{ marginRight: 8 }}>
            日志类型
          </span>
          <select
            value={logType}
            onChange={(ev) => setLogType(ev.target.value as "dataset" | "file")}
            disabled={logsLoading}
            style={{ padding: "0.35rem" }}
          >
            <option value="dataset">dataset（库级）</option>
            <option value="file">file（文件级）</option>
          </select>
        </label>
        <button type="button" disabled={kbLoading} onClick={() => void reloadKbs()}>
          {kbLoading ? "…" : "刷新知识库"}
        </button>
        <button type="button" disabled={logsLoading || !datasetId} onClick={() => void loadLogs()}>
          {logsLoading ? "加载中…" : "刷新日志"}
        </button>
      </div>

      {logsLoading && !logs.length ? (
        <p className="muted">加载日志…</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.9rem",
              background: "#fff",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border-subtle)", textAlign: "left" }}>
                <th style={{ padding: "0.45rem" }}>文档/任务</th>
                <th style={{ padding: "0.45rem" }}>类型</th>
                <th style={{ padding: "0.45rem" }}>状态</th>
                <th style={{ padding: "0.45rem" }}>进度说明</th>
                <th style={{ padding: "0.45rem" }}>开始时间</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: "1rem" }}>
                    暂无日志（共 {total} 条）。
                  </td>
                </tr>
              ) : (
                logs.map((row, i) => (
                  <tr key={String(row.id ?? i)} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "0.45rem" }}>
                      {(row.document_name as string) || (row.pipeline_title as string) || String(row.id ?? "—")}
                    </td>
                    <td style={{ padding: "0.45rem" }}>{String(row.task_type ?? "—")}</td>
                    <td style={{ padding: "0.45rem" }}>{String(row.operation_status ?? "—")}</td>
                    <td
                      style={{
                        padding: "0.45rem",
                        maxWidth: 360,
                        wordBreak: "break-word",
                      }}
                      className="muted"
                    >
                      {String(row.progress_msg ?? "").slice(0, 200)}
                    </td>
                    <td style={{ padding: "0.45rem", whiteSpace: "nowrap" }} className="muted">
                      {fmtTime(row.process_begin_at ?? row.create_time)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
        共 <strong>{total}</strong> 条（本页最多请求 50 条）。
      </p>
    </div>
  );
}
