import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { deleteDatasets, listDatasets, type DatasetRow } from "../api/datasets";
import { deleteDocuments, listDocuments, uploadDocuments, type DocRow } from "../api/datasetDocuments";
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

export function DocumentsPage() {
  const { permissions } = useAuth();
  const canDelete = hasPermission(permissions, "doc.delete");
  const canUpload = hasPermission(permissions, "doc.upload");

  const [rows, setRows] = useState<DatasetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [activeKb, setActiveKb] = useState<string | null>(null);
  const [activeKbName, setActiveKbName] = useState("");
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [docsTotal, setDocsTotal] = useState(0);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { res, body } = await listDatasets({ page: 1, page_size: 50 });
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDocs = useCallback(async (datasetId: string) => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const { res, body } = await listDocuments(datasetId, { page: 1, page_size: 80 });
      if (res.status === 401 || body.code === 401) {
        setDocsError("未授权");
        setDocs([]);
        return;
      }
      if (body.code !== 0) {
        setDocsError(body.message || `错误码 ${body.code}`);
        setDocs([]);
        return;
      }
      setDocs(Array.isArray(body.data?.docs) ? body.data.docs : []);
      setDocsTotal(typeof body.data?.total === "number" ? body.data.total : body.data?.docs?.length ?? 0);
    } catch (e) {
      setDocsError(e instanceof Error ? e.message : String(e));
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (activeKb) {
      void loadDocs(activeKb);
    } else {
      setDocs([]);
      setDocsTotal(0);
    }
  }, [activeKb, loadDocs]);

  function toggleDocsPanel(datasetId: string, name: string) {
    if (activeKb === datasetId) {
      setActiveKb(null);
      setActiveKbName("");
      return;
    }
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
        `确定删除知识库「${name}」？\n此操作与官方 RAGFlow 行为一致（DELETE /api/v1/datasets），不可撤销。`,
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

  async function onFilesSelected(files: FileList | null) {
    if (!activeKb || !files?.length) {
      return;
    }
    setUploadBusy(true);
    setDocsError(null);
    try {
      const arr = Array.from(files);
      const { res, body } = await uploadDocuments(activeKb, arr);
      if (res.status === 401 || body.code === 401) {
        setDocsError("未授权");
        return;
      }
      if (body.code !== 0) {
        setDocsError(body.message || `上传失败 (${body.code})`);
        return;
      }
      await loadDocs(activeKb);
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
        <code>GET/POST/DELETE /api/v1/datasets/&lt;id&gt;/documents</code>（与官方一致）。整库删除需{" "}
        <code>doc.delete</code>（知识库级）权限。
      </p>
      <p className="muted" style={{ maxWidth: 880, fontSize: "0.9rem" }}>
        批量导出 ZIP 等若官方未暴露与本页一致的 REST，请暂用官方 <code>web/</code>；后续可接 TBOX 扩展。
      </p>

      {error ? (
        <div
          style={{
            marginTop: "1rem",
            marginBottom: "0.5rem",
            padding: "0.75rem 1rem",
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <p style={{ color: "#991b1b", margin: 0, flex: "1 1 12rem" }}>
            {error} <Link to="/login">去登录</Link>
          </p>
          <button type="button" disabled={loading} onClick={() => void load()} style={{ cursor: loading ? "wait" : "pointer" }}>
            {loading ? "重试中…" : "重试加载知识库"}
          </button>
        </div>
      ) : null}

      {loading ? (
        <p>加载中…</p>
      ) : (
        <>
          <p className="muted" style={{ marginTop: "1rem" }}>
            共 <strong>{total}</strong> 个知识库（本页最多 50 个）
          </p>
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
                      暂无知识库，请在官方流程中创建后刷新本页。
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
                              {canDelete ? (
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
                                  无删库权限
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
              {docsError ? (
                <div
                  style={{
                    marginBottom: "0.75rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: 6,
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "0.65rem",
                  }}
                >
                  <span style={{ color: "#991b1b", flex: "1 1 10rem" }}>{docsError}</span>
                  <button
                    type="button"
                    disabled={docsLoading}
                    onClick={() => void loadDocs(activeKb)}
                    style={{ cursor: docsLoading ? "wait" : "pointer" }}
                  >
                    {docsLoading ? "重试中…" : "重试加载文档"}
                  </button>
                </div>
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
                      onChange={(ev) => void onFilesSelected(ev.target.files)}
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
                <span className="muted">共 {docsTotal} 条</span>
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
                        <th style={{ padding: "0.4rem" }}>分块</th>
                        <th style={{ padding: "0.4rem" }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="muted" style={{ padding: "0.75rem" }}>
                            暂无文档，可上传或从其他入口同步。
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
                              <td style={{ padding: "0.4rem" }}>{d.chunk_count ?? "—"}</td>
                              <td style={{ padding: "0.4rem" }}>
                                {did && canDelete ? (
                                  <button
                                    type="button"
                                    disabled={busyId === did}
                                    onClick={() => void onDeleteDoc(d)}
                                    style={{ color: "#b91c1c", fontSize: "0.85rem" }}
                                  >
                                    {busyId === did ? "…" : "删除"}
                                  </button>
                                ) : did && !canDelete ? (
                                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                                    无删除权限
                                  </span>
                                ) : null}
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
    </div>
  );
}
