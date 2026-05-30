/** Client-side whole-dataset ZIP import/export (no dedicated REST; uses file GET + multipart upload). */

import type JSZip from "jszip";

import {
  downloadDocumentBlob,
  listAllDocuments,
  uploadDocuments,
  type DocRow,
} from "../api/datasetDocuments";

const ZIP_IMPORT_MAX_FILES = 200;
const ZIP_IMPORT_MAX_BYTES = 512 * 1024 * 1024;
const ZIP_EXPORT_CONFIRM_FILES = 100;

function safeZipEntryName(name: string, used: Set<string>): string {
  const base = (name || "file").replace(/[/\\]+/g, "_").replace(/^\.+/, "") || "file";
  let out = base.slice(0, 180);
  let n = 1;
  while (used.has(out)) {
    const dot = base.lastIndexOf(".");
    if (dot > 0) {
      out = `${base.slice(0, dot)}_${n}${base.slice(dot)}`.slice(0, 180);
    } else {
      out = `${base}_${n}`.slice(0, 180);
    }
    n += 1;
  }
  used.add(out);
  return out;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportDatasetZip(
  datasetId: string,
  datasetName: string,
  onProgress?: (msg: string) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  onProgress?.("正在列出文档…");
  const listed = await listAllDocuments(datasetId);
  if (listed.error) {
    return { ok: false, error: listed.error };
  }
  const docs = listed.docs.filter((d) => d.id);
  if (docs.length === 0) {
    return { ok: false, error: "该知识库没有可导出的文档" };
  }
  if (docs.length > ZIP_EXPORT_CONFIRM_FILES) {
    const ok = window.confirm(
      `将下载 ${docs.length} 个原始文件并打包为 ZIP，可能较慢。是否继续？`,
    );
    if (!ok) {
      return { ok: false, error: "已取消" };
    }
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const used = new Set<string>();
  let idx = 0;
  for (const doc of docs) {
    idx += 1;
    const id = String(doc.id);
    const label = (doc.name as string) || id;
    onProgress?.(`下载 ${idx}/${docs.length}：${label}`);
    const { blob, error } = await downloadDocumentBlob(id);
    if (error || !blob) {
      return { ok: false, error: error || `无法下载 ${label}` };
    }
    zip.file(safeZipEntryName(label, used), blob);
  }

  onProgress?.("正在生成 ZIP…");
  const out = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const stem = (datasetName || datasetId).replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "dataset";
  triggerBlobDownload(out, `${stem}.zip`);
  return { ok: true };
}

async function zipEntriesToFiles(zip: JSZip): Promise<File[]> {
  const files: File[] = [];
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) {
      continue;
    }
    const path = entry.name.replace(/\\/g, "/");
    if (!path || path.startsWith("__MACOSX/") || path.endsWith("/.DS_Store")) {
      continue;
    }
    const base = path.split("/").pop() || path;
    if (!base || base.startsWith(".")) {
      continue;
    }
    const blob = await entry.async("blob");
    files.push(new File([blob], base));
  }
  return files;
}

export async function importDatasetZipFile(
  datasetId: string,
  zipFile: File,
  onProgress?: (msg: string) => void,
): Promise<{ ok: true; uploaded: number } | { ok: false; error: string }> {
  if (!zipFile.name.toLowerCase().endsWith(".zip")) {
    return { ok: false, error: "请选择 .zip 文件" };
  }
  if (zipFile.size > ZIP_IMPORT_MAX_BYTES) {
    return {
      ok: false,
      error: `ZIP 超过 ${Math.round(ZIP_IMPORT_MAX_BYTES / (1024 * 1024))}MB 上限`,
    };
  }

  onProgress?.("正在解压…");
  let zip: JSZip;
  try {
    const JSZipCtor = (await import("jszip")).default;
    zip = await JSZipCtor.loadAsync(zipFile);
  } catch {
    return { ok: false, error: "无法读取 ZIP 文件" };
  }

  const files = await zipEntriesToFiles(zip);
  if (files.length === 0) {
    return { ok: false, error: "ZIP 内没有可上传的文件" };
  }
  if (files.length > ZIP_IMPORT_MAX_FILES) {
    return { ok: false, error: `ZIP 内文件数超过 ${ZIP_IMPORT_MAX_FILES} 上限` };
  }

  const batchSize = 8;
  let uploaded = 0;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    onProgress?.(`上传 ${Math.min(i + batch.length, files.length)}/${files.length}…`);
    const { res, body } = await uploadDocuments(datasetId, batch);
    if (res.status === 401 || body.code === 401) {
      return { ok: false, error: "未授权" };
    }
    if (body.code !== 0) {
      return { ok: false, error: body.message || `上传失败 (${body.code})` };
    }
    uploaded += batch.length;
  }
  return { ok: true, uploaded };
}

export type { DocRow };
