# TBOX 知识库：快速启动（开发联调）

目标：在一台机器上同时跑 **RAGFlow 后端** 与 **TBOX 独立前端（web-tbox）**，并打通到 **`/v1/tbox/*`** 与既有 API。

**完整部署与验收路径（Docker / 本机 Python / Nginx / 冒烟清单）**见 **[`TBOX_DEPLOY_RUNBOOK.md`](./TBOX_DEPLOY_RUNBOOK.md)**。
**在新服务器上从 GitHub 克隆并一键部署**见 **[`TBOX_DEPLOY_FROM_GITHUB.md`](./TBOX_DEPLOY_FROM_GITHUB.md)**（推荐 `bash scripts/deploy-on-new-server.sh`）。
**部署后的使用说明、菜单与权限**见 **[`TBOX_SYSTEM_USER_MANUAL.md`](./TBOX_SYSTEM_USER_MANUAL.md)**；**按界面逐步验收**见 **[`TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`](./TBOX_UI_ACCEPTANCE_WALKTHROUGH.md)**。

### 本机准生产路径（VM）

| 目录 | 用途 |
|------|------|
| `~/ragflow` | 开发、改代码、push |
| **`/srv/tbox/ragflow`** | **正式运行**（Docker data-root 同在 `/data/docker`） |

```bash
cd /srv/tbox/ragflow   # 或 ~/ragflow 联调
bash scripts/start-tbox-ragflow.sh --console
bash scripts/tbox_vm_production_acceptance.sh
```

验收清单：**[`TBOX_VM_PRODUCTION_ACCEPTANCE.md`](./TBOX_VM_PRODUCTION_ACCEPTANCE.md)**（5180 + 内网双账号 + Walkthrough）。

## 1. 前置

- 已按官方文档启动依赖（MySQL、ES/Infinity、Redis、MinIO 等），或直接使用 **`docker compose`** 起全栈（见仓库 `docker/README.md`）。
- Node **>= 18.20.4**（推荐 20）、npm 或 pnpm。

### 1.1 Docker 全栈冷启动（S5 checklist）

在**第三方新机器**上从零部署 TBOX（Harness §9.1 **S5**），推荐路径：

```bash
cd <REPO>/docker
cp .env.example .env    # 对照模板修改变量（见 docker/README.md「S5 冷启动 checklist」）
cd <REPO>
bash docker/tbox-compose-up.sh
# 含生产 web-tbox：TBOX_CONSOLE=1 bash docker/tbox-compose-up.sh
```

**`.env` 关键项**（完整表见 **`docker/.env.example`** 注释）：

| 变量 | TBOX 说明 |
|------|-----------|
| `RAGFLOW_IMAGE=ragflow-tbox:local` | 须含本仓库 `tbox_app.py`；`tbox-compose-up.sh` 默认本地构建 |
| `DOC_ENGINE` / `DEVICE` | 与 `COMPOSE_PROFILES` 一致（默认 elasticsearch + cpu） |
| `SVR_HTTP_PORT` | 默认 **9380** |
| `ENABLE_TBOX_CRAWL_WORKER=1` | 需要 **`/crawl`** 定时入库时启用 |
| `TBOX_CONSOLE=1` | 生产 **`web-tbox`** 于 **5180**（Nginx 静态 + API 反代） |

**amd64**：目标平台 **linux/amd64**。显式构建：`docker build --platform linux/amd64 -f Dockerfile -t ragflow-tbox:local .`；验证：`docker inspect ragflow-tbox:local --format '{{.Architecture}}'`。

**验收**：`curl -sf http://127.0.0.1:9380/v1/tbox/health`；可选 `bash scripts/tbox_release_smoke.sh`（或 `TBOX_SMOKE_RUNNER=docker` 在容器内跑 G1/G3，绕过宿主机 `uv sync`）。详 **[`TBOX_DEPLOY_RUNBOOK.md`](./TBOX_DEPLOY_RUNBOOK.md)** §3.1–3.4。

### 1.2 S6 上游 merge 后（必做）

合并 `origin/main` 后须 **重建 API 镜像**（容器内代码不会自动更新）：

```bash
# 一键：重建 + typecheck/build + release smoke
bash scripts/tbox_post_upstream_merge.sh
# 国内网络可加：TBOX_CHINA_DOWNLOAD=1
# 镜像已重建仅验 smoke：TBOX_SKIP_BUILD=1 bash scripts/tbox_post_upstream_merge.sh
```

