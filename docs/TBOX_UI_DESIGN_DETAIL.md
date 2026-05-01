# TBOX 知识库 UI 详细设计

本文档为 **UI 详细设计**：在 **`TBOX_UI_DESIGN_OVERVIEW.md`** 概要之下，给出路由—权限—页面结构—关键交互—响应式与实现映射。参考代码路径均以 **`tbox-ragflow-platform/others/apps/web/`**（下称 **参考 Web**）为准。

---

## 1. 全局布局（参考 `layouts/MainLayout.vue`）

### 1.1 结构

| 区域 | 规格 | 行为 |
|------|------|------|
| **侧栏** | 宽度 **220px**（桌面）；背景 **#fff**；右边框 **#e2e8f0** | 顶部 **品牌区**：产品名「TBOX」+ 小标签 **「TBOX 知识库（单库）」**；其下 **`el-menu` router 模式**。 |
| **顶栏** | 高度随 Element 默认（约 60px）；底边框 **#e2e8f0** | 右侧：**当前用户展示名** + **退出**（link 样式按钮）。 |
| **主内容** | 背景 **`var(--bg-page)` → #f8fafc**；内边距 **20px** | **`router-view`**。 |

### 1.2 设计令牌（参考 `styles/global.css`）

| 变量 | 值 | 用途 |
|------|-----|------|
| `--color-primary` | `#2563eb` | 主按钮、品牌主色、链接强调。 |
| `--color-accent` | `#0d9488` | 辅助高亮、成功/安全态点缀。 |
| `--bg-page` | `#f8fafc` | 主内容区背景。 |
| `--text-primary` | `#0f172a` | 主文案。 |
| `--text-secondary` | `#475569` | 次要说明（`.muted` 类）。 |

**字体栈**（参考）：`system-ui, -apple-system, Segoe UI, Roboto, …, PingFang SC, Microsoft YaHei, sans-serif`。

### 1.3 响应式（详细规则）

| 断点（建议） | 布局调整 |
|--------------|----------|
| **≥1024px** | 完整侧栏 + 顶栏 + 主区。 |
| **768px–1023px** | 侧栏可改为 **抽屉（overlay）** 或 **可折叠图标栏**；主内容全宽。 |
| **&lt;768px** | 默认 **抽屉导航**；顶栏保留用户与退出；表格支持 **横向滚动**；主要操作按钮 **全宽或 sticky 底栏**（二选一，实现阶段定稿）。 |

> 参考 Web 当前以桌面为主；**主 fork `web-tbox` 实现时必须显式完成上表行为**。

---

## 2. 路由、菜单与权限（参考 `router/index.ts` + `stores/auth.ts`）

### 2.1 路由表

| `name` | `path` | `meta.title` | `meta.permission` | `public` |
|--------|--------|--------------|-------------------|----------|
| `login` | `/login` | 登录 | — | ✅ |
| `chat` | `/` | 对话 | `chat.use` | — |
| `search` | `/search` | 检索 | `search.use` | — |
| `documents` | `/documents` | 文档 | `doc.view` | — |
| `crawl` | `/crawl` | 采集 | `crawl.manage` | — |
| `kb` | `/kb` | 知识库配置 | `kb.configure` | — |
| `audit` | `/audit` | 审计 | `audit.read` | — |
| `users` | `/users` | 用户与角色 | `user.manage` | — |
| `no-permission` | `/no-permission` | 无权限 | — | ✅ |
| `not-found` | `/*` | 未找到 | — | — |

**全局前置守卫逻辑**（须在主 fork复刻语义）：

1. 设置 `document.title` 为 ``${meta.title} · TBOX 知识库``。
2. `meta.public` → 放行。
3. 未登录 → `redirect` 至 `login`，并带 `redirect` query。
4. 有 `meta.permission` 且不在用户 `permissions[]` → `no-permission`。

### 2.2 权限词汇表（参考 `demoPermissionsByRole`）

下列字符串为 **权限键 canonical 名称**；后端 / BFF 下发时应 **同名或提供映射表**。

| 权限键 | 含义（产品） |
|--------|----------------|
| `chat.use` | 使用对话 |
| `search.use` | 使用检索 |
| `doc.view` | 查看文档列表与详情 |
| `doc.upload` | 上传文档 |
| `doc.delete` | 删除文档 |
| `doc.reparse` | 触发重新解析 |
| `doc.version.manage` | 版本管理（回滚/对比入口） |
| `kb.configure` | 知识库配置（非破坏性） |
| `kb.dangerous` | 危险配置（如清空、破坏性重建——实现时需二次确认） |
| `export.data` | 导出 PDF/Excel 等 |
| `audit.read` | 查看审计日志 |
| `stats.read` | 查看统计（非 P0 可先隐藏菜单） |
| `user.manage` | 用户与角色管理 |
| `crawl.manage` | 网络爬取 / 采集任务配置与调度（总纲 §1 第 3 条） |

