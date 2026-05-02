# TBOX API 边界与版本策略（S1 草案 → 随实现迭代）

本文定义 **TBOX 产品** 在 RAGFlow fork 上的 HTTP 扩展边界，与 `docs/TBOX_KB_DELIVERY_HARNESS.md` §7.2「可插拔 / 隔离层」一致。

## 1. 路径前缀

| 前缀 | 用途 | 约束 |
|------|------|------|
| **`/v1/tbox/*`** | **仅** TBOX 产品新增或包装后的能力（用户管理扩展、爬取任务、运营接口等） | 新功能**默认**落在此前缀下；**不修改**上游已有 `/v1/*`、`/api/v1/*` 路径语义。 |

### 1.1 已实现端点（随 `TBOX_API_CONTRACT_VERSION` 迭代）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/v1/tbox/health` | 无 | 健康检查 |
| GET | `/v1/tbox/contract` | 无 | 契约版本与文档指针 |
| GET | `/v1/tbox/me` | **需要** `Authorization`（与官方 `web/` 登录后相同） | 当前用户 id、邮箱、昵称、超管标记、**租户/角色** 列表（`UserTenant`），以及 **`permissions`** 字符串数组（含 **`crawl.manage`** 等，见 `docs/TBOX_UI_DESIGN_DETAIL.md` §2.2；契约 **≥4** 由服务端按租户角色推导） |
| POST | `/v1/tbox/logout` | **需要** `Authorization` | 使 `access_token` 失效并清理会话，语义对齐 `POST /api/v1/auth/logout` |

### 1.2 采集任务（`crawl.manage`；持久化表 `tbox_crawl_task`）

