# TBOX 对话应用（Chat Apps）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `web-tbox` 内实现对话应用完整 CRUD 与 C 级配置（对齐官方 `next-chats`），使用户无需部署官方 `web/` 即可完成「建库 → 建应用 → RAG 对话」闭环，且用户可见界面零 RAGFlow 品牌。

**Architecture:** 新增独立 `/apps` 模块（列表 + 编辑页），扩展 `src/api/chats.ts` 调用既有 `POST/GET/PUT/DELETE /api/v1/chats`；表单按分区组件拆分，状态用 `useState`（与 `KbConfigPage` 一致）；权限门禁 `kb.configure`；分 3 个 PR 交付，每 PR 通过 `typecheck` + `build`。

**Tech Stack:** React 18、React Router 6、TypeScript、Vite 7；后端 RAGFlow fork REST（无新 npm UI 库）。

**Spec:** `docs/superpowers/specs/2026-05-21-tbox-chat-apps-design.md`

---

## File Structure（创建 / 修改一览）

| 文件 | 职责 |
|------|------|
| `src/types/chatApp.ts` | Chat 应用 TypeScript 类型 |
| `src/utils/chatAppDefaults.ts` | 默认值、`toCreatePayload` / `toUpdatePayload` |
| `src/api/chats.ts` | 扩展 CRUD |
| `src/api/datasetMetadata.ts` | metadata flattened |
| `src/pages/ChatAppsPage.tsx` | 列表 + 删除 |
| `src/pages/ChatAppEditPage.tsx` | 创建/编辑容器 |
| `src/components/chatApp/*.tsx` | 表单分区（6 个） |
| `src/App.tsx` | 路由 |
| `src/layouts/MainLayout.tsx` | 侧栏 |
| `src/pages/ChatPage.tsx` | 空态 + 权限化引导 |
| `src/hooks/useRouteDocumentTitle.ts` | 标题 |
| `src/review/journeySteps.ts` | 验收步骤 |
| 品牌相关页面 | §PR-3 Task 8 |

---

## PR-1：API + 路由 + 列表 + 核心表单

### Task 1: Chat 应用类型与默认值

**Files:**
- Create: `web-tbox/src/types/chatApp.ts`
- Create: `web-tbox/src/utils/chatAppDefaults.ts`

- [ ] **Step 1: 创建 `chatApp.ts`**

```typescript
// web-tbox/src/types/chatApp.ts
export type ChatParameter = { key: string; optional: boolean };

export type ChatReferenceMetadata = {
  include?: boolean;
  fields?: string[];
};

export type ChatPromptConfig = {
  system: string;
  prologue: string;
  empty_response: string;
  parameters: ChatParameter[];
  quote: boolean;
  keyword: boolean;
  tts: boolean;
  refine_multiturn: boolean;
  use_kg: boolean;
  reasoning: boolean;
  toc_enhance: boolean;
  tavily_api_key?: string;
  cross_languages?: string[];
  reference_metadata?: ChatReferenceMetadata;
};

export type ChatLlmSetting = {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
};

export type MetaDataFilterManualCondition = {
  key: string;
  op: string;
  value: string | string[];
};

export type MetaDataFilter = {
  method?: "disabled" | "auto" | "semi_auto" | "manual" | string;
  logic?: string;
  manual?: MetaDataFilterManualCondition[];
  semi_auto?: Array<string | { key: string; op?: string }>;
};

/** 表单状态（与 API 字段对齐；GET 响应经 normalize 填入） */
export type ChatAppFormState = {
  name: string;
  description: string;
  language: "English" | "Chinese";
  icon: string;
  dataset_ids: string[];
  llm_id: string;
  llm_setting: ChatLlmSetting;
  prompt_config: ChatPromptConfig;
  top_n: number;
  top_k: number;
  similarity_threshold: number;
  vector_similarity_weight: number;
  rerank_id: string;
  meta_data_filter: MetaDataFilter;
};

export type ChatAppDetail = ChatAppFormState & {
  id?: string;
  kb_names?: string[];
  create_time?: string;
  update_time?: string;
};
```

- [ ] **Step 2: 创建 `chatAppDefaults.ts`**