| 项 | 说明 |
|----|------|
| Python | merge 后 **`>=3.13`**（`pyproject.toml`）；宿主机 `uv sync` 若 GitHub spacy 超时，用 **`TBOX_SMOKE_RUNNER=docker`** |
| 记录 | [`TBOX_UPSTREAM_MERGE_RUNBOOK.md`](./TBOX_UPSTREAM_MERGE_RUNBOOK.md) §4 |
| 差异 | `bash scripts/tbox_upstream_divergence.sh --fetch` |

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

### 3.2 DeepSeek 手测（G3-MODEL-DEEPSEEK）

1. 登录 **`web-tbox`**，打开 **`/kb`**，选择已有知识库（或先在 **`/documents`** 新建）。
2. 在 **供应商 API Key** 区域配置 **DeepSeek**（`POST /v1/llm/set_api_key`）；在 **空间默认模型** 或表单 **Chat 模型** 中选择 `…@DeepSeek`（见 **`/v1/llm/list`** 与预设下拉）。
3. 打开 **`/apps`** 新建或编辑对话应用（可用 **咨询/决策/辅导** 模板），绑定该知识库并选 DeepSeek 模型；或于 **`/`** 选该应用 / 「仅模型」。
4. 发送一条测试问题；**通过**：流式回复正常，无「响应不是有效 JSON」；`curl -sf http://127.0.0.1:9380/v1/tbox/health` 返回 `code:0`。

### 3.3 P1 能力速查（矩阵阶段 2）

| 能力 | 路径 | 说明 |
|------|------|------|
| 对话/检索导出 MD/PDF | **`/`**、**`/search`** | 「导出 Markdown / 导出 PDF…」 |
| Word / Excel / PPT | **`/`** Word+PPT；**`/search`** Excel+PPT | `exportOffice.ts` |
| 场景模板 | **`/apps`** | 「从模板：咨询/决策/辅导」 |
| 爬取策略 + worker | **`/crawl`** | 关键词/深度/域名 → `extra_config` |
| 多格式入库手测 | — | **`TBOX_INGEST_FORMAT_SMOKE.md`** |

提交或发版前建议在 `web-tbox/` 下执行 **`npm run typecheck`** 与 **`npm run build`**。

### 3.0 没有邮箱/密码（首次账号）

`web-tbox` 的 **`/login`** 只做**已有账号**的密码登录，不提供自助注册；账号来自 **RAGFlow 用户库**。

**做法一（推荐）：初始化内置超级用户**

RAGFlow 在 **`api/db/init_data.py`** 里定义了默认超级用户（可用环境变量覆盖）：

| 变量 | 未设置时的默认值 |
|------|------------------|
| `DEFAULT_SUPERUSER_EMAIL` | **`admin@ragflow.io`** |
| `DEFAULT_SUPERUSER_PASSWORD` | **`admin`** |
| `DEFAULT_SUPERUSER_NICKNAME` | **`admin`** |

在 **`docker/docker-compose.yml`** 里为 **`ragflow-cpu` / `ragflow-gpu`** 的 **`command`** 增加一项 **`--init-superuser`**（与现有 **`--enable-adminserver`** 并列），例如：

```yaml
command:
  - --enable-adminserver
  - --init-superuser
```

保存后 **`docker compose … up -d` 重建/重启** RAGFlow 容器一次；若该邮箱已存在则不会重复创建。之后用 **`admin@ragflow.io` / `admin`** 在 **`web-tbox`** 登录（登录后请尽快改密）。

**注意（旧镜像）**：部分 **`infiniflow/ragflow:v0.24.x`** 在 **`--init-superuser`** 创建用户后，会因默认 Chat 模型未配置而在初始化阶段抛错，导致 **`ragflow_server` 起不来**；此时应**去掉** compose 里的 **`--init-superuser`** 并重建容器（用户已在库里则无需再 init）。另：仅 **很旧的官方 stock 镜像（如 v0.24.x）** 登录为 **`POST /v1/user/login`**，才在 **`web-tbox/.env`** 设置 **`VITE_AUTH_LOGIN_PATH=/v1/user/login`**。本仓库 **`ragflow-tbox:local`** 与当前 Quart 后端用默认 **`POST /api/v1/auth/login`**，**不要**设置旧路径，否则会出现 **`Not Found: /v1/user/login`**。

**做法二：开放注册**

若 **`docker/.env`** 中 **`REGISTER_ENABLED=1`**（默认常见为 1），可通过 **官方 `web/`** 或调用 **`POST /api/v1/users`** 注册新用户（需满足邮箱格式等校验），再用该邮箱登录 **`web-tbox`**。

### 3.1 登录与鉴权接口

