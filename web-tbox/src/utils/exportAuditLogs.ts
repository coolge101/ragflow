/** 审计/入库日志 CSV / Excel 导出（纯前端） */

import { listAllIngestionLogs, type IngestionLogQuery } from "../api/ingestionLogs";
import { auditRowToExportRecord } from "./auditLogFilters";
import { downloadBlob } from "./exportOffice";

export const LARGE_AUDIT_EXPORT_THRESHOLD = 500;

export function confirmLargeAuditExport(count: number): boolean {
  if (count <= LARGE_AUDIT_EXPORT_THRESHOLD) {
    return true;
  }
  return window.confirm(`当前筛选共 ${count} 条日志，导出可能较慢。是否继续？`);
}

function csvEscape(cell: string): string {
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export async function fetchAuditLogsForExport(
  datasetId: string,
  query: IngestionLogQuery,
): Promise<{ rows: Record<string, string>[]; total: number; error?: string; truncated?: boolean }> {
  const listed = await listAllIngestionLogs(datasetId, query);
  if (listed.error) {
    return { rows: [], total: 0, error: listed.error };
  }
  const rows = listed.logs.map(auditRowToExportRecord);
  return { rows, total: listed.total, truncated: listed.truncated };
}

export function exportAuditLogsCsv(
  rows: Record<string, string>[],
  filenameStem: string,
): void {
  if (!rows.length) {
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h] ?? "")).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(`${filenameStem}.csv`, blob);
}

export async function exportAuditLogsExcel(
  rows: Record<string, string>[],
  filenameStem: string,
): Promise<void> {
  if (!rows.length) {
    return;
  }
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "audit");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(`${filenameStem}.xlsx`, new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}