```typescript
// web-tbox/src/utils/chatAppDefaults.ts
import type { ChatAppDetail, ChatAppFormState } from "../types/chatApp";

const DEFAULT_SYSTEM = [
  "You are an intelligent assistant. Please summarize the content of the dataset to answer the question.",
  "Please list the data in the dataset and answer in detail. When all dataset content is irrelevant to the question,",
  'your answer must include the sentence "The answer you are looking for is not found in the dataset!"',
  "Answers need to consider chat history.",
  "      Here is the knowledge base:",
  "      {knowledge}",
  "      The above is the knowledge base.",
].join(" ");

export function createEmptyChatAppForm(): ChatAppFormState {
  return {
    name: "",
    description: "",
    language: "Chinese",
    icon: "",
    dataset_ids: [],
    llm_id: "",
    llm_setting: {
      temperature: 0.1,
      top_p: 0.3,
      frequency_penalty: 0.7,
      presence_penalty: 0.4,
      max_tokens: 512,
    },
    prompt_config: {
      system: DEFAULT_SYSTEM,
      prologue: "Hi! I'm your assistant. What can I do for you?",
      empty_response: "Sorry! No relevant content was found in the knowledge base!",
      parameters: [{ key: "knowledge", optional: false }],
      quote: true,
      keyword: false,
      tts: false,
      refine_multiturn: true,
      use_kg: false,
      reasoning: false,
      toc_enhance: false,
      cross_languages: [],
      reference_metadata: { include: false, fields: undefined },
    },
    top_n: 6,
    top_k: 1024,
    similarity_threshold: 0.1,
    vector_similarity_weight: 0.3,
    rerank_id: "",
    meta_data_filter: { method: "disabled", manual: [], semi_auto: [] },
  };
}

/** 将 GET /chats/:id 的 data 转为表单（缺省字段回落到 createEmpty） */
export function chatDetailToForm(data: Record<string, unknown>): ChatAppFormState {
  const base = createEmptyChatAppForm();
  const pc = (data.prompt_config as Record<string, unknown>) ?? {};
  const rm = (pc.reference_metadata as Record<string, unknown>) ?? {};
  return {
    ...base,
    name: String(data.name ?? ""),
    description: String(data.description ?? ""),
    language: (data.language === "English" ? "English" : "Chinese") as "English" | "Chinese",
    icon: String(data.icon ?? ""),
    dataset_ids: Array.isArray(data.dataset_ids) ? data.dataset_ids.map(String) : [],
    llm_id: String(data.llm_id ?? ""),
    llm_setting: { ...base.llm_setting, ...(data.llm_setting as object) },
    prompt_config: {
      ...base.prompt_config,
      system: String(pc.system ?? base.prompt_config.system),
      prologue: String(pc.prologue ?? base.prompt_config.prologue),
      empty_response: String(pc.empty_response ?? base.prompt_config.empty_response),
      parameters: Array.isArray(pc.parameters)
        ? (pc.parameters as ChatAppFormState["prompt_config"]["parameters"])
        : base.prompt_config.parameters,
      quote: Boolean(pc.quote ?? base.prompt_config.quote),
      keyword: Boolean(pc.keyword ?? base.prompt_config.keyword),
      tts: Boolean(pc.tts ?? base.prompt_config.tts),
      refine_multiturn: Boolean(pc.refine_multiturn ?? base.prompt_config.refine_multiturn),
      use_kg: Boolean(pc.use_kg ?? base.prompt_config.use_kg),
      reasoning: Boolean(pc.reasoning ?? base.prompt_config.reasoning),
      toc_enhance: Boolean(pc.toc_enhance ?? base.prompt_config.toc_enhance),
      tavily_api_key: pc.tavily_api_key ? String(pc.tavily_api_key) : undefined,
      cross_languages: Array.isArray(pc.cross_languages) ? pc.cross_languages.map(String) : [],
      reference_metadata: {
        include: Boolean(rm.include),
        fields: Array.isArray(rm.fields) ? rm.fields.map(String) : undefined,
      },
    },
    top_n: Number(data.top_n ?? base.top_n),
    top_k: Number(data.top_k ?? base.top_k),
    similarity_threshold: Number(data.similarity_threshold ?? base.similarity_threshold),
    vector_similarity_weight: Number(data.vector_similarity_weight ?? base.vector_similarity_weight),
    rerank_id: String(data.rerank_id ?? ""),
    meta_data_filter: {
      ...(base.meta_data_filter as object),
      ...(data.meta_data_filter as object),
    },
  };
}

export function toChatApiPayload(form: ChatAppFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    description: form.description,
    language: form.language,
    icon: form.icon,
    dataset_ids: form.dataset_ids,
    llm_id: form.llm_id || undefined,
    llm_setting: form.llm_setting,
    prompt_config: {
      ...form.prompt_config,
      reference_metadata: form.prompt_config.reference_metadata?.include
        ? form.prompt_config.reference_metadata
        : { include: false, fields: undefined },
    },
    top_n: form.top_n,
    top_k: form.top_k,
    similarity_threshold: form.similarity_threshold,
    vector_similarity_weight: form.vector_similarity_weight,
    rerank_id: form.rerank_id,
    meta_data_filter: form.meta_data_filter,
  };
  return payload;
}

export function validateChatAppForm(form: ChatAppFormState): string | null {
  if (!form.name.trim()) {
    return "请填写应用名称。";
  }
  if (form.dataset_ids.length > 0 && !form.prompt_config.system.includes("{knowledge}")) {
    return "已绑定知识库时，System Prompt 建议包含 {knowledge} 占位符。";
  }
  return null;
}
```