以下 HTTP 端点负责任务 **CRUD** 与租户隔离；**执行一次**（`/run` 与 worker）的抓取/入库逻辑见 **§1.3**。均需 **`Authorization`**，且 **`GET /v1/tbox/me`** 的 **`permissions`** 须含 **`crawl.manage`**。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/v1/tbox/crawl/tasks` | 分页列表。Query：`page`（默认 1）、`page_size`（默认 20，最大 100）、`dataset_id`（可选）、`tenant_id`（**同一用户属于多个租户时必填**；超管可选，用于过滤）。响应 `data`：`{ total, page, page_size, items[] }`。 |
| GET | `/v1/tbox/crawl/tasks/<task_id>` | 单条详情。 |
| POST | `/v1/tbox/crawl/tasks` | 创建。JSON：`name`（必填）、`seed_urls`（必填，非空 `http`/`https` URL 数组，≤100 条）、`source_type`（`static_web` \| `rss`，默认 `static_web`）、`run_state`（`draft` \| `ready` \| `paused`，默认 `draft`）、`schedule_cron`（可选；空串表示仅手动；若非空需 **5 段 cron**，字符集 `0-9 * / , -`）、`enabled`（布尔）、`extra_config`（对象）、`tenant_id`（可选，默认当前用户 id）、`dataset_id`（可选，须为该租户下有效知识库 id）。 |
| PATCH | `/v1/tbox/crawl/tasks/<task_id>` | 部分更新；仅允许上述可写字段中出现在 body 的键（`dataset_id` 可置 `null` 解除绑定；`schedule_cron` 校验同创建）。 |
| DELETE | `/v1/tbox/crawl/tasks/<task_id>` | 软删除（`status=0`）。 |
| POST | `/v1/tbox/crawl/tasks/<task_id>/run` | **手动触发一次**与 worker 相同的 **tick**（更新 **`last_run_at`** / **`last_error`**）。默认对 **`seed_urls`** 前 **N** 条做 **轻量 HTTP 探测**（与入库相同：**手动重定向** + **每 hop SSRF + robots**，见 `common/tbox_crawl_ssrf_fetch.probe_url_streaming_cap`）；若已绑定 **`dataset_id`**：**`static_web`** 为 **SSRF GET**（有界体积，**每 hop robots**）；**`rss`** 对 **Feed URL** robots 后再 **`RSSConnector`** 拉条目 **`.txt` 入库**。**`extra_config`**：**`tbox_skip_http_probe`** / **`tbox_skip_ingest`** / **`tbox_skip_robots_check`**。不要求 `run_state=ready`。 |

**`items[]` 字段**：`id`, `tenant_id`, `dataset_id`, `name`, `source_type`, `seed_urls`, `schedule_cron`, `enabled`, `run_state`, `last_run_at`, `last_error`, `extra_config`, `created_by`, `create_time`, `update_time`, `status`。

**`extra_config` 常用键**（布尔；`PATCH` 传入的 `extra_config` 为**整对象替换**，其它键须自行带回）：**`tbox_skip_http_probe`**、**`tbox_skip_ingest`**、**`tbox_skip_robots_check`**、**`worker_stub_fail`**（tick 最前故意失败，联调用）。**`web-tbox`** **`/crawl`**：对上述四键提供勾选，并以 **JSON 文本框** 编辑其余键（默认展示**已剥离**四键；可选 **「JSON 含勾选四键」** 查看/编辑完整对象；完整模式下勾选变更会重合并到文本；**保存**时先解析 JSON 再合并勾选，**勾选优先**覆盖四键）。见 `docs/TBOX_UI_DESIGN_DETAIL.md` §4。

**租户规则**：非超管仅可操作 **`UserTenant` 角色为 owner/admin/normal** 的 `tenant_id` 下任务（与 `crawl.manage` 下发范围一致）；超管可跨租户读写。

### 1.3 采集 Worker 进程

| 项 | 说明 |
|------|------|
| 入口 | **`rag/svr/tbox_crawl_worker.py`**（独立进程；与 **`rag/svr/sync_data_source.py`** 同类，不经 Quart）。 |
| 轮询条件 | **`tbox_crawl_task`**：`status` 有效、`enabled=true`、**`run_state=ready`** 且 `schedule_cron` 与当前分钟匹配。**同一分钟去重**（`last_run_at`）+ **Redis 分布式锁**（`tbox_crawl_tick:<task_id>`，非阻塞；Redis 不可用时降级无锁并打日志）。 |
| 当前行为 | 写 **`last_run_at`** / **`last_error`**。默认 **HTTP 探测**（`common/tbox_crawl_http_probe.py`）；**`robots.txt`**：`common/tbox_crawl_robots.py`（`urllib.robotparser` + SSRF 安全拉取 **`/robots.txt`**，404 视为允许；拉取/解析失败则**放行**并打日志）。**`extra_config.tbox_skip_robots_check`** 关闭 robots。若 **`dataset_id`** 非空：**`static_web`** / **`rss`** 入库路径见前；入库 GET **每个重定向 hop 前**均 `can_fetch`（`common/tbox_crawl_ssrf_fetch.py` 的 **`robots_preflight`**）。**`tbox_skip_http_probe`** / **`tbox_skip_ingest`** 见 §1.2。**`worker_stub_fail`** 在 tick 最前抛错。 |
| robots 节奏 | **`can_fetch`（Disallow/Allow）** + **`OriginFetchThrottler`**（`common/tbox_crawl_origin_throttle.py`）：同一 tick 内对同一 origin 的 **GET** 之间按 **`Crawl-delay`**（`RobotFileParser.crawl_delay`，上限 **`TBOX_CRAWL_MAX_CRAWL_DELAY_SEC`** 默认 **60**）与 **`TBOX_CRAWL_MIN_ORIGIN_INTERVAL`**（默认 **0**）取较大值节流；可与 **`TBOX_CRAWL_SKIP_CRAWL_DELAY`** 关闭 **Crawl-delay** 部分。**`/robots.txt`** 拉取时间计入间隔。**408/429/502/503/504** 与 **520–524**（Cloudflare 等边缘常见非标准码）在抓取层按 **`Retry-After`** 或指数退避重试（参数见下）；**Request-rate** 仍待 **`docs/TBOX_KB_DELIVERY_HARNESS.md` §9.4**。 |
| Docker | 环境变量 **`ENABLE_TBOX_CRAWL_WORKER=1`**，或 **`docker/entrypoint.sh`** 传入 **`--enable-tbox-crawl-worker`**。 |
| 可调参数 | Worker：**`TBOX_CRAWL_WORKER_INTERVAL`**（默认 **30**）、**`TBOX_CRAWL_WORKER_POLL_LIMIT`**（默认 **20**）。探测：**`TBOX_CRAWL_FETCH_PROBE_MAX`**、**`TBOX_CRAWL_FETCH_TIMEOUT`**、**`TBOX_CRAWL_HTTP_USER_AGENT`**、**`TBOX_CRAWL_HTTP_READ_BYTES`**（默认 **8192**）。**robots**：**`TBOX_CRAWL_ROBOTS_TIMEOUT`**（默认 **10**）、**`TBOX_CRAWL_ROBOTS_MAX_BYTES`**（默认 **262144**）。**origin 节流**：**`TBOX_CRAWL_MIN_ORIGIN_INTERVAL`**（秒，默认 **0**）、**`TBOX_CRAWL_MAX_CRAWL_DELAY_SEC`**（默认 **60**）、**`TBOX_CRAWL_SKIP_CRAWL_DELAY`**（真值则忽略 **Crawl-delay**）。**瞬时错误退避**：**`TBOX_CRAWL_RETRY_MAX_ATTEMPTS`**（默认 **2**）、**`TBOX_CRAWL_RETRY_BACKOFF_BASE`**（秒，默认 **1.0**）、**`TBOX_CRAWL_RETRY_BACKOFF_MAX`**（秒，默认 **15**）、**`TBOX_CRAWL_RETRY_AFTER_CAP_SEC`**（秒，默认 **30**）；可按状态覆盖上述各 **HTTP 状态码**（**`TBOX_CRAWL_RETRY_MAX_ATTEMPTS_<CODE>`**、**`TBOX_CRAWL_RETRY_BACKOFF_BASE_<CODE>`**、**`TBOX_CRAWL_RETRY_AFTER_CAP_SEC_<CODE>`**，**`CODE`** 为 **`408`**、**`429`**、**`502`**、**`503`**、**`504`**、**`520`**–**`524`**；未设置则回落到全局同名参数）。**static_web** 入库：**`TBOX_CRAWL_INGEST_*`**。**rss** 入库：**`TBOX_CRAWL_RSS_*`**；**`TBOX_CRAWL_INGEST_TIMEOUT`** 作用于 **RSS Feed HTTP** 与 **static_web GET**（回落 **`TBOX_CRAWL_FETCH_TIMEOUT`**）。 |
| 本地开发 | 依赖服务已起后：`export PYTHONPATH=$(pwd)`，执行 **`python rag/svr/tbox_crawl_worker.py`**。 |

**S3 知识库（官方 REST，不经 `/v1/tbox` 包装）**：`web-tbox` 路由 **`/documents`**（兼容重定向自 **`/kbs`**）调用 **`GET/DELETE /api/v1/datasets`**，以及 **`GET/POST/DELETE /api/v1/datasets/<dataset_id>/documents`**（列表、本地上传 multipart `file`、按 id 删除文档），与官方 `web/src/utils/api.ts` 契约一致。

**S3+ 对话与检索（官方 REST）**：`web-tbox` 另直接调用 **`POST /api/v1/chat/completions`**（SSE 流式）、**`GET /api/v1/chats`**、**`POST /api/v1/chats/<chat_id>/sessions`**、**`GET /api/v1/chats/<chat_id>/sessions`**（列表）、**`GET /api/v1/chats/<chat_id>/sessions/<session_id>`**（详情）、**`POST /api/v1/datasets/<id>/search`**、**`GET /api/v1/tenants/<tenant_id>/users`**（`tenant_id` 须为当前登录用户 id）。

**审计（官方 REST）**：**`GET /api/v1/datasets/<dataset_id>/ingestions`**（查询参数含 `log_type`、`page`、`page_size` 等），供 **`/audit`** 展示流水线/入库日志。

**既有 RAGFlow API**：`/v1/*`、`/api/v1/*` 仍由官方路由提供；**web-tbox** 通过 Vite 代理调用；变更跟随上游合并与官方文档。

实现入口：**HTTP**：`api/apps/tbox_app.py`（由 `api/apps/__init__.py` 自动注册为 **`/v1/tbox`**）；**Worker**：`rag/svr/tbox_crawl_worker.py`。

## 2. 契约版本

- 字段 **`tbox_api_contract_version`**：整型，由 `tbox_app.py` 中 `TBOX_API_CONTRACT_VERSION` 定义。
- **何时 +1**：对外 JSON 字段增删改、语义变化、或独立前端强依赖的响应结构变化。
- 探测接口：`GET /v1/tbox/health`、`GET /v1/tbox/contract`（无鉴权）。
- 登录仍使用官方 **`POST /api/v1/auth/login`**（密码 RSA 与 `web/` 一致）；独立前端见 `web-tbox/`。

## 3. 用户 / 租户 / 团队 / 角色（§6 已确认）

- **TBOX 用户**与 RAGFlow **租户、团队、角色**在数据模型上 **一一对应**（首版无 OIDC/SAML）。
- 具体表字段映射、同步策略与鉴权头（`Authorization` / Cookie）在实现 **S1/S3** 时补全本节表格；在此之前独立前端仅调用既有登录与租户 API。

## 4. 鉴权

- **`/v1/tbox/*` 下除 `/health`、`/contract` 外的路由**：默认与 RAGFlow 一致，使用 **`@login_required`** 或等价机制（随各接口落地时标注）。
- 禁止在仓库中存放生产密钥；使用环境变量或 Compose secrets（§7.4）。

## 5. 修订

| 日期 | 变更 |
|------|------|
| 2026-05-01 | 初版：前缀、`/health`/`/contract`、契约版本策略 |
| 2026-05-01 | 增加 `/me`、`/logout`；契约版本 **2**；登录走 `/api/v1/auth/login` |
| 2026-05-01 | 补充 S3：`/kbs` 使用官方 `datasets` 列表与删除 API |
| 2026-05-01 | 契约版本 **3**：`GET /v1/tbox/me` 增加 `permissions`；`web-tbox` 主路由 **`/documents`**（`/kbs` 重定向）；侧栏壳与权限守卫落地 |
| 2026-05-01 | 补充 `web-tbox` 对话：`GET .../chats/:id/sessions` 列表与 **`GET .../sessions/:sid`** 详情 |
| 2026-05-01 | 补充 `web-tbox` **`/documents`**：`GET/POST/DELETE .../datasets/:id/documents` |
| 2026-05-01 | 契约版本 **4**：`permissions` 增加 **`crawl.manage`**；`web-tbox` 路由 **`/crawl`**、**`/audit`** 对接 **`GET .../ingestions`** |
| 2026-05-01 | **§1.2**：`/v1/tbox/crawl/tasks` CRUD（表 **`tbox_crawl_task`**）；契约版本仍为 **4**（未改 `/me` 形状） |
| 2026-05-01 | **§1.3**：`rag/svr/tbox_crawl_worker.py` 骨架；`docker/entrypoint.sh` **`ENABLE_TBOX_CRAWL_WORKER`** / **`--enable-tbox-crawl-worker`** |
| 2026-05-01 | **§1.2**：**`POST /v1/tbox/crawl/tasks/<id>/run`** 手动 stub 执行；与 worker 共用 **`execute_crawl_task_stub_tick`** |
| 2026-05-01 | **§1.3**：worker 增加 `schedule_cron` 到点判断与同分钟去重（`is_task_due_now`） |
| 2026-05-01 | **§1.3**：worker 增加 **Redis 非阻塞锁**（多副本防重；失败降级） |
| 2026-05-01 | **§1.2–1.3**：tick 默认 **HTTP 种子探测**（可 **`extra_config.tbox_skip_http_probe`**）；环境变量见 §1.3 |
| 2026-05-01 | **§1.3**：**robots.txt 预检**（`common/tbox_crawl_robots.py`）；**`tbox_skip_robots_check`**；**`TBOX_CRAWL_ROBOTS_*`** |
| 2026-05-01 | **§1.3**：HTTP **探测**改为 **`requests` 手动重定向**（与 **`fetch_url_body_capped`** 共用 **`_ssrf_redirecting_stream_get`**），**每 hop robots** |
| 2026-05-01 | **§1.2**：**`extra_config`** 常用键说明；**`web-tbox` `/crawl`** 勾选写入（与 `TBOX_UI_DESIGN_DETAIL` §4） |
| 2026-05-01 | **§1.2**：**`web-tbox` `/crawl`** **`extra_config` JSON 高级编辑**（与勾选合并、勾选优先） |
| 2026-05-01 | **§1.2**：**`web-tbox` `/crawl`** **`extra_config` 完整 JSON 模式**（可选含四键；与 `TBOX_UI_DESIGN_DETAIL` §4 一致） |
| 2026-05-01 | **§1.3**：表增 **robots 节奏** 行（**`Crawl-delay` 未强制**；待办见 **`TBOX_KB_DELIVERY_HARNESS.md` §9.4**） |
| 2026-05-01 | **§1.3**：**`OriginFetchThrottler`** 实现 **Crawl-delay** + 可配最小间隔；**robots 节奏** 行与 **可调参数** 更新 |
| 2026-05-01 | **§1.3**：抓取层补 **429/503 礼貌退避**（`Retry-After` + 指数退避）；新增 **`TBOX_CRAWL_RETRY_*`** 参数说明 |
| 2026-05-01 | **§1.3**：**429/503** 重试参数支持 **按状态覆盖**；**`last_error`** 写入 **`[tbox:CODE]`** 前缀（见 **`common/tbox_crawl_last_error.py`**） |
| 2026-05-01 | **§1.3**：**`static_web`** + **`dataset_id`**：**SSRF 抓取**（`common/tbox_crawl_ssrf_fetch.py`）→ **`FileService.upload_document`** + **`DocumentService.run`**；**`tbox_skip_ingest`**；**`TBOX_CRAWL_INGEST_*`** |
| 2026-05-01 | **§1.3**：**`rss`** + **`dataset_id`**：**`RSSConnector`** 条目 → **`.txt`** 入库 + 解析队列；**`TBOX_CRAWL_RSS_*`** |
| 2026-05-01 | **§1.3**：**`RSSConnector`** Feed 拉取（**`ingest_rss_seeds_into_kb`**）对齐 **hop robots**、**`OriginFetchThrottler`**、**429/502/503/504 退避** 与 **`TBOX_CRAWL_HTTP_USER_AGENT`** |
| 2026-05-01 | **§1.3**：**RSS** Feed **`RSSConnector`** 使用 **`TBOX_CRAWL_INGEST_TIMEOUT`**（与 **static_web** 入库同源） |
| 2026-05-02 | **§1.3**：抓取层瞬时退避状态码增加 **502**（与 **429/503** 同策略；**`TBOX_CRAWL_RETRY_*_502`** 可选覆盖）；**`TBOX_KB_DELIVERY_HARNESS.md` §9.4.2** 同步 |
| 2026-05-02 | **§1.3**：抓取层瞬时退避增加 **504**（**`TBOX_CRAWL_RETRY_*_504`**；与 **502/503** 同策略）；**`TBOX_KB_DELIVERY_HARNESS.md` §9.4.2** 同步 |
| 2026-05-02 | **§1.3**：抓取层瞬时退避增加 **408**（**`TBOX_CRAWL_RETRY_*_408`**；GET 场景下常见网关空闲超时，与 **429/502/503/504** 同策略）；**`TBOX_KB_DELIVERY_HARNESS.md` §9.4.2** 同步 |
| 2026-05-02 | **§1.3**：抓取层瞬时退避增加 **Cloudflare 等 520–524**（**`TBOX_CRAWL_RETRY_*_520`** … **`_524`**；与 **`408/429/502/503/504`** 同策略）；**`_retry_*_for_status`** 改为表驱动；**`TBOX_KB_DELIVERY_HARNESS.md` §9.4.2** 同步 |
