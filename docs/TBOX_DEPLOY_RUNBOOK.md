# TBOX 前后端部署与联调操作手册

本文说明如何在本机或服务器上**跑通 RAGFlow 后端（含 `/v1/tbox/*`）**与 **TBOX 独立前端 `web-tbox/`**，便于你对照预期逐项验收。

**终端用户与管理员「部署完成后怎么用」**：**[`TBOX_SYSTEM_USER_MANUAL.md`](./TBOX_SYSTEM_USER_MANUAL.md)**。
更细的接口与权限说明见：**[`TBOX_QUICKSTART.md`](./TBOX_QUICKSTART.md)**、**[`TBOX_API_BOUNDARY.md`](./TBOX_API_BOUNDARY.md)**、**[`TBOX_ENV_AND_VERSIONS.md`](./TBOX_ENV_AND_VERSIONS.md)**。
**从 GitHub 克隆并在其他 Linux 服务器部署**（私库、构建、可选 Actions）：**[`TBOX_DEPLOY_FROM_GITHUB.md`](./TBOX_DEPLOY_FROM_GITHUB.md)**。

---

## 1. 必须先弄清的前提

### 1.1 TBOX 路由来自本仓库代码，不是「任意官方镜像」自带的

- `api/apps/tbox_app.py` 会被 **`api/apps/__init__.py`** 按约定自动注册为前缀 **`/v1/tbox`**（与 `api/constants.py` 中的 `API_VERSION = "v1"` 一致）。
- **若容器里跑的是不含该文件的旧镜像**，则 **`curl …/v1/tbox/health` 会 404**，`web-tbox` 登录后主壳拉 **`/v1/tbox/me`** 也会失败。

**推荐做法（二选一）：**

1. **用本仓库构建的镜像**（含当前 TBOX 改动），在 `docker/.env` 里把 `RAGFLOW_IMAGE` 指到该镜像（见 §4.4）。
2. **本机用源码跑 API**（依赖仍可用 Docker 起），保证 `PYTHONPATH` 指向本仓库根目录（见 §5）。

### 1.2 环境与端口（默认值可按 `docker/.env` 调整）

| 组件 | 典型宿主端口 | 说明 |
|------|----------------|------|
| RAGFlow HTTP API | **9380** | `SVR_HTTP_PORT`，`web-tbox` 默认代理目标 |
| MySQL | **5455** | `EXPOSE_MYSQL_PORT` |
| Elasticsearch | **1200** | `ES_PORT`（使用 `elasticsearch` profile 时） |
| Infinity | 见 `.env` | 使用 `infinity` profile 时 |
| Redis / MinIO | 见 `docker/README.md` | |
| `web-tbox` 开发服务器 | **5174** | `web-tbox` 内 `npm run dev` |

### 1.3 一期交付范围（便于验收、培训与排障）

以下描述 **`web-tbox` + 本仓库 RAGFlow/TBOX 后端** 在**当前一期**已打通的能力（页面保持产品壳层，逻辑以接口为准）：

| 能力域 | 说明 |
|--------|------|
| **登录与主壳** | RSA + **`POST /api/v1/auth/login`**；主壳 **`GET /v1/tbox/me`**（含 **`permissions`**）；**`POST /v1/tbox/logout`** 退出。 |
| **对话 / 检索** | **`/`** 流式 **`POST /api/v1/chat/completions`**（含引用侧栏）；**`/search`** 数据集内检索。 |
| **对话应用** | **`/apps`**（**`kb.configure`**）：**`GET/POST/PUT/DELETE /api/v1/chats`**；列表、新建、编辑（绑定知识库、Prompt、检索与高级配置）。 |
| **文档与知识库** | **`/documents`**（**`/kbs`** 重定向）：官方 **`GET/DELETE /api/v1/datasets`** 与 **`…/datasets/<id>/documents`**；删文档需 **`doc.delete`**；**删整库**需 **`kb.dangerous`**。 |
| **知识库配置** | **`/kb`**（**`kb.configure`**）：单库 **`GET/PUT /api/v1/datasets/<id>`**（名称、描述、嵌入模型、分块、`permission`、`parser_config` 等）；删整库同需 **`kb.dangerous`**。 |
| **审计** | **`/audit`**（**`audit.read`**）：**`GET /api/v1/datasets/<id>/ingestions`**（`log_type=dataset|file`）。 |
| **采集** | **`/crawl`**（**`crawl.manage`**）：**`/v1/tbox/crawl/tasks`** CRUD 与 **`POST …/tasks/<id>/run`**；可选独立 **采集 Worker**（见 §3.5、**`TBOX_QUICKSTART.md`**）。 |
| **用户与角色** | **`/users`**：空间成员与 **托管用户**（**`/v1/tbox/workspaces/<tenant_id>/managed-users`** 等，需本仓库 API）。 |
| **评审与验收** | **`/review`**、**`/review/step/:id`**：与业务页右下角「本页验收」共用存储；开发默认开启，**生产构建**见 §6.1。 |