- [ ] **Step 3: 验证类型检查**

Run:
```bash
cd web-tbox && npm run typecheck
```
Expected: PASS（新建文件尚未被 import 时也应无 error；若有 isolatedModules 警告可忽略）

- [ ] **Step 4: Commit**

```bash
git add web-tbox/src/types/chatApp.ts web-tbox/src/utils/chatAppDefaults.ts
git commit -m "feat(web-tbox): add chat app types and default form helpers"
```

---

### Task 2: 扩展 chats API

**Files:**
- Modify: `web-tbox/src/api/chats.ts`

- [ ] **Step 1: 在 `chats.ts` 末尾追加类型与函数**

```typescript
export type GetChatJson = {
  code: number;
  message?: string;
  data?: Record<string, unknown>;
};

export type MutateChatJson = {
  code: number;
  message?: string;
  data?: Record<string, unknown>;
};

export async function getChat(chatId: string): Promise<{ res: Response; body: GetChatJson }> {
  const res = await fetch(`/api/v1/chats/${encodeURIComponent(chatId)}`, {
    headers: authHeadersGet(),
  });
  const body = await readJsonBody<GetChatJson>(res);
  return { res, body };
}

export async function createChat(
  payload: Record<string, unknown>,
): Promise<{ res: Response; body: MutateChatJson }> {
  const res = await fetch("/api/v1/chats", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await readJsonBody<MutateChatJson>(res);
  return { res, body };
}

export async function updateChat(
  chatId: string,
  payload: Record<string, unknown>,
): Promise<{ res: Response; body: MutateChatJson }> {
  const res = await fetch(`/api/v1/chats/${encodeURIComponent(chatId)}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await readJsonBody<MutateChatJson>(res);
  return { res, body };
}

export async function deleteChat(chatId: string): Promise<{ res: Response; body: MutateChatJson }> {
  const res = await fetch(`/api/v1/chats/${encodeURIComponent(chatId)}`, {
    method: "DELETE",
    headers: authHeadersGet(),
  });
  const body = await readJsonBody<MutateChatJson>(res);
  return { res, body };
}
```

- [ ] **Step 2: 验证**

```bash
cd web-tbox && npm run typecheck
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web-tbox/src/api/chats.ts
git commit -m "feat(web-tbox): add chat app CRUD API client"
```

---

### Task 3: 路由与侧栏

**Files:**
- Modify: `web-tbox/src/App.tsx`
- Modify: `web-tbox/src/layouts/MainLayout.tsx`
- Modify: `web-tbox/src/hooks/useRouteDocumentTitle.ts`

- [ ] **Step 1: `App.tsx` — import 页面并注册路由**

在 import 区增加：
```typescript
import { ChatAppsPage } from "./pages/ChatAppsPage";
import { ChatAppEditPage } from "./pages/ChatAppEditPage";
```

在 `<Route element={<MainLayout />}>` 内、`/kb` 路由附近增加：

```tsx
<Route
  path="apps"
  element={
    <RequirePermission permission="kb.configure">
      <ChatAppsPage />
    </RequirePermission>
  }
