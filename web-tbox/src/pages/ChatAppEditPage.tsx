import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createChat, getChat, updateChat } from "../api/chats";
import { fetchFlattenedMetadata, metadataKeysFromFlattened } from "../api/datasetMetadata";
import { listDatasets, type DatasetRow } from "../api/datasets";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import { ChatAppAdvancedSection } from "../components/chatApp/ChatAppAdvancedSection";
import { ChatAppBasicSection } from "../components/chatApp/ChatAppBasicSection";
import { ChatAppModelSection } from "../components/chatApp/ChatAppModelSection";
import { ChatAppPromptSection } from "../components/chatApp/ChatAppPromptSection";
import { ChatAppRetrievalSection } from "../components/chatApp/ChatAppRetrievalSection";
import { ChatAppSwitchesSection } from "../components/chatApp/ChatAppSwitchesSection";
import type { SectionProps } from "../components/chatApp/sectionProps";
import type { ChatAppFormState } from "../types/chatApp";
import {
  chatDetailToForm,
  createEmptyChatAppForm,
  toChatApiPayload,
  validateChatAppForm,
} from "../utils/chatAppDefaults";
import {
  CHAT_APP_SCENARIOS,
  createChatAppFormFromScenario,
  isChatAppScenarioId,
} from "../utils/chatAppScenarioTemplates";

export function ChatAppEditPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = !id || location.pathname.endsWith("/new");

  const [form, setForm] = useState<ChatAppFormState>(createEmptyChatAppForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [metadataKeys, setMetadataKeys] = useState<string[]>([]);

  const onChange: SectionProps["onChange"] = useCallback((patch) => {
    setForm((prev) => (typeof patch === "function" ? patch(prev) : { ...prev, ...patch }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const dsPromise = listDatasets({ page: 1, page_size: 100 });
      const chatPromise = !isNew && id ? getChat(id) : Promise.resolve(null);

      const [{ res: dsRes, body: dsBody }, chatResult] = await Promise.all([dsPromise, chatPromise]);

      if (dsRes.status === 401 || dsBody.code === 401) {
        setLoadError("未授权，请重新登录。");
        setDatasets([]);
        return;
      }
      if (dsBody.code !== 0) {
        setLoadError(dsBody.message || `加载知识库失败 (${dsBody.code})`);
        setDatasets([]);
        return;
      }
      setDatasets(Array.isArray(dsBody.data) ? dsBody.data : []);

      if (chatResult) {
        const { res, body } = chatResult;
        if (res.status === 401 || body.code === 401) {
          setLoadError("未授权，请重新登录。");
          return;
        }
        if (body.code !== 0 || !body.data) {
          setLoadError(body.message || `加载对话应用失败 (${body.code})`);
          return;
        }
        setForm(chatDetailToForm(body.data));
      } else if (isNew) {
        const template = searchParams.get("template");
        setForm(isChatAppScenarioId(template) ? createChatAppFormFromScenario(template) : createEmptyChatAppForm());
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id, isNew, searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!form.dataset_ids.length) {
      setMetadataKeys([]);
      return;
    }
    void fetchFlattenedMetadata(form.dataset_ids).then(({ body }) => {
      if (body.code === 0) {
        setMetadataKeys(metadataKeysFromFlattened(body.data));
      } else {
        setMetadataKeys([]);
      }
    });
  }, [form.dataset_ids]);

  async function onSave() {
    setSaveError(null);

    const validationMsg = validateChatAppForm(form);
    if (validationMsg) {
      if (validationMsg.startsWith("请填写")) {
        setSaveError(validationMsg);
        return;
      }
      if (!window.confirm(`${validationMsg}\n仍要保存吗？`)) {
        return;
      }
    }

    setSaving(true);
    try {
      const payload = toChatApiPayload(form);
      if (isNew) {
        const { res, body } = await createChat(payload);
        if (res.status === 401 || body.code === 401) {
          setSaveError("未授权，请重新登录。");
          return;
        }
        if (body.code !== 0) {
          setSaveError(body.message || `创建失败 (${body.code})`);
          return;
        }
        const newId = body.data?.id != null ? String(body.data.id) : "";
        if (newId) {
          navigate(`/admin/apps/${encodeURIComponent(newId)}`, { replace: true });
        } else {
          navigate("/admin/apps", { replace: true });
        }
      } else if (id) {
        const { res, body } = await updateChat(id, payload);
        if (res.status === 401 || body.code === 401) {
          setSaveError("未授权，请重新登录。");
          return;
        }
        if (body.code !== 0) {
          setSaveError(body.message || `保存失败 (${body.code})`);
          return;
        }
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const disabled = loading || saving;

  return (
    <div>
      <p style={{ marginTop: 0 }}>
        <Link to="/admin/apps">← 返回对话应用列表</Link>
      </p>

      <h1 style={{ marginTop: "0.5rem" }}>{isNew ? "新建对话应用" : "编辑对话应用"}</h1>

      {isNew ? (
        <div
          className="muted"
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            background: "#f8fafc",
            border: "1px dashed var(--border-subtle)",
            borderRadius: 8,
            maxWidth: 720,
            fontSize: "0.92rem",
          }}
        >
          <div style={{ marginBottom: 6 }}>从场景模板预填（咨询 / 决策 / 辅导）：</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {CHAT_APP_SCENARIOS.map((s) => (
              <Link key={s.id} to={`/admin/apps/new?template=${s.id}`}>
                {s.label}
              </Link>
            ))}
            <Link to="/admin/apps/new">空白</Link>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <ApiErrorBanner
          style={{ marginBottom: "1rem" }}
          onRetry={() => void load()}
          retryLabel="重试加载"
          retryDisabled={loading}
          retryBusy={loading}
        >
          {loadError}
        </ApiErrorBanner>
      ) : null}

      {saveError ? (
        <ApiErrorBanner style={{ marginBottom: "1rem" }} showLoginLink={saveError.includes("未授权")}>
          {saveError}
        </ApiErrorBanner>
      ) : null}

      {loading ? (
        <p className="muted">加载中…</p>
      ) : (
        <>
          <ChatAppBasicSection form={form} onChange={onChange} disabled={disabled} datasets={datasets} />
          <ChatAppModelSection form={form} onChange={onChange} disabled={disabled} />
          <ChatAppPromptSection form={form} onChange={onChange} disabled={disabled} />
          <ChatAppSwitchesSection form={form} onChange={onChange} disabled={disabled} />
          <ChatAppAdvancedSection
            form={form}
            onChange={onChange}
            disabled={disabled}
            metadataKeys={metadataKeys}
          />
          <ChatAppRetrievalSection form={form} onChange={onChange} disabled={disabled} />

          <div style={{ marginTop: "1.5rem", maxWidth: 720 }}>
            <button type="button" disabled={saving} onClick={() => void onSave()}>
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