**逐步操作验收**（含权限与「怎么算通过」）：**[`TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`](./TBOX_UI_ACCEPTANCE_WALKTHROUGH.md)**。
**接口契约与版本号**：**[`TBOX_API_BOUNDARY.md`](./TBOX_API_BOUNDARY.md)**；前端期望版本见 **`web-tbox/src/constants/tboxContract.ts`** 与后端 **`api/apps/tbox_app.py`** 中 **`TBOX_API_CONTRACT_VERSION`**（需一致）。

**尚未作为一期必交付**（易误判为故障）：对话/检索结果 **多格式文件导出**、文档 **重解析/版本/ZIP**（视官方 REST 与排期）、审计 **高级筛选** 等 → **[`TBOX_PHASE2_PAGE_REQUIREMENTS_MEMO.md`](./TBOX_PHASE2_PAGE_REQUIREMENTS_MEMO.md)**。

---

## 2. 部署形态总览

| 形态 | 后端 | 前端 | 适用 |
|------|------|------|------|
| **开发联调** | Docker 全栈或「依赖 Docker + 本机 Python」 | `web-tbox`：`npm run dev`（Vite 代理 `/api`、`/v1`） | 日常开发与对照预期 |
| **生产同源** | 同一域名下 Nginx 反代到 9380 | Nginx `root` 指向 `web-tbox/dist`，`location` 反代 `/api`、`/v1` | 避免浏览器跨域，见 §8 |
| **生产跨域** | 独立 API 域名 | 静态站 + 配置 CORS 或网关统一入口 | 需额外网关/CORS 策略 |

---

## 3. 后端：Docker Compose 全栈（路径 A）

在仓库根目录 **`/path/to/ragflow`** 下操作（下文 `<REPO>` 表示该路径）。

### 3.1 准备 `docker/.env`

```bash
cd <REPO>/docker
```

- **模板文件**：**`<REPO>/docker/.env.example`**（与 **`docker/README.md`** 中变量说明一致；含 TBOX 可选变量注释）。多数场景下用它生成本地 **`docker/.env`** 即可。
- **为何克隆后没有 `.env`**：根目录 **`.gitignore`** 包含 **`.env`**，若团队**从未**对 `docker/.env` 执行 `git add -f`，则该文件**不会**出现在远程仓库里，克隆后需自行生成。若你使用的 fork **已跟踪** `docker/.env`，克隆后会有该文件，仍建议对照 **`.env.example`** 检查并**改掉默认密码**后再用于生产。
- **生成本地 `docker/.env`（不覆盖已有文件时）**：

```bash
cd <REPO>/docker
test ! -f .env && cp .env.example .env && echo "created .env from .env.example"
# 若需强制用模板覆盖本地： cp -f .env.example .env
```

- 生成后按需修改 **`MYSQL_PASSWORD`、`REDIS_PASSWORD`、`MINIO_*`、`SVR_HTTP_PORT=9380`**、**`DOC_ENGINE`** / **`RAGFLOW_IMAGE`** 等。

### 3.1.1 一键拉起（联调推荐）