/>
<Route
  path="apps/new"
  element={
    <RequirePermission permission="kb.configure">
      <ChatAppEditPage />
    </RequirePermission>
  }
/>
<Route
  path="apps/:id"
  element={
    <RequirePermission permission="kb.configure">
      <ChatAppEditPage />
    </RequirePermission>
  }
/>
```

- [ ] **Step 2: `MainLayout.tsx` — NAV_ITEMS 插入**

在 `{ to: "/kb", ... }` 之后、`{ to: "/", ... }` 之前：

```typescript
{ to: "/apps", label: "对话应用", perm: "kb.configure" },
```

- [ ] **Step 3: `useRouteDocumentTitle.ts` — 标题映射**

在 `exact` 对象中增加：
```typescript
"/apps": "对话应用",
```

在 `exact` 检查之后、`return "页面不存在"` 之前增加：

```typescript
if (pathname === "/apps/new") {
  return "新建对话应用";
}
if (pathname.startsWith("/apps/")) {
  return "编辑对话应用";
}
```

- [ ] **Step 4: 创建占位页（使 typecheck 通过）**

`ChatAppsPage.tsx` 与 `ChatAppEditPage.tsx` 先导出最小组件：

```typescript
// ChatAppsPage.tsx
export function ChatAppsPage() {
  return <h1>对话应用</h1>;
}
```

```typescript
// ChatAppEditPage.tsx
export function ChatAppEditPage() {
  return <h1>编辑对话应用</h1>;
}
```

- [ ] **Step 5: 验证**

```bash
cd web-tbox && npm run typecheck && npm run build
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web-tbox/src/App.tsx web-tbox/src/layouts/MainLayout.tsx web-tbox/src/hooks/useRouteDocumentTitle.ts web-tbox/src/pages/ChatAppsPage.tsx web-tbox/src/pages/ChatAppEditPage.tsx
git commit -m "feat(web-tbox): wire /apps routes and sidebar nav"
```

---

### Task 4: 对话应用列表页

**Files:**
- Modify: `web-tbox/src/pages/ChatAppsPage.tsx`

- [ ] **Step 1: 实现列表页**

要点：
- `useEffect` 调 `listChats({ page_size: 80 })`
- 表格列：名称、绑定库数（`dataset_ids?.length` 或 `kb_names`）、`llm_id`、更新时间
- 顶栏：「新建对话应用」→ `Link to="/apps/new"`
- 行操作：「编辑」→ `/apps/:id`；「删除」→ `window.confirm` 后 `deleteChat`
- 错误：`ApiErrorBanner` + 重试
- 空列表：提示 + 新建按钮

参考 `DocumentsPage` 的 loading/error 模式。

- [ ] **Step 2: 浏览器手测**

1. 以 `kb.configure` 账号登录
2. 侧栏可见「对话应用」
3. `/apps` 列表可加载（可为空）
4. 无 `kb.configure` 账号访问 `/apps` → 跳转 `/no-permission`

- [ ] **Step 3: 验证构建**

```bash
cd web-tbox && npm run typecheck && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add web-tbox/src/pages/ChatAppsPage.tsx
git commit -m "feat(web-tbox): add chat apps list page with delete"
```

---

### Task 5: 表单分区组件（基本 / 模型 / Prompt / 检索）

**Files:**
- Create: `web-tbox/src/components/chatApp/ChatAppBasicSection.tsx`
- Create: `web-tbox/src/components/chatApp/ChatAppModelSection.tsx`
- Create: `web-tbox/src/components/chatApp/ChatAppPromptSection.tsx`
- Create: `web-tbox/src/components/chatApp/ChatAppRetrievalSection.tsx`

- [ ] **Step 1: `ChatAppBasicSection`**

Props: `{ form: ChatAppFormState; setForm: (updater) => void; datasets: DatasetRow[] }`

字段：
- `name`（input，required）
- `description`（textarea）
- `language`（select: Chinese / English）
- `dataset_ids`（`<select multiple>` 或 checkbox 列表，数据来自 `listDatasets`）

- [ ] **Step 2: `ChatAppModelSection`**

复用 `ModelIdSelect` 绑定 `llm_id`。

`llm_setting` 五个 number input：`temperature`、`top_p`、`max_tokens`、`frequency_penalty`、`presence_penalty`（step=0.1 或 1）。

- [ ] **Step 3: `ChatAppPromptSection`**

- `prompt_config.system` textarea rows=8
- `prologue`、`empty_response` textarea
- PR-1 阶段 `parameters` 可先只读展示默认 `[{knowledge}]`；PR-2 再 editable

- [ ] **Step 4: `ChatAppRetrievalSection`**

- `top_n`、`top_k` number input
- `similarity_threshold`、`vector_similarity_weight` range input 0–1 step 0.05
- `rerank_id`：PR-1 用 text input；PR-2 可换 `ModelIdSelect` rerank 预设

- [ ] **Step 5: typecheck**

```bash
cd web-tbox && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add web-tbox/src/components/chatApp/
git commit -m "feat(web-tbox): add chat app form section components (core)"
```

---

### Task 6: 编辑页容器（创建 + 保存）

**Files:**
- Modify: `web-tbox/src/pages/ChatAppEditPage.tsx`

- [ ] **Step 1: 实现 `ChatAppEditPage`**

逻辑：
```typescript
const { id } = useParams();
const isNew = !id || id === "new" || location.pathname.endsWith("/new");
const [form, setForm] = useState(createEmptyChatAppForm);
```

- `isNew`：仅加载 `listDatasets`
- 编辑：`getChat(id)` → `chatDetailToForm(body.data)`
- 渲染四个 Section + 底部「保存」
- 保存：
  ```typescript
  const warn = validateChatAppForm(form);
  if (warn && !window.confirm(`${warn}\n仍要保存吗？`)) return;
  const payload = toChatApiPayload(form);
  if (isNew) {
    const { body } = await createChat(payload);
    if (body.code === 0 && body.data?.id) navigate(`/apps/${body.data.id}`, { replace: true });
  } else {
    await updateChat(id!, payload);
  }
  ```
- 顶栏：返回列表 `Link to="/apps"`

- [ ] **Step 2: 手测创建流程**

1. `/apps/new` 填名称、选知识库、选模型 → 保存
2. 跳转到 `/apps/:id`
3. `/` 刷新应用 → 下拉可见新应用

- [ ] **Step 3: build**

```bash
cd web-tbox && npm run typecheck && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add web-tbox/src/pages/ChatAppEditPage.tsx
git commit -m "feat(web-tbox): add chat app create/edit page with save"
```

---

### Task 7: 对话页空态（TBOX 文案 + 权限引导）

**Files:**
- Modify: `web-tbox/src/pages/ChatPage.tsx`

- [ ] **Step 1: 引入 `useAuth` + `hasPermission`**

替换 `showAppsEmpty` 区块文案：

- 有 `kb.configure`：
  ```tsx
  当前账号下<strong>暂无对话应用</strong>。请前往{" "}
  <Link to="/apps/new">对话应用</Link> 创建，或点「刷新应用」。
  ```
- 无 `kb.configure`：
  ```tsx
  当前<strong>暂无可用对话应用</strong>。请联系管理员配置后再使用；在此之前仍可使用「仅模型」对话。
  ```

- [ ] **Step 2: 有 `kb.configure` 时在工具栏加链接**

「管理应用」→ `Link to="/apps"`

- [ ] **Step 3: 验证 + Commit**

```bash
cd web-tbox && npm run typecheck && npm run build
git add web-tbox/src/pages/ChatPage.tsx
git commit -m "feat(web-tbox): improve chat page empty state and app links"
```

---

## PR-2：开关 + 动态变量 + rerank + metadata keys

### Task 8: dataset metadata API

**Files:**
- Create: `web-tbox/src/api/datasetMetadata.ts`

- [ ] **Step 1: 实现 flattened metadata**

```typescript
import { getAuthorizationHeader } from "../auth/session";
import { readJsonBody } from "./readJsonBody";

