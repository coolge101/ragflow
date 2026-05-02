# TBOX 独立前端（web-tbox）

与仓库根 `web/`（RAGFlow 官方 UI）**并行存在**：本目录为 **TBOX 知识库产品** 的 UI 基座，通过 HTTP 调用 RAGFlow 及 **`/v1/tbox/*`** 扩展 API。

## 开发

```bash
cp -n .env.example .env
npm install
npm run dev
```

默认 **http://127.0.0.1:5174** 。请确保后端 API 已监听 `VITE_RAGFLOW_API_ORIGIN`（默认 `http://127.0.0.1:9380`）。

- **主壳**：侧栏导航 + 顶栏用户与退出；菜单与路由受 **`GET /v1/tbox/me`** 返回的 **`permissions`** 控制（契约 **v4+**，含 `crawl.manage`）。
- **`/`**：对话（`chat.use`）— **`GET /api/v1/chats`**、**`GET/POST .../chats/:id/sessions`**、**`GET .../sessions/:sid`**，**`POST /api/v1/chat/completions`** SSE；「仅模型」不传 `chat_id`。右侧 **本轮引用**（`reference.chunks`）。
- **`/search`**：检索（`search.use`）— **`POST /api/v1/datasets/:id/search`**。
- **`/documents`**：知识库列表（`doc.view`）；展开后文档 **列表 / 上传（doc.upload）/ 删除（doc.delete）**；**`/kbs`** 重定向到此处。
- **`/kb`**：知识库配置占位（`kb.configure`）。
- **`/audit`**：`audit.read` — **`GET /api/v1/datasets/<id>/ingestions`**（流水线/入库日志）。
- **`/crawl`**：`crawl.manage` — 采集任务 **列表 / 新建 / 编辑 / 删除 / 执行一次**（**`/v1/tbox/crawl/tasks`**、**`POST .../tasks/:id/run`**，见 `docs/TBOX_API_BOUNDARY.md` §1.2）；后台 worker 见 §1.3。
- **`/users`**：`user.manage` — **`GET /api/v1/tenants/<当前用户 id>/users`**。
- **`/login`**：RSA + **`POST /api/v1/auth/login`**；支持 **`?redirect=`**；登录后拉 **`GET /v1/tbox/me`**、退出 **`POST /v1/tbox/logout`**。

信息架构与权限键见 **`docs/TBOX_UI_DESIGN_DETAIL.md`**。

## 构建

```bash
npm run build
```

产物在 `dist/`，可由 Nginx 或静态资源服务托管；与 Docker 编排的衔接见 `docs/TBOX_QUICKSTART.md` 与总纲 §9。

## 文档

- `docs/TBOX_KB_DELIVERY_HARNESS.md`
- `docs/TBOX_UI_DESIGN_OVERVIEW.md` / `docs/TBOX_UI_DESIGN_DETAIL.md`
- `docs/TBOX_API_BOUNDARY.md`
- `docs/TBOX_ENV_AND_VERSIONS.md`