**必须在含 `docker/` 与 `Dockerfile` 的仓库根目录执行**（路径 `docker/tbox-compose-up.sh` 是相对当前 shell 工作目录的）。若出现 **`No such file or directory`**：先 **`cd <REPO>`**（克隆下来的 **`ragflow`** 根），或改用 **`bash /绝对路径/ragflow/docker/tbox-compose-up.sh`**。

```bash
cd <REPO>   # 例如 cd ~/ragflow  或  cd /path/to/ragflow
bash docker/tbox-compose-up.sh
# 等价：在仓库根执行  bash scripts/tbox-up.sh（内部会调用上述脚本）
# 或一键（可选同时起 web-tbox）：
#   ./scripts/start-tbox-ragflow.sh
#   ./scripts/start-tbox-ragflow.sh --web
```

脚本会按 **`docker/.env`** 中的 **`DOC_ENGINE`**、**`DEVICE`** 依次 **`docker compose up -d --pull missing`**（仅缺少本地镜像时才向 Hub 拉取；离线或 Hub 不稳定时可 **`export TBOX_COMPOSE_PULL=never`** 并确保 **`RAGFLOW_IMAGE` / `MINIO_IMAGE` 等标签本机已存在**），然后探测 **`http://127.0.0.1:${SVR_HTTP_PORT:-9380}/api/v1/auth/login/channels`**（纯 Python 服务；Go 混合部署时可能为 **`/v1/user/login/channels`**）与 **`/v1/tbox/health`**。

可选 **`TBOX_CONSOLE=1`**：同时启用 Compose profile **`tbox-console`**，构建并启动带 **`web-tbox` 生产静态资源** 的 Nginx 容器（默认 **`http://127.0.0.1:${TBOX_CONSOLE_PORT:-5180}/`**）。若 **`SVR_HTTP_PORT` 不是 9380**，请在 **`docker/.env`** 中设置 **`TBOX_CONSOLE_RAGFLOW_UPSTREAM=host.docker.internal:<端口>`**，与主 RAGFlow 映射一致。

### 3.1.2 将 Docker 构建依赖拉到本机（`Dockerfile.deps` / 主 `Dockerfile`）

根目录 **`download_deps.py`** 会把 Hugging Face 模型、NLTK、Tika、Chrome 等文件下载到仓库根目录（含 **`huggingface.co/`**），再执行：

```bash
cd <REPO>
bash scripts/pull-local-deps-for-docker.sh
# 国内网络可选:  bash scripts/pull-local-deps-for-docker.sh --china-mirrors
```

脚本末尾会 **`docker build -f Dockerfile.deps -t infiniflow/ragflow_deps:latest .`**。之后在本机构建主镜像时，**`Dockerfile`** 通过 **`--mount=from=infiniflow/ragflow_deps:latest`** 拷贝上述资源到镜像内的 **`/ragflow/rag/res/deepdoc`** 等路径，**无需在构建主镜像时再访问 Hugging Face**。换机离线部署时：携带含已下载文件的仓库目录与已 **`docker save`** 的 **`infiniflow/ragflow_deps:latest` / 自建 RAGFlow 镜像 / `ragflow-tbox-console:local`**，目标机 **`docker load`** 后设置 **`TBOX_COMPOSE_PULL=never`** 再起 Compose。

### 3.1.3 启动脚本与 5180 / pre_release 提示（Phase 42）

三脚本在栈就绪后共用 **`scripts/tbox_print_release_next_steps.sh`**，打印 **5180 console + smoke env + pre_release + VM 验收 + Phase 16–17 归档** 链；详见 **§8.1**。

| 脚本 | 典型场景 | 何时打印 pre_release 链 |
|------|----------|---------------------------|
| **`scripts/tbox-up.sh`** | 仓库根一键 **`docker/tbox-compose-up.sh`** | 环境变量 **`TBOX_CONSOLE=1`** 时 |
| **`scripts/start-tbox-ragflow.sh`** | Docker + 可选 **`--web` / `--console`** | **`--console`** 或 **`TBOX_CONSOLE=1`** 时 |
| **`scripts/deploy-on-new-server.sh`** | 新服务器克隆 + 构建 + 部署 | 部署成功后（含 **`--with-compose-hint`**：`TBOX_CONSOLE=1 bash docker/tbox-compose-up.sh`） |

