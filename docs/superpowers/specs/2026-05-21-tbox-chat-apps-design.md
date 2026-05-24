# TBOX 对话应用（Chat Apps）完整配置 — 设计规格

**日期**：2026-05-21
**状态**：已评审（brainstorming §1–§5 用户确认）
**范围**：`web-tbox` 独立前端 + 既有 RAGFlow fork 后端 REST（不部署官方 `web/`）

---

## 1. 背景与目标

### 1.1 问题

当前 `web-tbox` 对话页仅 **消费** 对话应用（`GET /api/v1/chats`），创建与完整配置依赖 RAGFlow 官方 `web/` 或手工调 API。空态提示用户去「RAGFlow 官方界面」创建，与产品定位冲突。

### 1.2 产品目标

终端用户只使用 **TBOX 自有品牌** 控制台，在 `web-tbox` 内完成完整 RAG 闭环：

```
建知识库 → 上传解析 → 创建/配置对话应用 → 选择应用对话（含引用）
```

### 1.3 非目标

- 不重写或替换 RAGFlow 后端引擎。
- 不 fork / 嵌入官方 `web/` 组件库（Ant Design、shadcn、react-hook-form）。
- 不做 Agent 画布、多 Chat 并排壳（官方 `next-chats` 聊天 UI）。
- 不在控制台 UI 展示 RAGFlow 名称或引导打开官方界面。

### 1.4 引擎与商用合规

- **引擎**：继续依赖本仓库 RAGFlow fork（Apache License 2.0）。
- **商标**：对外以 TBOX 品牌呈现；不使用 RAGFlow / InfiniFlow 商标暗示官方产品。
- **Attribution**：`LICENSE` / 可选 `NOTICE` 保留在**分发包**内，不进终端用户界面。

---

## 2. 权限模型

沿用 TBOX 既有权限键，**不新增** `chat.configure`。

| 权限 | 能力 |
|------|------|
| `kb.configure` | 访问 `/apps`、`/apps/new`、`/apps/:id`；创建、编辑、删除对话应用 |
| `chat.use` | 访问 `/`；选择已有应用对话、「仅模型」模式 |
| 无 `kb.configure` | 不可见「对话应用」菜单；不可直接访问 `/apps*`（`RequirePermission` 拦截） |

**删除应用**：需 `kb.configure` + 浏览器二次确认（与删文档同级；**不**要求 `kb.dangerous`）。

后端 Chat CRUD 仍为 `login_required` + 租户归属校验；TBOX 在前端路由层用 `kb.configure` 做产品级门禁。

---

## 3. 信息架构与路由

### 3.1 侧栏

在 `MainLayout` 的 `NAV_ITEMS` 中，于「知识库配置」与「对话」之间新增：

| 路由 | 标签 | 权限 |
|------|------|------|
| `/apps` | 对话应用 | `kb.configure` |

### 3.2 路由表

| 路径 | 组件 | 权限 | 说明 |
|------|------|------|------|
| `/apps` | `ChatAppsPage` | `kb.configure` | 列表、新建入口、删除 |
| `/apps/new` | `ChatAppEditPage` | `kb.configure` | 创建（默认值） |
| `/apps/:id` | `ChatAppEditPage` | `kb.configure` | 编辑（`GET .../chats/:id`） |
| `/` | `ChatPage`（修改） | `chat.use` | 选应用 + 会话；空态与链接受权限影响 |

### 3.3 用户动线

**管理员 / 运营（`kb.configure`）**

```
文档/知识库 → 知识库配置 → 对话应用（新建/编辑）→ 对话（选择应用）
```

**普通用户（仅 `chat.use`）**

```
对话 → 选择管理员已配置的应用
```

### 3.4 空态与引导

| 页面 | 条件 | 文案方向 |
|------|------|----------|
| `/` | 无应用 + 有 `kb.configure` | 引导前往 `/apps/new` 创建 |
| `/` | 无应用 + 无 `kb.configure` | 「暂无可用对话应用，请联系管理员」 |
| `/apps` | 列表为空 | 「新建对话应用」主按钮 |

---

## 4. API 集成

### 4.1 扩展 `web-tbox/src/api/chats.ts`

| 函数 | HTTP | 说明 |
|------|------|------|
| `listChats` | `GET /api/v1/chats` | 已有 |
| `getChat(id)` | `GET /api/v1/chats/:id` | 编辑页加载 |
| `createChat(payload)` | `POST /api/v1/chats` | 创建 |
| `updateChat(id, payload)` | `PUT /api/v1/chats/:id` | 全量更新（与官方一致） |
| `deleteChat(id)` | `DELETE /api/v1/chats/:id` | 删除 |

