import { useCallback, useEffect, useState } from "react";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import {
  deleteDatasets,
  getDataset,
  listDatasets,
  updateDataset,
  type DatasetDetail,
  type DatasetRow,
} from "../api/datasets";
import { ModelIdSelect } from "../components/ModelIdSelect";
import { listLlmFactories, setLlmApiKey } from "../api/llmFactories";
import { getTenantModels, patchTenantModels, type TenantModelsInfo } from "../api/tenantModels";
import {
  CHAT_MODEL_PRESETS,
  EMBEDDING_MODEL_PRESETS,
  IMAGE2TEXT_PRESETS,
  SPEECH2TEXT_PRESETS,
} from "../constants/modelPresets";
import { hasPermission } from "../constants/permissions";
import { useAuth } from "../context/AuthContext";
import { sanitizeParserConfigForDatasetUpdate } from "../utils/sanitizeParserConfig";

/** Matches server `CreateDatasetReq` / `UpdateDatasetReq` allowed `chunk_method` values. */
const CHUNK_METHOD_OPTIONS = [
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
  "resume",
] as const;

function pickStr(v: unknown): string {
  return v == null ? "" : String(v);
}

/** 后端 `verify_embedding_availability` 返回的英文提示，映射为可操作的说明。 */
function formatDatasetSaveError(raw: string): string {
  if (raw.includes("Unsupported model:") || raw.includes("Unauthorized model:")) {
    return `${raw} 此为「本库嵌入模型」（格式 模型@厂商）未通过服务端校验；与下方 parser_config JSON 无关。请在本页选择有效嵌入模型并保存，或在「空间默认模型」中配置 embd_id 与对应厂商的 API Key。`;
  }
  return raw;
}

function formatDetailSummary(d: DatasetDetail | null): string {
  if (!d) {
    return "";
  }
  const docs = d.document_count;
  const chunks = d.chunk_count;
  const parts: string[] = [];
  if (typeof docs === "number") {
    parts.push(`文档数 ${docs}`);
  }
  if (typeof chunks === "number") {
    parts.push(`分块数 ${chunks}`);
  }
  return parts.length ? `（${parts.join(" · ")}）` : "";
}