手动查看：

```bash
bash scripts/tbox_print_release_next_steps.sh
bash scripts/tbox_print_release_next_steps.sh --with-compose-hint
```

### 3.2 启动依赖（`docker-compose-base.yml`）

按你在 `.env` 里选的**文档引擎**启动对应 profile（**不要**同时起冲突的引擎，以团队约定为准）。

**Elasticsearch 示例：**

```bash
cd <REPO>/docker
docker compose -f docker-compose-base.yml --profile elasticsearch up -d
```

**Infinity 示例：**

```bash
docker compose -f docker-compose-base.yml --profile infinity up -d
```

无 profile 的服务（如 **mysql、redis、minio**）会随上述命令一并拉起（见 `docker-compose-base.yml`）。

等待 **mysql** 等服务 **healthy** 后再起 RAGFlow 主服务（与 `docker/docker-compose.yml` 中 `depends_on` 一致）。

### 3.3 启动 RAGFlow 主容器（`docker-compose.yml`）

**CPU：**

```bash
cd <REPO>/docker
docker compose -f docker-compose.yml --profile cpu up -d
```

**GPU（需本机 NVIDIA 环境与 nvidia-container-toolkit）：**

```bash
docker compose -f docker-compose.yml --profile gpu up -d
```

默认会把宿主 **`SVR_HTTP_PORT`（默认 9380）** 映射到容器内 API 端口。

### 3.4 确保镜像内含 TBOX 代码

- **若 `RAGFLOW_IMAGE` 为上游预构建镜像**，且该标签**未**包含你当前仓库里的 `api/apps/tbox_app.py` 等改动，则 **TBOX 接口不可用**。
- **建议**：在本仓库根目录构建镜像，例如：

```bash
cd <REPO>
docker build --platform linux/amd64 -f Dockerfile -t ragflow-tbox:local .
```

然后在 `docker/.env` 中设置：

```bash
RAGFLOW_IMAGE=ragflow-tbox:local
```

再执行 `docker compose -f docker-compose.yml … up -d` 使新镜像生效。

**Fork 补丁（如 `rag/app/picture.py` OCR 回退）**：`docker cp` 进运行容器**仅用于临时验证**；准生产/发版必须 **重建镜像**（`bash docker/tbox-compose-up.sh` 或 `bash scripts/deploy-on-new-server.sh`），否则容器重建后补丁丢失。

开发阶段也可用 **`docker-compose.yml` 里已有 volume** 挂载本仓库的 `entrypoint.sh` / `service_conf.yaml.template`；**是否挂载整份源码**取决于你的镜像入口与团队约定，不在此强制一种做法。

### 3.5（可选）TBOX 采集 Worker

采集任务 **`POST /v1/tbox/crawl/tasks/:id/run`** 可在无独立进程时由 API 侧触发一次 tick；**轮询队列式 worker** 为可选：

- **本机进程**：见 [`TBOX_QUICKSTART.md`](./TBOX_QUICKSTART.md) §3.2。
- **Docker**：在 `docker/.env` 中设置 **`ENABLE_TBOX_CRAWL_WORKER=1`**，或在 `docker/entrypoint.sh` 的启动参数中加入 **`--enable-tbox-crawl-worker`**（与 `entrypoint.sh` 内说明一致）。

---

## 4. 后端：依赖 Docker + 本机 Python（路径 B）

适合：**频繁改后端代码**、又不想每次重建镜像。

1. 按 §3.2 仅启动 **docker-compose-base.yml**（MySQL、Redis、MinIO、ES 或 Infinity 等）。
2. 在本机安装 Python 依赖（仓库推荐 **`uv sync`**，见根目录 `CLAUDE.md` / `AGENTS.md`）。
3. 在仓库根目录：

```bash
cd <REPO>
export PYTHONPATH=$(pwd)
# 按需加载 docker/.env 中的连接信息，使 service_conf 能连上容器内服务
bash docker/launch_backend_service.sh
```

确保监听地址与 **`web-tbox` 的 `VITE_RAGFLOW_API_ORIGIN`** 一致（默认 `http://127.0.0.1:9380`）。

---

