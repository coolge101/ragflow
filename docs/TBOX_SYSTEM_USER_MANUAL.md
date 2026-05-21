# TBOX 知识库系统 — 使用说明书

本文面向**在本仓库基础上部署与使用「RAGFlow + TBOX 扩展 + web-tbox 前端」**的管理员与终端用户，说明系统是什么、如何启动、如何登录、各功能入口及常见问题。更细的接口与部署参数见文末**相关文档**。

---

## 1. 系统是什么

| 组成部分 | 说明 |
|----------|------|
| **RAGFlow** | 开源 RAG 引擎：知识库、文档解析、对话、检索等 HTTP API（默认端口 **9380**）。 |
| **TBOX 扩展** | 本仓库在 RAGFlow 上增加的 **`/v1/tbox/*`** API：当前用户与权限、托管用户、采集任务、登出等；需使用**本仓库构建的 API 镜像**（如 **`ragflow-tbox:local`**），官方 Hub 镜像不含这些路由。 |
| **web-tbox** | TBOX 产品独立前端：**登录、主壳、对话、检索、文档/知识库、知识库单库配置（`/kb`）、审计、采集、用户与托管用户、无权限提示**；可选 **评审/验收页（`/review`）** 与右下角「本页验收」。开发模式默认 **http://127.0.0.1:5174**；生产为静态 **`dist/`** + Nginx 或 **`tbox-console`** 镜像。 |
| **依赖服务** | 通常由 Docker 一并启动：**MySQL、Redis、MinIO、Elasticsearch（或 Infinity）** 等，详见 `docker/docker-compose-base.yml`。 |

**典型使用方式**：在一台机器上先起后端（Docker），再在浏览器访问 **web-tbox**（开发用 `npm run dev`，生产可 Nginx 托管 `web-tbox/dist`）。

---

## 2. 端口与访问地址（默认值）

可在 **`docker/.env`**、**`web-tbox/.env`** 中修改；下表为常见默认。

| 服务 | 默认地址 | 说明 |
|------|-----------|------|
| RAGFlow API | `http://127.0.0.1:9380` | 变量 **`SVR_HTTP_PORT`**（宿主映射到容器 9380）。 |
| web-tbox（开发） | `http://127.0.0.1:5174` | Vite；**`VITE_RAGFLOW_API_ORIGIN`** 指向上述 API。 |
| MySQL / ES 等 | 见 `docker/.env.example` | 如 **`EXPOSE_MYSQL_PORT`**、**`ES_PORT`**。 |

**跨机访问**：若浏览器不在跑后端的那台机器上，勿用那台机上的 `127.0.0.1` 指后端；应改为**后端所在 IP** 或配置 **SSH 端口转发**，并把 **`web-tbox/.env`** 中 **`VITE_RAGFLOW_API_ORIGIN`** 设为浏览器可达的 API 地址（生产建议同源 Nginx 反代，见部署手册）。

---

## 3. 启动系统

### 3.1 准备配置

```bash
cd /path/to/ragflow/docker
test ! -f .env && cp .env.example .env
# 编辑 .env：数据库密码、DOC_ENGINE、RAGFLOW_IMAGE 等
```

联调推荐 **`RAGFLOW_IMAGE=ragflow-tbox:local`**（需已用本仓库 **`Dockerfile`** 构建成功）。

### 3.2 一键拉起后端与依赖

在**仓库根目录**（含 **`docker/`** 与 **`Dockerfile`** 的那一层）执行：

```bash
cd /path/to/ragflow   # 先进入你的克隆根目录；勿在 $HOME 或其它目录直接 bash docker/...
bash docker/tbox-compose-up.sh
# 或：bash scripts/tbox-up.sh
```

若报 **`No such file or directory`**：说明当前目录下没有 **`docker/tbox-compose-up.sh`** —— **`pwd`** 确认是否在克隆根目录，或用 **`bash "$(git -C /path/to/ragflow rev-parse --show-toplevel)/docker/tbox-compose-up.sh"`**。

