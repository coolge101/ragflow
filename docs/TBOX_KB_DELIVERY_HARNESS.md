# TBOX 知识库（基于 RAGFlow）交付与 Harness 约束总纲

本文档用于：**统一范围、分期节奏、质量门禁与仓库边界**，使后续开发可对照执行、可验收。
与 **Harness Engineering** 的关系：Runtime / Delivery / Contract 三类约束中，本项目至少应满足 **Delivery / Contract**（可复现、契约稳定、文档与 CI 可追溯）；若你启用对抗测试与安全 CI，则叠加 **Runtime** 要求。

**维护规则**：任何扩大范围、更换部署形态或 API 契约的变更，须先更新本文档对应章节，再改代码。

**与初版假设的差异（对齐说明）**：初稿侧重「RAGFlow 后端 + `tbox-pipelines`/契约门闸」的运维型集成；**产品级「TBOX 知识库」**按出资方定义，核心是 **开源 RAGFlow 二次开发 + 新 UI 与爬取能力 + Docker 可移植部署**（见 §1）。`tbox-ragflow-platform` 等仓库可作为**配套流水线/契约**，但不替代 §1 的四条主线。

---

## 1. 产品线定义：「基于 RAGFlow 的 TBOX 知识库」（已与你对齐）

下列四条为**当前共识下的产品范围**；后续验收与分期以本节为准。

| # | 能力 | 说明 |
|---|------|------|
| **1** | **以开源 RAGFlow 为基座的二次开发** | 在官方 RAGFlow 能力之上扩展与定制，保持与上游的升级/合并策略可执行（见 §5 分支策略）。 |
| **2** | **新 UI：兼容原有能力 + TBOX 扩展** | 在兼容 RAGFlow 既有功能的前提下，增加：**用户管理**、**知识库管理**（导入、导出、删除等）、**知识爬取管理**等界面与流程。 |
| **3** | **网络知识爬取** | 系统具备从网络获取与更新相关知识的能力（采集、调度、入库或与 KB 流水线衔接；数据源类型、robots、调度等见 **§7**）。 |
| **4** | **Docker 可部署到其他服务器** | 交付形态支持在**其他机器**上以 **Docker**（或 Compose 编排）部署，文档与镜像/配置需支持可复现安装（见 §3 交付 Harness）。 |

**细化约束**已写入 **§7**（原 §6 问卷已答复）。

---

## 2. 仓库与边界（必须遵守）

| 区域 | 路径 / 远程 | 职责 | 约束 |
|------|-------------|------|------|
| **TBOX 产品主仓（预期）** | 本仓库：开源 RAGFlow 的 **fork** | **后端 API**（含 **`/v1/tbox/*`** 扩展，见 `api/apps/tbox_app.py`）、Agent、解析、**独立前端 `web-tbox/`**、官方 `web/`、爬取与 Docker 编排 | 二次开发尽量**模块化**；契约见 `docs/TBOX_API_BOUNDARY.md`；环境与端口见 `docs/TBOX_ENV_AND_VERSIONS.md`。 |
| **可选：流水线与契约仓** | `tbox-ragflow-platform` 等 | `tbox-pipelines`、webhook、文档门闸、运维同步 | **非 §1 四条之替代**；若采用，须写明与本产品 KB/爬取数据流如何衔接（子模块 / 版本 / 仅文档引用）。 |
| Harness 组件 | 本仓 `common/harness_monitor.py`、`test/adversarial_tests.py`、`.github/workflows/harness_engineering.yml` 等（若存在） | 安全与可观测边界 | **§7**：`harness_engineering` 使用 **`ubuntu-latest`**；**不在 PR 上触发**；对抗测试为发布前验证，见 §7。 |

### 2.1 UI 设计与参考实现（文档入口）

| 文档 | 用途 |
|------|------|
| **`docs/TBOX_UI_DESIGN_OVERVIEW.md`** | UI **概要设计**：目标、IA 原则、与 `web-tbox/` 及参考原型的关系。 |
| **`docs/TBOX_UI_DESIGN_DETAIL.md`** | UI **详细设计**：路由、权限键、逐页规格、响应式、与 API 衔接及 **`web-tbox` 实现映射**。 |

**参考原型路径**（平台仓内，**非**主产品强制技术栈）：`tbox-ragflow-platform/others/apps/web/`（Vue 3 + Vite + Element Plus）。用于 **信息架构、权限语义、布局与色板** 对齐；交付主线前端仍为同仓 **`web-tbox/`**（见 §2 表「TBOX 产品主仓」行）。

**门禁**：§1 第 2 条与 §7.2 不变；若调整一级导航、权限键名或单库/合规相关展示，须 **先改上述 UI 文档** 再改代码。

---

## 3. 与 Harness Engineering 的对齐清单

开 PR 前自检（与 `docs/harness_engineering_guide.md` 中「交付与契约 Harness」一节一致者打勾）：