1. 浏览器访问 **`/login`**，使用与 RAGFlow 相同的**邮箱 + 密码**。前端会调用登录接口（默认 **`POST /api/v1/auth/login`**；旧镜像见 **§3.0** 中的 **`VITE_AUTH_LOGIN_PATH`**），密码使用与官方 `web/` 相同的 **RSA 公钥**加密后再提交。修改 **`web-tbox/.env` 后须重启 `npm run dev`** 才会生效。

若提示 **`Email and password do not match!`** 且确认密码为 **`admin`**：多为库里 **同名邮箱多行**（`.first()` 命中错误行）。在仓库根执行 **`./scripts/tbox-dedupe-admin-email.sh`**（需 **`docker-mysql-1`** 与 **`docker/.env` 中 `MYSQL_PASSWORD`**），或自行在 **`user`** 表只保留一条 **`admin@ragflow.io`**。
2. 登录成功后，响应头 **`Authorization`** 与 JSON 中的 **`access_token`** 会写入 `localStorage`（键名与官方 `web/` 一致：`Authorization`、`token`、`userInfo`）。
3. 主壳加载时请求 **`GET /v1/tbox/me`**（含 **`permissions`**）并带上 `Authorization`；**`POST /v1/tbox/logout`** 可退出并使 token 失效（与 `POST /api/v1/auth/logout` 语义对齐）。
4. 知识库与文档：**`/documents`**（**`/kbs`** 重定向至此）— **`GET/DELETE /api/v1/datasets`**；**新建空库**为 **`POST /api/v1/datasets`**（需 **`doc.upload` 或 `kb.configure`**）；展开知识库后 **`GET/POST/DELETE .../datasets/<id>/documents`**（上传需 `doc.upload`，删文档需 `doc.delete`；**删整库**需 **`kb.dangerous`**）。**`/kb`**（`kb.configure`）— 单库 **`GET/PUT /api/v1/datasets/<id>`**；删整库同样需 **`kb.dangerous`**。ZIP 等导出若 REST 未对齐可暂用官方 `web/`。侧栏与权限见 **`docs/TBOX_UI_DESIGN_DETAIL.md`**。
5. **对话**：**`/`** 使用 **`POST /api/v1/chat/completions`**（流式）。可选 **应用**（`GET /api/v1/chats`）、**会话列表/详情**（`GET .../chats/:id/sessions`、`GET .../sessions/:sid`）、**新建会话**（`POST .../sessions`）；选「仅模型」则不传 `chat_id`。侧栏展示 **`reference.chunks`**。需已配置可用 Chat 模型。
6. **对话应用**：**`/apps`**（需 **`kb.configure`**）— 在本系统内 **新建/编辑** 对话应用（`POST/PUT /api/v1/chats`），绑定知识库与 Prompt；保存后在 **`/`** 应用下拉中选用，完成「建库 → 建应用 → RAG 对话」闭环。
7. **检索**：**`/search`** 使用 **`POST /api/v1/datasets/<id>/search`**；**用户**：**`/users`** 使用 **`GET /api/v1/tenants/<当前用户 id>/users`**。
8. **审计**：**`/audit`** 使用 **`GET /api/v1/datasets/<id>/ingestions`**；**采集**：**`/crawl`** 需 **`crawl.manage`**；任务 CRUD 走 **`/v1/tbox/crawl/tasks`**，手动执行一次 tick 走 **`POST /v1/tbox/crawl/tasks/<id>/run`**（**`robots.txt` 预检** + 探测 + 已绑定 **`dataset_id`** 时 **`static_web`/`rss`** 入库；**`tbox_skip_robots_check`** 等见 **`docs/TBOX_API_BOUNDARY.md`** §1.2–1.3；**`/me`** 契约 **v4+**）。

### 3.4 采集 Worker（可选）

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