**角色 → 权限** 的演示矩阵以参考 `auth.ts` 为准；生产环境以 **服务端返回** 为准，前端 **不得硬编码** 为安全源。

### 2.3 侧栏菜单过滤

与参考一致：`items.filter(i => permissions.includes(i.perm))`；图标映射：

| 模块 | 图标（Element Plus Icons） |
|------|------------------------------|
| 对话 | `ChatDotRound` |
| 检索 | `Search` |
| 文档 | `Reading` |
| 采集 | `Promotion` 或 `Connection`（实现阶段任选） |
| 知识库配置 | `Setting` |
| 审计 | `Monitor` |
| 用户与角色 | `User` |

---

## 3. 页面级设计

### 3.1 登录页（`views/LoginView.vue`）

| 项 | 要求 |
|----|------|
| 参考现状 | 开发用 **用户名 + 角色** 模拟登录。 |
| 生产对齐 | 与 RAGFlow **`POST /api/v1/auth/login`** + `Authorization` 头方案一致（主 fork 已在 `web-tbox` 实现 RSA 登录）。 |
| 状态 | 错误提示、加载中禁用提交；支持登录后跳回 `redirect`。 |

### 3.2 对话页（`views/ChatView.vue`）

| 项 | 要求 |
|----|------|
| 布局 | 标题 + 简短说明；**多行输入** + **发送**；**卡片**展示流式输出。 |
| 流式 | 使用 **`fetch` 解析 SSE**（`lib/sseChat.ts`），非 `EventSource`。 |
| P0 增强 | **`onCitation` 回调**：侧栏或折叠面板展示引用片段与高亮（当前 TODO，主 fork 排期实现）。 |
| 会话 | 参考使用 `devSessionId` 占位；生产对接 **session / chat id** API。 |

### 3.3 检索页（`views/SearchView.vue`）

| 项 | 要求 |
|----|------|
| 能力 | 关键词 / 语义切换（若后端支持）；结果列表：**标题、片段、得分、跳转文档**。 |
| 空态 | 无结果提示与清空条件。 |

### 3.4 文档页（`views/DocumentsView.vue`）

参考当前为占位；**详细交付**需包含：

| 功能 | UI 元素 | 权限 |
|------|---------|------|
| 列表 | 表格：名称、大小、状态（解析中/成功/失败）、更新时间 | `doc.view` |
| 上传 | 拖拽区 + 文件选择；进度条 | `doc.upload` |
| 删除 | 行内删除 + `ElMessageBox.confirm` | `doc.delete` |
| 重解析 | 行内操作 | `doc.reparse` |
| 版本 | 时间线或侧抽屉 | `doc.version.manage` |
| 导出 | 行级或批量导出 **PDF/Excel** | `export.data` |

### 3.5 知识库配置（`views/KbConfigView.vue`）

| 项 | 要求 |
|----|------|
| 单库 | 表单分区：嵌入模型、分块策略、解析器相关（与 RAGFlow 配置项对齐，字段随 API 文档迭代）。 |
| 危险操作 | 单独区块，仅 `kb.dangerous` 可见；**二次确认 + 输入确认词**。 |

### 3.6 审计页（`views/AuditView.vue`）

| 项 | 要求 |
|----|------|
| 列表 | 时间、操作者、动作、对象、结果、IP/UA（若后端提供）。 |
| 筛选 | 时间范围、动作类型、用户。 |

**`web-tbox` 当前实现**：在 **`audit.read`** 下对接官方 **`GET /api/v1/datasets/<id>/ingestions`**（`log_type=dataset|file`），展示流水线/入库类日志（文档名、任务类型、状态、进度说明、开始时间）。与上表「通用审计」可并存，后续可再接 TBOX 专用审计 API。

### 3.7 用户与角色（`views/UsersView.vue`）

| 项 | 要求 |
|----|------|
| 列表 | 用户、角色、状态、最近登录。 |
| 编辑 | 角色多选 → 映射权限集合；与总纲 **用户↔租户/角色一一对应** 的后端模型对齐后再接保存接口。 |

### 3.8 无权限 / 404

- **`NoPermissionView`**：说明当前账号缺少的权限，提供返回首页或联系管理员。
- **`NotFoundView`**：友好 404。

---

## 4. 知识爬取管理（总纲 §1.3）— UI 挂载

**主 fork 已采用方案 A**：侧栏一级 **「采集」**，路径 **`/crawl`**，权限 **`crawl.manage`**（由 `GET /v1/tbox/me` 的 `permissions` 下发；契约版本 **≥4**）。

备选 **方案 B**（`/documents/crawl`）未启用；若未来合并导航可再评估。

