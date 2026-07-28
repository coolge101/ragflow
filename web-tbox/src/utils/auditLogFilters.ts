/** 入库/流水线日志筛选与展示（对齐官方 ingestions API） */

import type { IngestionLogRow } from "../api/ingestionLogs";

export const AUDIT_OPERATION_STATUS_OPTIONS = [
  { value: "0", label: "未开始 (0)" },
  { value: "1", label: "进行中 (1)" },
  { value: "2", label: "已取消 (2)" },
  { value: "3", label: "完成 (3)" },
  { value: "4", label: "失败 (4)" },
  { value: "5", label: "调度 (5)" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  "0": "未开始",
  "1": "进行中",
  "2": "已取消",
  "3": "完成",
  "4": "失败",
  "5": "调度",
  UNSTART: "未开始",
  RUNNING: "进行中",
  CANCEL: "已取消",
  DONE: "完成",
  FAIL: "失败",
  SCHEDULE: "调度",
};

export function operationStatusLabel(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) {
    return "—";
  }
  return STATUS_LABEL[s] || s;
}

/** `datetime-local` → API `create_date_from` / `create_date_to`（本地日历，秒级） */
export function datetimeLocalToApi(value: string): string | undefined {
  const v = value.trim();
  if (!v) {
    return undefined;
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    return undefined;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function auditRowTitle(row: IngestionLogRow): string {
  return (
    (row.document_name as string) ||
    (row.pipeline_title as string) ||
    String(row.id ?? "—")
  );
}

export function auditRowTime(row: IngestionLogRow): string {
  const raw = row.process_begin_at ?? row.create_time ?? row.create_date;
  if (raw == null || raw === "") {
    return "";
  }
  const s = String(raw);
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (n > 1e12) {
      return new Date(n).toLocaleString();
    }
    if (n > 0 && n < 1e12) {
      return new Date(n * 1000).toLocaleString();
    }
  }
  return s;
}

export function auditRowToExportRecord(row: IngestionLogRow): Record<string, string> {
  return {
    文档或任务: auditRowTitle(row),
    任务类型: String(row.task_type ?? ""),
    状态: operationStatusLabel(row.operation_status),
    状态码: String(row.operation_status ?? ""),
    进度说明: String(row.progress_msg ?? ""),
    开始时间: auditRowTime(row),
    日志ID: String(row.id ?? ""),
  };
}