### 4.2 关联 API（已有或需封装）

| 用途 | API |
|------|-----|
| 知识库多选 | `GET /api/v1/datasets`（`listDatasets`） |
| 模型选择 | `GET /v1/llm/list` + `ModelIdSelect` |
| Metadata 字段 | `GET /api/v1/datasets/metadata/flattened?dataset_ids=...` |
| 对话 | 既有 `ChatPage` completions / sessions |

### 4.3 Payload 字段（C 全量，对齐官方 `next-chats`）

**顶层**

- `name`（必填）
- `description`
- `language`（可选，`English` | `Chinese`；省略时由后端按环境默认）
- `icon`（可选 base64；一期可留空字符串）
- `dataset_ids`（string[]）
- `llm_id`
- `llm_setting`（temperature、top_p、max_tokens、frequency_penalty、presence_penalty 等）
- `top_n`、`top_k`
- `similarity_threshold`、`vector_similarity_weight`
- `rerank_id`
- `meta_data_filter`

**`prompt_config`**

- `system`、`prologue`、`empty_response`
- `parameters`：`{ key, optional }[]`
- `quote`、`keyword`、`tts`、`refine_multiturn`、`use_kg`、`reasoning`、`toc_enhance`
- `tavily_api_key`
- `cross_languages`（string[]）
- `reference_metadata`：`{ include?, fields? }`

### 4.4 默认值

新建应用时，`src/utils/chatAppDefaults.ts` 与后端 `_DEFAULT_PROMPT_CONFIG`（`api/apps/restful_apis/chat_api.py`）对齐：

- `system` 含 `{knowledge}` 占位符
- `parameters: [{ key: "knowledge", optional: false }]`
- `quote: true`、`refine_multiturn: true`
- `top_n: 6`（或官方创建默认）、`similarity_threshold: 0.1`、`vector_similarity_weight: 0.3`
- `llm_id`：可留空由后端填租户默认 Chat 模型

### 4.5 保存语义

- **创建**：`POST`，body 为完整可写字段集合。
- **更新**：`PUT`，提交当前表单全量状态（与官方 `updateChat` 一致）；编辑页加载后 `GET` 回填再 `PUT`。

---

## 5. 前端结构

### 5.1 新文件

| 路径 | 职责 |
|------|------|
| `src/types/chatApp.ts` | `ChatApp`、`PromptConfig`、`MetaDataFilter` 等类型 |
| `src/utils/chatAppDefaults.ts` | 创建默认值、PUT 前 payload 归一化 |
| `src/api/datasetMetadata.ts` | `metadata/flattened` 封装（若尚未存在） |
| `src/pages/ChatAppsPage.tsx` | 列表 + 删除 |
| `src/pages/ChatAppEditPage.tsx` | 创建/编辑容器、保存、分区布局 |
| `src/components/chatApp/ChatAppBasicSection.tsx` | 名称、描述、language、知识库多选 |
| `src/components/chatApp/ChatAppModelSection.tsx` | llm_id、llm_setting |
| `src/components/chatApp/ChatAppPromptSection.tsx` | system、prologue、empty_response、parameters |
| `src/components/chatApp/ChatAppRetrievalSection.tsx` | top_n、top_k、阈值、rerank |
| `src/components/chatApp/ChatAppSwitchesSection.tsx` | quote、keyword、tts 等开关 |
| `src/components/chatApp/ChatAppAdvancedSection.tsx` | Tavily、cross_languages、reference_metadata、meta_data_filter |

### 5.2 修改文件

| 路径 | 变更 |
|------|------|
| `src/App.tsx` | 注册 `/apps`、`/apps/new`、`/apps/:id` + `RequirePermission kb.configure` |
| `src/layouts/MainLayout.tsx` | 侧栏「对话应用」 |
| `src/pages/ChatPage.tsx` | 空态文案、链到 `/apps` |
| `src/hooks/useRouteDocumentTitle.ts` | 新路由标题 |
| `src/review/journeySteps.ts` | 验收步骤 |
| 多页用户可见文案 | 品牌清理（§7） |

### 5.3 UI 模式

- 沿用 `web-tbox` 现有风格：`useState`、内联样式、`ApiErrorBanner`、`ModelIdSelect`。
- **不**引入 react-hook-form / zod / UI 库。
- 长表单：分区 `<section>` + 小标题；窄屏纵向堆叠（`useNarrowLayout`）。
- 保存：页底固定「保存」；创建成功后 `navigate(/apps/:id)` 或回列表。