export function KbConfigPage() {
  const { permissions } = useAuth();
  const canDangerKb = hasPermission(permissions, "kb.dangerous");

  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [kbLoading, setKbLoading] = useState(true);
  const [kbError, setKbError] = useState<string | null>(null);
  const [datasetId, setDatasetId] = useState("");

  const [detail, setDetail] = useState<DatasetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [chunkMethod, setChunkMethod] = useState<string>("naive");
  const [permission, setPermission] = useState<"me" | "team">("me");
  const [parserJsonText, setParserJsonText] = useState("{}\n");

  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [tenantInfo, setTenantInfo] = useState<TenantModelsInfo | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantErr, setTenantErr] = useState<string | null>(null);
  const [tenantEmbdDraft, setTenantEmbdDraft] = useState("");
  const [tenantLlmDraft, setTenantLlmDraft] = useState("");
  const [tenantAsrDraft, setTenantAsrDraft] = useState("");
  const [tenantImgDraft, setTenantImgDraft] = useState("");
  const [tenantSaveBusy, setTenantSaveBusy] = useState(false);
  const [tenantSaveMsg, setTenantSaveMsg] = useState<string | null>(null);

  const [factories, setFactories] = useState<{ name: string }[]>([]);
  const [factoriesErr, setFactoriesErr] = useState<string | null>(null);
  const [apiFactory, setApiFactory] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  const [apiKeyMsg, setApiKeyMsg] = useState<string | null>(null);

  const loadTenantPanel = useCallback(async () => {
    setTenantLoading(true);
    setTenantErr(null);
    setTenantSaveMsg(null);
    try {
      const { res, body } = await getTenantModels();
      if (res.status === 401 || body.code === 401) {
        setTenantErr("未授权，请重新登录。");
        setTenantInfo(null);
        return;
      }
      if (body.code !== 0 || !body.data) {
        setTenantErr(body.message || `加载空间模型失败（${body.code}）`);
        setTenantInfo(null);
        return;
      }
      const d = body.data;
      setTenantInfo(d);
      setTenantEmbdDraft(pickStr(d.embd_id));
      setTenantLlmDraft(pickStr(d.llm_id));
      setTenantAsrDraft(pickStr(d.asr_id));
      setTenantImgDraft(pickStr(d.img2txt_id));
    } catch (e) {
      setTenantErr(e instanceof Error ? e.message : String(e));
      setTenantInfo(null);
    } finally {
      setTenantLoading(false);
    }
  }, []);

  const loadFactories = useCallback(async () => {
    setFactoriesErr(null);
    try {
      const { res, body } = await listLlmFactories();
      if (res.status === 401 || body.code === 401) {
        setFactoriesErr("未授权");
        setFactories([]);
        return;
      }
      if (body.code !== 0) {
        setFactoriesErr(body.message || `加载厂商列表失败（${body.code}）`);
        setFactories([]);
        return;
      }
      const rows = Array.isArray(body.data) ? body.data : [];
      const names = rows
        .map((r) => (typeof r.name === "string" ? r.name : ""))
        .filter(Boolean)
        .map((name) => ({ name }));
      setFactories(names);
      setApiFactory((prev) => {
        if (prev && names.some((n) => n.name === prev)) {
          return prev;
        }
        return names[0]?.name ?? "";
      });
    } catch (e) {
      setFactoriesErr(e instanceof Error ? e.message : String(e));
      setFactories([]);
    }
  }, []);

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
      setDatasetId((prev) => {
        if (prev && rows.some((r) => String(r.id) === prev)) {
          return prev;
        }
        return rows[0]?.id ? String(rows[0].id) : "";
      });
    } catch (e) {
      setKbError(e instanceof Error ? e.message : String(e));
      setDatasets([]);
    } finally {
      setKbLoading(false);
    }
  }, []);

  const applyDetailToForm = useCallback((d: DatasetDetail) => {
    setName(pickStr(d.name).trim() || pickStr(d.id));
    setDescription(pickStr(d.description));
    setEmbeddingModel(pickStr(d.embedding_model));
    const cm = pickStr(d.chunk_method).trim().toLowerCase();
    setChunkMethod(CHUNK_METHOD_OPTIONS.includes(cm as (typeof CHUNK_METHOD_OPTIONS)[number]) ? cm : "naive");
    const perm = pickStr(d.permission).trim().toLowerCase();
    setPermission(perm === "team" ? "team" : "me");
    const pc = d.parser_config;
    try {
      const safe = sanitizeParserConfigForDatasetUpdate(pc && typeof pc === "object" ? pc : {});
      setParserJsonText(`${JSON.stringify(safe, null, 2)}\n`);
    } catch {
      setParserJsonText("{}\n");
    }
  }, []);

  const loadDetail = useCallback(async () => {
    if (!datasetId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    setSaveMsg(null);
    try {
      const { res, body } = await getDataset(datasetId);
      if (res.status === 401 || body.code === 401) {
        setDetailError("未授权");
        setDetail(null);
        return;
      }
      if (body.code !== 0 || !body.data) {
        setDetailError(body.message || `错误码 ${body.code}`);
        setDetail(null);
        return;
      }
      setDetail(body.data);
      applyDetailToForm(body.data);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : String(e));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [datasetId, applyDetailToForm]);

  useEffect(() => {
    void reloadKbs();
  }, [reloadKbs]);

  useEffect(() => {
    void loadTenantPanel();
    void loadFactories();
  }, [loadTenantPanel, loadFactories]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function onSave() {
    if (!datasetId) {
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveMsg("名称不能为空。");
      return;
    }
    let parserConfig: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(parserJsonText.trim() || "{}");
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        setSaveMsg("parser_config 必须是 JSON 对象（不能是数组或 null）。");
        return;
      }
      parserConfig = parsed as Record<string, unknown>;
    } catch {
      setSaveMsg("parser_config 不是合法 JSON。");
      return;
    }

    const parserConfigForApi = sanitizeParserConfigForDatasetUpdate(parserConfig);

    setSaveBusy(true);
    setSaveMsg(null);
    try {
      const body: Record<string, unknown> = {
        name: trimmedName,
        description: description.trim() || null,
        chunk_method: chunkMethod,
        permission,
        parser_config: parserConfigForApi,
      };
      const emb = embeddingModel.trim();
      if (emb) {
        body.embedding_model = emb;
      }
      const { res, body: out } = await updateDataset(datasetId, body);
      if (res.status === 401 || out.code === 401) {
        setSaveMsg("未授权，请重新登录。");
        return;
      }
      if (out.code !== 0) {
        setSaveMsg(formatDatasetSaveError(out.message || `保存失败（${out.code}）`));
        return;
      }
      setSaveMsg("已保存。");
      if (out.data) {
        setDetail(out.data);
        applyDetailToForm(out.data);
      } else {
        await loadDetail();
      }
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }

  async function onSaveTenantModels() {
    if (!tenantInfo?.tenant_id) {
      setTenantSaveMsg("未加载到空间信息（可能当前账号不是空间所有者）。");
      return;
    }
    const embd = tenantEmbdDraft.trim();
    const llm = tenantLlmDraft.trim();
    if (!embd) {
      setTenantSaveMsg("请填写默认嵌入模型 embd_id（格式 模型@厂商），否则解析仍会报 No default embedding。");
      return;
    }
    setTenantSaveBusy(true);
    setTenantSaveMsg(null);
    try {
      const payload: Record<string, unknown> = {
        tenant_id: tenantInfo.tenant_id,
        embd_id: embd,
        llm_id: llm || pickStr(tenantInfo.llm_id),
        asr_id: tenantAsrDraft.trim() || pickStr(tenantInfo.asr_id),
        img2txt_id: tenantImgDraft.trim() || pickStr(tenantInfo.img2txt_id),
      };
      const { res, body } = await patchTenantModels(payload);
      if (res.status === 401 || body.code === 401) {
        setTenantSaveMsg("未授权。");
        return;
      }
      if (body.code !== 0) {
        setTenantSaveMsg(body.message || `保存失败（${body.code}）`);
        return;
      }
      setTenantSaveMsg("已保存空间默认模型。请到「文档 / 知识库」对未完成的文档重新点「开始解析」。");
      await loadTenantPanel();
    } catch (e) {
      setTenantSaveMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setTenantSaveBusy(false);
    }
  }

  async function onSaveApiKey() {
    const fac = apiFactory.trim();
    const key = apiKey.trim();
    if (!fac || !key) {
      setApiKeyMsg("请选择厂商并填写 API Key。");
      return;
    }
    setApiKeyBusy(true);
    setApiKeyMsg(null);
    try {
      const { res, body } = await setLlmApiKey({
        llm_factory: fac,
        api_key: key,
        base_url: apiBaseUrl.trim(),
      });
      if (res.status === 401 || body.code === 401) {
        setApiKeyMsg("未授权。");
        return;
      }
      if (body.code !== 0) {
        setApiKeyMsg(body.message || `保存失败（${body.code}）`);
        return;
      }
      setApiKeyMsg("API Key 已写入。若默认模型仍为空，请在上方填写 embd_id 并保存。");
      setApiKey("");
      await loadTenantPanel();
    } catch (e) {
      setApiKeyMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setApiKeyBusy(false);
    }
  }

  async function onDeleteKb() {
    if (!datasetId || !detail) {
      return;
    }
    const label = pickStr(detail.name) || datasetId;
    if (
      !window.confirm(
        `确定删除知识库「${label}」？\n对应 DELETE /api/v1/datasets，不可撤销。`,
      )
    ) {
      return;
    }
    setDeleteBusy(true);
    setSaveMsg(null);
    try {
      const { res, body } = await deleteDatasets([datasetId]);
      if (res.status === 401 || body.code === 401) {
        setSaveMsg("未授权，请重新登录。");
        return;
      }
      if (body.code !== 0) {
        setSaveMsg(body.message || `删除失败（${body.code}）`);
        return;
      }
      setDatasetId("");
      setDetail(null);
      await reloadKbs();
      setSaveMsg("知识库已删除。");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  const chunkHint =
    typeof detail?.chunk_count === "number" && detail.chunk_count > 0
      ? "当前库已有分块数据时，后端会拒绝更换嵌入模型；请先了解后端限制再修改。"
      : null;

  const embeddingUnset =
    Boolean(datasetId) &&
    !embeddingModel.trim() &&
    (typeof detail?.chunk_count !== "number" || detail.chunk_count === 0);

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ marginTop: 0 }}>知识库配置</h1>
      <p className="muted">
        通过 <code>GET/PUT /api/v1/datasets/&lt;id&gt;</code> 配置：名称、描述、嵌入模型、分块方法、可见范围与{" "}
        <code>parser_config</code>。整库删除需 <code>kb.dangerous</code> 权限（二次确认）。
      </p>

      <section
        style={{
          marginBottom: "1.25rem",
          padding: "1rem 1.2rem",
          background: "#f8fafc",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.08rem" }}>空间级：默认模型与 API Key</h2>
        <p className="muted" style={{ fontSize: "0.88rem", marginTop: "-0.2rem" }}>
          解析报错 <code>No default embedding model is set</code> 表示<strong>知识库未绑定嵌入模型</strong>且<strong>空间默认 embd_id 为空</strong>。可在下方为<strong>当前登录用户作为所有者的空间</strong>设置默认{" "}
          <code>embd_id</code> / <code>llm_id</code>（<code>PATCH /api/v1/users/me/models</code>），并先通过{" "}
          <code>POST /v1/llm/set_api_key</code> 把对应厂商的 Key 写入租户表。
        </p>
        {tenantLoading ? (
          <p className="muted">加载空间模型信息…</p>
        ) : tenantErr ? (
          <ApiErrorBanner onRetry={() => void loadTenantPanel()} retryLabel="重试" retryDisabled={tenantLoading} retryBusy={tenantLoading}>
            {tenantErr}
          </ApiErrorBanner>
        ) : tenantInfo ? (
          <>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              空间 <strong>{pickStr(tenantInfo.name) || pickStr(tenantInfo.tenant_id)}</strong>（角色 {pickStr(tenantInfo.role) || "—"}）
            </p>
            <div style={{ display: "grid", gap: "0.65rem", maxWidth: 720, marginTop: "0.5rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="muted">
                  默认嵌入模型 <code>embd_id</code> <span style={{ color: "#b91c1c" }}>*</span>
                </span>
                <ModelIdSelect
                  modelType="embedding"
                  value={tenantEmbdDraft}
                  onChange={setTenantEmbdDraft}
                  presets={EMBEDDING_MODEL_PRESETS}
                  disabled={tenantSaveBusy}
                  placeholderLabel="请选择默认嵌入模型"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="muted">
                  默认对话模型 <code>llm_id</code>（解析部分流程会用到）
                </span>
                <ModelIdSelect
                  modelType="chat"
                  value={tenantLlmDraft}
                  onChange={setTenantLlmDraft}
                  presets={CHAT_MODEL_PRESETS}
                  disabled={tenantSaveBusy}
                  placeholderLabel="请选择默认对话模型"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="muted">
                  <code>asr_id</code>（语音转文字，可选）
                </span>
                <ModelIdSelect
                  modelType="speech2text"
                  value={tenantAsrDraft}
                  onChange={setTenantAsrDraft}
                  presets={SPEECH2TEXT_PRESETS}
                  disabled={tenantSaveBusy}
                  placeholderLabel="不使用时请选空或「其他」留空"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="muted">
                  <code>img2txt_id</code>（图生文，可选）
                </span>
                <ModelIdSelect
                  modelType="image2text"
                  value={tenantImgDraft}
                  onChange={setTenantImgDraft}
                  presets={IMAGE2TEXT_PRESETS}
                  disabled={tenantSaveBusy}
                  placeholderLabel="不使用时请选空或「其他」留空"
                />
              </label>
            </div>
            <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
              <button type="button" disabled={tenantSaveBusy} onClick={() => void onSaveTenantModels()}>
                {tenantSaveBusy ? "保存中…" : "保存空间默认模型"}
              </button>
              {tenantSaveMsg ? (
                <span className="muted" style={{ fontSize: "0.88rem" }}>
                  {tenantSaveMsg}
                </span>
              ) : null}
            </div>

            <hr style={{ margin: "1.1rem 0", border: "none", borderTop: "1px dashed var(--border-subtle)" }} />

            <h3 style={{ fontSize: "0.98rem", margin: "0 0 0.35rem" }}>供应商 API Key</h3>
            <p className="muted" style={{ fontSize: "0.82rem", marginTop: 0 }}>
              与「模型与 API Key 配置」一致：写入后 Key 保存在服务端。复杂厂商（如火山、Bedrock）请在本页按厂商说明填写。
            </p>
            {factoriesErr ? (
              <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>{factoriesErr}</p>
            ) : (
              <div style={{ display: "grid", gap: "0.65rem", maxWidth: 720 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="muted">厂商 llm_factory</span>
                  <select value={apiFactory} onChange={(e) => setApiFactory(e.target.value)} style={{ padding: "0.4rem" }}>
                    {factories.length === 0 ? (
                      <option value="">（无）</option>
                    ) : (
                      factories.map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="muted">API Key</span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-… 或对应厂商密钥"
                    style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.85rem" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="muted">Base URL（可选，兼容网关 / 自建 OpenAI 类接口）</span>
                  <input
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.85rem" }}
                  />
                </label>
              </div>
            )}
            <div style={{ marginTop: "0.65rem", display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
              <button type="button" disabled={apiKeyBusy || !apiFactory} onClick={() => void onSaveApiKey()}>
                {apiKeyBusy ? "提交中…" : "保存并校验 API Key"}
              </button>
              <button type="button" disabled={tenantLoading} onClick={() => void loadFactories()}>
                刷新厂商列表
              </button>
              {apiKeyMsg ? (
                <span className="muted" style={{ fontSize: "0.88rem" }}>
                  {apiKeyMsg}
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <p className="muted">暂无空间模型数据。</p>
        )}
      </section>

      {kbError ? (
        <ApiErrorBanner
          onRetry={() => void reloadKbs()}
          retryLabel="重试加载知识库列表"
          retryDisabled={kbLoading}
          retryBusy={kbLoading}
        >
          知识库列表：{kbError}
        </ApiErrorBanner>
      ) : null}
      {detailError ? (
        <ApiErrorBanner
          onRetry={() => void loadDetail()}
          retryLabel="重试加载详情"
          retryDisabled={detailLoading || !datasetId}
          retryBusy={detailLoading}
        >
          知识库详情：{detailError}
        </ApiErrorBanner>
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
            style={{ minWidth: 240, padding: "0.35rem" }}
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
        <button type="button" disabled={kbLoading} onClick={() => void reloadKbs()}>
          {kbLoading ? "…" : "刷新列表"}
        </button>
        <button type="button" disabled={detailLoading || !datasetId} onClick={() => void loadDetail()}>
          {detailLoading ? "加载中…" : "放弃修改并重载"}
        </button>
      </div>

      {!datasetId ? (
        <p className="muted">
          请先在「文档 / 知识库」页使用「新建知识库」，或通过 API 创建数据集，再于此处编辑配置。
        </p>
      ) : detailLoading && !detail ? (
        <p className="muted">加载配置…</p>
      ) : (
        <div
          style={{
            padding: "1rem 1.25rem",
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
          }}
        >
          <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
            当前库 {formatDetailSummary(detail)}
          </p>
          {chunkHint ? (
            <p style={{ fontSize: "0.88rem", color: "#92400e", marginTop: "-0.25rem" }}>{chunkHint}</p>
          ) : null}
          {embeddingUnset ? (
            <p style={{ fontSize: "0.88rem", color: "#1e40af", marginTop: "-0.15rem", background: "#eff6ff", padding: "0.55rem 0.65rem", borderRadius: 6 }}>
              当前知识库<strong>未填写嵌入模型</strong>。若空间默认 <code>embd_id</code> 也为空，解析会失败。请在本页下方填写「嵌入模型」并保存，或先在上方「空间默认模型」中设置{" "}
              <code>embd_id</code> 与 API Key。
            </p>
          ) : null}

          <div style={{ display: "grid", gap: "0.75rem", maxWidth: 720 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="muted">名称</span>
              <input value={name} onChange={(e) => setName(e.target.value)} style={{ padding: "0.4rem" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="muted">描述</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                style={{ padding: "0.4rem", resize: "vertical" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="muted">
                本库嵌入模型 <code>embedding_model</code>{" "}
                <span style={{ fontWeight: "normal" }}>
                  （下拉来自 <code>GET /v1/llm/list</code>，含国产/常用预设；选第一项空则回退到空间默认 <code>embd_id</code>）
                </span>
              </span>
              <ModelIdSelect
                modelType="embedding"
                value={embeddingModel}
                onChange={setEmbeddingModel}
                presets={EMBEDDING_MODEL_PRESETS}
                disabled={saveBusy}
                placeholderLabel="（可选）请选择本库嵌入模型，或留空用空间默认"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="muted">分块方法 chunk_method</span>
              <select value={chunkMethod} onChange={(e) => setChunkMethod(e.target.value)} style={{ padding: "0.4rem" }}>
                {CHUNK_METHOD_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="muted">可见范围 permission</span>
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value === "team" ? "team" : "me")}
                style={{ padding: "0.4rem" }}
              >
                <option value="me">me（仅自己）</option>
                <option value="team">team（团队）</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="muted">parser_config（JSON）</span>
              <textarea
                value={parserJsonText}
                onChange={(e) => setParserJsonText(e.target.value)}
                spellCheck={false}
                rows={12}
                style={{ padding: "0.45rem", fontFamily: "monospace", fontSize: "0.82rem" }}
              />
            </label>
          </div>

          <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
            <button type="button" disabled={saveBusy || detailLoading} onClick={() => void onSave()}>
              {saveBusy ? "保存中…" : "保存配置"}
            </button>
            {saveMsg ? (
              <span className="muted" style={{ fontSize: "0.9rem" }}>
                {saveMsg}
              </span>
            ) : null}
          </div>

          {canDangerKb ? (
            <section style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px dashed var(--border-subtle)" }}>
              <h2 style={{ fontSize: "1rem", margin: "0 0 0.5rem" }}>危险操作</h2>
              <p className="muted" style={{ fontSize: "0.85rem", marginTop: 0 }}>
                删除整个知识库与库内索引，需 <code>kb.dangerous</code>。
              </p>
              <button
                type="button"
                disabled={deleteBusy || !datasetId}
                onClick={() => void onDeleteKb()}
                style={{ color: "#b91c1c" }}
              >
                {deleteBusy ? "删除中…" : "删除此知识库"}
              </button>
            </section>
          ) : (
            <p className="muted" style={{ marginTop: "1.25rem", fontSize: "0.85rem" }}>
              整库删除需要 <code>kb.dangerous</code> 权限；可在「用户与角色」中为管理员开启对应权限集。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