页面内需包含：**数据源类型**（静态/RSS/登录站/API）、**robots 遵守开关（默认开）**、**调度（默认定时 + 手动触发）**、**凭据环境变量提示**（不落库）。**后端**：`GET/POST /v1/tbox/crawl/tasks`、`GET/PATCH/DELETE /v1/tbox/crawl/tasks/<id>`、`POST .../tasks/<id>/run` 与 worker tick（探测、robots、按类型入库）见 `docs/TBOX_API_BOUNDARY.md` §1.2–1.3。**`web-tbox`**：`CrawlPage` 已对接列表/新建/编辑/删除、租户筛选、**`extra_config` 勾选**（`tbox_skip_*`、`worker_stub_fail`）、**`extra_config` JSON 高级编辑**（默认展示**已剥离**四键的其余键；可选 **「JSON 含勾选四键」** 展开为完整对象；完整模式下**勾选变更**会按当前文本重新合并四键；**保存**时先解析 JSON 再与勾选合并，**勾选优先**）、列表列「extra 选项」摘要、**执行一次**；登录站/API 源类型与凭据 UI 仍可按总纲迭代。

---

## 5. 与 RAGFlow / TBOX API 的对应关系

| UI 模块 | 优先调用的 API 类型 |
|---------|---------------------|
| 登录 | `POST /api/v1/auth/login`（与官方一致） |
| 对话 / 检索 | RAGFlow 既有 **REST** 或后续 BFF 聚合 |
| 文档 / 知识库 | `GET/DELETE /api/v1/datasets` 及文档子资源（见官方 OpenAPI / `web/src/utils/api.ts`） |
| 审计（入库/流水线） | `GET /api/v1/datasets/<id>/ingestions`（`log_type=dataset|file`） |
| TBOX 扩展 | `GET /v1/tbox/me`、**`/v1/tbox/crawl/tasks`**（含 **`POST .../tasks/<id>/run`** 与 worker 同源 tick）等 **`/v1/tbox/*`**（见 `docs/TBOX_API_BOUNDARY.md`） |

---

## 6. 主 fork `web-tbox` 实现映射（React）

| 参考（Vue + Element Plus） | `web-tbox` 建议 |
|----------------------------|-----------------|
| `el-container` / `el-aside` / `el-header` | 布局用 **CSS Grid/Flex** 或引入 **Ant Design Layout** |
| `el-menu` | `Menu` 组件 + `react-router` `NavLink` active 样式 |
| `el-button` / `el-input` / `el-card` | Ant Design 或 Radix + 自有样式 |
| Pinia `auth` | `Context` + `useReducer` / Zustand（与总纲技术中立，选型后写入 `web-tbox/README.md`） |

**路由表**：须与 §2.1 **路径与 permission 键名**一致（路径可微调但需批量改文档）。

---

## 7. 验收检查清单（UI 阶段）

- [ ] 未登录访问受保护路由 → 跳转登录并带回跳地址。
- [ ] 无权限 → 无权限页，不暴露侧栏敏感菜单。
- [ ] 侧栏仅展示 `permissions` 内模块。
- [ ] 主色/背景/次要文字色与 §1.2 令牌一致（允许 ±5% 色差）。
- [ ] 对话页流式失败有明确错误提示。
- [ ] 文档删除 / 危险配置具备 **二次确认**。
- [ ] 768px 以下导航可用手势打开（抽屉）且主内容可阅读。

---

## 8. 修订记录

| 日期 | 变更 |
|------|------|
| 2026-05-01 | 初版：从参考 Web 抽取布局、路由、权限、页面与响应式规则；补充爬取挂载与 `web-tbox` 映射表 |
| 2026-05-01 | 路由 **`/crawl`**、权限 **`crawl.manage`**；§4 采用方案 A；§5 补充 ingestions；§3.6 与 `web-tbox` 审计实现说明 |
| 2026-05-01 | §4/§5：采集任务 **`/v1/tbox/crawl/tasks`** CRUD 与边界文档 §1.2 对齐 |
| 2026-05-01 | **`web-tbox` `CrawlPage`**：对接 **`src/api/crawlTasks.ts`**（列表/新建/编辑/删） |
| 2026-05-01 | 采集表 **「执行一次」** → **`POST /v1/tbox/crawl/tasks/<id>/run`**；§5 TBOX 扩展行 |
| 2026-05-01 | §4：`CrawlPage` **`extra_config` 勾选**（`tbox_skip_*`、`worker_stub_fail`）、列表「extra 选项」；与 §1.3 tick 行为对齐 |
| 2026-05-01 | §4：`CrawlPage` **`extra_config` JSON 高级编辑**（PATCH 保留非表单键；与勾选合并、勾选优先） |
| 2026-05-01 | §4：`CrawlPage` **完整 `extra_config` JSON 开关**（可选含四键；勾选变更时重合并；保存仍勾选优先） |