### 5.4 表单联动

1. `dataset_ids` 变化 → 刷新 metadata flattened keys。
2. `reference_metadata.include === true` → 展示 fields 多选（keys 来自 flattened）。
3. `meta_data_filter.method`：
   - `disabled`：不展示条件
   - `manual`：manual 条件列表 + logic
   - `semi_auto`：semi_auto 字段列表
4. `system` 未含 `{knowledge}` 且已选知识库 → 保存前警告（非阻断）。

---

## 6. 实现分期

目标为 **C 全量**；建议分 3 个 PR 降低评审风险：

| 阶段 | 交付 |
|------|------|
| **PR-1** | `chats.ts` CRUD API；`ChatAppsPage`；`ChatAppEditPage` 核心分区（基本、模型、Prompt、检索）；`App.tsx` 路由；侧栏；`ChatPage` 空态 |
| **PR-2** | 开关全量、rerank、动态 variables；metadata flattened 联动 |
| **PR-3** | Tavily、cross_languages、reference_metadata、meta_data_filter 完整编辑器；全站品牌清理；验收文档与 `journeySteps` |

每 PR 须通过 `npm run typecheck` 与 `npm run build`。

---

## 7. 品牌去 RAGFlow 化（用户可见层）

**原则**：控制台、登录页、空态、错误提示中不出现 RAGFlow、官方 `web/` 跳转指引。

| 位置 | 改为 |
|------|------|
| `ChatPage` 空态 | 「暂无对话应用。请前往 **对话应用** 创建，或联系管理员。」 |
| `SearchPage` 空态 | 「请先在 **文档 / 知识库** 中创建并入库。」 |
| `LoginPage` | 「使用您的 TBOX 账号（邮箱 + 密码）」 |
| `DocumentsPage` / `KbConfigPage` | 删除「请用官方 web」类指引，改为本系统内路径 |
| `UsersPage` | 「空间内四档角色」（非「RAGFlow 角色」） |
| 文档 title | 「TBOX 知识库」 |

**保留**：开发者 README、env 名 `VITE_RAGFLOW_API_ORIGIN`、代码注释中的技术指代。

---

## 8. 错误处理

- 401：`ApiErrorBanner` + 去登录。
- `code !== 0`：展示 `message`（如重名 `Duplicated chat name`、无效 `llm_id`）。
- 网络失败：可重试按钮。
- 删除：confirm 对话框；失败保留列表状态。

---

## 9. 验收标准

1. **`kb.configure` 用户**：侧栏见「对话应用」→ 新建 → 绑定知识库 + 配置 Prompt → 保存成功。
2. **`/` 对话页**：刷新应用列表后可选该应用 → 发送消息 → 引用侧栏出现 `reference.chunks`（库内已有解析内容）。
3. **仅 `chat.use` 用户**：不可访问 `/apps`；对话页仅可选已有应用；无应用时见管理员提示。
4. **品牌**：用户可见文案无「RAGFlow」「官方界面」。
5. **部署**：生产仅需 `web-tbox/dist` + 本 fork 后端；无需构建/托管官方 `web/`。

---

## 10. 文档同步（实现时）

- `web-tbox/README.md`：增加 `/apps` 路由说明。
- `docs/TBOX_QUICKSTART.md`、`docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`：新增对话应用动线。
- `docs/TBOX_UI_DESIGN_DETAIL.md` §3.2 / §2.1：补充「对话应用」页与权限说明（`kb.configure`）。
- `docs/TBOX_DEPLOY_RUNBOOK.md` §1.3：一期范围增加「对话应用 CRUD」。

---

## 11. 决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 实现路径 | 独立 `/apps` 模块 | 与 KbConfig 模式一致，C 级表单可维护 |
| 配置范围 | C（对齐官方 next-chats） | 用户明确要求 |
| 配置权限 | `kb.configure` | 用户选择 B |
| 删除权限 | `kb.configure` | 与配置权一致，低于删整库 |
| 品牌 | 用户界面零 RAGFlow | 商用自有品牌 A |
| 表单栈 | 原生 React state | 与 web-tbox 现有依赖一致 |

---

## 12. 后续步骤

1. 用户审阅本 spec。
2. 通过后执行 `writing-plans` → `docs/superpowers/plans/2026-05-21-tbox-chat-apps.md`。
3. 按 plan 分 PR 实现。
