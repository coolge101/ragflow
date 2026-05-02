import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createCrawlTask,
  deleteCrawlTask,
  listCrawlTasks,
  patchCrawlTask,
  runCrawlTask,
  type CrawlTaskRow,
} from "../api/crawlTasks";
import { listDatasets, type DatasetRow } from "../api/datasets";
import { useAuth } from "../context/AuthContext";
import { formatCrawlLastErrorDisplay } from "../utils/crawlLastError";

const CRAWL_ROLES = new Set(["owner", "admin", "normal"]);

/** Mirrors backend ``extra_config`` keys used by ``execute_crawl_task_stub_tick`` / worker tick. */
const EXTRA_SKIP_HTTP_PROBE = "tbox_skip_http_probe";
const EXTRA_SKIP_INGEST = "tbox_skip_ingest";
const EXTRA_SKIP_ROBOTS = "tbox_skip_robots_check";
const EXTRA_WORKER_STUB_FAIL = "worker_stub_fail";

const MANAGED_EXTRA_KEYS = new Set([
  EXTRA_SKIP_HTTP_PROBE,
  EXTRA_SKIP_INGEST,
  EXTRA_SKIP_ROBOTS,
  EXTRA_WORKER_STUB_FAIL,
]);

function stripManagedExtraKeys(ex: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...ex };
  for (const k of MANAGED_EXTRA_KEYS) {
    delete out[k];
  }
  return out;
}

function stringifyExtraConfigSubset(ex: Record<string, unknown> | undefined): string {
  return JSON.stringify(stripManagedExtraKeys(ex || {}), null, 2);
}

function parseExtraConfigJson(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const raw = text.trim();
  if (!raw) {
    return { ok: true, value: {} };
  }
  try {
    const v = JSON.parse(raw) as unknown;
    if (v === null || typeof v !== "object" || Array.isArray(v)) {
      return { ok: false, error: "必须是 JSON 对象（非数组）" };
    }
    return { ok: true, value: v as Record<string, unknown> };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function configFlagOn(extra: Record<string, unknown> | undefined, key: string): boolean {
  if (!extra || typeof extra !== "object") {
    return false;
  }
  return Boolean(extra[key]);
}

function mergeCrawlExtraConfig(
  base: Record<string, unknown> | undefined,
  flags: { skipHttpProbe: boolean; skipIngest: boolean; skipRobots: boolean; workerStubFail: boolean },
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(base || {}) };
  const apply = (k: string, on: boolean) => {
    if (on) {
      out[k] = true;
    } else {
      delete out[k];
    }
  };
  apply(EXTRA_SKIP_HTTP_PROBE, flags.skipHttpProbe);
  apply(EXTRA_SKIP_INGEST, flags.skipIngest);
  apply(EXTRA_SKIP_ROBOTS, flags.skipRobots);
  apply(EXTRA_WORKER_STUB_FAIL, flags.workerStubFail);
  return out;
}

type CrawlExtraFlags = { skipHttpProbe: boolean; skipIngest: boolean; skipRobots: boolean; workerStubFail: boolean };

/** Subset textarea → full pretty JSON (merge checkbox flags into parsed object). */
function fullExtraJsonFromSubsetText(
  subsetText: string,
  flags: CrawlExtraFlags,
): { ok: true; text: string } | { ok: false; error: string } {
  const parsed = parseExtraConfigJson(subsetText);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, text: JSON.stringify(mergeCrawlExtraConfig(parsed.value, flags), null, 2) };
}

/** Full textarea → subset pretty JSON (strip managed keys). */
function subsetExtraJsonFromFullText(fullText: string): { ok: true; text: string } | { ok: false; error: string } {
  const parsed = parseExtraConfigJson(fullText);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, text: JSON.stringify(stripManagedExtraKeys(parsed.value), null, 2) };
}

function formatCrawlExtraSummary(extra: Record<string, unknown> | undefined): string {
  const parts: string[] = [];
  if (configFlagOn(extra, EXTRA_SKIP_HTTP_PROBE)) {
    parts.push("跳过探测");
  }
  if (configFlagOn(extra, EXTRA_SKIP_INGEST)) {
    parts.push("跳过入库");
  }
  if (configFlagOn(extra, EXTRA_SKIP_ROBOTS)) {
    parts.push("跳过 robots");
  }
  if (configFlagOn(extra, EXTRA_WORKER_STUB_FAIL)) {
    parts.push("stub 失败联调");
  }
  const customN = Object.keys(extra || {}).filter((k) => !MANAGED_EXTRA_KEYS.has(k)).length;
  if (customN > 0) {
    parts.push(`其它键×${customN}`);
  }
  return parts.length ? parts.join("、") : "—";
}