脚本会：启动 **`docker-compose-base.yml`**（按 **`DOC_ENGINE`** 等 profile）、启动 **`docker-compose.yml`** 中的 RAGFlow（cpu/gpu）、探测 **`/api/v1/auth/login/channels`**（及兼容旧路径）与 **`/v1/tbox/health`**。看到 **`OK: RAGFlow HTTP responds`**、**`OK: TBOX is active`** 与 **`Done.`** 即表示后端就绪。

**仅重建 API 镜像**（改动了 `api/` 等）：

```bash
cd /path/to/ragflow
TBOX_BUILD_RAGFLOW=1 bash docker/tbox-compose-up.sh
# 或：cd docker && docker compose -f docker-compose.yml --profile cpu build ragflow-cpu
```

### 3.3 启动 web-tbox（前端）

```bash
cd /path/to/ragflow/web-tbox
cp -n .env.example .env
# 确认 VITE_RAGFLOW_API_ORIGIN 指向可访问的 API（默认 http://127.0.0.1:9380）
npm install
npm run dev
```

浏览器打开终端打印的地址（默认 **5174**）。**修改 `.env 后必须重启 `npm run dev`**。

### 3.4 生产环境托管前端（静态资源）

与 **`docs/TBOX_DEPLOY_RUNBOOK.md`** §7 一致，典型做法为：

1. **`cd web-tbox && npm ci && npm run build`**，产物在 **`web-tbox/dist/`**。
2. 由 **Nginx**（或与 API **同源**的网关）`root` 指向 **`dist`**，并将 **`/api`、`/v1`** 反代到 RAGFlow（如 **`127.0.0.1:9380`**）。**勿**假设生产环境仍有 Vite 代理。
3. 若使用 Compose **`tbox-console`** profile，镜像内会构建静态页并由 Nginx 反代 API（见部署手册 §7.3）。
4. 构建前按需设置 **`web-tbox/.env`**：至少 **`VITE_RAGFLOW_API_ORIGIN`**；需要 **`/review`** 时设置 **`VITE_REVIEW_PAGES=1`**（见 **`web-tbox/.env.example`**）。

### 3.5 停止

在 **`docker/`** 目录：

```bash
docker compose -f docker-compose.yml --profile cpu down   # 按你实际 profile 调整
docker compose -f docker-compose-base.yml --profile elasticsearch down
```

（具体 profile 与 **`DOC_ENGINE`**、**`DEVICE`** 一致。）

---

## 4. 登录与账号

### 4.1 登录页

访问 **`/login`**，使用 RAGFlow 用户库中的**邮箱 + 密码**。密码在浏览器端经 **RSA** 加密后，以 **`POST /api/v1/auth/login`** 提交（**不要**在 **`web-tbox/.env`** 里为当前本仓库镜像设置 **`VITE_AUTH_LOGIN_PATH=/v1/user/login`**，否则会 **`Not Found: /v1/user/login`**；该路径仅适用于很旧的官方 stock 镜像）。

### 4.2 默认超级用户（可选）

若需开箱即用 **`admin@ragflow.io` / `admin`**，需在 **`docker/docker-compose.yml`** 里为 **`ragflow-cpu` / `ragflow-gpu`** 的 **`command`** 增加 **`--init-superuser`**（与 **`--enable-adminserver`** 并列），保存后**重建并重启**容器。默认值定义在 **`api/db/init_data.py`**（可用环境变量覆盖邮箱/密码/昵称）。

**注意**：部分旧官方镜像在 **`--init-superuser`** 后可能因模型未配置而启动失败；使用**本仓库构建的 `ragflow-tbox:local`** 时一般按快速开始文档操作即可。若库中已存在该邮箱则不会重复创建。

### 4.3 其他注册方式

若 **`REGISTER_ENABLED=1`**，可通过官方 **`web/`** 或 **`POST /api/v1/users`** 注册，再用同一账号登录 web-tbox。

### 4.4 登录后主流程

成功后前端会保存 **`Authorization`** 与 **`access_token`**，并请求 **`GET /v1/tbox/me`** 获取 **`permissions`**，据此显示侧栏菜单。退出可调用 **`POST /v1/tbox/logout`**。

---

## 5. 功能说明（按菜单）

以下权限键来自 **`/v1/tbox/me`**；无权限的菜单可能隐藏或跳转无权限页。细项见 **`docs/TBOX_UI_DESIGN_DETAIL.md`**。

| 路由 | 权限（典型） | 功能概要 |
|------|----------------|----------|
| **`/`** | `chat.use` | 对话；流式 **`POST /api/v1/chat/completions`**；可展示引用块 **`reference.chunks`**。 |
| **`/search`** | `search.use` | 在指定知识库中 **`POST /api/v1/datasets/<id>/search`**。 |
| **`/documents`**（**`/kbs`** 重定向） | `doc.view`；**新建空库**需 `doc.upload` 或 `kb.configure`（`POST /api/v1/datasets`）；上传/删文档需 `doc.upload` / `doc.delete`；**删整库**需 `kb.dangerous` | 知识库列表、新建、文档管理。 |
| **`/kb`** | `kb.configure`；删整库需 `kb.dangerous` | 单库配置：**`GET/PUT /api/v1/datasets/<id>`**（名称、描述、嵌入模型、分块、`permission`、`parser_config` 等）。 |
| **`/audit`** | `audit.read` | 入库/流水线日志 **`GET /api/v1/datasets/<id>/ingestions`**。 |
| **`/crawl`** | `crawl.manage` | 采集任务 CRUD 与执行 **`/v1/tbox/crawl/tasks`** 等。 |
| **`/users`** | 管理类能力 | 空间成员、TBOX 权限与托管用户（需后端支持对应 API）。 |
| **`/login`** | — | 登录/跳转。 |

**模型与知识库**：对话与检索依赖租户下已配置的 **Embedding / Chat** 等模型；若登录后部分功能不可用，请在 RAGFlow 管理侧检查模型与知识库配置。

### 5.1 按使用场景的常见动线（一期）

| 场景 | 建议路径 | 说明 |
|------|-----------|------|
| **日常问答** | **`/`** → 选应用或「仅模型」→ 发送消息 | 依赖 **`chat.use`** 与可用 Chat 模型；有引用时右侧展示 **`reference.chunks`**。 |
| **在库内试检索** | **`/search`** → 选知识库 → 输入关键词 → 检索 | 依赖 **`search.use`** 与已有数据集。 |
| **新建空知识库** | **`/documents`** → 「新建知识库」→ 填名称等并创建 | 需 **`doc.upload` 或 `kb.configure`**；调用官方 **`POST /api/v1/datasets`**。 |
| **上传与管理文件** | **`/documents`** → 「管理文档」→ 上传或删除 | 浏览 **`doc.view`**；上传 **`doc.upload`**；删文档 **`doc.delete`**。**删整个知识库**需 **`kb.dangerous`**（与 **`/kb`** 危险区一致）。 |
| **调整单库解析/分块等** | **`/kb`** | 选库后改字段并「保存配置」；**`parser_config`** 须为合法 JSON。**已有大量分块时**，后端可能拒绝更换 **嵌入模型**（属官方校验，非前端故障）。 |
| **看入库与解析进度** | **`/audit`** | 切换知识库与 **`dataset` / `file`** 日志类型；列表为官方 **`ingestions`** 接口结果。 |
| **配置定时/手动采集** | **`/crawl`** | 任务绑定租户与可选 **`dataset_id`**；**「执行一次」** 与可选 **Worker** 行为见 **`TBOX_API_BOUNDARY.md`**。 |
| **管理成员与托管账号** | **`/users`** | 具体按钮与字段随 **`/v1/tbox/me`** 与空间角色变化；托管用户走 **`/v1/tbox/workspaces/.../managed-users`**。 |

### 5.2 TBOX 权限键速查（与菜单关系最大）

完整定义见 **`docs/TBOX_UI_DESIGN_DETAIL.md`**。下表便于**自助排障「为什么菜单没有 / 按钮灰掉」**：

| 权限键 | 典型影响 |
|--------|-----------|
| **`chat.use`** | 对话菜单 **`/`** |
| **`search.use`** | 检索 **`/search`** |
| **`doc.view`** | 文档/知识库列表 **`/documents`** |
| **`doc.upload` / `doc.delete`** | 上传文档、删除文档；**与 `kb.configure` 二选一即可**在 **`/documents`** 使用「新建知识库」 |
| **`kb.configure`** | 知识库配置 **`/kb`**（编辑并保存单库）；亦可 **`/documents`** 新建空库 |
| **`kb.dangerous`** | **删除整个知识库**（在 **`/documents`** 或 **`/kb`**） |
| **`audit.read`** | 审计 **`/audit`** |
| **`crawl.manage`** | 采集 **`/crawl`** |
| **`user.manage`** 等 | **用户与角色** **`/users`**（与空间所有者/管理员规则叠加） |

实际菜单由 **`GET /v1/tbox/me`** 返回的 **`permissions`** 数组决定；超级用户通常拥有全部键。

### 5.3 界面验收与「一页纸」导出（可选）

给测试或甲方**逐步点验**时，使用 **`docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`**（步骤 A–K）。各业务页右下角 **「本页验收」** 与 **`/review`**、**`/review/step/:id`** 使用同一浏览器存储；确认页支持 **下载 HTML** 与 **打印存 PDF**。生产环境若不需要评审入口，构建时不要设置 **`VITE_REVIEW_PAGES=1`**。

---

## 6. 常用配置项摘要

| 位置 | 变量（示例） | 用途 |
|------|----------------|------|
| **`docker/.env`** | `RAGFLOW_IMAGE`、`RAGFLOW_BASE_IMAGE`、`NEED_MIRROR`、`DOC_ENGINE`、`SVR_HTTP_PORT`、`TBOX_CHINA_DOWNLOAD` | 镜像、文档引擎、端口、国内构建/下载等。 |
| **`web-tbox/.env`** | `VITE_RAGFLOW_API_ORIGIN` | 浏览器侧 API 基址（开发时 Vite 代理目标）。 |
| **`web-tbox/.env`** | ~~`VITE_AUTH_LOGIN_PATH=/v1/user/login`~~ | **本仓库 Quart 后端请勿设置**；默认 **`/api/v1/auth/login`**。 |
| **`web-tbox/.env`** | **`VITE_REVIEW_PAGES`** | 生产需要 **`/review`** 时设为 **`1`**；不需要则省略或 **`0`**。 |

---

## 7. 常见问题与处理

| 现象 | 可能原因 | 处理方向 |
|------|-----------|----------|
| **`Not Found: /v1/user/login`** | 前端误配旧登录路径 | 删除 **`web-tbox/.env`** 中的 **`VITE_AUTH_LOGIN_PATH`**，重启 **`npm run dev`**。 |
| **`bash: docker/tbox-compose-up.sh: No such file or directory`** | 未在仓库根目录执行 | 见 **§3.2**；**`cd`** 到含 **`docker/tbox-compose-up.sh`** 的克隆根目录，或用绝对路径调用脚本。 |
| **`tbox-compose-up.sh` 超时** | 曾用错误健康检查路径 | 使用**已更新**的脚本（探测 **`/api/v1/auth/login/channels`**）；更新仓库后重跑脚本。 |
| **`/v1/tbox/health` 404** | 容器非本仓库 TBOX 镜像 | 设置 **`RAGFLOW_IMAGE=ragflow-tbox:local`** 并 **`docker compose build`**。 |
| **构建镜像磁盘满** | Docker 根分区空间不足 | **`docker system prune`** / **`docker builder prune`**，或扩容磁盘。 |
| **拉镜像 DNS 失败**（如 USTC mirror） | **`daemon.json`** 中镜像站不可用 | 运行 **`sudo bash scripts/fix-docker-registry-mirrors.sh`**（见脚本注释），或手动调整 **`registry-mirrors`** 后 **`systemctl restart docker`**。 |
| **`Email and password do not match!`** | 未 init 用户或库中重复邮箱 | 配置 **`--init-superuser`** 或注册账号；重复邮箱可参考 **`scripts/tbox-dedupe-admin-email.sh`**。 |
| **Compose 提示 orphan 容器** | 工程名/服务变更残留 | 可 **`docker compose … up -d --remove-orphans`** 清理（确认无依赖后）。 |
| **「知识库配置」里删库按钮没有** | 当前账号无 **`kb.dangerous`** | 由空间管理员在 **`/users`** 调整托管权限或使用具备该权限的账号（见 §5.2）。 |
| **`/kb` 保存返回嵌入模型相关错误** | 库内 **`chunk_count` > 0** 时官方限制修改 **`embedding_model`** | 新建空库配置后再导入文档，或接受当前嵌入模型。 |
| **采集任务执行成功但库内无新文档** | 未绑定 **`dataset_id`**、**`robots.txt`** 拒绝、或未起 **Worker** / 任务未 **`enabled`** | 见 **`TBOX_API_BOUNDARY.md`** §1.2–1.3 与部署手册 **§3.5**。 |
| **打开 `/review` 空白或不像说明里那样** | 生产构建未打开评审开关 | 设置 **`VITE_REVIEW_PAGES=1`** 后重新 **`npm run build`** 并部署新 **`dist`**。 |

---

## 8. 安全与生产建议

- 修改 **`docker/.env`** 中所有默认密码与密钥；**不要将含生产密钥的 `.env` 提交到 Git**。
- 首次登录 **`admin@ragflow.io`** 后尽快**修改密码**。
- 生产环境使用 **HTTPS**、限制管理端口暴露、定期备份 **MySQL** 与对象存储中的数据。

---

## 9. 相关文档（深入阅读）

| 文档 | 内容 |
|------|------|
| **[`TBOX_QUICKSTART.md`](./TBOX_QUICKSTART.md)** | 快速联调、初始化用户、登录接口说明、PR 前自检。 |
| **[`TBOX_DEPLOY_RUNBOOK.md`](./TBOX_DEPLOY_RUNBOOK.md)** | Docker/Nginx/离线依赖、一期交付范围、冒烟与验收。 |
| **[`TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`](./TBOX_UI_ACCEPTANCE_WALKTHROUGH.md)** | 按步骤界面验收（A–K）。 |
| **[`TBOX_PHASE2_PAGE_REQUIREMENTS_MEMO.md`](./TBOX_PHASE2_PAGE_REQUIREMENTS_MEMO.md)** | 二期能力备忘（导出、采集高级 UI 等）。 |
| **[`TBOX_DEPLOY_FROM_GITHUB.md`](./TBOX_DEPLOY_FROM_GITHUB.md)** | 从 GitHub 在其他服务器部署（克隆、私库、构建、可选 CI）。 |
| **[`TBOX_API_BOUNDARY.md`](./TBOX_API_BOUNDARY.md)** | **`/v1/tbox/*`** 契约与采集行为。 |
| **[`TBOX_UI_DESIGN_DETAIL.md`](./TBOX_UI_DESIGN_DETAIL.md)** | 权限键与界面规则。 |
| **`web-tbox/README.md`** | 前端路由与开发命令。 |
| **`docker/README.md`** | 官方 Docker 变量与通用说明。 |

---

*说明书版本与仓库一期 **web-tbox + `/v1/tbox/*`** 交付范围一致；若接口或端口变更，以对应 **`docs/`** 与 **`.env.example`** 为准。*