## 5. 验证后端（建议逐条执行）

将 **`API`** 替换为你的 API 根地址（默认 `http://127.0.0.1:9380`）。

```bash
API=http://127.0.0.1:9380

# TBOX 健康与契约版本（应 JSON，含 tbox_api_contract_version、status）
curl -sS "$API/v1/tbox/health" | python3 -m json.tool
curl -sS "$API/v1/tbox/contract" | python3 -m json.tool
```

- 若此处 **404**：当前运行的进程/镜像**没有**加载 `tbox_app`（回到 §1.1、§3.4）。
- 若 **连接被拒绝**：依赖或主服务未起、或端口不是 9380。

**登录（需已有用户；密码为 RAGFlow 用户密码，具体注册/初始化以官方文档为准）：**

```bash
# 仅示意：真实登录由 web-tbox 使用 RSA；此处可用官方 web 或 API 文档完成注册后，再用浏览器测
```

带上登录后的 **`Authorization: Bearer <token>`** 再测：

```bash
curl -sS -H "Authorization: Bearer <你的token>" "$API/v1/tbox/me" | python3 -m json.tool
```

应返回用户信息及 **`permissions`**（契约 **v4+** 含 `crawl.manage` 等，见 `TBOX_API_BOUNDARY.md`）。

---

## 6. 前端：`web-tbox` 开发模式（推荐用于「看哪里不达预期」）

```bash
cd <REPO>/web-tbox
cp -n .env.example .env
# 若 API 不是本机 9380，编辑 .env：
#   VITE_RAGFLOW_API_ORIGIN=http://<API主机>:<端口>

npm install
npm run dev
```

浏览器打开：**http://127.0.0.1:5174**

- 开发模式下，**`/api` 与 `/v1` 由 Vite 代理**到 `VITE_RAGFLOW_API_ORIGIN`，浏览器无 CORS 问题。
- 登录页使用 **`POST /api/v1/auth/login`**；登录后主壳请求 **`GET /v1/tbox/me`**。

### 6.1 生产静态构建时的 `web-tbox/.env` 建议

| 变量 | 建议 | 说明 |
|------|------|------|
| **`VITE_RAGFLOW_API_ORIGIN`** | 指向浏览器可达的 API 根（生产多为**同源**下的网关前缀，由 Nginx 反代到 9380） | **`npm run build` 会打入产物**；改后须重新 **`npm run build`**。 |
| **`VITE_REVIEW_PAGES`** | 需要 **`/review`** 验收索引与确认页时设为 **`1`**；不需要则省略或 **`0`** | 见 **`web-tbox/.env.example`**；纯终端用户环境可关闭以隐藏评审入口。 |
| **`VITE_TBOX_OFFLINE_PERMISSIONS`** | **生产勿开启** | 仅无 TBOX 后端时的开发兜底。 |

发版前自检（与 CI 一致）：

```bash
cd <REPO>/web-tbox
npm run typecheck
npm run build
```

---

## 7. 前端：生产构建 + Nginx（路径示例）

### 7.1 构建静态文件

```bash
cd <REPO>/web-tbox
npm ci
npm run build
```

产物在 **`web-tbox/dist/`**。

### 7.2 Nginx 要点（与 `docker/nginx/ragflow.conf` 思路一致）

生产环境若页面与 API **同源**（推荐）：

- **`root`**：指向 **`web-tbox/dist`**（不是官方 `web/dist`，除非你故意用官方 UI）。
- **反代**：`location ~ ^/(v1|api)` → **`http://127.0.0.1:9380`**（或内网 API 地址）。

仓库示例片段（**需按实际域名、证书、`proxy.conf` 调整**）：

```nginx
location ~ ^/(v1|api) {
    proxy_pass http://127.0.0.1:9380;
    # include proxy.conf;
}
```

`docker/docker-compose.yml` 中挂载 **`./nginx/ragflow.conf`** 的示例行默认是注释掉的；启用前请把 **`root`** 改为 **`web-tbox` 构建产物** 或单独为 TBOX 增加 `server` 块。

**注意**：`npm run dev` 里的代理**仅在开发服务器生效**；`npm run build` 后的静态文件**不会**自动代理，必须靠 Nginx（或同效网关）。

