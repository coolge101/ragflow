import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import { listDatasets, type DatasetRow } from "../api/datasets";
import { listIngestionLogs, type IngestionLogQuery, type IngestionLogRow } from "../api/ingestionLogs";
import { hasPermission } from "../constants/permissions";
import { useAuth } from "../context/AuthContext";
import {
  AUDIT_OPERATION_STATUS_OPTIONS,
  auditRowTime,
  auditRowTitle,
  datetimeLocalToApi,
  operationStatusLabel,
} from "../utils/auditLogFilters";
import {
  confirmLargeAuditExport,
  exportAuditLogsCsv,
  exportAuditLogsExcel,
  fetchAuditLogsForExport,
} from "../utils/exportAuditLogs";
import { exportFilenameDatePrefix } from "../utils/exportConsultationResult";

const LOGS_PAGE_SIZE = 50;

function toggleStatus(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function AuditPage() {
  const { permissions } = useAuth();
  const canExport = hasPermission(permissions, "export.data");

  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [kbLoading, setKbLoading] = useState(true);
  const [datasetId, setDatasetId] = useState("");
  const [logs, setLogs] = useState<IngestionLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [logType, setLogType] = useState<"dataset" | "file">("dataset");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [keywords, setKeywords] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [kbError, setKbError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / LOGS_PAGE_SIZE));

  const queryBase = useMemo((): IngestionLogQuery => {
    const q: IngestionLogQuery = {
      log_type: logType,
      orderby: "create_time",
      desc: true,
    };
    const from = datetimeLocalToApi(dateFrom);
    const to = datetimeLocalToApi(dateTo);
    if (from) {
      q.create_date_from = from;
    }
    if (to) {
      q.create_date_to = to;
    }
    if (statusFilter.length) {
      q.operation_status = [...statusFilter];
    }
    if (keywords.trim()) {
      q.keywords = keywords.trim();
    }
    return q;
  }, [logType, dateFrom, dateTo, statusFilter, keywords]);

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
        ...queryBase,
        page,
        page_size: LOGS_PAGE_SIZE,
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
  }, [datasetId, page, queryBase]);

  useEffect(() => {
    void reloadKbs();
  }, [reloadKbs]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setStatusFilter([]);
    setKeywords("");
    setPage(1);
  }

  async function onExport(format: "csv" | "xlsx") {
    if (!datasetId || !canExport) {
      return;
    }
    setExportBusy(true);
    setExportMsg(null);
    setLogsError(null);
    try {
      const { rows, total: t, error, truncated } = await fetchAuditLogsForExport(datasetId, queryBase);
      if (error && rows.length === 0) {
        setLogsError(error);
        return;
      }
      if (rows.length === 0) {
        setLogsError("当前筛选无数据可导出");
        return;
      }
      if (!confirmLargeAuditExport(t || rows.length)) {
        return;
      }
      const kbName =
        (datasets.find((d) => String(d.id) === datasetId)?.name as string | undefined) || datasetId;
      const stem = `audit-${exportFilenameDatePrefix()}-${String(kbName).replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 40)}`;
      if (format === "csv") {
        exportAuditLogsCsv(rows, stem);
      } else {
        await exportAuditLogsExcel(rows, stem);
      }
      const truncNote = truncated ? "（已截断至 2000 条）" : "";
      setExportMsg(`已导出 ${rows.length} 条${truncNote}`);
    } catch (e) {
      setLogsError(e instanceof Error ? e.message : String(e));
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ marginTop: 0 }}>审计</h1>
      <p className="muted">
        知识库<strong>流水线/入库日志</strong>：<code>GET /api/v1/datasets/&lt;id&gt;/ingestions</code>。支持{" "}
        <code>log_type</code>、<code>operation_status</code>、<code>create_date_from/to</code>、
        <code>keywords</code>（文件级日志）。导出需 <code>export.data</code>。
      </p>

      {kbError ? (
        <ApiErrorBanner
          onRetry={() => void reloadKbs()}
          retryLabel="重试加载知识库"
          retryDisabled={kbLoading}
          retryBusy={kbLoading}
        >
          知识库列表：{kbError}
        </ApiErrorBanner>
      ) : null}
      {logsError ? (
        <ApiErrorBanner
          onRetry={() => void loadLogs()}
          retryLabel="重试加载日志"
          retryDisabled={logsLoading || !datasetId}
          retryBusy={logsLoading}
        >
          入库日志：{logsError}
        </ApiErrorBanner>
      ) : null}
      {exportMsg ? <p style={{ color: "#15803d", fontSize: "0.9rem" }}>{exportMsg}</p> : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "flex-end",
          marginBottom: "1rem",
          padding: "0.75rem",
          border: "1px solid var(--border-subtle, #e5e7eb)",
          borderRadius: 8,
        }}
      >
        <label>
          <span className="muted" style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
            知识库
          </span>
          <select
            value={datasetId}
            onChange={(ev) => {
              setDatasetId(ev.target.value);
              setPage(1);
            }}
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
          <span className="muted" style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
            日志类型
          </span>
          <select
            value={logType}
            onChange={(ev) => {
              setLogType(ev.target.value as "dataset" | "file");
              setPage(1);
            }}
            disabled={logsLoading}
            style={{ padding: "0.35rem" }}
          >
            <option value="dataset">dataset（库级）</option>
            <option value="file">file（文件级）</option>
          </select>
        </label>
        <label>
          <span className="muted" style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
            开始时间 ≥
          </span>
          <input
            type="datetime-local"
            value={dateFrom}
            onChange={(ev) => {
              setDateFrom(ev.target.value);
              setPage(1);
            }}
            disabled={logsLoading}
          />
        </label>
        <label>
          <span className="muted" style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
            结束时间 ≤
          </span>
          <input
            type="datetime-local"
            value={dateTo}
            onChange={(ev) => {
              setDateTo(ev.target.value);
              setPage(1);
            }}
            disabled={logsLoading}
          />
        </label>
        <label style={{ minWidth: 200 }}>
          <span className="muted" style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
            关键词（文件名）
          </span>
          <input
            type="search"
            value={keywords}
            onChange={(ev) => setKeywords(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                setPage(1);
                void loadLogs();
              }
            }}
            placeholder="回车查询"
            disabled={logsLoading}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <div className="muted" style={{ marginBottom: 6, fontSize: "0.85rem" }}>
          状态筛选（operation_status，可多选）
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem 1rem" }}>
          {AUDIT_OPERATION_STATUS_OPTIONS.map((opt) => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.88rem" }}>
              <input
                type="checkbox"
                checked={statusFilter.includes(opt.value)}
                onChange={() => {
                  setStatusFilter((prev) => toggleStatus(prev, opt.value));
                  setPage(1);
                }}
                disabled={logsLoading}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", marginBottom: "1rem" }}>
        <button type="button" disabled={kbLoading} onClick={() => void reloadKbs()}>
          {kbLoading ? "…" : "刷新知识库"}
        </button>
        <button type="button" disabled={logsLoading || !datasetId} onClick={() => void loadLogs()}>
          {logsLoading ? "加载中…" : "应用筛选"}
        </button>
        <button type="button" disabled={logsLoading} onClick={resetFilters}>
          清除筛选
        </button>
        {canExport ? (
          <>
            <button type="button" disabled={exportBusy || !datasetId || logsLoading} onClick={() => void onExport("csv")}>
              {exportBusy ? "导出中…" : "导出 CSV"}
            </button>
            <button type="button" disabled={exportBusy || !datasetId || logsLoading} onClick={() => void onExport("xlsx")}>
              {exportBusy ? "导出中…" : "导出 Excel"}
            </button>
          </>
        ) : (
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            无导出权限（export.data）
          </span>
        )}
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          共 <strong>{total}</strong> 条 · 第 {page}/{totalPages} 页
        </span>
        {totalPages > 1 ? (
          <>
            <button type="button" disabled={logsLoading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              上一页
            </button>
            <button
              type="button"
              disabled={logsLoading || page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页
            </button>
          </>
        ) : null}
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
                <th style={{ padding: "0.45rem" }}>任务类型</th>
                <th style={{ padding: "0.45rem" }}>状态</th>
                <th style={{ padding: "0.45rem" }}>进度说明</th>
                <th style={{ padding: "0.45rem" }}>开始时间</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: "1rem" }}>
                    暂无日志（筛选后共 {total} 条）。
                  </td>
                </tr>
              ) : (
                logs.map((row, i) => (
                  <tr key={String(row.id ?? i)} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "0.45rem" }}>{auditRowTitle(row)}</td>
                    <td style={{ padding: "0.45rem" }}>{String(row.task_type ?? "—")}</td>
                    <td style={{ padding: "0.45rem" }} title={String(row.operation_status ?? "")}>
                      {operationStatusLabel(row.operation_status)}
                    </td>
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
                      {auditRowTime(row) || "—"}
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