- [ ] **可复现**：新同事仅依赖文档中的命令可完成安装与最小验证。
- [ ] **契约**：对外事件（webhook / 日志字段）变更已 bump 版本或迁移说明，且样例与 schema 同步。
- [ ] **可观测**：关键路径有结构化日志或指标；告警规则若有，与文档索引一致。
- [ ] **批次**：单次 PR 主题单一，避免「一大坨」难以 review。
- [ ] **Runtime（可选）**：若合并了对抗测试 / harness CI，则相关 `paths` 变更需考虑 runner 可用性。

---

## 4. 分期交付计划（与 §1 对齐的整体安排）

下列阶段为**建议骨架**；§6 问卷已答复，硬约束见 **§7**。

| 阶段 | 内容 | 完成定义（草案） |
|------|------|------------------|
| **P0 对齐** | 技术栈冻结（RAGFlow 版本、Node/Python）、UI 技术路线、爬取合规与上游合并策略 | §7 已关闭问卷项；独立前端与 UI 细节在设计阶段定稿 |
| **P1 基座** | Fork 可构建运行；**兼容** RAGFlow 原有核心路径（登录/KB/对话等）在目标部署下可用 | Docker（或 Compose）一键起；冒烟用例列表入文档 |
| **P2 新 UI：用户与 KB 管理** | 用户管理；知识库管理（导入、导出、删除等）与权限衔接 | UI + API 可测；数据不可逆操作有确认与审计（最低限度日志） |
| **P3 爬取** | 网络爬取能力：任务配置、调度、失败重试、与 KB 入库流水线对接 | 端到端：从「配置源」到「KB 可检索」；频率/robots/鉴权策略成文 |
| **P4 交付** | **其他服务器** Docker 部署：镜像、环境变量、卷、网络、升级说明 | 第三方按文档冷启动成功；可选提供 compose 模板 |
| **P5 可选** | `tbox-ragflow-platform` 集成、webhook、Harness 深度门禁 | 与业务需要挂钩，不阻塞 P1–P4 |

**已知已完成（与 §1 产品主线非等价；请团队核对后勾选）**

- [ ] 平台仓（若使用）：`tbox-ragflow-platform` 上 alert-docs-gate 等已合入其 `main`。
- [ ] 本仓：新 UI / 爬取 / Docker 相关代码与文档是否已有初版分支或 PR（路径说明）。
- [ ] Harness：`harness_engineering` 工作流与 runner 是否纳入团队 CI 策略。

---

## 5. 门禁与分支策略（约束）

- **默认分支**：**不在 `main` 上直接开发**；功能开发用 `feature/tbox-kb-*`（或团队约定前缀），合并经 PR。
- **上游同步**：长期跟踪 `infiniflow/ragflow` **主分支**，建议 **每 2～4 周**合并一次上游至本 fork 的集成分支，再合入功能分支或 `main`，降低漂移。
- **二次开发边界**：**不侵入上游核心**；按 **可插拔 / 隔离层** 划分（独立前端、适配层、扩展 API），便于 rebase/合并。
- **合并前**：`ruff` / `pytest`（本仓约定范围）+ 你声明的 E2E 最小集；**对抗测试不纳入首版 PR 必过项**（见 §7）。
- **文档**：涉及 KB、爬取、Docker、用户模型、环境变量的，必须更新 `docs/TBOX_KB_DELIVERY_HARNESS.md` 或链出的用户/运维文档，并在 PR 描述中引用；**用户可见文档以中文为主**（见 §7）。

---

## 6. 需求澄清问卷（已答复）

下列为出资方答复摘要；**可执行约束**以 §7 为准。

| # | 问题摘要 | 答复 |
|---|----------|------|
| 1 | 新 UI 技术栈 | **独立前端**（如 Vite 等）；与 RAGFlow 通过 API 对接。**具体 UI 细节在开始 UI 设计时再讨论**。 |
| 2 | 用户管理与租户/SSO | **新定义的用户**与 RAGFlow 中 **租户 / 团队 / 角色一一对应**。**首版不要求** OIDC/SAML 等单点登录。 |
| 3 | 知识库导入/导出 | 首版支持的格式与 **RAGFlow 当前一致**即可（单库体量上限未另定，沿用 RAGFlow 能力与既有限制）。 |
| 4 | 爬取 | 首版允许：**静态网页、RSS、需登录站点、API 拉取**；**必须遵守 robots.txt**；默认 **定时** 调度，**同时支持手动**触发。 |
| 5 | Docker 交付 | **仅 `docker-compose.yml`（Compose）即可**；不要求多节点/K8s 清单。目标环境：**Linux**，架构 **linux/amd64**（及团队若扩展 arm64 等，须在文档中单独声明）。 |
| 6 | 上游与模块边界 | **必须**长期跟踪并定期合并 **infiniflow/ragflow 主分支**（建议 **每 2～4 周**一次）；**禁止**在 fork 的 `main` 上直接堆功能开发。二次开发按 **可插拔 / 隔离层** 划分，**不侵入上游核心**，便于 rebase。 |
| 7 | harness_engineering 工作流 | **保留**；runner 使用 **`ubuntu-latest`**（不再依赖 self-hosted 作为默认）。 |
| 8 | 对抗测试与 PR | **对抗测试作为发布前质量验证**；**不纳入首版 PR 合并必过门禁**（工作流不随 PR 触发，见 §7）。 |
| 9 | 文档语言 | **中文**（约束与用户手册以中文为准）。 |
| 10 | 硬截止日期 | **无**。 |