### 7.3 使用 Compose 自带的 `tbox-console`（推荐「整栈 Docker + 可用 UI」）

仓库 **`docker/docker-compose.yml`** 中定义了服务 **`tbox-console`**（profile **`tbox-console`**）：镜像内 **`npm ci && npm run build`** 生成静态页，Nginx 将 **`/v1`**、**`/api`** 反代到 **`TBOX_CONSOLE_RAGFLOW_UPSTREAM`**（默认 **`host.docker.internal:9380`**，与宿主 **`SVR_HTTP_PORT`** 为 9380 时一致）。

```bash
cd <REPO>/docker
# 与 tbox-compose-up.sh 一致：在 .env 中 TBOX_CONSOLE=1，或手动：
docker compose -f docker-compose.yml --profile cpu --profile tbox-console up -d --build
```

根目录一键（等价于带上 **`TBOX_CONSOLE=1`** 调 **`docker/tbox-compose-up.sh`**）：

```bash
cd <REPO>
./scripts/start-tbox-ragflow.sh --console
```

**UI 变更后仅重建 5180 静态页**（Citation / 检索高亮等）：**[`TBOX_CONSOLE_REBUILD.md`](./TBOX_CONSOLE_REBUILD.md)** — `bash scripts/tbox_rebuild_console.sh`

---

## 8. 功能冒烟清单（对照「是否达到预期」）

在 **`web-tbox`** 已登录、且 **`/v1/tbox/me` 成功** 的前提下，按角色权限逐项点：

| 顺序 | 路由 | 依赖 | 说明 |
|------|------|------|------|
| 1 | `/login` | 用户账号 | RSA 登录；失败时看页面错误提示 |
| 2 | 主壳加载 | **`/v1/tbox/me`** | 侧栏菜单随 **`permissions`** 变化 |
| 3 | `/` | `chat.use`、已配置对话模型 | 流式对话、引用块 |
| 4 | `/search` | `search.use`、已有知识库 | 数据集内检索 |
| 5 | `/documents` | `doc.view`、`doc.upload`、`doc.delete`；删整库另需 **`kb.dangerous`** | 列表、分页、展开文档、上传/删文档、删整库（有权限时） |
| 6 | `/kb` | `kb.configure`（删库另需 `kb.dangerous`） | 单库 **GET/PUT** `datasets/:id`；见 `web-tbox/README.md` |
| 7 | `/audit` | `audit.read` | 入库/流水线日志 |
| 8 | `/crawl` | **`crawl.manage`**（契约 v4+） | 任务 CRUD、`POST …/run` |
| 9 | `/users` | 空间管理 / **`user.manage`** 等（与 **`/v1/tbox/me`** 及后端授权一致） | 成员列表、托管用户 CRUD（视账号） |
| 10 | **`/review`**（可选） | 构建时 **`VITE_REVIEW_PAGES=1`** | 页面确认索引、单步确认、导出 HTML / 打印 PDF |

**已知产品边界（易误判为「坏了」）**：ZIP 等与官方 `web/` 差异、文档 **重解析/版本** 等若 REST 未暴露则控制台暂无、采集全自动化依赖 **worker** 与任务配置——详见 **`TBOX_QUICKSTART.md`** 与 **`TBOX_API_BOUNDARY.md`**。

### 8.1 发版与验收脚本链（5180 准生产）

**前置**：Docker API **9380** + **`tbox-console` @ 5180** 已起（`bash scripts/start-tbox-ragflow.sh --console`）。Smoke 凭据见 **[`TBOX_SMOKE_ENV.md`](./TBOX_SMOKE_ENV.md)**（`bash scripts/tbox_setup_smoke_env.sh`）。

