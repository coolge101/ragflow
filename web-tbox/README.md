# TBOX 独立前端（web-tbox）

与仓库根 `web/`（RAGFlow 官方 UI）**并行存在**：本目录为 **TBOX 知识库产品** 的 UI 基座，通过 HTTP 调用 RAGFlow 及 **`/v1/tbox/*`** 扩展 API。

分步联调（后端健康检查、`.env`、登录与权限）见仓库根 **[`docs/TBOX_QUICKSTART.md`](../docs/TBOX_QUICKSTART.md)**；**前后端部署、镜像与 Nginx、冒烟验收**见 **[`docs/TBOX_DEPLOY_RUNBOOK.md`](../docs/TBOX_DEPLOY_RUNBOOK.md)**。PR 前与 **`ubuntu-latest` 轻量 CI** 对号的本地命令见 **`TBOX_QUICKSTART.md` §6**（含本目录 **`npm ci` / `typecheck` / `build`** 与后端相关 **`pytest`**）。

## 开发

```bash
cp -n .env.example .env
npm install
npm run dev
```

默认终端会打印 **http://127.0.0.1:5174**（Vite 已 **`host: true`**，亦可用本机局域网 IP 访问）。**若 Firefox 跑在另一台电脑/宿主机上**，不要用那台机器上的 `127.0.0.1:5174`（那是它自己），应改为 **虚拟机 IP:5174**，或 SSH 端口转发。请先在 `web-tbox/` 执行 **`npm run dev`**，并确保后端已监听 **`VITE_RAGFLOW_API_ORIGIN`**（默认 `http://127.0.0.1:9380`；浏览器若不在跑后端的同一台机子上，要把 `.env` 里的 API 地址改成该后端可达的 URL，并处理 CORS/同源，见部署手册）。

- **主壳**：侧栏导航 + 顶栏用户与退出；菜单与路由受 **`GET /v1/tbox/me`** 返回的 **`permissions`** 控制（契约 **v4+**，含 `crawl.manage`）。
- **`/`**：对话（`chat.use`）— **`GET /api/v1/chats`**、**`GET/POST .../chats/:id/sessions`**、**`GET .../sessions/:sid`**，**`POST /api/v1/chat/completions`** SSE；「仅模型」不传 `chat_id`。右侧 **本轮引用**（`reference.chunks`）。
- **`/apps`**：对话应用（`kb.configure`）— **`GET/POST/PUT/DELETE /api/v1/chats`**；列表 **`/apps`**、新建 **`/apps/new`**、编辑 **`/apps/:id`**；绑定知识库、Prompt、检索与高级配置后可在对话页选用。
- **`/search`**：检索（`search.use`）— **`POST /api/v1/datasets/:id/search`**。
- **`/documents`**：知识库列表（`doc.view`）；**新建空知识库**（`POST /api/v1/datasets`，需 **`doc.upload` 或 `kb.configure`**）；展开后文档 **列表 / 上传（`doc.upload`）/ 开始解析（`POST …/documents/parse`，与官方一致：上传后默认「未开始」）/ 删文档（`doc.delete`）**；**删整库**需 **`kb.dangerous`**；**`/kbs`** 重定向到此处。
- **`/kb`**：知识库单库配置（`kb.configure`）— **`GET/PUT /api/v1/datasets/:id`**；同页含**空间默认模型**（`GET/PATCH /api/v1/users/me/models`）、**模型下拉**（`GET /v1/llm/list` + 国产/常用预设 +「其他」手输）与**供应商 API Key**（`POST /v1/llm/set_api_key`）；**删整库**需 **`kb.dangerous`**（与文档页一致）。
- **`/audit`**：`audit.read` — **`GET /api/v1/datasets/<id>/ingestions`**（流水线/入库日志）。
- **`/crawl`**：`crawl.manage` — 采集任务 **列表 / 新建 / 编辑 / 删除 / 执行一次**（**`/v1/tbox/crawl/tasks`**、**`POST .../tasks/:id/run`**，见 `docs/TBOX_API_BOUNDARY.md` §1.2）；后台 worker 见 §1.3。
- **`/users`**：空间成员与 RAGFlow 四档角色、TBOX 权限、RSA 初始密码 — **`/v1/tbox/workspaces/<tenant_id>/managed-users`**（需后端为本仓库构建的镜像；可先 **`bash scripts/tbox-up.sh`**）。
- **`/login`**：RSA + **`POST /api/v1/auth/login`**；支持 **`?redirect=`**；登录后拉 **`GET /v1/tbox/me`**、退出 **`POST /v1/tbox/logout`**。

信息架构与权限键见 **`docs/TBOX_UI_DESIGN_DETAIL.md`**。

## 构建

```bash
npm run typecheck
npm run build
```

产物在 `dist/`，可由 Nginx 或静态资源服务托管；与 Docker 编排的衔接见 [`docs/TBOX_QUICKSTART.md`](../docs/TBOX_QUICKSTART.md) 与总纲 §9。CI：`.github/workflows/web-tbox.yml`（`npm ci` + `typecheck` + `build`）。

## 文档

- `docs/TBOX_SYSTEM_USER_MANUAL.md`（部署后使用、权限、FAQ）
- `docs/TBOX_DEPLOY_RUNBOOK.md`（Docker / Nginx / 一期交付范围 / 冒烟）
- `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`（按步骤界面验收）
- `docs/TBOX_KB_DELIVERY_HARNESS.md`
- `docs/TBOX_UI_DESIGN_OVERVIEW.md` / `docs/TBOX_UI_DESIGN_DETAIL.md`
- `docs/TBOX_API_BOUNDARY.md`
- `docs/TBOX_ENV_AND_VERSIONS.md`（§6：**PR 轻量 CI** 与触发路径）
- `docs/TBOX_QUICKSTART.md` **§6**：PR 前自检命令（与本目录及全仓 CI 对齐）
