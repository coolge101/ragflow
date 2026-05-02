# TBOX 知识库：快速启动（开发联调）

目标：在一台机器上同时跑 **RAGFlow 后端** 与 **TBOX 独立前端（web-tbox）**，并打通到 **`/v1/tbox/*`** 与既有 API。

## 1. 前置

- 已按官方文档启动依赖（MySQL、ES/Infinity、Redis、MinIO 等），或直接使用 **`docker compose`** 起全栈（见仓库 `docker/README.md`）。
- Node **>= 18.20.4**（推荐 20）、npm 或 pnpm。

## 2. 启动 RAGFlow API

确保宿主可访问 **`http://127.0.0.1:9380`**（或你在 `.env` 中配置的 `SVR_HTTP_PORT`）。

验证 TBOX 扩展：

```bash
curl -sS "http://127.0.0.1:9380/v1/tbox/health" | python3 -m json.tool
```

应见 `tbox_api_contract_version` 与 `status: ok`。

## 3. 启动 TBOX 独立前端（web-tbox）

```bash
cd web-tbox
cp -n .env.example .env
# 若 API 不在本机 9380，编辑 .env 中 VITE_RAGFLOW_API_ORIGIN
npm install
npm run dev
```

浏览器打开终端提示的地址（默认 **http://127.0.0.1:5174**）。开发模式下 Vite 将 **`/v1` 与 `/api`** 代理到 `VITE_RAGFLOW_API_ORIGIN`，避免 CORS。

提交或发版前建议在 `web-tbox/` 下执行 **`npm run typecheck`** 与 **`npm run build`**（与 GitHub Actions **`.github/workflows/web-tbox.yml`** 一致）；路由与权限说明见同目录 **`README.md`**。

### 3.1 登录与鉴权接口

1. 浏览器访问 **`/login`**，使用与 RAGFlow 相同的**邮箱 + 密码**。前端会调用 **`POST /api/v1/auth/login`**，密码使用与官方 `web/` 相同的 **RSA 公钥**加密后再提交。
2. 登录成功后，响应头 **`Authorization`** 与 JSON 中的 **`access_token`** 会写入 `localStorage`（键名与官方 `web/` 一致：`Authorization`、`token`、`userInfo`）。
3. 主壳加载时请求 **`GET /v1/tbox/me`**（含 **`permissions`**）并带上 `Authorization`；**`POST /v1/tbox/logout`** 可退出并使 token 失效（与 `POST /api/v1/auth/logout` 语义对齐）。
4. 知识库与文档：**`/documents`**（**`/kbs`** 重定向至此）— **`GET/DELETE /api/v1/datasets`**；展开知识库后 **`GET/POST/DELETE .../datasets/<id>/documents`**（上传需 `doc.upload`，删文档需 `doc.delete`）。ZIP 等导出若 REST 未对齐可暂用官方 `web/`。侧栏与权限见 **`docs/TBOX_UI_DESIGN_DETAIL.md`**。
5. **对话**：**`/`** 使用 **`POST /api/v1/chat/completions`**（流式）。可选 **应用**（`GET /api/v1/chats`）、**会话列表/详情**（`GET .../chats/:id/sessions`、`GET .../sessions/:sid`）、**新建会话**（`POST .../sessions`）；选「仅模型」则不传 `chat_id`。侧栏展示 **`reference.chunks`**。需已配置可用 Chat 模型。
6. **检索**：**`/search`** 使用 **`POST /api/v1/datasets/<id>/search`**；**用户**：**`/users`** 使用 **`GET /api/v1/tenants/<当前用户 id>/users`**。
7. **审计**：**`/audit`** 使用 **`GET /api/v1/datasets/<id>/ingestions`**；**采集**：**`/crawl`** 需 **`crawl.manage`**；任务 CRUD 走 **`/v1/tbox/crawl/tasks`**，手动执行一次 tick 走 **`POST /v1/tbox/crawl/tasks/<id>/run`**（**`robots.txt` 预检** + 探测 + 已绑定 **`dataset_id`** 时 **`static_web`/`rss`** 入库；**`tbox_skip_robots_check`** 等见 **`docs/TBOX_API_BOUNDARY.md`** §1.2–1.3；**`/me`** 契约 **v4+**）。