| 阶段 | 命令 | 说明 |
|------|------|------|
| **发版前（推荐）** | `bash scripts/tbox_pre_release.sh` | host check → suite + 钉扎 **`TBOX_VM_PRODUCTION_ACCEPTANCE.md` §5** |
| 模式矩阵 | `bash scripts/tbox_pre_release.sh --help` | `TBOX_PRE_RELEASE_VM` / `TBOX_SKIP_HOST_CHECK` / `TBOX_REQUIRE_DUAL_ACCOUNT` |
| 仅 API 冒烟 | `bash scripts/tbox_smoke_suite.sh` | bundle → login → release（不写 §5） |
| 完整 VM 7 步 | `bash scripts/tbox_vm_production_acceptance.sh` | 含 web-tbox check；或 **`TBOX_PRE_RELEASE_VM=1`** pre_release |
| S6 merge 后 | `bash scripts/tbox_post_upstream_merge.sh` | 重建 → host → pre_release VM+§5 |
| Phase 16–17 手测 | `bash scripts/tbox_phase16_17_handtest.sh` | 5180 Citation + `/search` 高亮（Walkthrough **步骤 C/D**） |
| 手测归档 §5 | `bash scripts/tbox_phase16_17_finish.sh --archive` | bundle 校验 + **`--confirm`** |

双账号准生产：`TBOX_REQUIRE_DUAL_ACCOUNT=1` + `scripts/tbox_smoke.env` 中 **`TBOX_SMOKE_NORMAL_*`**。脚本索引：**[`TBOX_SMOKE_SCRIPTS.md`](./TBOX_SMOKE_SCRIPTS.md)** · 准生产清单：**[`TBOX_VM_PRODUCTION_ACCEPTANCE.md`](./TBOX_VM_PRODUCTION_ACCEPTANCE.md)**。

---

## 9. 常见问题排查

| 现象 | 可能原因 | 建议 |
|------|-----------|------|
| **`bash: docker/tbox-compose-up.sh: No such file or directory`** | 当前 shell **不在**仓库根目录，相对路径 **`docker/...`** 找不到 | **`cd <REPO>`**（含 **`Dockerfile`** 与 **`docker/`** 的那一层）再执行；或 **`bash /绝对路径/ragflow/docker/tbox-compose-up.sh`**；仓库根下也可 **`bash scripts/tbox-up.sh`**。 |
| **`text_concat_xgb` / `updown_concat_xgb.model` / Network is unreachable** | 曾部分下载或离线，Hub 退回不完整本地目录 | 见下文 **§9.1**（删残缺目录 → 镜像或跳过；**`docker/.env`** 设 **`RAGFLOW_DISABLE_TEXT_CONCAT_XGB=1`**）。 |
| `/v1/tbox/health` 404 | 镜像/进程无 TBOX 代码 | §1.1、§3.4 |
| 前端「空响应体 / 不是 JSON」 | 反代把 `/api` 指错、或 502 HTML | 查 Nginx 与后端日志、直连 `curl` API |
| 登录 401 / CORS | 生产未同源反代、或 token 未带上 | §7.2；开发用 `npm run dev` |
| 采集无入库 | 未绑 `dataset_id`、被 robots 拦截、未起 worker | `TBOX_API_BOUNDARY.md` §1.2–1.3 |
| DB 报错缺表 | 模型与库版本不一致 | 确认使用**同一分支**镜像/代码并查看迁移/初始化说明 |
| Compose 拉镜像失败、`registry-1.docker.io` 443 超时 | 访问 Docker Hub 不稳定 | 见 **§11** |
| **`/kb` 保存失败**（提示 chunk / embedding） | 库内已有分块时后端禁止更换嵌入模型等 | 见官方数据集更新规则；或新建空库再改配置。 |
| **侧栏缺少「知识库配置 / 采集」等** | 当前账号 **`permissions`** 不含对应键 | 由管理员在 **`/users`** 或 RAGFlow 侧调整角色/托管权限（见 **`TBOX_UI_DESIGN_DETAIL.md`**）。 |

### 9.1 `InfiniFlow/text_concat_xgb_v1.0` 不完整 / `Network is unreachable`

构建或执行 **`download_deps.py`** 时会拉取 **`InfiniFlow/text_concat_xgb_v1.0`**（小模型，用于 PDF 行块拼接）。若本机**曾断网或只下了一半**，目录里**没有** **`updown_concat_xgb.model`**，会出现 *Incomplete … missing updown_concat_xgb.model*。

**做法 A：能上网（推荐先试镜像站）**