function eligibleTenants(me: { tenants?: Array<{ tenant_id: string; role: string }> } | null | undefined) {
  if (!me?.tenants) {
    return [];
  }
  return me.tenants.filter((t) => CRAWL_ROLES.has(String(t.role || "").toLowerCase()));
}

function parseSeedUrls(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fmtTime(v: unknown): string {
  if (v == null || v === "") {
    return "—";
  }
  const s = String(v);
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (n > 0 && n < 1e12) {
      return new Date(n * 1000).toLocaleString();
    }
    if (n >= 1e12) {
      return new Date(n).toLocaleString();
    }
  }
  return s;
}

export function CrawlPage() {
  const { me } = useAuth();
  const eligible = useMemo(() => eligibleTenants(me), [me]);
  const isSuper = Boolean(me?.is_superuser);

  const [tenantFilter, setTenantFilter] = useState("");
  const [taskOwnerTenant, setTaskOwnerTenant] = useState("");
  const [superListFilter, setSuperListFilter] = useState("");

  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [tasks, setTasks] = useState<CrawlTaskRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const [createName, setCreateName] = useState("");
  const [createSeeds, setCreateSeeds] = useState("");
  const [createSource, setCreateSource] = useState<"static_web" | "rss">("static_web");
  const [createRunState, setCreateRunState] = useState<"draft" | "ready" | "paused">("draft");
  const [createCron, setCreateCron] = useState("");
  const [createEnabled, setCreateEnabled] = useState(false);
  const [createDatasetId, setCreateDatasetId] = useState("");
  const [createSkipHttpProbe, setCreateSkipHttpProbe] = useState(false);
  const [createSkipIngest, setCreateSkipIngest] = useState(false);
  const [createSkipRobots, setCreateSkipRobots] = useState(false);
  const [createWorkerStubFail, setCreateWorkerStubFail] = useState(false);
  const [createExtraJson, setCreateExtraJson] = useState("{}");
  const [createExtraJsonFull, setCreateExtraJsonFull] = useState(false);

  const [editing, setEditing] = useState<CrawlTaskRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editSeeds, setEditSeeds] = useState("");
  const [editSource, setEditSource] = useState<"static_web" | "rss">("static_web");
  const [editRunState, setEditRunState] = useState<"draft" | "ready" | "paused">("draft");
  const [editCron, setEditCron] = useState("");
  const [editEnabled, setEditEnabled] = useState(false);
  const [editDatasetId, setEditDatasetId] = useState("");
  const [editSkipHttpProbe, setEditSkipHttpProbe] = useState(false);
  const [editSkipIngest, setEditSkipIngest] = useState(false);
  const [editSkipRobots, setEditSkipRobots] = useState(false);
  const [editWorkerStubFail, setEditWorkerStubFail] = useState(false);
  const [editExtraJson, setEditExtraJson] = useState("{}");
  const [editExtraJsonFull, setEditExtraJsonFull] = useState(false);

  const mustPickTenant = !isSuper && eligible.length > 1;

  const createExtraFlags = useMemo(
    () => ({
      skipHttpProbe: createSkipHttpProbe,
      skipIngest: createSkipIngest,
      skipRobots: createSkipRobots,
      workerStubFail: createWorkerStubFail,
    }),
    [createSkipHttpProbe, createSkipIngest, createSkipRobots, createWorkerStubFail],
  );

  const editExtraFlags = useMemo(
    () => ({
      skipHttpProbe: editSkipHttpProbe,
      skipIngest: editSkipIngest,
      skipRobots: editSkipRobots,
      workerStubFail: editWorkerStubFail,
    }),
    [editSkipHttpProbe, editSkipIngest, editSkipRobots, editWorkerStubFail],
  );

  /** In full JSON mode, re-apply checkbox flags into the textarea when toggles change (functional update avoids wiping on every keystroke). */
  useEffect(() => {
    if (!createExtraJsonFull) {
      return;
    }
    setCreateExtraJson((prev) => {
      const parsed = parseExtraConfigJson(prev);
      if (!parsed.ok) {
        return prev;
      }
      return JSON.stringify(mergeCrawlExtraConfig(parsed.value, createExtraFlags), null, 2);
    });
  }, [createExtraJsonFull, createExtraFlags]);

  useEffect(() => {
    if (!editing || !editExtraJsonFull) {
      return;
    }
    setEditExtraJson((prev) => {
      const parsed = parseExtraConfigJson(prev);
      if (!parsed.ok) {
        return prev;
      }
      return JSON.stringify(mergeCrawlExtraConfig(parsed.value, editExtraFlags), null, 2);
    });
  }, [editing, editExtraJsonFull, editExtraFlags]);

  const resolvedListTenant = useMemo(() => {
    if (isSuper) {
      return undefined;
    }
    if (eligible.length > 1) {
      const v = tenantFilter.trim();
      return v || undefined;
    }
    if (eligible.length === 1) {
      return eligible[0].tenant_id;
    }
    return me?.user_id || undefined;
  }, [isSuper, eligible, tenantFilter, me?.user_id]);

  const canFetchList = isSuper || resolvedListTenant != null;

  useEffect(() => {
    if (!me || isSuper) {
      return;
    }
    if (eligible.length === 1) {
      const id = eligible[0].tenant_id;
      setTenantFilter(id);
      setTaskOwnerTenant(id);
    } else if (eligible.length === 0 && me.user_id) {
      setTenantFilter(me.user_id);
      setTaskOwnerTenant(me.user_id);
    }
  }, [me, isSuper, eligible]);

  useEffect(() => {
    if (me?.user_id && !taskOwnerTenant) {
      setTaskOwnerTenant(me.user_id);
    }
  }, [me?.user_id, taskOwnerTenant]);

  const reloadKbs = useCallback(async () => {
    try {
      const { res, body } = await listDatasets({ page: 1, page_size: 200 });
      if (res.ok && body.code === 0 && Array.isArray(body.data)) {
        setDatasets(body.data);
      }
    } catch {
      setDatasets([]);
    }
  }, []);

  useEffect(() => {
    void reloadKbs();
  }, [reloadKbs]);

  const loadTasks = useCallback(async () => {
    if (!canFetchList) {
      setTasks([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tid = isSuper ? (superListFilter.trim() || undefined) : resolvedListTenant;
      const { res, body } = await listCrawlTasks({
        page,
        page_size: pageSize,
        tenant_id: tid,
      });
      if (res.status === 401 || body.code === 401) {
        setError("未授权");
        setTasks([]);
        return;
      }
      if (body.code !== 0) {
        setError(body.message || `错误码 ${body.code}`);
        setTasks([]);
        setTotal(0);
        return;
      }
      const d = body.data;
      setTasks(Array.isArray(d?.items) ? d.items : []);
      setTotal(typeof d?.total === "number" ? d.total : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [canFetchList, isSuper, page, resolvedListTenant, superListFilter]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const openEdit = (t: CrawlTaskRow) => {
    const ex = t.extra_config && typeof t.extra_config === "object" ? (t.extra_config as Record<string, unknown>) : undefined;
    setEditing(t);
    setEditName(t.name);
    setEditSeeds((t.seed_urls || []).join("\n"));
    setEditSource(t.source_type === "rss" ? "rss" : "static_web");
    setEditRunState(
      t.run_state === "ready" || t.run_state === "paused" ? (t.run_state as "ready" | "paused") : "draft",
    );
    setEditCron(t.schedule_cron || "");
    setEditEnabled(Boolean(t.enabled));
    setEditDatasetId(t.dataset_id ? String(t.dataset_id) : "");
    setEditSkipHttpProbe(configFlagOn(ex, EXTRA_SKIP_HTTP_PROBE));
    setEditSkipIngest(configFlagOn(ex, EXTRA_SKIP_INGEST));
    setEditSkipRobots(configFlagOn(ex, EXTRA_SKIP_ROBOTS));
    setEditWorkerStubFail(configFlagOn(ex, EXTRA_WORKER_STUB_FAIL));
    setEditExtraJsonFull(false);
    setEditExtraJson(stringifyExtraConfigSubset(ex));
  };

  const closeEdit = () => {
    setEditing(null);
    setEditExtraJsonFull(false);
  };

  const onCreate = async () => {
    setActionMsg(null);
    const seeds = parseSeedUrls(createSeeds);
    const owner = isSuper
      ? taskOwnerTenant.trim() || me?.user_id || ""
      : taskOwnerTenant.trim() || resolvedListTenant || me?.user_id || "";
    if (!owner) {
      setActionMsg(isSuper ? "请填写任务所属租户 ID" : "无法解析租户，请刷新页面重试");
      return;
    }
    if (!createName.trim()) {
      setActionMsg("请填写任务名称");
      return;
    }
    if (seeds.length === 0) {
      setActionMsg("请至少填写一行种子 URL（http/https）");
      return;
    }
    const parsed = parseExtraConfigJson(createExtraJson);
    if (!parsed.ok) {
      setActionMsg(`extra_config JSON 无效：${parsed.error}`);
      return;
    }
    const { res, body } = await createCrawlTask({
      tenant_id: owner,
      name: createName.trim(),
      seed_urls: seeds,
      source_type: createSource,
      run_state: createRunState,
      schedule_cron: createCron.trim(),
      enabled: createEnabled,
      dataset_id: createDatasetId.trim() || undefined,
      extra_config: mergeCrawlExtraConfig(parsed.value, {
        skipHttpProbe: createSkipHttpProbe,
        skipIngest: createSkipIngest,
        skipRobots: createSkipRobots,
        workerStubFail: createWorkerStubFail,
      }),
    });
    if (res.status === 401 || body.code === 401) {
      setActionMsg("未授权");
      return;
    }
    if (body.code !== 0) {
      setActionMsg(body.message || `创建失败 ${body.code}`);
      return;
    }
    setActionMsg("已创建");
    setCreateName("");
    setCreateSeeds("");
    setCreateCron("");
    setCreateEnabled(false);
    setCreateDatasetId("");
    setCreateSkipHttpProbe(false);
    setCreateSkipIngest(false);
    setCreateSkipRobots(false);
    setCreateWorkerStubFail(false);
    setCreateExtraJsonFull(false);
    setCreateExtraJson("{}");
    void loadTasks();
  };

  const onSaveEdit = async () => {
    if (!editing) {
      return;
    }
    setActionMsg(null);
    const seeds = parseSeedUrls(editSeeds);
    if (!editName.trim()) {
      setActionMsg("名称不能为空");
      return;
    }
    if (seeds.length === 0) {
      setActionMsg("种子 URL 不能为空");
      return;
    }
    const parsed = parseExtraConfigJson(editExtraJson);
    if (!parsed.ok) {
      setActionMsg(`extra_config JSON 无效：${parsed.error}`);
      return;
    }
    const payload: Record<string, unknown> = {
      name: editName.trim(),
      seed_urls: seeds,
      source_type: editSource,
      run_state: editRunState,
      schedule_cron: editCron.trim(),
      enabled: editEnabled,
      extra_config: mergeCrawlExtraConfig(parsed.value, {
        skipHttpProbe: editSkipHttpProbe,
        skipIngest: editSkipIngest,
        skipRobots: editSkipRobots,
        workerStubFail: editWorkerStubFail,
      }),
    };
    payload.dataset_id = editDatasetId.trim() || null;

    const { res, body } = await patchCrawlTask(editing.id, payload);
    if (res.status === 401 || body.code === 401) {
      setActionMsg("未授权");
      return;
    }
    if (body.code !== 0) {
      setActionMsg(body.message || `保存失败 ${body.code}`);
      return;
    }
    setActionMsg("已保存");
    closeEdit();
    void loadTasks();
  };

  const onRun = async (id: string) => {
    setActionMsg(null);
    setError(null);
    setRunningId(id);
    try {
      const { res, body } = await runCrawlTask(id);
      if (res.status === 401 || body.code === 401) {
        setError("未授权（执行）");
        return;
      }
      if (body.code !== 0) {
        setError(body.message || `执行失败 ${body.code}`);
        return;
      }
      setActionMsg("已触发一次执行（探测；若已绑定知识库则按类型入库并入解析队列）");
      void loadTasks();
    } finally {
      setRunningId(null);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("确定删除该采集任务？")) {
      return;
    }
    setActionMsg(null);
    const { res, body } = await deleteCrawlTask(id);
    if (res.status === 401 || body.code === 401) {
      setActionMsg("未授权");
      return;
    }
    if (body.code !== 0) {
      setActionMsg(body.message || `删除失败 ${body.code}`);
      return;
    }
    setActionMsg("已删除");
    if (editing?.id === id) {
      closeEdit();
    }
    void loadTasks();
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ marginTop: 0 }}>采集 / 爬取</h1>
      <p className="muted">
        任务数据来自 <code>GET/POST /v1/tbox/crawl/tasks</code>、<code>PATCH/DELETE .../tasks/&lt;id&gt;</code>、
        <code>POST .../tasks/&lt;id&gt;/run</code>（与 worker 相同 tick：HTTP 探测 + 已选知识库时 <code>static_web</code> 拉页 /{" "}
        <code>rss</code> 拉 Feed 条目入库，需 <code>crawl.manage</code>）。详见 <code>docs/TBOX_API_BOUNDARY.md</code> §1.3。
      </p>
      <ul className="muted" style={{ lineHeight: 1.6, marginBottom: "1.25rem" }}>
        <li>
          默认按 <code>robots.txt</code> 预检（与 <code>TBOX_CRAWL_HTTP_USER_AGENT</code> 一致；手动重定向的每一跳均校验）。
          任务 <code>extra_config.tbox_skip_robots_check</code> 可关闭。默认定时 + 可手动触发。
        </li>
        <li>站点凭据走环境变量 / 密钥卷，不入库。</li>
      </ul>

      {error ? (
        <p style={{ color: "#b91c1c" }}>
          {error}{" "}
          <Link to="/login">去登录</Link>
        </p>
      ) : null}
      {actionMsg ? <p style={{ color: "#15803d" }}>{actionMsg}</p> : null}

      <section style={{ marginBottom: "1.5rem", padding: "1rem", border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>筛选</h2>
        {isSuper ? (
          <label style={{ display: "block", marginBottom: 8 }}>
            <span className="muted" style={{ marginRight: 8 }}>
              仅看某租户（可选）
            </span>
            <input
              value={superListFilter}
              onChange={(e) => {
                setSuperListFilter(e.target.value);
                setPage(1);
              }}
              placeholder="空 = 列出全部租户"
              style={{ minWidth: 280 }}
            />
          </label>
        ) : null}
        {mustPickTenant ? (
          <label style={{ display: "block" }}>
            <span className="muted" style={{ marginRight: 8 }}>
              工作租户 <span style={{ color: "#b91c1c" }}>*</span>
            </span>
            <select
              value={tenantFilter}
              onChange={(e) => {
                const v = e.target.value;
                setTenantFilter(v);
                setTaskOwnerTenant(v);
                setPage(1);
              }}
            >
              <option value="">请选择</option>
              {eligible.map((t) => (
                <option key={t.tenant_id} value={t.tenant_id}>
                  {t.tenant_id}（{t.role}）
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="button" style={{ marginTop: 12 }} onClick={() => void loadTasks()} disabled={loading}>
          {loading ? "加载中…" : "刷新列表"}
        </button>
      </section>

      {!canFetchList ? (
        <p className="muted">{mustPickTenant ? "请选择工作租户后再查看任务列表。" : "加载用户信息…"}</p>
      ) : (
        <>
          <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "8px 6px" }}>名称</th>
                  <th style={{ padding: "8px 6px" }}>类型</th>
                  <th style={{ padding: "8px 6px" }}>状态</th>
                  <th style={{ padding: "8px 6px" }}>种子数</th>
                  <th style={{ padding: "8px 6px" }}>租户</th>
                  <th style={{ padding: "8px 6px" }}>知识库</th>
                  <th style={{ padding: "8px 6px" }}>最近执行</th>
                  <th style={{ padding: "8px 6px" }}>错误摘要</th>
                  <th style={{ padding: "8px 6px" }}>extra 选项</th>
                  <th style={{ padding: "8px 6px" }}>更新</th>
                  <th style={{ padding: "8px 6px" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 6px" }}>{t.name}</td>
                    <td style={{ padding: "8px 6px" }}>{t.source_type}</td>
                    <td style={{ padding: "8px 6px" }}>
                      {t.run_state}
                      {t.enabled ? " · 已启用" : ""}
                    </td>
                    <td style={{ padding: "8px 6px" }}>{(t.seed_urls || []).length}</td>
                    <td style={{ padding: "8px 6px", wordBreak: "break-all" }}>{t.tenant_id}</td>
                    <td style={{ padding: "8px 6px", wordBreak: "break-all" }}>{t.dataset_id || "—"}</td>
                    <td style={{ padding: "8px 6px" }}>{fmtTime(t.last_run_at)}</td>
                    <td style={{ padding: "8px 6px", maxWidth: 220, wordBreak: "break-word" }} title={t.last_error || ""}>
                      {formatCrawlLastErrorDisplay(t.last_error, 80)}
                    </td>
                    <td style={{ padding: "8px 6px", maxWidth: 140, fontSize: "0.82rem" }} className="muted">
                      {formatCrawlExtraSummary(
                        t.extra_config && typeof t.extra_config === "object"
                          ? (t.extra_config as Record<string, unknown>)
                          : undefined,
                      )}
                    </td>
                    <td style={{ padding: "8px 6px" }}>{fmtTime(t.update_time)}</td>
                    <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        disabled={runningId === t.id}
                        onClick={() => void onRun(t.id)}
                        title="与后台 worker 相同：探测 + 有知识库时按类型入库并入解析队列"
                      >
                        {runningId === t.id ? "执行中…" : "执行一次"}
                      </button>{" "}
                      <button type="button" onClick={() => openEdit(t)}>
                        编辑
                      </button>{" "}
                      <button type="button" onClick={() => void onDelete(t.id)}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tasks.length === 0 && !loading ? <p className="muted">暂无任务</p> : null}
          </div>
          <div className="muted" style={{ marginBottom: "1.5rem", display: "flex", gap: "1rem", alignItems: "center" }}>
            <span>
              共 {total} 条，第 {page} 页
            </span>
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              上一页
            </button>
            <button
              type="button"
              disabled={page * pageSize >= total || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </button>
          </div>
        </>
      )}

      <section style={{ marginBottom: "1.5rem", padding: "1rem", border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>新建任务</h2>
        {isSuper ? (
          <label style={{ display: "block", marginBottom: 8 }}>
            <span className="muted" style={{ marginRight: 8 }}>
              任务所属租户 ID
            </span>
            <input
              value={taskOwnerTenant}
              onChange={(e) => setTaskOwnerTenant(e.target.value)}
              placeholder={me?.user_id || "必填"}
              style={{ minWidth: 320 }}
            />
          </label>
        ) : null}
        <label style={{ display: "block", marginBottom: 8 }}>
          <span className="muted" style={{ marginRight: 8 }}>
            名称
          </span>
          <input value={createName} onChange={(e) => setCreateName(e.target.value)} style={{ minWidth: 320 }} />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          <span className="muted" style={{ marginRight: 8 }}>
            种子 URL（每行一个）
          </span>
          <textarea
            value={createSeeds}
            onChange={(e) => setCreateSeeds(e.target.value)}
            rows={5}
            style={{ width: "100%", maxWidth: 640 }}
            placeholder={"https://example.com/page\nhttps://example.com/feed.xml"}
          />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: 8 }}>
          <label>
            <span className="muted" style={{ marginRight: 8 }}>
              来源类型
            </span>
            <select value={createSource} onChange={(e) => setCreateSource(e.target.value as "static_web" | "rss")}>
              <option value="static_web">static_web</option>
              <option value="rss">rss</option>
            </select>
          </label>
          <label>
            <span className="muted" style={{ marginRight: 8 }}>
              运行态
            </span>
            <select
              value={createRunState}
              onChange={(e) => setCreateRunState(e.target.value as "draft" | "ready" | "paused")}
            >
              <option value="draft">draft</option>
              <option value="ready">ready</option>
              <option value="paused">paused</option>
            </select>
          </label>
          <label>
            <span className="muted" style={{ marginRight: 8 }}>
              Cron（可空）
            </span>
            <input
              value={createCron}
              onChange={(e) => setCreateCron(e.target.value)}
              placeholder="留空 = 仅手动；5 段 cron，如 */10 * * * *"
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={createEnabled} onChange={(e) => setCreateEnabled(e.target.checked)} />
            <span className="muted">启用调度（执行器就绪后）</span>
          </label>
        </div>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span className="muted" style={{ marginRight: 8 }}>
            目标知识库（可选）
          </span>
          <select value={createDatasetId} onChange={(e) => setCreateDatasetId(e.target.value)}>
            <option value="">不绑定</option>
            {datasets.map((d) => (
              <option key={String(d.id)} value={String(d.id ?? "")}>
                {String(d.name ?? d.id)}
              </option>
            ))}
          </select>
        </label>
        <div className="muted" style={{ marginBottom: 12, lineHeight: 1.7 }}>
          <div style={{ marginBottom: 6, fontWeight: 600, color: "var(--fg, #111827)" }}>extra_config（tick）</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <input type="checkbox" checked={createSkipHttpProbe} onChange={(e) => setCreateSkipHttpProbe(e.target.checked)} />
            <span>
              <code>tbox_skip_http_probe</code> — 不做轻量 HTTP 探测
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <input type="checkbox" checked={createSkipIngest} onChange={(e) => setCreateSkipIngest(e.target.checked)} />
            <span>
              <code>tbox_skip_ingest</code> — 探测后不入库（仍更新 <code>last_run_at</code>）
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <input type="checkbox" checked={createSkipRobots} onChange={(e) => setCreateSkipRobots(e.target.checked)} />
            <span>
              <code>tbox_skip_robots_check</code> — 不做 robots.txt 预检
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <input type="checkbox" checked={createWorkerStubFail} onChange={(e) => setCreateWorkerStubFail(e.target.checked)} />
            <span style={{ color: "#b45309" }}>
              <code>worker_stub_fail</code> — 每次 tick 在入口故意抛错（仅联调错误路径；勿在生产长期开启）
            </span>
          </label>
        </div>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span className="muted" style={{ display: "block", marginBottom: 6 }}>
            <strong>extra_config</strong> 高级编辑（JSON 对象；{createExtraJsonFull ? "当前为完整对象，勾选变更时会重合并四键到文本" : "默认已剥离勾选四键"}；保存时与勾选合并，<strong>勾选优先</strong>）
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={createExtraJsonFull}
              onChange={(e) => {
                const on = e.target.checked;
                setActionMsg(null);
                if (on) {
                  const r = fullExtraJsonFromSubsetText(createExtraJson, createExtraFlags);
                  if (!r.ok) {
                    setActionMsg(`无法展开为完整 JSON：${r.error}`);
                    return;
                  }
                  setCreateExtraJson(r.text);
                  setCreateExtraJsonFull(true);
                } else {
                  const r = subsetExtraJsonFromFullText(createExtraJson);
                  if (!r.ok) {
                    setActionMsg(`当前 JSON 无效，无法切回仅其它键：${r.error}`);
                    return;
                  }
                  setCreateExtraJson(r.text);
                  setCreateExtraJsonFull(false);
                }
              }}
            />
            <span className="muted">JSON 含勾选四键（完整 extra_config）</span>
          </label>
          <textarea
            value={createExtraJson}
            onChange={(e) => setCreateExtraJson(e.target.value)}
            rows={7}
            spellCheck={false}
            style={{
              width: "100%",
              maxWidth: 640,
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.85rem",
            }}
            placeholder='{}'
          />
        </label>
        <button type="button" onClick={() => void onCreate()}>
          创建
        </button>
      </section>

      {editing ? (
        <section style={{ padding: "1rem", border: "1px solid #2563eb", borderRadius: 8, marginBottom: "2rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>编辑：{editing.id}</h2>
          <label style={{ display: "block", marginBottom: 8 }}>
            <span className="muted" style={{ marginRight: 8 }}>
              名称
            </span>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ minWidth: 320 }} />
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            <span className="muted" style={{ marginRight: 8 }}>
              种子 URL
            </span>
            <textarea value={editSeeds} onChange={(e) => setEditSeeds(e.target.value)} rows={5} style={{ width: "100%", maxWidth: 640 }} />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: 8 }}>
            <label>
              <span className="muted" style={{ marginRight: 8 }}>
                来源
              </span>
              <select value={editSource} onChange={(e) => setEditSource(e.target.value as "static_web" | "rss")}>
                <option value="static_web">static_web</option>
                <option value="rss">rss</option>
              </select>
            </label>
            <label>
              <span className="muted" style={{ marginRight: 8 }}>
                运行态
              </span>
              <select value={editRunState} onChange={(e) => setEditRunState(e.target.value as "draft" | "ready" | "paused")}>
                <option value="draft">draft</option>
                <option value="ready">ready</option>
                <option value="paused">paused</option>
              </select>
            </label>
            <label>
              <span className="muted" style={{ marginRight: 8 }}>
                Cron
              </span>
              <input value={editCron} onChange={(e) => setEditCron(e.target.value)} placeholder="5 段 cron 或留空" />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={editEnabled} onChange={(e) => setEditEnabled(e.target.checked)} />
              <span className="muted">启用</span>
            </label>
          </div>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span className="muted" style={{ marginRight: 8 }}>
              知识库
            </span>
            <select value={editDatasetId} onChange={(e) => setEditDatasetId(e.target.value)}>
              <option value="">不绑定</option>
              {datasets.map((d) => (
                <option key={String(d.id)} value={String(d.id ?? "")}>
                  {String(d.name ?? d.id)}
                </option>
              ))}
            </select>
          </label>
          <div className="muted" style={{ marginBottom: 12, lineHeight: 1.7 }}>
            <div style={{ marginBottom: 6, fontWeight: 600, color: "var(--fg, #111827)" }}>extra_config（tick）</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <input type="checkbox" checked={editSkipHttpProbe} onChange={(e) => setEditSkipHttpProbe(e.target.checked)} />
              <span>
                <code>tbox_skip_http_probe</code> — 不做轻量 HTTP 探测
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <input type="checkbox" checked={editSkipIngest} onChange={(e) => setEditSkipIngest(e.target.checked)} />
              <span>
                <code>tbox_skip_ingest</code> — 探测后不入库
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <input type="checkbox" checked={editSkipRobots} onChange={(e) => setEditSkipRobots(e.target.checked)} />
              <span>
                <code>tbox_skip_robots_check</code> — 不做 robots.txt 预检
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <input type="checkbox" checked={editWorkerStubFail} onChange={(e) => setEditWorkerStubFail(e.target.checked)} />
              <span style={{ color: "#b45309" }}>
                <code>worker_stub_fail</code> — tick 入口故意抛错（联调）
              </span>
            </label>
          </div>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span className="muted" style={{ display: "block", marginBottom: 6 }}>
              <strong>extra_config</strong> 高级编辑（JSON；{editExtraJsonFull ? "当前为完整对象，勾选变更时会重合并四键到文本" : "默认已剥离勾选四键"}；保存时先解析再与勾选合并，<strong>勾选优先</strong>）
            </span>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={editExtraJsonFull}
                onChange={(e) => {
                  const on = e.target.checked;
                  setActionMsg(null);
                  if (on) {
                    const r = fullExtraJsonFromSubsetText(editExtraJson, editExtraFlags);
                    if (!r.ok) {
                      setActionMsg(`无法展开为完整 JSON：${r.error}`);
                      return;
                    }
                    setEditExtraJson(r.text);
                    setEditExtraJsonFull(true);
                  } else {
                    const r = subsetExtraJsonFromFullText(editExtraJson);
                    if (!r.ok) {
                      setActionMsg(`当前 JSON 无效，无法切回仅其它键：${r.error}`);
                      return;
                    }
                    setEditExtraJson(r.text);
                    setEditExtraJsonFull(false);
                  }
                }}
              />
              <span className="muted">JSON 含勾选四键（完整 extra_config）</span>
            </label>
            <textarea
              value={editExtraJson}
              onChange={(e) => setEditExtraJson(e.target.value)}
              rows={7}
              spellCheck={false}
              style={{
                width: "100%",
                maxWidth: 640,
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.85rem",
              }}
            />
          </label>
          <button type="button" onClick={() => void onSaveEdit()}>
            保存
          </button>{" "}
          <button type="button" onClick={closeEdit}>
            取消
          </button>
        </section>
      ) : null}
    </div>
  );
}