---

## 7. 「已确认约束」（执行依据）

### 7.1 产品范围（§1，不变）

1. 以开源 **RAGFlow** 为基础**二次开发**。
2. **新 UI**：兼容原有能力，并增加**用户管理**、**知识库管理**（导入、导出、删除等）、**知识爬取管理**。
3. **网络爬取**能力。
4. **Docker / Compose** 可部署到**其他服务器**。

### 7.2 架构与实现（来自 §6）

- **前端**：**独立前端**，与后端 **API** 集成；视觉与交互细节在 **UI 设计阶段**定稿。
- **用户模型**：TBOX 用户与 RAGFlow **租户、团队、角色一一对应**；首版 **无 SSO**（无 OIDC/SAML 必达要求）。
- **导入/导出**：与 **RAGFlow 首版一致**的格式与能力范围。
- **爬取**：数据源类型含 **静态网页、RSS、需登录站点、API**；**强制遵守 robots.txt**；默认 **定时**，并支持 **手动**。
- **部署**：以 **`docker-compose.yml`** 为主交付物；目标 **Linux / amd64**（若扩展架构须更新文档与 CI）。
- **上游**：**定期合并** `infiniflow/ragflow` **main**（建议 **2～4 周**）；开发在 **功能分支**，**不直改** fork `main`；代码 **可插拔、隔离层、少改上游核心**。
- **文档语言**：**中文**。
- **排期**：**无硬截止日期**。

### 7.3 CI 与 Harness（来自 §6）

- **`harness_engineering.yml`**：`runs-on: **ubuntu-latest**`；**已移除对 `pull_request` 的触发**，仅在 **push（约定分支）、定时、手动** 时运行，避免将对抗与重型 Docker 步骤绑在 PR 合并门禁上。
- **对抗测试**：在**发布前**或上述工作流触发时执行质量验证；**首版合入 PR 不以对抗测试为必过项**。
- **PR 轻量门禁（`ubuntu-latest`，路径触发）**：与上条**独立**，在变更相关路径时于 PR 上运行 **`web-tbox.yml`**（前端 typecheck + build）、**`harness-monitor-unit.yml`**（`HarnessMonitor` + `test/adversarial_tests.py` 离线用例）、**`tbox-crawl-common-unit.yml`**（爬取相关 `test/unit_test/common/test_tbox_crawl_*.py` 等）、**`tbox-task-service-unit.yml`**（**`tbox_crawl_task_service`** 纯逻辑单测）、**`tbox-crawl-worker-unit.yml`**（**`tbox_crawl_worker`** 进程冒烟）、**`tbox-app-routes-unit.yml`**（**`tbox_app`** **`/health`**、**`/contract`**、**`/me`**、**`/logout`**；mock **`crawl_svc`** / **`get_request_json`**：**crawl 任务** **`GET`/`POST`/`PATCH`/`DELETE`**、**`POST .../run`**（含错误分支））。索引见 **`docs/TBOX_ENV_AND_VERSIONS.md`** §6。
- 若后续将部分检查重新纳入 PR，须**先改本文档 §7.3 与 workflow**，再改 CI。

### 7.4 实施提示（非约束，供排期）

- **需登录站点 / API 拉取**：凭据与密钥管理须单独设计（环境变量/密钥卷），不得写入仓库。
- **独立前端 + 上游合并**：建议明确 **API 版本化** 与 **RAGFlow 版本钉扎**，避免前端与后端漂移。

### 7.5 第三方模型（可选验收）

- RAGFlow 上游已支持在租户中配置 **DeepSeek** 等供应商（见 `conf/models/deepseek.json`、`rag/llm/`、官方 `web/` 模型常量）。**非 TBOX 独占功能**，随上游合并保持即可。
- **可选发版前手测**：在目标环境为租户添加 DeepSeek（或兼容 OpenAI-API 的网关）API Key，在应用或默认模型中选一条 DeepSeek 对话模型，经 **`web-tbox/` 对话页** 或官方 `web/` 完成一轮流式对话，确认无鉴权/代理错误。

---

## 8. 修订记录