```bash
cd <REPO>
rm -rf huggingface.co/InfiniFlow/text_concat_xgb_v1.0
# 任选：国内镜像
export HF_ENDPOINT=https://hf-mirror.com
uv run python download_deps.py --china-mirrors
# 或不用 uv：python3 download_deps.py --china-mirrors
```

**做法 B：完全跳过该模型（离线 / 内网、可接受关闭 XGB 行拼接）**

1. 删掉残缺目录（否则校验仍失败）：

   ```bash
   cd <REPO>
   rm -rf huggingface.co/InfiniFlow/text_concat_xgb_v1.0
   ```

2. 在 **`docker/.env`** 中增加一行（**运行时**也要一致，容器内才会跳过加载）：

   ```bash
   RAGFLOW_DISABLE_TEXT_CONCAT_XGB=1
   ```

3. 再跑依赖下载（会创建占位目录并跳过 Hub 上的该 repo）：

   ```bash
   RAGFLOW_DISABLE_TEXT_CONCAT_XGB=1 uv run python download_deps.py --disable-text-concat-xgb
   ```

4. 一键 Compose 时脚本会读 **`docker/.env`**：若已设 **`RAGFLOW_DISABLE_TEXT_CONCAT_XGB=1`**，**`docker/tbox-compose-up.sh`** 会向 **`pull-local-deps-for-docker.sh`** 传入 **`--disable-text-concat-xgb`**（见脚本内逻辑）。

**影响**：PDF 解析里 **不再使用 XGBoost 行对分类器**，改为布局/启发式规则（见 **`deepdoc/parser/pdf_parser.py`** 日志说明）。一般仍可完成版面与表格识别主干能力。

---

## 11. Docker Hub 拉取超时（`i/o timeout` / `Interrupted`）

日志里若出现 **`Head "https://registry-1.docker.io/...` `dial tcp ...:443: i/o timeout`**，说明本机到 **Docker Hub** 的网络不通或极慢，**与 RAGFlow 配置无关**。

**可任选其一或组合使用：**

1. **为 Docker 配置 registry 镜像加速**（需 root，路径因发行版略有差异）
   编辑 **`/etc/docker/daemon.json`**（若无则新建），增加 **`registry-mirrors`** 指向你网络可达的 **`docker.io` 镜像站**，然后 **`sudo systemctl restart docker`**。具体镜像站地址以你所在网络环境文档为准（企业内网常有内部 Harbor）。

2. **换 MinIO 镜像名（已支持环境变量）**
   在 **`docker/.env`** 中增加一行（仍从 Docker Hub 拉，但若你已在 daemon 配置了镜像加速，会走加速）：

   ```bash
   MINIO_IMAGE=minio/minio:latest
   ```

   仓库已在 **`docker-compose-base.yml`** 中为 MinIO 使用 **`${MINIO_IMAGE:-…}`**，改完 **`docker compose … up -d`** 即可。

3. **换 RAGFlow 镜像**
   在 **`docker/.env`** 里设置 **`RAGFLOW_IMAGE`** 为国内/企业镜像源地址（见 **`docker/README.md`** 中 `RAGFLOW_IMAGE` 镜像说明）。

4. **HTTP/HTTPS 代理**
   若环境要求走代理：为 Docker 配置 **`HTTP_PROXY`/`HTTPS_PROXY`**（见 Docker 官方文档「Configure Docker to use a proxy server」）。

5. **离线**
   在能访问 Docker Hub 的机器上 **`docker pull` + `docker save`**，再 **`docker load`** 到目标机。

---

## 10. PR / 发版前与 CI 对齐的自检（可选）

与 **`docs/TBOX_QUICKSTART.md` §6** 一致：`web-tbox` 的 `npm ci && typecheck && build`，以及仓库内 TBOX 相关 **`pytest`** 矩阵。重型 **`harness_engineering`** 不绑在 PR 上，发版前按团队流程执行。

---

**文档版本**：与仓库 TBOX 交付文档同步维护；若部署形态或默认端口变更，请同时更新 **`TBOX_ENV_AND_VERSIONS.md`** 与本手册相关章节。