export type FlattenedMetadataJson = {
  code: number;
  message?: string;
  data?: Record<string, unknown>;
};

export async function fetchFlattenedMetadata(
  datasetIds: string[],
): Promise<{ res: Response; body: FlattenedMetadataJson }> {
  const q = new URLSearchParams();
  for (const id of datasetIds) {
    q.append("dataset_ids", id);
  }
  const auth = getAuthorizationHeader();
  const res = await fetch(`/api/v1/datasets/metadata/flattened?${q.toString()}`, {
    headers: auth ? { Authorization: auth } : {},
  });
  const body = await readJsonBody<FlattenedMetadataJson>(res);
  return { res, body };
}

/** 从 flattened 响应提取 metadata key 列表（供 multi-select） */
export function metadataKeysFromFlattened(data: Record<string, unknown> | undefined): string[] {
  if (!data) return [];
  return Object.keys(data).sort();
}
```

- [ ] **Step 2: Commit**

```bash
git add web-tbox/src/api/datasetMetadata.ts
git commit -m "feat(web-tbox): add dataset metadata flattened API client"
```

---

### Task 9: 开关分区 + Prompt 动态变量

**Files:**
- Create: `web-tbox/src/components/chatApp/ChatAppSwitchesSection.tsx`
- Modify: `web-tbox/src/components/chatApp/ChatAppPromptSection.tsx`
- Modify: `web-tbox/src/pages/ChatAppEditPage.tsx`

- [ ] **Step 1: `ChatAppSwitchesSection`**

七个 `<label><input type="checkbox">` 绑定：
`quote`、`keyword`、`tts`、`refine_multiturn`、`use_kg`、`reasoning`、`toc_enhance`

- [ ] **Step 2: `ChatAppPromptSection` — parameters 编辑器**

- 列表展示 `parameters`；「添加变量」push `{ key: "", optional: false }`
- 每行：key input + optional checkbox + 删除按钮
- 保存时过滤空 key

- [ ] **Step 3: `ChatAppRetrievalSection` — rerank_id**

用 `ModelIdSelect` 或 text + 说明「留空表示不使用 rerank」

- [ ] **Step 4: EditPage 挂载 SwitchesSection**

- [ ] **Step 5: 验证 + Commit**

```bash
cd web-tbox && npm run typecheck && npm run build
git add web-tbox/src/components/chatApp/ web-tbox/src/pages/ChatAppEditPage.tsx
git commit -m "feat(web-tbox): chat app switches, parameters, rerank field"
```

---

## PR-3：高级配置 + 品牌清理 + 文档

### Task 10: 高级配置分区

**Files:**
- Create: `web-tbox/src/components/chatApp/ChatAppAdvancedSection.tsx`
- Modify: `web-tbox/src/pages/ChatAppEditPage.tsx`

- [ ] **Step 1: `ChatAppAdvancedSection`**

Props 增加 `metadataKeys: string[]`（EditPage 在 `dataset_ids` 变化时调 `fetchFlattenedMetadata`）。

字段：
1. `prompt_config.tavily_api_key` — password input
2. `prompt_config.cross_languages` — 逗号分隔 text，parse 为 string[]
3. `reference_metadata.include` checkbox；true 时 fields 多选（checkbox group from `metadataKeys`）
4. `meta_data_filter.method` select：`disabled` | `manual` | `semi_auto` | `auto`
5. `method === manual`：可增删 manual 行（key select from metadataKeys、op select、`value` text）
6. `method === semi_auto`：semi_auto 字符串列表（每行一个 key）

`auto` 模式仅展示说明「由检索自动过滤」，不展示 manual UI。

- [ ] **Step 2: EditPage 联动**

```typescript
useEffect(() => {
  if (!form.dataset_ids.length) { setMetadataKeys([]); return; }
  void fetchFlattenedMetadata(form.dataset_ids).then(({ body }) => {
    if (body.code === 0) setMetadataKeys(metadataKeysFromFlattened(body.data));
  });
}, [form.dataset_ids]);
```

- [ ] **Step 3: 验证 + Commit**

```bash
cd web-tbox && npm run typecheck && npm run build
git add web-tbox/src/components/chatApp/ChatAppAdvancedSection.tsx web-tbox/src/pages/ChatAppEditPage.tsx
git commit -m "feat(web-tbox): chat app advanced settings (tavily, metadata filter)"
```

---

### Task 11: 全站品牌清理（用户可见文案）

**Files:**
- Modify: `web-tbox/src/pages/SearchPage.tsx`
- Modify: `web-tbox/src/pages/LoginPage.tsx`
- Modify: `web-tbox/src/pages/DocumentsPage.tsx`
- Modify: `web-tbox/src/pages/KbConfigPage.tsx`
- Modify: `web-tbox/src/pages/UsersPage.tsx`

- [ ] **Step 1: 逐文件替换（用户可见字符串）**

| 文件 | 查找 | 替换为 |
|------|------|--------|
| `SearchPage.tsx` | `RAGFlow` / 官方 | 「文档 / 知识库」 |
| `LoginPage.tsx` | `与 RAGFlow 相同的账号` | `使用您的 TBOX 账号` |
| `LoginPage.tsx` | `与官方` | 删除或改为「与本系统」 |
| `DocumentsPage.tsx` | `官方 RAGFlow` / `官方 web` | 「本系统」或删除外链指引 |
| `KbConfigPage.tsx` | `官方 web/` | 「模型与 API Key 配置」 |
| `UsersPage.tsx` | `RAGFlow 租户内四档角色` | `空间内四档角色` |
| `UsersPage.tsx` | 表头 `RAGFlow 角色` | `空间角色` |

保留：代码注释、env 变量名、API path 文档中的 `/api/v1/...`。

- [ ] **Step 2: 全库 grep 确认**

```bash
rg -n "RAGFlow|官方界面|官方 web|官方 \`web" web-tbox/src --glob '*.tsx'
```
Expected: 仅剩注释或开发者向说明（若有用户可见命中则继续改）

- [ ] **Step 3: Commit**

```bash
git add web-tbox/src/pages/
git commit -m "chore(web-tbox): remove RAGFlow branding from user-facing copy"
```

---

### Task 12: 验收步骤与文档

**Files:**
- Modify: `web-tbox/src/review/journeySteps.ts`
- Modify: `web-tbox/README.md`
- Modify: `docs/TBOX_QUICKSTART.md`
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`
- Modify: `docs/TBOX_UI_DESIGN_DETAIL.md`
- Modify: `docs/TBOX_DEPLOY_RUNBOOK.md`