| 日期 | 变更 |
|------|------|
| 2026-05-01 | 初版：总纲 + 问卷 + 分期骨架 |
| 2026-05-01 | 对齐「TBOX 知识库」四条产品线定义；重写 §2/§4/§6/§7；区分与初稿假设差异 |
| 2026-05-01 | §6 问卷已答复；§7 写入全部约束；§5 上游/分支；`harness_engineering` 改为 ubuntu-latest 并取消 PR 触发 |
| 2026-05-01 | 新增 §9「下一步开发计划表」（与 §4、§7 对齐） |
| 2026-05-01 | §9.0 进度：`web-tbox/`、`tbox_app.py`、TBOX 环境与 API 边界、快速启动文档；§2/§9.2 同步 |
| 2026-05-01 | 登录页 + `/v1/tbox/me`、`/v1/tbox/logout`；文档与 `web-tbox` 依赖更新 |
| 2026-05-01 | S3 首包：`/kbs` 知识库列表与删除（官方 datasets API）、`NavBar` |
| 2026-05-01 | 新增 **§2.1** UI 设计文档索引；`TBOX_UI_DESIGN_OVERVIEW.md` / `TBOX_UI_DESIGN_DETAIL.md`；§9.0 S2 与参考原型路径对齐 |
| 2026-05-02 | §7.3：PR 轻量 CI（`web-tbox` / `harness-monitor-unit` / **`tbox-crawl-common-unit.yml`**，原 `tbox-crawl-ssrf-unit.yml`）与 **`docs/TBOX_ENV_AND_VERSIONS.md`** §6 索引 |
| 2026-05-02 | 新增 **`tbox-task-service-unit.yml`**（`tbox_crawl_task_service` 单测）；**pkg_resources** 弃用告警仅在**该测试模块**内 **`warnings.filterwarnings`** 处理（不放宽 **`pyproject.toml`** 全局 **`filterwarnings`**） |
| 2026-05-02 | **`TBOX_QUICKSTART.md`** 新增 **§6**：PR 前本地命令与 **`TBOX_ENV_AND_VERSIONS.md`** §6 轻量 CI 对齐说明 |
| 2026-05-02 | **`web-tbox/README.md`**：链至 **`TBOX_QUICKSTART`** §6 / **`TBOX_ENV_AND_VERSIONS`** §6（PR 自检与 CI 索引） |
| 2026-05-02 | 新增 **`tbox-crawl-worker-unit.yml`** + **`test/unit_test/rag/svr/test_tbox_crawl_worker.py`**；**`TBOX_QUICKSTART`** / **`TBOX_ENV_AND_VERSIONS`** §6 与本文 §7.3 同步 |
| 2026-05-02 | 新增 **`tbox-app-routes-unit.yml`** + **`test/unit_test/api/apps/tbox_app_isolated/`**（隔离 Quart，不导入全量 **`api.apps`**；由 **`conftest.py`**、**`_shared.py`**、按域 **`test_*.py`** 组成）；**`TBOX_QUICKSTART`** / **`TBOX_ENV_AND_VERSIONS`** §6 与本文 §7.3 同步 |
| 2026-05-02 | **`test_tbox_app_health`**：可变 **`current_user`** + mock **`crawl_svc`** 覆盖 **`GET /crawl/tasks`**（超管空列表）、**`crawl.manage`** 拒绝、**`GET /crawl/tasks/<id>`** 404；文档 §6 表与快速启动注释同步 |
| 2026-05-02 | **`test_tbox_app_health`**：**`POST /crawl/tasks`**（**`name`** 必填、成功创建）；stub **`get_request_json`** 改为 **async**；文档 §6 / §7.3 同步 |
| 2026-05-02 | **`test_tbox_app_health`**：**`PATCH`**（无字段、**`name`** 空、**`name`** 成功）、**`DELETE`**、**`POST .../run`**；文档 §6 / §7.3 同步 |
| 2026-05-02 | **`test_tbox_app_health`**：**`/me`**、**`/logout`**（可变 **`current_user`** + **`save`**）；**`POST .../run`** 的 **`ValueError`** / **`RuntimeError`**；文档 §6 / §7.3 同步 |
| 2026-05-02 | 单文件 **`test_tbox_app_health.py`** 重构为包 **`tbox_app_isolated/`**（**`conftest.py`**、**`_shared.py`**、**`test_permissions_and_public`** / **`test_crawl_tasks_routes`** / **`test_session_routes`**）；**`tbox-app-routes-unit.yml`** 路径与 **pytest** 目标改为目录 |
| 2026-05-02 | **`tbox_app_isolated`**：**`GET /crawl/tasks/<id>`** 成功；跨租户 **403**；**`POST /crawl/tasks`** **`tenant_id`** 不在允许列表 → **`ARGUMENT_ERROR`** |
| 2026-05-02 | **`tbox_app_isolated`**：**`GET /crawl/tasks`** 多租户 **`resolve_list_tenant_id`** 错误；**`POST`** 非法 **`source_type`**；**`PATCH`** 跨租户 **403** / **`extra_config`** 非对象；**`DELETE`**/**`POST …/run`** 跨租户 **403** |
| 2026-05-01 | `web-tbox`：主布局、全路由与 `RequirePermission`；`/me` 增加 `permissions`（契约 **v3**）；`TBOX_ENV_AND_VERSIONS.md` §2 填基线 commit；§9.0 S3 更新 |
| 2026-05-01 | `web-tbox`：对话流式、知识库检索、租户用户列表对接官方 API；`TBOX_API_BOUNDARY` / 快速启动 / §9.0 同步 |
| 2026-05-01 | `web-tbox` 对话：应用列表 + 会话创建/复用 + 引用侧栏（`reference.chunks`）；`chats.ts` / `ReferenceChunks.tsx` |
| 2026-05-01 | `web-tbox` 对话：**会话列表/切换/刷新**（`GET .../sessions`、`GET .../sessions/:id`）；新增 **§7.5** DeepSeek 等可选发版手测说明 |
| 2026-05-01 | **`/documents`**：**数据集文档** `GET/POST/DELETE .../documents`（上传 multipart）；§9.0 S3、API 边界、快速启动同步 |
| 2026-05-01 | **`/crawl`** 采集壳 + **`crawl.manage`**（`/me` 契约 **v4**）；**`/audit`** 对接 **`GET .../ingestions`**；UI 概要/详细设计 §4/IA 同步 |
| 2026-05-01 | **`/v1/tbox/crawl/tasks`** CRUD + **`tbox_crawl_task`** 表；`TBOX_API_BOUNDARY` §1.2；§9.0 **S4** 说明更新 |
| 2026-05-01 | **`web-tbox` `/crawl`**：`CrawlPage` 对接 **`crawlTasks`** API（列表/新建/编辑/删、租户筛选） |
| 2026-05-01 | **`rag/svr/tbox_crawl_worker.py`** + `docker/entrypoint.sh` **`ENABLE_TBOX_CRAWL_WORKER`**；`TBOX_API_BOUNDARY` §1.3、`TBOX_QUICKSTART` §3.1 |
| 2026-05-01 | **`POST /v1/tbox/crawl/tasks/<id>/run`** + `execute_crawl_task_stub_tick`；**`web-tbox`** 采集表「执行一次」 |
| 2026-05-01 | worker 增加 `schedule_cron` 到点判断 + 同分钟去重（`is_task_due_now`）；S4 状态描述同步 |
| 2026-05-01 | worker 增加 **Redis 非阻塞分布式锁**（`tbox_crawl_tick:<id>`） |
| 2026-05-01 | crawl tick：**HTTP 种子探测**（`common/tbox_crawl_http_probe.py`）、**`tbox_skip_http_probe`**；`TBOX_API_BOUNDARY` §1.2–1.3 |
| 2026-05-01 | crawl tick：**真实入库**（`tbox_crawl_ingest_service` + `common/tbox_crawl_ssrf_fetch.py`）、**`tbox_skip_ingest`**；`TBOX_API_BOUNDARY` §1.3 |
| 2026-05-01 | crawl tick：**RSS** 入库（`RSSConnector` + **`TBOX_CRAWL_RSS_*`**）；`TBOX_API_BOUNDARY` §1.3 |
| 2026-05-01 | crawl tick：**robots.txt 预检**（`common/tbox_crawl_robots.py`）、**`tbox_skip_robots_check`** |
| 2026-05-01 | crawl **HTTP 探测**：与抓取同源 **`_ssrf_redirecting_stream_get`**（每 hop robots + SSRF） |
| 2026-05-01 | **`web-tbox` `CrawlPage`**：**`extra_config` 完整 JSON 开关**（与 `TBOX_UI_DESIGN_DETAIL` §4、`TBOX_API_BOUNDARY` §1.2 同步） |
| 2026-05-01 | 新增 **§9.4**「S4 爬取合规与 Crawl-delay 待办」；§9.0/§9.1 **S4** 行改为引用 §9.4 |
| 2026-05-01 | **§9.4.2**：落地 **`OriginFetchThrottler`** + **`Crawl-delay`**；**`TBOX_API_BOUNDARY` §1.3** 同步 |
| 2026-05-01 | **§9.4.2**：落地 **429/503 礼貌退避**（`Retry-After` + backoff）；补 **`TBOX_CRAWL_RETRY_*`** 参数 |
| 2026-05-01 | **§9.4.2**：**429/503** 重试 **按状态覆盖**；**`last_error`** **`[tbox:CODE]`** 前缀；**`TBOX_API_BOUNDARY` §1.3** 同步 |
| 2026-05-01 | **§9.4.2**：**`RSSConnector`** Feed 拉取对齐 **throttle / robots hop / 429 退避**（`ingest_rss_seeds_into_kb`） |
| 2026-05-02 | **§9.4.2**：**502** 纳入 **`tbox_crawl_ssrf_fetch`** 与 **RSS Feed** 同源瞬时退避；**`TBOX_API_BOUNDARY` §1.3** 补 **`TBOX_CRAWL_RETRY_*_502`** |
| 2026-05-02 | **§9.4.2**：**504** 纳入同源瞬时退避；**`TBOX_API_BOUNDARY` §1.3** 补 **`TBOX_CRAWL_RETRY_*_504`** |
| 2026-05-02 | **§9.4.2**：**408** 纳入同源瞬时退避；**`TBOX_API_BOUNDARY` §1.3** 补 **`TBOX_CRAWL_RETRY_*_408`** |
| 2026-05-02 | **§9.4.2**：**520–524**（边缘/CDN 常见）纳入 **`tbox_crawl_ssrf_fetch._RETRY_STATUSES`**；**`TBOX_API_BOUNDARY` §1.3** 补 **`TBOX_CRAWL_RETRY_*_<CODE>`** 说明 |
| 2026-05-02 | **§9.4.2**：**525**、**526**、**530** 纳入 **`_RETRY_STATUSES`**；**`TBOX_API_BOUNDARY` §1.3** 注明 **500/501** 等 **5xx** 不重试 |
| 2026-05-02 | **§9.4.2**：**528** 纳入 **`_RETRY_STATUSES`**；**`TBOX_API_BOUNDARY` §1.3** 同步 **`CODE`** 列表 |
| 2026-05-02 | **§9.4.2**：**529** 纳入 **`_RETRY_STATUSES`**；**`TBOX_API_BOUNDARY` §1.3** 明确 **`TBOX_CRAWL_RETRY_MAX_ATTEMPTS_<CODE>=0`** 关闭该码重试 |
| 2026-05-02 | **§9.4.2**：**`effective_retry_statuses`** — 环境变量 **`TBOX_CRAWL_RETRY_STATUSES`** / **`TBOX_CRAWL_RETRY_EXTRA_STATUSES`** 与 **`extra_config.tbox_crawl_retry_extra_statuses`** 配置白名单；**`DEFAULT_RETRY_STATUS_CODES`**；**`TBOX_API_BOUNDARY` §1.2–1.3** 同步 |
| 2026-05-02 | **§9.4.2**：**`extra_config.tbox_crawl_retry_statuses`** 任务级全量白名单（**`effective_retry_statuses`** 第二优先级） | **`TBOX_API_BOUNDARY` §1.2** 同步 |

---

## 9. 下一步开发计划表

下表按**依赖顺序**排列：同一阶段内可并行；**前置未完成则不建议启动后置**。时间列为「建议顺序」而非硬期限（见 §7.2 排期）。

### 9.0 迭代进度（大步伐落地记录）

| 阶段 | 状态 | 说明 |
|------|------|------|
| **S0** | **部分完成** | 已新增 `docs/TBOX_ENV_AND_VERSIONS.md`、`docs/TBOX_QUICKSTART.md`；**独立前端目录已定为同仓 `web-tbox/`**（Vite + React）。**基线 commit 表仍须维护者填写**。 |
| **S1** | **已推进** | `docs/TBOX_API_BOUNDARY.md`；`api/apps/tbox_app.py`：`/health`、`/contract`；**`/me`（鉴权）**、**`/logout`**；`/me` 契约版本当前为 **v4**（`permissions` 含 `crawl.manage` 等；以 `TBOX_API_CONTRACT_VERSION` 与 `GET /v1/tbox/contract` 为准）。租户列表来自 `UserTenant`；更细「一一对应」字段表仍可在 S3 补全。 |
| **S2** | **已推进** | `web-tbox/`：**`/login` 邮箱密码登录**（RSA → `/api/v1/auth/login`）、**`/` 控制台**拉取 **`/v1/tbox/me`**（带 `Authorization`）、**退出** 调 **`POST /v1/tbox/logout`**。IA/权限/视觉以 **`docs/TBOX_UI_DESIGN_OVERVIEW.md`**、**`docs/TBOX_UI_DESIGN_DETAIL.md`** 为准；参考原型见 **§2.1**。 |
| **S3** | **已启动** | **知识库 `/documents`**（含 **文档列表/上传/删除**）；**对话 `/`**；**检索 `/search`**；**用户 `/users`**；**审计 `/audit`**（ingestions）；**`permissions`**（**v4** 含 `crawl.manage`）。**整库 ZIP 导出** 仍视官方 REST 暴露情况。 |
| **S4** | **部分启动** | **`/crawl`** + **`crawl.manage`**；**`/v1/tbox/crawl/tasks` CRUD**；**`rag/svr/tbox_crawl_worker.py`** 轮询 + tick：**探测** + **`robots.txt` 预检**（可跳过）+ **`dataset_id`** 时 **`static_web`/`rss`** 入库；**`docker/entrypoint.sh`** **`ENABLE_TBOX_CRAWL_WORKER`**；**`web-tbox` `CrawlPage`**（含 **`extra_config` 勾选 + JSON / 完整 JSON 模式**）。**Crawl-delay、全量 robots 语义、登录/API 源等**见 **§9.4 待办**。 |
| **S5–S7** | 未开始 | 按 §9.1 继续排期。 |

### 9.1 阶段总览

| 阶段 | 目标 | 主要交付物 | 验收要点（与 §7 对齐） |
|------|------|------------|------------------------|
| **S0 工程基线** | 分支、上游节奏、目录/API 契约打底 | 功能分支约定；钉扎/记录当前 RAGFlow 基线 commit；**同仓 `web-tbox/`**；中文《环境与版本》《快速启动》 | 新人按 `docs/TBOX_QUICKSTART.md` 可联调后端 + 占位前端；**不在 `main` 直开**（§5）；**基线 commit 须补填**（`TBOX_ENV_AND_VERSIONS.md`） |
| **S1 后端隔离层** | 可插拔扩展，少动上游核心 | **`/v1/tbox/*` 首包** + 边界文档；用户/租户/团队/角色 **一一映射** 的数据模型与后续 API；**无 SSO** 首版路径 | 映射规则与鉴权随接口迭代补文档；密钥走环境变量（§7.4） |
| **S2 独立前端骨架** | UI 技术栈落地，对接 API | **`web-tbox/`**（Vite）；代理与 **health 联调**；后续路由与登录 | 当前：**health 联调**；登录与完整布局在 UI 设计阶段（§6 题 1） |
| **S3 用户与 KB 管理** | §1 第 2 条能力 | 用户管理界面 + API；知识库 **导入/导出/删除** 等与 **RAGFlow 首版格式一致** 的封装或直连 | 与官方行为对齐的用例表 + 手测/自动化冒烟；不可逆操作有确认与日志（§4 P2） |
| **S4 爬取子系统** | §1 第 3 条 | 数据源：**静态网页、RSS、需登录、API**；**遵守 robots.txt**；**默认定时 + 支持手动**；任务与状态 UI；与 KB 入库流水线对接 | 端到端：配置源 → 定时/手动触发 → 可检索；合规与凭据策略成文（§6 题 4、§7.4）。**当前实现与 §6「必须遵守 robots」的差距**（如 **Crawl-delay**、扩展指令）见 **§9.4**。 |
| **S5 Docker 交付** | §1 第 4 条 | **仅 Compose** 的 `docker-compose.yml`（及必要 `.env.example`）；目标 **Linux / amd64** 说明与验证 | 第三方新机器按文档冷启动成功；架构扩展须更新文档（§6 题 5） |
| **S6 上游同步例行化** | 控制漂移 | **每 2～4 周**合并 `infiniflow/ragflow` **main** 的流程（负责人、合并窗口、冲突处理清单） | 至少完成一轮合并演练并记录（§5、§7.2） |
| **S7 发布前质量** | 非 PR 门禁 | **对抗测试**在发版前或 `workflow_dispatch` 执行；结果归档 | 与 §7.3 一致：PR 不依赖对抗测试通过 |

### 9.2 建议立即启动的 5 项（S0 内）

| 序号 | 工作项 | 产出 | 说明 |
|------|--------|------|------|
| 1 | 冻结本 fork **基线 commit** 与 **Node/Python** 大版本 | `docs/TBOX_ENV_AND_VERSIONS.md`（**§2 表须填写**） | 与独立前端、后端 lockfile 一致 |
| 2 | 定 **独立前端** 目录策略（同仓 `web-tbox/` vs 独立 git 仓库） | **已定：同仓 `web-tbox/`**（见 §9.0）；若改独立 git 须先更新 §2 与本表 | 影响 CI 与发布流水线 |
| 3 | 起草 **REST/Web API 边界**（现有 RAGFlow API vs TBOX 扩展前缀） | **`docs/TBOX_API_BOUNDARY.md`** + `tbox_app.py` 首端点 | OpenAPI 机器可读稿可后补 |
| 4 | 从上游 **拉一次 main** 到集成分支并解决冲突 | 合并记录或 PR | 落实 §5「2～4 周」节奏前先跑通流程 |
| 5 | **Compose** 当前能否覆盖「后端 + 依赖服务 +（占位）前端」 |  compose 片段 + README 步骤 | 为 S5 打样，可迭代 |

### 9.3 可选并行（不阻塞 S0–S2）

| 工作项 | 说明 |
|--------|------|
| 若使用 `tbox-ragflow-platform` | 明确与本产品数据流关系（§2），仅作流水线/契约配套 |
| Harness 脚本/workflow 在 `ubuntu-latest` 上跑通与调优 | 若 Docker 步骤超时，再拆 job 或缩小范围（与 §7.3 一致） |

### 9.4 S4 爬取合规与 Crawl-delay 待办（与 §6 题 4、§7 对齐）

本节记录 **已实现** 与 **仍待产品/工程闭环** 的边界，避免将「有 robots 预检」误等同「已完全满足站点 robots 与礼貌爬取」。

#### 9.4.1 已实现（可验收）

| 项 | 说明 |
|----|------|
| **Disallow / Allow + UA** | `common/tbox_crawl_robots.py` 使用 **`urllib.robotparser.RobotFileParser`**，对目标 URL 调用 **`can_fetch`**（与 **`TBOX_CRAWL_HTTP_USER_AGENT`** 一致）；探测与 **`fetch_url_body_capped`** 路径在适当时机做 **`robots_preflight`**（见 `docs/TBOX_API_BOUNDARY.md` §1.2–1.3）。 |
| **按 origin 缓存** | 同一 tick 内对 **scheme+host** 复用已拉取的 **`/robots.txt`**，减少重复请求。 |
| **404 / 拉取失败** | **`/robots.txt`** 为 **404** 时视为无规则放行；拉取或解析异常时 **放行并打日志**（规则未知，不阻断业务）。 |
| **SSRF 边界** | robots 与页面/Feed 拉取均走 **受控 GET**（体积与超时上限），与内网 SSRF 防护一致。 |
| **可关闭** | 任务 **`extra_config.tbox_skip_robots_check`** 跳过预检（**`web-tbox` `/crawl`** 有勾选）。 |

#### 9.4.2 Crawl-delay 与请求节奏

| 项 | 现状 | 说明 / 待办 |
|----|------|-------------|
| **`Crawl-delay` + 最小间隔** | **已实现（首版）**：`common/tbox_crawl_origin_throttle.py` 的 **`OriginFetchThrottler`** 在 **`fetch_url_body_capped` / `probe_url_streaming_cap`** 的 **每 hop GET 前** 与 **`/robots.txt` 拉取时间戳**对齐后 **`sleep`**；**`RobotsOriginCache.crawl_delay_seconds`** 读 **`RobotFileParser.crawl_delay`**；环境变量 **`TBOX_CRAWL_MIN_ORIGIN_INTERVAL`**、**`TBOX_CRAWL_MAX_CRAWL_DELAY_SEC`**、**`TBOX_CRAWL_SKIP_CRAWL_DELAY`**。探测、**`static_web`** 入库、**TBOX RSS 入库** 均共享 throttler。 | **`RSSConnector._read_feed`**（仅 **Feed URL** 拉取与重定向）在 **`ingest_rss_seeds_into_kb`** 中已传入 **throttle + per-hop robots + 与 `fetch_url_body_capped` 同源的瞬时 HTTP 退避**（**`effective_retry_statuses(extra_config)`**，默认含 **408/429/502/503/504**、**520–524**、**525/526/528/529/530**，可由 **`TBOX_CRAWL_RETRY_*`** 与 **`extra_config.tbox_crawl_retry_extra_statuses`** 调整）；**条目正文**仍来自 **feedparser** 解析字段，**不**对 entry **外链**再发 GET。 |
| **非标准 Request-rate** | **未**解析 Google 扩展等非 **`urllib.robotparser`** 字段。 | 若合规要求覆盖，须自定义解析或第三方 robots 库。 |
| **瞬时 HTTP 与退避** | **已实现（首版）**：`common/tbox_crawl_ssrf_fetch.py` 的 **`effective_retry_statuses`** 给出每 tick / 每请求的**可重试状态码白名单**（内建 **`DEFAULT_RETRY_STATUS_CODES`**；**`TBOX_CRAWL_RETRY_STATUSES`** 进程级全量替换；否则 **`extra_config.tbox_crawl_retry_statuses`** 任务级全量替换；否则 **`TBOX_CRAWL_RETRY_EXTRA_STATUSES`** ∪ **`extra_config.tbox_crawl_retry_extra_statuses`** 与默认并集，见 **`docs/TBOX_API_BOUNDARY.md` §1.3**）。对白名单内状态按 **`Retry-After`**（delta/http-date，带上限）或指数退避重试；全局 **`TBOX_CRAWL_RETRY_*`**，并按 **`TBOX_CRAWL_RETRY_*_<CODE>`** 覆盖任意 **100–599**；**`TBOX_CRAWL_RETRY_MAX_ATTEMPTS_<CODE>=0`** 关闭该码抓取层重试。**`500`**/**`501`** 等不在白名单内则**不重试**。 | **`last_error`** 短码前缀见下行。 |
| **last_error 短码** | tick 失败写入 **`[tbox:CODE] …`**（**`common/tbox_crawl_last_error.py`**），如 **`HTTP_PROBE`**、**`INGEST_STATIC`**、**`INGEST_RSS`**、**`DATASET_TENANT`**、**`KB_NOT_FOUND`**、**`WORKER_EXCEPTION`**、**`WORKER_STUB`**。 | 后续可映射到 UI 固定文案或 i18n key。 |

#### 9.4.3 待办：robots 全量语义与产品合规

| 项 | 说明 |
|----|------|
| **Host、Sitemap 等** | 标准 **`RobotFileParser`** 对 **`Host`** 等支持有限；若产品需要「跟 sitemap 全站爬」须 **单独设计**（数据源类型、范围、与 §6「仅首版四类源」的关系）。 |
| **§6 题 4：需登录站点、API 拉取** | 总纲要求的数据源类型；**凭据**见 §7.4（环境变量/密钥卷）。**任务模型、鉴权注入与 UI** 仍待与 **`/crawl`**、worker 对齐，**不属于**本节「robots 子集」已闭合。 |
| **全量合规与条款** | 「遵守 robots」**不等于**自动满足各站 **ToS / 版权 / 地域限制**；若面向公网生产，需 **产品策略**（可配置域名白名单、默认关闭公网爬、用户确认文案等）与 **法务/运维** 结论，并在 **`TBOX_UI_DESIGN_*`** 与对外手册中写明 **能力边界与免责**。 |

---

**执行约定**：本表随迭代更新；行项状态可用团队看板勾选，但**范围变更须先改 §1/§7 再改本表**。
