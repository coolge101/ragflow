import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import { G1IngestFormatGuide } from "../components/G1IngestFormatGuide";
import { createDataset, deleteDatasets, getDataset, listDatasets, type DatasetRow } from "../api/datasets";
import { deleteDocuments, listDocuments, parseDocuments, reparseDocuments, uploadDocuments, type DocRow } from "../api/datasetDocuments";
import { exportDatasetZip, importDatasetZipFile } from "../utils/datasetZipTransfer";
import { g1CreateModalHint, g1UploadChunkMethodWarning } from "../utils/g1IngestFormatGuide";
import { hasPermission } from "../constants/permissions";
import { useAuth } from "../context/AuthContext";

function runLabel(run: string | undefined): string {
  const m: Record<string, string> = {
    "0": "未开始",
    "1": "解析中",
    "2": "已取消",
    "3": "完成",
    "4": "失败",
    UNSTART: "未开始",
    RUNNING: "解析中",
    CANCEL: "已取消",
    DONE: "完成",
    FAIL: "失败",
  };
  if (run == null || run === "") {
    return "—";
  }
  return m[String(run)] || String(run);
}

/** RAGFlow: upload returns `run` 0 / UNSTART until `POST .../documents/parse` is called. */
function isDocRunUnstart(run: unknown): boolean {
  const s = run == null ? "" : String(run).trim();
  return s === "" || s === "0" || s.toUpperCase() === "UNSTART";
}

/** 可再次发起解析（含已取消，与「未开始」同类入口）。 */
function isDocRunAwaitingParse(run: unknown): boolean {
  const s = run == null ? "" : String(run).trim();
  return (
    isDocRunUnstart(run) || s === "2" || s.toUpperCase() === "CANCEL"
  );
}

function isDocRunDoneOrFail(run: unknown): boolean {
  const s = String(run ?? "").trim();
  return s === "3" || s === "4" || s.toUpperCase() === "DONE" || s.toUpperCase() === "FAIL";
}

function isDocRunFailed(run: unknown): boolean {
  const s = String(run ?? "").trim();
  return s === "4" || s.toUpperCase() === "FAIL";
}

/** API `progress`：进行中多为 0~1；失败可能为 -1。 */
function docProgressBarPercent(doc: DocRow): number {
  const raw = doc.progress;
  if (typeof raw !== "number" || Number.isNaN(raw)) {
    return isDocRunRunning(doc.run) ? 6 : 0;
  }
  if (raw < 0) {
    return 0;
  }
  const pct = Math.round(Math.min(1, Math.max(0, raw)) * 100);
  if (isDocRunRunning(doc.run) && pct > 0 && pct < 3) {
    return 3;
  }
  return pct;
}

function docProgressCaption(doc: DocRow): string {
  const raw = doc.progress;
  const msg = (doc.progress_msg && String(doc.progress_msg).trim()) || "";
  if (isDocRunRunning(doc.run)) {
    if (typeof raw === "number" && !Number.isNaN(raw) && raw >= 0 && raw <= 1) {
      const p = Math.round(raw * 1000) / 10;
      return msg ? `${p}% · ${msg}` : `${p}%`;
    }
    return msg || "排队或启动中…";
  }
  if (isDocRunFailed(doc.run)) {
    return msg || "解析失败（可看审计日志或后端日志中的模型/网络错误）";
  }
  const rs = String(doc.run ?? "").trim();
  if (rs === "3" || rs.toUpperCase() === "DONE") {
    return "已完成";
  }
  return "—";
}

function isDocRunRunning(run: unknown): boolean {
  const s = String(run ?? "").trim();
  return s === "1" || s.toUpperCase() === "RUNNING";
}

const KB_PAGE_SIZE = 25;
const DOCS_PAGE_SIZE = 50;

/** RAGFlow `chunk_method` / `parser_id` options (CreateDatasetReq). */
const KB_CHUNK_METHOD_OPTIONS = [
  "naive",
  "book",
  "email",
  "laws",
  "manual",
  "one",
  "paper",
  "picture",
  "presentation",
  "qa",
  "table",
  "tag",
] as const;