### 3.2 采集 Worker（可选，骨架）

独立进程轮询 **`run_state=ready`** 且 **`enabled`** 的任务并更新 **`last_run_at`**（与 **`POST .../run`** 相同：默认轻量 HTTP 种子探测，可调 **`TBOX_CRAWL_FETCH_PROBE_MAX`**、**`TBOX_CRAWL_MIN_ORIGIN_INTERVAL`** / **`TBOX_CRAWL_MAX_CRAWL_DELAY_SEC`**（**Crawl-delay** 节流）等，见 **`docs/TBOX_API_BOUNDARY.md`** §1.3）。仓库根执行：

```bash
export PYTHONPATH=$(pwd)
python rag/svr/tbox_crawl_worker.py
```

Docker：在 **`docker/.env`** 中设置 **`ENABLE_TBOX_CRAWL_WORKER=1`**，或在 **`docker/entrypoint.sh`** 的 command 中增加 **`--enable-tbox-crawl-worker`**。详见 **`docs/TBOX_API_BOUNDARY.md`** §1.3。

## 4. 与官方 `web/` 的关系

- **`web/`**：RAGFlow 自带前端（Vite），继续用于对照上游行为。
- **`web-tbox/`**：TBOX 产品 UI 基座，**仅**依赖 HTTP API，便于与上游解耦与独立发版（见 `docs/TBOX_KB_DELIVERY_HARNESS.md` §9）。

## 5. 更多

- 环境与版本：`docs/TBOX_ENV_AND_VERSIONS.md`
- API 边界：`docs/TBOX_API_BOUNDARY.md`
- 总纲：`docs/TBOX_KB_DELIVERY_HARNESS.md`
- UI 概要/详细设计：`docs/TBOX_UI_DESIGN_OVERVIEW.md`、`docs/TBOX_UI_DESIGN_DETAIL.md`（参考原型：`tbox-ragflow-platform/others/apps/web/`，见总纲 §2.1）

## 6. PR 前自检（与 `ubuntu-latest` 轻量 CI 对齐）

Workflow 名称、路径触发与职责见 **`docs/TBOX_ENV_AND_VERSIONS.md` §6**。在仓库根且已安装依赖时，可按下述命令本地对号（与对应 GitHub Actions job 等价；**`uv`** 请先执行 **`uv sync --python 3.12 --group test --frozen`**）：

```bash
# 独立前端（与 .github/workflows/web-tbox.yml 一致）
(cd web-tbox && npm ci && npm run typecheck && npm run build)

# Harness + 对抗离线用例（与 harness-monitor-unit.yml 一致）
uv run pytest test/test_harness_monitor.py test/adversarial_tests.py -v --tb=short

# TBOX 爬取 common 单测（与 tbox-crawl-common-unit.yml 一致）
uv run pytest \
  test/unit_test/common/test_tbox_crawl_ssrf_fetch.py \
  test/unit_test/common/test_tbox_crawl_last_error.py \
  test/unit_test/common/test_tbox_crawl_origin_throttle.py \
  test/unit_test/common/test_tbox_crawl_robots.py \
  test/unit_test/common/test_tbox_crawl_http_probe.py \
  test/unit_test/common/test_ssrf_guard.py \
  -v --tb=short

# tbox_crawl_task_service 纯逻辑（与 tbox-task-service-unit.yml 一致）
uv run pytest test/unit_test/api/db/services/test_tbox_crawl_task_service.py -v --tb=short

# tbox_crawl_worker 冒烟（与 tbox-crawl-worker-unit.yml 一致）
uv run pytest test/unit_test/rag/svr/test_tbox_crawl_worker.py -v --tb=short

# tbox_app 隔离路由（/health、/contract、/me、/logout；mock crawl_svc：crawl 任务 CRUD + POST …/run 含错误分支；与 tbox-app-routes-unit.yml 一致）
uv run pytest test/unit_test/api/apps/tbox_app_isolated -v --tb=short
```

**说明**：重型 **`harness_engineering`**（对抗 + Docker 等）**不**随 PR 触发，见 **`docs/TBOX_KB_DELIVERY_HARNESS.md`** §7.3；发版前仍按该 workflow 或运维流程执行。
