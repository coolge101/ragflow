import { type CSSProperties, FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listDatasets, type DatasetRow } from "../api/datasets";
import { searchDataset, type ChunkRow } from "../api/datasetSearch";

function chunkSnippet(c: ChunkRow): string {
  const doc = (c.document_keyword as string) || (c.docnm_kwd as string) || "";
  const content =
    (c.content_with_weight as string) ||
    (c.content_ltks as string) ||
    (c.content as string) ||
    "";
  const sim = c.similarity != null ? `相似度 ${Number(c.similarity).toFixed(3)}` : "";
  return [doc && `【${doc}】`, sim, content.slice(0, 500)].filter(Boolean).join("\n");
}

const errBanner: CSSProperties = {
  marginTop: "0.75rem",
  padding: "0.65rem 0.9rem",
  borderRadius: 8,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.65rem",
};

export function SearchPage() {
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [datasetId, setDatasetId] = useState("");
  const [question, setQuestion] = useState("");
  const [chunks, setChunks] = useState<ChunkRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const loadDatasets = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const { res, body } = await listDatasets({ page: 1, page_size: 100 });
      if (res.status === 401 || body.code === 401) {
        setListError("未授权");
        setDatasets([]);
        return;
      }
      if (body.code !== 0) {
        setListError(body.message || `错误码 ${body.code}`);
        setDatasets([]);
        return;
      }
      const rows = Array.isArray(body.data) ? body.data : [];
      setDatasets(rows);
      if (rows[0]?.id) {
        setDatasetId(String(rows[0].id));
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
      setDatasets([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadDatasets();
  }, [loadDatasets]);

  const runSearch = useCallback(async () => {
    const q = question.trim();
    if (!datasetId || !q) {
      return;
    }
    setLoadingSearch(true);
    setSearchError(null);
    setChunks([]);
    try {
      const { res, body } = await searchDataset(datasetId, { question: q, top_k: 10 });
      if (res.status === 401 || body.code === 401) {
        setSearchError("未授权");
        return;
      }
      if (body.code !== 0) {
        setSearchError(body.message || `错误码 ${body.code}`);
        return;
      }
      const data = body.data;
      setChunks(Array.isArray(data?.chunks) ? data.chunks : []);
      setTotal(typeof data?.total === "number" ? data.total : data?.chunks?.length ?? 0);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingSearch(false);
    }
  }, [datasetId, question]);

  const onSearch = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      await runSearch();
    },
    [runSearch],
  );

  return (
    <div style={{ maxWidth: 880 }}>
      <h1 style={{ marginTop: 0 }}>检索</h1>
      <p className="muted">
        调用 <code>POST /api/v1/datasets/&lt;id&gt;/search</code> 在选定知识库内做向量检索试用。
      </p>

      {loadingList ? <p className="muted">加载知识库列表…</p> : null}
      {listError ? (
        <div style={errBanner}>
          <span style={{ color: "#991b1b", flex: "1 1 12rem" }}>
            {listError} <Link to="/login">去登录</Link>
          </span>
          <button type="button" disabled={loadingList} onClick={() => void loadDatasets()} style={{ cursor: loadingList ? "wait" : "pointer" }}>
            {loadingList ? "重试中…" : "重试加载知识库"}
          </button>
        </div>
      ) : null}
      {searchError ? (
        <div style={errBanner}>
          <span style={{ color: "#991b1b", flex: "1 1 12rem" }}>
            {searchError} <Link to="/login">去登录</Link>
          </span>
          <button
            type="button"
            disabled={loadingSearch || !datasetId || !question.trim()}
            onClick={() => void runSearch()}
            style={{ cursor: loadingSearch ? "wait" : "pointer" }}
          >
            {loadingSearch ? "重试中…" : "重试检索"}
          </button>
        </div>
      ) : null}

      <form onSubmit={(ev) => void onSearch(ev)} style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          <div className="muted" style={{ marginBottom: 4 }}>
            知识库
          </div>
          <select
            value={datasetId}
            onChange={(ev) => setDatasetId(ev.target.value)}
            disabled={loadingList || datasets.length === 0}
            style={{ minWidth: 280, padding: "0.4rem" }}
          >
            {datasets.length === 0 ? (
              <option value="">暂无知识库</option>
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
          <div className="muted" style={{ marginBottom: 4 }}>
            问题 / 关键词
          </div>
          <input
            value={question}
            onChange={(ev) => setQuestion(ev.target.value)}
            style={{ width: "100%", maxWidth: 560, padding: "0.5rem" }}
            placeholder="输入要检索的内容"
          />
        </label>
        <button type="submit" disabled={loadingSearch || !datasetId || !question.trim()}>
          {loadingSearch ? "检索中…" : "检索"}
        </button>
      </form>

      {chunks.length > 0 ? (
        <section style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>结果（{total}）</h2>
          <ol style={{ paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {chunks.map((c, i) => (
              <li
                key={String(c.chunk_id ?? c.id ?? i)}
                style={{
                  background: "#fff",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 8,
                  padding: "0.75rem 1rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {chunkSnippet(c)}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