- 使用说明书（功能、权限、FAQ）：**[`TBOX_SYSTEM_USER_MANUAL.md`](./TBOX_SYSTEM_USER_MANUAL.md)**
- 环境与版本：`docs/TBOX_ENV_AND_VERSIONS.md`
- API 边界：`docs/TBOX_API_BOUNDARY.md`
- 总纲：`docs/TBOX_KB_DELIVERY_HARNESS.md`
- **能力矩阵（G1–G5）**：`docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md`
- **下一阶段开发计划**：`docs/superpowers/plans/2026-05-24-tbox-next-phase.md`
- **P2 阶段计划（Office 导出等）**：`docs/superpowers/plans/2026-05-24-tbox-phase3-plan.md`
- **Phase 4（G1 闭环 + S5 Docker）**：`docs/superpowers/plans/2026-05-24-tbox-phase4-plan.md`
- **Phase 5（G3 DeepSeek + S6/S7）**：`docs/superpowers/plans/2026-05-24-tbox-phase5-plan.md`
- **Phase 6（发版冒烟 + S0 基线）**：`docs/superpowers/plans/2026-05-24-tbox-phase6-plan.md`
- **Phase 7（S7 + 部署闭环）**：`docs/superpowers/plans/2026-05-24-tbox-phase7-plan.md`
- **Phase 8（S6 差异快照）**：`docs/superpowers/plans/2026-05-24-tbox-phase8-plan.md`
- **S6 上游合并**：`docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md`
- **S7 对抗冒烟记录**：`docs/TBOX_S7_ADVERSARIAL_SMOKE.md`
- **G1 多格式入库手测清单**：`docs/TBOX_INGEST_FORMAT_SMOKE.md`
- **G3 DeepSeek 冒烟**：`docs/TBOX_DEEPSEEK_SMOKE.md`
- UI 概要/详细设计：`docs/TBOX_UI_DESIGN_OVERVIEW.md`、`docs/TBOX_UI_DESIGN_DETAIL.md`（参考原型：`tbox-ragflow-platform/others/apps/web/`，见总纲 §2.1）
- 二期能力备忘：`docs/TBOX_PHASE2_PAGE_REQUIREMENTS_MEMO.md`

## 6. PR 前自检（与 `ubuntu-latest` 轻量 CI 对齐）

Workflow 名称、路径触发与职责见 **`docs/TBOX_ENV_AND_VERSIONS.md` §6**。在仓库根且已安装依赖时，可按下述命令本地对号（与对应 GitHub Actions job 等价；**`uv`** 请先执行 **`uv sync --python 3.12 --group test --frozen`**）：

```bash
# 独立前端（与 .github/workflows/web-tbox.yml 一致）
(cd web-tbox && npm ci && npm run typecheck && npm run build)

# Harness + 对抗离线用例（与 harness-monitor-unit.yml 一致）
uv run pytest test/test_harness_monitor.py test/adversarial_tests.py -v --tb=short

# TBOX 爬取 common 单测（与 tbox-python-unit.yml 中 crawl_common 矩阵格一致）
uv run pytest \
  test/unit_test/common/test_tbox_crawl_ssrf_fetch.py \
  test/unit_test/common/test_tbox_crawl_last_error.py \
  test/unit_test/common/test_tbox_crawl_origin_throttle.py \
  test/unit_test/common/test_tbox_crawl_robots.py \
  test/unit_test/common/test_tbox_crawl_http_probe.py \
  test/unit_test/common/test_ssrf_guard.py \
  -v --tb=short

# tbox_crawl_task_service 纯逻辑（与 tbox-python-unit.yml 中 task_service 矩阵格一致）
uv run pytest test/unit_test/api/db/services/test_tbox_crawl_task_service.py -v --tb=short

# tbox_crawl_worker 冒烟（与 tbox-python-unit.yml 中 crawl_worker 矩阵格一致）
uv run pytest test/unit_test/rag/svr/test_tbox_crawl_worker.py -v --tb=short

# tbox_app 隔离路由（/health、/contract、/me、/logout；mock crawl_svc：crawl 任务 CRUD + POST …/run 含错误分支；与 tbox-python-unit.yml 中 app_routes 矩阵格一致）
# 目录缩小收集范围；`-m tbox_app_isolated` 与包内 conftest 打标一致，缺标会 0 用例失败。
uv run pytest test/unit_test/api/apps/tbox_app_isolated -m tbox_app_isolated -v --tb=short

# 仅 crawl 相关用例（子 marker：`tbox_app_crawl`，在 `conftest.py` 按文件名自动附加）
uv run pytest test/unit_test/api/apps/tbox_app_isolated -m "tbox_app_isolated and tbox_app_crawl" -v --tb=short

# G1 / G3 API 冒烟（需 Docker 栈 @ 9380）
uv run python3 scripts/tbox_g1_ingest_format_smoke.py
uv run python3 scripts/tbox_g3_deepseek_smoke.py
bash scripts/tbox_release_smoke.sh

# 发版前对抗（S7，非 PR 门禁 — 见 Harness §7.6）
# export RAGFLOW_ADVERSARIAL_TESTS=1
# uv run pytest test/adversarial_tests.py -v --tb=short
```

**说明**：重型 **`harness_engineering`**（对抗 + Docker 等）**不**随 PR 触发，见 **`docs/TBOX_KB_DELIVERY_HARNESS.md`** §7.3；发版前仍按该 workflow 或运维流程执行。