export function DocumentsPage() {
  const { permissions } = useAuth();
  const canDeleteDoc = hasPermission(permissions, "doc.delete");
  const canDeleteKb = hasPermission(permissions, "kb.dangerous");
  const canUpload = hasPermission(permissions, "doc.upload");
  const canReparse = hasPermission(permissions, "doc.reparse");
  const canExportZip = hasPermission(permissions, "export.data");
  const canConfigureKb = hasPermission(permissions, "kb.configure");
  const canCreateKb = canUpload || canConfigureKb;
  /** 首次解析（未开始→解析中）：与上传同一类操作权限。 */
  const canStartParse = canUpload;

  const [kbPage, setKbPage] = useState(1);
  const [rows, setRows] = useState<DatasetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [activeKb, setActiveKb] = useState<string | null>(null);
  const [activeKbName, setActiveKbName] = useState("");
  const [docsPage, setDocsPage] = useState(1);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [docsTotal, setDocsTotal] = useState(0);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [parseBusy, setParseBusy] = useState(false);
  const [parseRowBusy, setParseRowBusy] = useState<string | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipStatus, setZipStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const zipImportRef = useRef<HTMLInputElement | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createPermission, setCreatePermission] = useState<"me" | "team">("me");
  const [createChunkMethod, setCreateChunkMethod] = useState<string>("naive");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [activeKbChunkMethod, setActiveKbChunkMethod] = useState<string>("naive");
  const [uploadFormatWarning, setUploadFormatWarning] = useState<string | null>(null);

  const kbTotalPages = Math.max(1, Math.ceil(total / KB_PAGE_SIZE));
  const docsTotalPages = Math.max(1, Math.ceil(docsTotal / DOCS_PAGE_SIZE));

  const load = useCallback(
    async (opts?: { page?: number }) => {
      const page = opts?.page !== undefined ? opts.page : kbPage;
      setLoading(true);
      setError(null);
      try {
        const { res, body } = await listDatasets({ page, page_size: KB_PAGE_SIZE });
        if (res.status === 401 || body.code === 401) {
          setError("未授权，请重新登录");
          setRows([]);
          return;
        }
        if (body.code !== 0) {
          setError(body.message || `错误码 ${body.code}`);
          setRows([]);
          return;
        }
        setRows(Array.isArray(body.data) ? body.data : []);
        setTotal(typeof body.total === "number" ? body.total : body.data?.length ?? 0);
        if (opts?.page !== undefined) {
          setKbPage(page);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [kbPage],
  );

  const loadDocs = useCallback(
    async (datasetId: string, pageOverride?: number, opts?: { silent?: boolean }) => {
      const page = pageOverride ?? docsPage;
      const silent = Boolean(opts?.silent);
      if (!silent) {
        setDocsLoading(true);
        setDocsError(null);
      }
      try {
        const { res, body } = await listDocuments(datasetId, { page, page_size: DOCS_PAGE_SIZE });
        if (res.status === 401 || body.code === 401) {
          if (!silent) {
            setDocsError("未授权");
            setDocs([]);
          }
          return;
        }
        if (body.code !== 0) {
          if (!silent) {
            setDocsError(body.message || `错误码 ${body.code}`);
            setDocs([]);
          }
          return;
        }
        setDocs(Array.isArray(body.data?.docs) ? body.data.docs : []);
        setDocsTotal(typeof body.data?.total === "number" ? body.data.total : body.data?.docs?.length ?? 0);
      } catch (e) {
        if (!silent) {
          setDocsError(e instanceof Error ? e.message : String(e));
          setDocs([]);
        }
      } finally {
        if (!silent) {
          setDocsLoading(false);
        }
      }
    },
    [docsPage],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeKb) {
      setActiveKbChunkMethod("naive");
      setUploadFormatWarning(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { body } = await getDataset(activeKb);
        if (cancelled || body.code !== 0) {
          return;
        }
        const cm = String(body.data?.chunk_method || "naive");
        setActiveKbChunkMethod(cm);
      } catch {
        if (!cancelled) {
          setActiveKbChunkMethod("naive");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeKb]);

  useEffect(() => {
    if (!activeKb) {
      setDocs([]);
      setDocsTotal(0);
      return;
    }
    void loadDocs(activeKb);
  }, [activeKb, docsPage, loadDocs]);

  /** 有「解析中」文档时轮询列表，刷新后端写入的 progress / progress_msg（不闪全表 loading）。 */
  useEffect(() => {
    if (!activeKb) {
      return;
    }
    const hasRunning = docs.some((d) => isDocRunRunning(d.run));
    if (!hasRunning) {
      return;
    }
    const tick = window.setInterval(() => {
      void loadDocs(activeKb, docsPage, { silent: true });
    }, 2500);
    return () => window.clearInterval(tick);
  }, [activeKb, docs, docsPage, loadDocs]);

  function toggleDocsPanel(datasetId: string, name: string) {
    if (activeKb === datasetId) {
      setActiveKb(null);
      setActiveKbName("");
      return;
    }
    setDocsPage(1);
    setActiveKb(datasetId);
    setActiveKbName(name);
  }

  async function onDelete(row: DatasetRow) {
    const id = row.id as string | undefined;
    const name = (row.name as string) || id;
    if (!id) {
      return;
    }
    if (
      !window.confirm(
        `确定删除知识库「${name}」？\n此操作调用 DELETE /api/v1/datasets，不可撤销。`,
      )
    ) {
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const { res, body } = await deleteDatasets([id]);
      if (res.status === 401 || body.code === 401) {
        setError("未授权，请重新登录");
        return;
      }
      if (body.code !== 0) {
        setError(body.message || `删除失败 (${body.code})`);
        return;
      }
      if (activeKb === id) {
        setActiveKb(null);
        setActiveKbName("");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onDeleteDoc(doc: DocRow) {
    if (!activeKb) {
      return;
    }
    const id = doc.id as string | undefined;
    const name = (doc.name as string) || id;
    if (!id) {
      return;
    }
    if (!window.confirm(`确定删除文档「${name}」？\n对应 DELETE /api/v1/datasets/.../documents`)) {
      return;
    }
    setBusyId(id);
    setDocsError(null);
    try {
      const { res, body } = await deleteDocuments(activeKb, [id]);
      if (res.status === 401 || body.code === 401) {
        setDocsError("未授权");
        return;
      }
      if (body.code !== 0) {
        setDocsError(body.message || `删除失败 (${body.code})`);
        return;
      }
      await loadDocs(activeKb);
      await load();
    } catch (e) {
      setDocsError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  function resetCreateForm() {
    setCreateName("");
    setCreateDesc("");
    setCreatePermission("me");
    setCreateChunkMethod("naive");
    setCreateError(null);
  }

  function openCreateModal() {
    resetCreateForm();
    setCreateOpen(true);
  }

  async function onCreateSubmit(ev: FormEvent) {
    ev.preventDefault();
    setCreateError(null);
    const n = createName.trim();
    if (!n) {
      setCreateError("请填写知识库名称");
      return;
    }
    setCreateBusy(true);
    setError(null);
    try {
      const { res, body } = await createDataset({
        name: n,
        description: createDesc.trim() || undefined,
        permission: createPermission,
        chunk_method: createChunkMethod,
      });
      if (res.status === 401 || body.code === 401) {
        setCreateError("未授权，请重新登录");
        return;
      }
      if (body.code !== 0) {
        setCreateError(body.message || `创建失败 (${body.code})`);
        return;
      }
      setCreateOpen(false);
      resetCreateForm();
      await load({ page: 1 });
      const newId = body.data?.id as string | undefined;
      const newName = (body.data?.name as string | undefined) || n;
      if (newId) {
        setDocsPage(1);
        setActiveKb(newId);
        setActiveKbName(newName);
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreateBusy(false);
    }
  }

  async function onParseDocuments(documentIds: string[], mode: "batch" | "row") {
    if (!activeKb || documentIds.length === 0) {
      return;
    }
    if (mode === "batch") {
      setParseBusy(true);
    } else {
      setParseRowBusy(documentIds[0] ?? null);
    }
    setDocsError(null);
    try {
      const { res, body } = await parseDocuments(activeKb, documentIds);
      if (res.status === 401 || body.code === 401) {
        setDocsError("未授权");
        return;
      }
      if (body.code !== 0) {
        setDocsError(body.message || `解析请求失败 (${body.code})`);
        return;
      }
      await loadDocs(activeKb, docsPage);
    } catch (e) {
      setDocsError(e instanceof Error ? e.message : String(e));
    } finally {
      setParseBusy(false);
      setParseRowBusy(null);
    }
  }

  async function onReparseDocument(doc: DocRow) {
    if (!activeKb || !canReparse) {
      return;
    }
    const id = doc.id as string | undefined;
    if (!id) {
      return;
    }
    const name = (doc.name as string) || id;
    const chunks = typeof doc.chunk_count === "number" ? doc.chunk_count : 0;
    const clearMsg =
      chunks > 0
        ? `将清除现有约 ${chunks} 个分块并重新解析文档「${name}」。`
        : `将重新解析文档「${name}」。`;
    if (!window.confirm(`${clearMsg}\n\n调用 POST /api/v1/documents/ingest（run=1, delete=true）。是否继续？`)) {
      return;
    }
    setParseRowBusy(id);
    setDocsError(null);
    try {
      const { res, body } = await reparseDocuments([id], { delete: true });
      if (res.status === 401 || body.code === 401) {
        setDocsError("未授权");
        return;
      }
      if (body.code !== 0) {
        setDocsError(body.message || `重解析失败 (${body.code})`);
        return;
      }
      await loadDocs(activeKb, docsPage);
    } catch (e) {
      setDocsError(e instanceof Error ? e.message : String(e));
    } finally {
      setParseRowBusy(null);
    }
  }

  async function onExportZip() {
    if (!activeKb || !canExportZip) {
      return;
    }
    setZipBusy(true);
    setZipStatus(null);
    setDocsError(null);
    try {
      const result = await exportDatasetZip(activeKb, activeKbName || activeKb, setZipStatus);
      if (!result.ok) {
        if (result.error !== "已取消") {
          setDocsError(result.error);
        }
      } else {
        setZipStatus("ZIP 已开始下载");
      }
    } catch (e) {
      setDocsError(e instanceof Error ? e.message : String(e));
    } finally {
      setZipBusy(false);
    }
  }

  async function onZipImportSelected(files: FileList | null) {
    if (!activeKb || !files?.length || !canUpload) {
      return;
    }
    const f = files[0];
    setZipBusy(true);
    setZipStatus(null);
    setDocsError(null);
    try {
      const result = await importDatasetZipFile(activeKb, f, setZipStatus);
      if (!result.ok) {
        setDocsError(result.error);
        return;
      }
      setZipStatus(`已上传 ${result.uploaded} 个文件（未开始解析，请手动开始解析）`);
      setDocsPage(1);
      await loadDocs(activeKb, 1);
      await load();
    } catch (e) {
      setDocsError(e instanceof Error ? e.message : String(e));
    } finally {
      setZipBusy(false);
      if (zipImportRef.current) {
        zipImportRef.current.value = "";
      }
    }
  }

  function onFilesIntent(files: FileList | File[] | null) {
    if (!files?.length) {
      setUploadFormatWarning(null);
      return;
    }
    const arr = Array.from(files as ArrayLike<File>);
    setUploadFormatWarning(g1UploadChunkMethodWarning(arr, activeKbChunkMethod));
    void onFilesSelected(files);
  }

  async function onFilesSelected(files: FileList | File[] | null) {
    if (!activeKb || !files?.length) {
      return;
    }
    setUploadBusy(true);
    setDocsError(null);
    try {
      const arr = Array.from(files as ArrayLike<File>);
      const { res, body } = await uploadDocuments(activeKb, arr);
      if (res.status === 401 || body.code === 401) {
        setDocsError("未授权");
        return;
      }
      if (body.code !== 0) {
        setDocsError(body.message || `上传失败 (${body.code})`);
        return;
      }
      setDocsPage(1);
      await loadDocs(activeKb, 1);
      await load();
    } catch (e) {
      setDocsError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadBusy(false);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>文档 / 知识库</h1>
      <p className="muted" style={{ maxWidth: 880 }}>
        知识库列表来自 <code>GET /api/v1/datasets</code>。展开后可管理该库内<strong>文档</strong>：
        <code>POST /api/v1/datasets</code> 新建空库（需 <code>doc.upload</code> 或 <code>kb.configure</code>）；
        <code>GET/POST/DELETE /api/v1/datasets/&lt;id&gt;/documents</code> 管理文档；<strong>重解析</strong>（已完成/失败）调用{" "}
        <code>POST /api/v1/documents/ingest</code>（需 <code>doc.reparse</code>）。上传后状态为<strong>未开始</strong>属正常，需再点<strong>开始解析</strong>（
        <code>POST …/documents/parse</code>）才会切片与入库。删除单个文档需 <code>doc.delete</code>；<strong>删除整个知识库</strong>需{" "}
        <code>kb.dangerous</code>（与「知识库配置」页一致）。
      </p>
      <p className="muted" style={{ maxWidth: 880, fontSize: "0.9rem" }}>
        <strong>整库 ZIP</strong>：无专用 REST；导出通过 <code>GET /v1/document/get/&lt;doc_id&gt;</code> 拉取原文件并在浏览器打包（需{" "}
        <code>export.data</code>）；导入解压后走 multipart 上传（需 <code>doc.upload</code>）。大库导出前会确认。
      </p>

      <G1IngestFormatGuide />

      {error ? (
        <ApiErrorBanner
          style={{ marginTop: "1rem", marginBottom: "0.5rem", padding: "0.75rem 1rem", gap: "0.75rem" }}
          onRetry={() => void load()}
          retryLabel="重试加载知识库"
          retryDisabled={loading}
          retryBusy={loading}
        >
          {error}
        </ApiErrorBanner>
      ) : null}

      {loading ? (
        <p>加载中…</p>
      ) : (
        <>
          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "center",
              justifyContent: "space-between",
              maxWidth: 960,
            }}
          >
            <p className="muted" style={{ margin: 0 }}>
              共 <strong>{total}</strong> 个知识库 · 每页 {KB_PAGE_SIZE} 条（第 {kbPage} / {kbTotalPages} 页）
            </p>
            {canCreateKb ? (
              <button type="button" onClick={openCreateModal}>
                新建知识库
              </button>
            ) : (
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                无新建权限（需 doc.upload 或 kb.configure）
              </span>
            )}
          </div>
          {kbTotalPages > 1 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginBottom: "0.65rem" }}>
              <button type="button" disabled={loading || kbPage <= 1} onClick={() => setKbPage((p) => Math.max(1, p - 1))}>
                上一页
              </button>
              <button
                type="button"
                disabled={loading || kbPage >= kbTotalPages}
                onClick={() => setKbPage((p) => Math.min(kbTotalPages, p + 1))}
              >
                下一页
              </button>
            </div>
          ) : null}
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                maxWidth: 960,
                fontSize: "0.95rem",
                background: "#fff",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-subtle)", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem" }}>名称</th>
                  <th style={{ padding: "0.5rem" }}>ID</th>
                  <th style={{ padding: "0.5rem" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: "1rem" }} className="muted">
                      {kbPage > 1
                        ? "本页没有知识库条目，请返回上一页或刷新列表。"
                        : canCreateKb
                          ? "暂无知识库。可点击上方「新建知识库」，或在其他入口创建后点「刷新知识库列表」。"
                          : "暂无知识库。请让具备 doc.upload 或 kb.configure 的账号新建，或在其他入口创建后刷新本页。"}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const id = row.id as string | undefined;
                    const name = (row.name as string) || "—";
                    const open = id && activeKb === id;
                    return (
                      <tr key={id || name} style={{ borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                        <td style={{ padding: "0.5rem" }}>{name}</td>
                        <td style={{ padding: "0.5rem", fontFamily: "monospace", fontSize: "0.85rem" }}>
                          {id || "—"}
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          {id ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                              <button type="button" onClick={() => toggleDocsPanel(id, name)}>
                                {open ? "收起文档" : "管理文档"}
                              </button>
                              {canDeleteKb ? (
                                <button
                                  type="button"
                                  disabled={busyId === id}
                                  onClick={() => void onDelete(row)}
                                  style={{ color: "#b91c1c" }}
                                >
                                  {busyId === id ? "删除中…" : "删除知识库"}
                                </button>
                              ) : (
                                <span className="muted" style={{ fontSize: "0.85rem" }}>
                                  无删库权限（kb.dangerous）
                                </span>
                              )}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {activeKb ? (
            <section
              onDragOver={(e) => {
                if (!canUpload) {
                  return;
                }
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                if (!canUpload || uploadBusy || docsLoading) {
                  return;
                }
                e.preventDefault();
                e.stopPropagation();
                void onFilesIntent(e.dataTransfer.files);
              }}
              style={{
                marginTop: "1.25rem",
                padding: "1rem 1.25rem",
                background: "#fff",
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                maxWidth: 960,
              }}
            >
              <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
                文档：{activeKbName || activeKb}
              </h2>
              {canUpload ? (
                <p className="muted" style={{ fontSize: "0.85rem", marginTop: "-0.25rem", marginBottom: "0.65rem" }}>
                  可将文件<strong>拖入本卡片</strong>上传（与「上传文件」相同）。上传后默认为<strong>未开始</strong>，请点下方<strong>开始解析</strong>或「解析本页全部未开始」以触发切片（与本系统文档流程一致）。
                  <strong>Excel（.xlsx）</strong>在默认分块下须含<strong>表头行 + 至少一行数据</strong>，否则可能 0 chunk（见 <code>TBOX_INGEST_FORMAT_SMOKE.md</code>）。
                  解析过程中列表会<strong>每约 2.5 秒自动刷新</strong>，「进度」列展示后端返回的完成比例与说明。
                </p>
              ) : null}
              {uploadFormatWarning ? (
                <p
                  style={{
                    fontSize: "0.85rem",
                    marginBottom: "0.65rem",
                    padding: "0.5rem 0.65rem",
                    background: "#fffbeb",
                    border: "1px solid #fcd34d",
                    borderRadius: 6,
                    color: "#92400e",
                  }}
                >
                  {uploadFormatWarning}
                  {canConfigureKb ? (
                    <>
                      {" "}
                      <a href="/kb">去知识库配置</a> 修改分块方式（当前：<code>{activeKbChunkMethod}</code>）。
                    </>
                  ) : null}
                </p>
              ) : null}
              <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "0.65rem", maxWidth: 920 }}>
                若长时间停留在「解析中」或变为「失败」，多与<strong>租户嵌入模型未配置/不可用</strong>、<strong>任务队列未消费</strong>或<strong>文档引擎（ES/Infinity）异常</strong>有关，请到<strong>知识库配置</strong>检查模型与依赖服务，并结合<strong>审计</strong>页与容器日志排查。
              </p>
              {docsError ? (
                <ApiErrorBanner
                  style={{ marginBottom: "0.75rem", padding: "0.5rem 0.75rem", borderRadius: 6, gap: "0.65rem" }}
                  onRetry={() => void loadDocs(activeKb)}
                  retryLabel="重试加载文档"
                  retryDisabled={docsLoading}
                  retryBusy={docsLoading}
                >
                  {docsError}
                </ApiErrorBanner>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem" }}>
                {canUpload ? (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      style={{ display: "none" }}
                      accept=".pdf,.doc,.docx,.txt,.md,.html,.ppt,.pptx,.xls,.xlsx,.csv,.json"
                      onChange={(ev) => onFilesIntent(ev.target.files)}
                    />
                    <button
                      type="button"
                      disabled={uploadBusy || docsLoading}
                      onClick={() => fileRef.current?.click()}
                    >
                      {uploadBusy ? "上传中…" : "上传文件"}
                    </button>
                  </>
                ) : (
                  <span className="muted">无上传权限（doc.upload）</span>
                )}
                <button type="button" disabled={docsLoading} onClick={() => void loadDocs(activeKb)}>
                  刷新文档列表
                </button>
                {canStartParse && activeKb ? (
                  <button
                    type="button"
                    disabled={docsLoading || parseBusy || !!parseRowBusy || zipBusy}
                    onClick={() => {
                      const ids = docs
                        .map((d) => d.id as string | undefined)
                        .filter((id): id is string => Boolean(id))
                        .filter((id) => {
                          const row = docs.find((d) => d.id === id);
                          return row ? isDocRunAwaitingParse(row.run) : false;
                        });
                      if (ids.length === 0) {
                        setDocsError("本页没有「未开始」或「已取消」状态的文档可解析。");
                        return;
                      }
                      void onParseDocuments(ids, "batch");
                    }}
                  >
                    {parseBusy ? "批量解析请求中…" : "解析本页全部未开始/已取消"}
                  </button>
                ) : null}
                {canUpload ? (
                  <>
                    <input
                      ref={zipImportRef}
                      type="file"
                      accept=".zip,application/zip"
                      style={{ display: "none" }}
                      onChange={(ev) => void onZipImportSelected(ev.target.files)}
                    />
                    <button
                      type="button"
                      disabled={uploadBusy || docsLoading || zipBusy}
                      onClick={() => zipImportRef.current?.click()}
                    >
                      {zipBusy ? "ZIP 处理中…" : "ZIP 批量导入"}
                    </button>
                  </>
                ) : null}
                {canExportZip ? (
                  <button type="button" disabled={docsLoading || zipBusy} onClick={() => void onExportZip()}>
                    {zipBusy ? "ZIP 处理中…" : "导出 ZIP"}
                  </button>
                ) : null}
                {zipStatus ? (
                  <span className="muted" style={{ fontSize: "0.85rem" }}>
                    {zipStatus}
                  </span>
                ) : null}
                <span className="muted">
                  共 {docsTotal} 条 · 第 {docsPage}/{docsTotalPages} 页
                </span>
                {docsTotalPages > 1 ? (
                  <>
                    <button type="button" disabled={docsLoading || docsPage <= 1} onClick={() => setDocsPage((p) => Math.max(1, p - 1))}>
                      文档上一页
                    </button>
                    <button
                      type="button"
                      disabled={docsLoading || docsPage >= docsTotalPages}
                      onClick={() => setDocsPage((p) => Math.min(docsTotalPages, p + 1))}
                    >
                      文档下一页
                    </button>
                  </>
                ) : null}
              </div>
              {docsLoading ? (
                <p className="muted">加载文档…</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      borderCollapse: "collapse",
                      width: "100%",
                      fontSize: "0.9rem",
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-subtle)", textAlign: "left" }}>
                        <th style={{ padding: "0.4rem" }}>名称</th>
                        <th style={{ padding: "0.4rem" }}>状态</th>
                        <th style={{ padding: "0.4rem", minWidth: 140 }}>进度</th>
                        <th style={{ padding: "0.4rem" }}>分块</th>
                        <th style={{ padding: "0.4rem" }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="muted" style={{ padding: "0.75rem" }}>
                            {docsPage > 1
                              ? "本页没有文档，请返回上一文档页或刷新列表。"
                              : "暂无文档，可上传或从其他入口同步。"}
                          </td>
                        </tr>
                      ) : (
                        docs.map((d) => {
                          const did = d.id as string | undefined;
                          const dname = (d.name as string) || did;
                          return (
                            <tr key={did || dname} style={{ borderBottom: "1px solid #eee" }}>
                              <td style={{ padding: "0.4rem" }}>{dname}</td>
                              <td style={{ padding: "0.4rem" }}>{runLabel(d.run as string | undefined)}</td>
                              <td style={{ padding: "0.4rem", verticalAlign: "top" }}>
                                {isDocRunRunning(d.run) ? (
                                  <div style={{ minWidth: 120, maxWidth: 260 }}>
                                    <div
                                      style={{
                                        height: 7,
                                        background: "var(--border-subtle, #e5e7eb)",
                                        borderRadius: 4,
                                        overflow: "hidden",
                                      }}
                                      title={docProgressCaption(d)}
                                    >
                                      <div
                                        style={{
                                          width: `${docProgressBarPercent(d)}%`,
                                          height: "100%",
                                          background: "var(--accent, #2563eb)",
                                          transition: "width 0.35s ease-out",
                                        }}
                                      />
                                    </div>
                                    <div
                                      className="muted"
                                      style={{
                                        fontSize: "0.72rem",
                                        marginTop: 5,
                                        lineHeight: 1.35,
                                        wordBreak: "break-word",
                                      }}
                                      title={docProgressCaption(d)}
                                    >
                                      {docProgressCaption(d)}
                                    </div>
                                  </div>
                                ) : isDocRunFailed(d.run) ? (
                                  <span style={{ color: "#b91c1c", fontSize: "0.78rem", lineHeight: 1.35 }} title={docProgressCaption(d)}>
                                    {docProgressCaption(d)}
                                  </span>
                                ) : (
                                  <span className="muted" style={{ fontSize: "0.78rem" }}>
                                    {docProgressCaption(d)}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "0.4rem" }}>{d.chunk_count ?? "—"}</td>
                              <td style={{ padding: "0.4rem" }}>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                                  {did && isDocRunRunning(d.run) ? (
                                    <span className="muted" style={{ fontSize: "0.8rem" }}>
                                      解析中…
                                    </span>
                                  ) : null}
                                  {did && canStartParse && isDocRunAwaitingParse(d.run) ? (
                                    <button
                                      type="button"
                                      disabled={!!parseBusy || parseRowBusy === did || busyId === did}
                                      onClick={() => void onParseDocuments([did], "row")}
                                      style={{ fontSize: "0.85rem" }}
                                    >
                                      {parseRowBusy === did ? "提交中…" : "开始解析"}
                                    </button>
                                  ) : null}
                                  {did && canReparse && isDocRunDoneOrFail(d.run) ? (
                                    <button
                                      type="button"
                                      disabled={!!parseBusy || parseRowBusy === did || busyId === did || zipBusy}
                                      onClick={() => void onReparseDocument(d)}
                                      style={{ fontSize: "0.85rem" }}
                                    >
                                      {parseRowBusy === did ? "提交中…" : "重新解析"}
                                    </button>
                                  ) : null}
                                  {did && isDocRunDoneOrFail(d.run) && !canReparse ? (
                                    <span className="muted" style={{ fontSize: "0.8rem" }}>
                                      无重解析权限
                                    </span>
                                  ) : null}
                                  {did && canDeleteDoc ? (
                                    <button
                                      type="button"
                                      disabled={busyId === did || !!parseBusy || parseRowBusy === did}
                                      onClick={() => void onDeleteDoc(d)}
                                      style={{ color: "#b91c1c", fontSize: "0.85rem" }}
                                    >
                                      {busyId === did ? "…" : "删除"}
                                    </button>
                                  ) : did && !canDeleteDoc ? (
                                    <span className="muted" style={{ fontSize: "0.8rem" }}>
                                      无删除权限
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          <p style={{ marginTop: "1rem" }}>
            <button type="button" onClick={() => void load()} disabled={loading}>
              刷新知识库列表
            </button>
          </p>
        </>
      )}

      {createOpen ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !createBusy) {
              setCreateOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tbox-create-kb-title"
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#fff",
              borderRadius: 10,
              padding: "1.25rem 1.35rem",
              boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
              border: "1px solid var(--border-subtle)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="tbox-create-kb-title" style={{ marginTop: 0, fontSize: "1.15rem" }}>
              新建知识库
            </h2>
            <p className="muted" style={{ fontSize: "0.85rem", marginTop: "-0.25rem" }}>
              调用 <code>POST /api/v1/datasets</code>；嵌入模型未填时使用租户默认。
            </p>
            <form onSubmit={(e) => void onCreateSubmit(e)}>
              <label style={{ display: "block", marginTop: "0.75rem", fontWeight: 600 }}>
                名称 <span style={{ color: "#b91c1c" }}>*</span>
              </label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                autoFocus
                disabled={createBusy}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
                maxLength={256}
                placeholder="例如：产品手册"
              />
              <label style={{ display: "block", marginTop: "0.85rem", fontWeight: 600 }}>描述（可选）</label>
              <textarea
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                disabled={createBusy}
                rows={3}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box", resize: "vertical" }}
                placeholder="简要说明该知识库的用途"
              />
              <label style={{ display: "block", marginTop: "0.85rem", fontWeight: 600 }}>可见范围</label>
              <select
                value={createPermission}
                onChange={(e) => setCreatePermission(e.target.value as "me" | "team")}
                disabled={createBusy}
                style={{ width: "100%", marginTop: 6 }}
              >
                <option value="me">仅自己（me）</option>
                <option value="team">团队（team）</option>
              </select>
              <label style={{ display: "block", marginTop: "0.85rem", fontWeight: 600 }}>分块方式</label>
              <select
                value={createChunkMethod}
                onChange={(e) => setCreateChunkMethod(e.target.value)}
                disabled={createBusy}
                style={{ width: "100%", marginTop: 6 }}
              >
                {KB_CHUNK_METHOD_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {g1CreateModalHint(createChunkMethod) ? (
                <p className="muted" style={{ fontSize: "0.82rem", marginTop: "0.35rem", marginBottom: 0 }}>
                  {g1CreateModalHint(createChunkMethod)}
                </p>
              ) : null}
              <G1IngestFormatGuide compact />
              {createError ? (
                <p style={{ color: "#b91c1c", fontSize: "0.9rem", marginTop: "0.75rem", marginBottom: 0 }}>{createError}</p>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", marginTop: "1.1rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  disabled={createBusy}
                  onClick={() => {
                    if (!createBusy) {
                      setCreateOpen(false);
                    }
                  }}
                >
                  取消
                </button>
                <button type="submit" disabled={createBusy}>
                  {createBusy ? "创建中…" : "创建"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