- [ ] **Step 1: `journeySteps.ts` 新增一步**

```typescript
{
  id: "chat-apps",
  title: "对话应用",
  targetPath: "/apps",
  summary: "kb.configure 下创建/编辑对话应用，绑定知识库与 Prompt。",
  checklist: [
    "侧栏可见「对话应用」（需 kb.configure）",
    "可新建应用并绑定知识库",
    "保存后在对话页可选该应用",
    "发送消息后引用侧栏有 chunks（库内已有内容）",
    "用户可见文案无 RAGFlow",
  ],
},
```

并在 `pathToJourneyStep.ts` 增加 `/apps` `/apps/new` `/apps/:id` 映射到 `chat-apps`。

- [ ] **Step 2: 更新 README 与 TBOX 文档**

各文档增加 `/apps` 路由、`kb.configure` 权限、闭环动线一句。

- [ ] **Step 3: 最终验证**

```bash
cd web-tbox && npm run typecheck && npm run build
```

手测 spec §9 全部 5 条验收标准。

- [ ] **Step 4: Commit**

```bash
git add web-tbox/src/review/ web-tbox/README.md docs/TBOX_*.md
git commit -m "docs: chat apps module acceptance and product docs"
```

---

## Spec Coverage Checklist

| Spec 要求 | Plan Task |
|-----------|-----------|
| `/apps` 路由 + 侧栏 | Task 3 |
| `kb.configure` 门禁 | Task 3 |
| CRUD API | Task 2 |
| C 全量字段 | Task 5–6, 9–10 |
| ChatPage 空态 | Task 7 |
| 品牌 A | Task 11 |
| 验收 / 文档 | Task 12 |
| 分 3 PR | PR-1/2/3 分段 |
| 不引入新 UI 库 | 全计划 |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-21-tbox-chat-apps.md`.

**Two execution options:**

1. **Subagent-Driven（推荐）** — 每个 Task 派生子 agent，Task 间人工/自动 review，迭代快
2. **Inline Execution** — 本会话按 Task 顺序直接改代码，PR-1 完成后暂停给你看 diff

**Which approach?**
