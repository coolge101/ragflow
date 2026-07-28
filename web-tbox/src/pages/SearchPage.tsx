import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import { SearchResultList, searchChunkSnippet } from "../components/SearchResultList";
import { listDatasets, type DatasetRow } from "../api/datasets";
import { searchDataset, type ChunkRow } from "../api/datasetSearch";
import {
  datasetLabelForId,
  parseKbParam,
  resolveDomainCrawlDatasetIds,
} from "../constants/crawlDataset";
import { maxChunkSimilarity } from "../utils/chunkDisplay";
import {
  buildSearchPrintHtml,
  downloadUtf8File,
  exportFilenameDatePrefix,
  formatSearchMarkdown,
  printHtmlDocument,
} from "../utils/exportConsultationResult";
import {
  confirmLargeExport,
  exportSearchToXlsx,
  exportSearchToPptx,
  LARGE_EXPORT_SEARCH_THRESHOLD,
  parseSearchChunkRow,
} from "../utils/exportOffice";

function chunkScore(row: ChunkRow): number {
  return maxChunkSimilarity([row as { similarity?: unknown }]);
}

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const initialKbParam = searchParams.get("kb") ?? "";
  const initialKbIds = useMemo(() => parseKbParam(initialKbParam), [initialKbParam]);
  const autoSearchRef = useRef(Boolean(initialQuery.trim() && initialKbIds.length > 0));

  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialKbIds);
  const [question, setQuestion] = useState(initialQuery);
  const [chunks, setChunks] = useState<ChunkRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSuccessSearchKey, setLastSuccessSearchKey] = useState<string | null>(null);
  const [activeResultIndex, setActiveResultIndex] = useState<number | null>(null);

  const domainOptions = useMemo(() => {
    const ids = resolveDomainCrawlDatasetIds(datasets);
    return ids.map((id) => ({ id, label: datasetLabelForId(datasets, id) }));
  }, [datasets]);

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
      const domainIds = resolveDomainCrawlDatasetIds(rows);
      setSelectedIds((prev) => {
        if (prev.length > 0) {
          const valid = prev.filter((id) => rows.some((r) => String(r.id) === id));
          if (valid.length > 0) {
            return valid;
          }
        }
        if (initialKbIds.length > 0) {
          const valid = initialKbIds.filter((id) => rows.some((r) => String(r.id) === id));
          if (valid.length > 0) {
            return valid;
          }
        }
        return domainIds;
      });
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
      setDatasets([]);
    } finally {
      setLoadingList(false);
    }
  }, [initialKbIds]);

  useEffect(() => {
    void loadDatasets();
  }, [loadDatasets]);

  const selectionKey = selectedIds.slice().sort().join(",");

  useEffect(() => {
    const key = `${selectionKey}\t${question.trim()}`;
    if (lastSuccessSearchKey !== null && lastSuccessSearchKey !== key) {
      setChunks([]);
      setTotal(0);
      setActiveResultIndex(null);
    }
  }, [selectionKey, question, lastSuccessSearchKey]);

  const runSearch = useCallback(async () => {
    const q = question.trim();
    if (!selectedIds.length || !q) {
      return;
    }
    setLoadingSearch(true);
    setSearchError(null);
    setChunks([]);
    setActiveResultIndex(null);
    try {
      const results = await Promise.all(
        selectedIds.map(async (id) => {
          const { res, body } = await searchDataset(id, { question: q, top_k: 10 });
          return { id, res, body };
        }),
      );
      if (results.some((r) => r.res.status === 401 || r.body.code === 401)) {
        setSearchError("未授权");
        return;
      }
      const failed = results.find((r) => r.body.code !== 0);
      if (failed) {
        setSearchError(failed.body.message || `错误码 ${failed.body.code}`);
        return;
      }
      const merged: ChunkRow[] = [];
      for (const r of results) {
        const label = datasetLabelForId(datasets, r.id);
        const list = Array.isArray(r.body.data?.chunks) ? r.body.data!.chunks! : [];
        for (const row of list) {
          const docName = String(row.document_keyword || row.docnm_kwd || "");
          merged.push({
            ...row,
            _dataset_id: r.id,
            _dataset_label: label,
            document_keyword: docName ? `[${label}] ${docName}` : `[${label}]`,
          });
        }
      }
      merged.sort((a, b) => chunkScore(b) - chunkScore(a));
      setChunks(merged);
      setTotal(merged.length);
      setLastSuccessSearchKey(`${selectedIds.slice().sort().join(",")}\t${q}`);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingSearch(false);
    }
  }, [selectedIds, question, datasets]);

  useEffect(() => {
    if (!autoSearchRef.current || loadingList || !selectedIds.length || !question.trim()) {
      return;
    }
    autoSearchRef.current = false;
    void runSearch();
  }, [loadingList, selectedIds, question, runSearch]);

  const onSearch = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      await runSearch();
    },
    [runSearch],
  );

  const currentSearchKey = `${selectionKey}\t${question.trim()}`;
  const showNoHits =
    lastSuccessSearchKey !== null &&
    lastSuccessSearchKey === currentSearchKey &&
    chunks.length === 0 &&
    !loadingSearch &&
    !searchError;
  const showWeakHit =
    lastSuccessSearchKey !== null &&
    lastSuccessSearchKey === currentSearchKey &&
    chunks.length > 0 &&
    maxChunkSimilarity(chunks) < 0.35;

  const lastQuery = useMemo(() => {
    if (!lastSuccessSearchKey) return "";
    const tab = lastSuccessSearchKey.indexOf("\t");
    return tab >= 0 ? lastSuccessSearchKey.slice(tab + 1) : "";
  }, [lastSuccessSearchKey]);
  const showKbEmpty = !loadingList && !listError && domainOptions.length === 0;
  const showHintBeforeSearch =
    domainOptions.length > 0 &&
    !loadingList &&
    !listError &&
    lastSuccessSearchKey === null &&
    !loadingSearch &&
    !searchError;

  function onClearSearchForm() {
    setQuestion("");
    setChunks([]);
    setTotal(0);
    setSearchError(null);
    setActiveResultIndex(null);
    setLastSuccessSearchKey(null);
  }

  function toggleId(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const datasetLabel =
    selectedIds.length === 0
      ? "—"
      : selectedIds.length === 1
        ? datasetLabelForId(datasets, selectedIds[0])
        : `已选 ${selectedIds.length} 个分库`;

  const canExport =
    lastSuccessSearchKey !== null &&
    lastSuccessSearchKey === currentSearchKey &&
    !loadingSearch &&
    !searchError;

  function buildExportChunks() {
    return chunks.map((c, i) => ({ index: i + 1, snippet: searchChunkSnippet(c) }));
  }

  function onExportMarkdown() {
    if (!canExport) {
      return;
    }
    const md = formatSearchMarkdown({
      title: "TBOX 检索结果",
      datasetLabel,
      question: question.trim(),
      total,
      chunks: buildExportChunks(),
    });
    downloadUtf8File(`tbox-search-${exportFilenameDatePrefix()}.md`, md);
  }

  function onExportPdf() {
    if (!canExport) {
      return;
    }
    try {
      const html = buildSearchPrintHtml({
        title: "TBOX 检索结果",
        datasetLabel,
        question: question.trim(),
        total,
        chunks: buildExportChunks(),
      });
      printHtmlDocument(html, "TBOX 检索结果");
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "无法打开打印窗口");
    }
  }

  async function onExportExcel() {
    if (!canExport) {
      return;
    }
    const rows = chunks.map((c, i) => parseSearchChunkRow(c, i + 1));
    if (!confirmLargeExport(rows.length, "检索片段", LARGE_EXPORT_SEARCH_THRESHOLD)) {
      return;
    }
    try {
      await exportSearchToXlsx({
        title: "TBOX 检索结果",
        datasetLabel,
        question: question.trim(),
        total,
        rows,
      });
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Excel 导出失败");
    }
  }

  async function onExportPptx() {
    if (!canExport) {
      return;
    }
    const rows = chunks.map((c, i) => parseSearchChunkRow(c, i + 1));
    if (!confirmLargeExport(rows.length, "检索片段（幻灯片）", LARGE_EXPORT_SEARCH_THRESHOLD)) {
      return;
    }
    try {
      await exportSearchToPptx({
        title: "TBOX 检索结果",
        datasetLabel,
        question: question.trim(),
        total,
        rows,
      });
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "PPT 导出失败");
    }
  }

  return (
    <div style={{ maxWidth: 880 }}>
      <h1 style={{ marginTop: 0 }}>检索</h1>
      <p className="muted">
        默认多选四个分域爬取库（Product / Market / Technology / Regulatory），对选中库并行检索后按相似度合并。
      </p>

      {loadingList ? <p className="muted">加载知识库列表…</p> : null}
      {listError ? (
        <ApiErrorBanner
          style={{ marginTop: "0.75rem" }}
          onRetry={() => void loadDatasets()}
          retryLabel="重试加载知识库"
          retryDisabled={loadingList}
          retryBusy={loadingList}
        >
          {listError}
        </ApiErrorBanner>
      ) : null}
      {searchError ? (
        <ApiErrorBanner
          style={{ marginTop: "0.75rem" }}
          onRetry={() => void runSearch()}
          retryLabel="重试检索"
          retryDisabled={loadingSearch || !selectedIds.length || !question.trim()}
          retryBusy={loadingSearch}
        >
          {searchError}
        </ApiErrorBanner>
      ) : null}

      {showKbEmpty ? (
        <div
          className="muted"
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            fontSize: "0.92rem",
          }}
        >
          未找到四个分域爬取库。请确认已创建 TBOX-Crawl-Product / Market / Technology / Regulatory。
        </div>
      ) : null}

      {showHintBeforeSearch ? (
        <div
          className="muted"
          style={{
            marginTop: "1rem",
            padding: "0.65rem 0.9rem",
            background: "#f8fafc",
            border: "1px dashed var(--border-subtle)",
            borderRadius: 8,
            fontSize: "0.9rem",
          }}
        >
          勾选分库并输入问题后，点「检索」查看合并结果。
        </div>
      ) : null}

      <form
        onSubmit={(ev) => void onSearch(ev)}
        style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: 12 }}
      >
        <fieldset style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "0.75rem 1rem" }}>
          <legend className="muted" style={{ padding: "0 0.35rem" }}>
            分域知识库（可多选）
          </legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem 1.25rem" }}>
            {domainOptions.map((opt) => (
              <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(opt.id)}
                  onChange={() => toggleId(opt.id)}
                  disabled={loadingList}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          <div style={{ marginTop: "0.65rem", display: "flex", gap: "0.5rem" }}>
            <button type="button" disabled={loadingList || !domainOptions.length} onClick={() => setSelectedIds(domainOptions.map((o) => o.id))}>
              全选
            </button>
            <button type="button" disabled={loadingList} onClick={() => setSelectedIds([])}>
              全不选
            </button>
          </div>
        </fieldset>
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <button type="submit" disabled={loadingSearch || !selectedIds.length || !question.trim()}>
            {loadingSearch ? "检索中…" : "检索"}
          </button>
          <button type="button" disabled={loadingSearch} onClick={onClearSearchForm} style={{ cursor: "pointer" }}>
            清空条件
          </button>
        </div>
      </form>

      {showNoHits ? (
        <section style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginTop: 0 }}>结果（0）</h2>
          <div
            className="muted"
            style={{
              padding: "0.85rem 1rem",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: 8,
              fontSize: "0.92rem",
            }}
          >
            本次检索<strong>无命中片段</strong>。可尝试换关键词、调整分库勾选，或确认该库已解析入库。
          </div>
          <p style={{ marginTop: "0.75rem" }}>
            <button type="button" onClick={onClearSearchForm} style={{ cursor: "pointer" }}>
              清空条件后重试
            </button>
          </p>
        </section>
      ) : chunks.length > 0 ? (
        <section style={{ marginTop: "1.5rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem" }}>
            <h2 style={{ fontSize: "1.1rem", margin: 0 }}>结果（{total}）</h2>
            <button type="button" disabled={!canExport} onClick={onExportMarkdown} title="下载当前检索结果为 Markdown">
              导出 Markdown
            </button>
            <button type="button" disabled={!canExport} onClick={onExportPdf} title="在新窗口打印，可选择另存为 PDF">
              导出 PDF…
            </button>
            <button type="button" disabled={!canExport} onClick={() => void onExportExcel()} title="下载当前检索结果为 Excel (.xlsx)">
              导出 Excel
            </button>
            <button type="button" disabled={!canExport} onClick={() => void onExportPptx()} title="下载当前检索结果为 PowerPoint (.pptx)">
              导出 PPT
            </button>
          </div>
          <p className="muted" style={{ fontSize: "0.85rem", margin: "0 0 0.75rem" }}>
            片段标题前缀为来源分库；点击条目可高亮查看。
          </p>
          {showWeakHit ? (
            <div
              className="muted"
              style={{
                marginBottom: "0.75rem",
                padding: "0.65rem 0.85rem",
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: 8,
                fontSize: "0.88rem",
              }}
            >
              最高相似度较低，结果可能与问题关联较弱。建议换关键词或调整分库勾选。
            </div>
          ) : null}
          <SearchResultList
            chunks={chunks}
            activeIndex={activeResultIndex}
            onSelectChunk={setActiveResultIndex}
            highlightQuery={lastQuery}
          />
        </section>
      ) : null}
    </div>
  );
}
