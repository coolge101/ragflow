# TBOX 控制台（web-tbox）界面验收 — 小白按步操作

本文说明：**在你自己的电脑上**，如何一步步打开页面、点哪里、看到什么算通过。你按顺序做完并打勾后，再进入下一轮开发即可。

---

## 一、开始前你要准备什么

### 1.1 软件与代码

1. 电脑上已安装 **Node.js**（建议 ≥ 18，与仓库要求一致）。
2. 本仓库已克隆到本地，例如目录：`/home/你的用户/ragflow`（下文称「仓库根目录」）。

### 1.2 后端（RAGFlow + TBOX API）要能用

控制台会向浏览器里的地址发请求（登录、`/v1/tbox/me`、知识库等）。**常见做法**：

- 若你平时用 **Docker** 起整套 RAGFlow：先按仓库里的 **`docs/TBOX_QUICKSTART.md`** 或 **`docs/TBOX_DEPLOY_RUNBOOK.md`** 把 API 跑起来。
- **开发时**前端通过 Vite 代理访问后端：在 `web-tbox/.env` 里配置 **`VITE_RAGFLOW_API_ORIGIN`** 指向你的 API 根地址（例如 `http://127.0.0.1:9380`）。可参考同目录 **`web-tbox/.env.example`**。

若后端没开：登录页可能出现红色「无法连接 TBOX API」等提示，**先不要继续验收**，先把后端和 `.env` 弄通。

### 1.3 不要用「双击 index.html」打开控制台

请始终用下面第二节里的 **`npm run dev` + 浏览器地址** 访问。直接打开 `index.html` 的 `file://` 链接**不会**正常加载程序。

---

## 二、第一次启动前端（每次验收都可以这样做）

1. 打开终端（Terminal）。
2. 进入前端目录（在仓库根目录下执行）：

   ```bash
   cd web-tbox
   ```

3. 第一次需要安装依赖（只需做一次，或 `package.json` 有变化时再做）：

   ```bash
   npm install
   ```

   若出现 **`ERESOLVE` / `peer vite`** 之类错误：请确认已拉取**最新**仓库（`web-tbox` 使用 **Vite 7** 与 **`@vitejs/plugin-react` 4.x** 对齐）；仍失败可删除 `web-tbox/node_modules` 与 `web-tbox/package-lock.json` 后重新执行 `npm install`。

4. 启动开发服务：

   ```bash
   npm run dev
   ```

5. 终端里会打印类似地址：**`http://127.0.0.1:5174`**（若端口被占用，以终端打印为准）。
6. 用 **Chrome / Edge / Firefox** 打开这个地址（不要用 `file://`）。

**通过标准**：浏览器能打开页面；未登录时一般会跳到 **登录页**。

### 2.1 5180 准生产验收（Docker console，VM 发版）

若使用 **`bash scripts/start-tbox-ragflow.sh --console`** 或 **`TBOX_CONSOLE=1`** 部署，浏览器基址改为 **`http://127.0.0.1:5180`**（内网用 **`http://<VM-LAN-IP>:5180`**），**不要**用 5174 dev 端口。

| 步骤 | 命令 / 路径 | 说明 |
|------|-------------|------|
| 发版前门禁 | `bash scripts/tbox_pre_release.sh` | host check → suite + §5（`--help` 见模式矩阵） |
| Smoke 凭据 | `bash scripts/tbox_setup_smoke_env.sh` | 创建/校验 `scripts/tbox_smoke.env` |
| 发版链（三脚本） | `bash scripts/tbox_print_release_next_steps.sh` | 5180 + pre_release 完整链（Runbook §3.1.3） |
| 自动化套件 | `bash scripts/tbox_smoke_suite.sh` | bundle + 登录 + API release smoke |
| 完整 VM 验收 | `bash scripts/tbox_vm_production_acceptance.sh` | 7 步（含 web-tbox check） |
| UI 变更后 | `bash scripts/tbox_rebuild_console.sh` | 重建 5180 静态页 |
| Phase 16–17 手测 | `bash scripts/tbox_phase16_17_handtest.sh` | Walkthrough **步骤 D** 5180 准生产前置 + bundle + C/D 清单 |
| 确认页（可选） | **`/review/step/phase16-17`** | journey **`phase16-17`**（§2.2） |
| 手测归档 §5 | `bash scripts/tbox_phase16_17_finish.sh --archive` | 浏览器 C §7 + D 通过后写 VM §5 ☑ |
| 双账号 API | `bash scripts/tbox_dual_account_check.sh` | 确认 `scripts/tbox_smoke.env` 已填 |

**Phase 16–17 三步**（与 VM 验收 **[§5](./TBOX_VM_PRODUCTION_ACCEPTANCE.md)** 一致）：`handtest` → 浏览器 **C §7 + D**（可选 **`/review/step/phase16-17`**）→ **`finish --archive`**。

脚本与环境：**[`TBOX_SMOKE_SCRIPTS.md`](./TBOX_SMOKE_SCRIPTS.md)**「Phase 16–17 浏览器手测」· **[`TBOX_SMOKE_ENV.md`](./TBOX_SMOKE_ENV.md)** · **`scripts/tbox_smoke.env.example`** · QUICKSTART **[§1.3](./TBOX_QUICKSTART.md)**。

下文步骤 A–P 在 5180 上验收时，将 **`5174` 全部替换为 `5180`**。Phase 16–17 要点见步骤 C 第 7 点、步骤 D Phase 17；详见 **`docs/TBOX_CONSOLE_REBUILD.md`**。

### 2.2 Walkthrough 步骤 ↔ `/review` 确认页

开发环境（5174）或准生产（5180）下，右下角 **「本页验收」** 与 **`/review/step/:id`** 共用 `web-tbox/src/review/journeySteps.ts` 数据（生产须 **`VITE_REVIEW_PAGES=1`** 构建）。

| Walkthrough | 业务路径 | journey `id` | 完整确认页（端口按环境替换） |
|-------------|----------|--------------|------------------------------|
| **A** 登录 | `/login` | `login` | `/review/step/login` |
| **B** 壳层 | `/` | `shell` | `/review/step/shell` |
| **C** 对话（Phase 16） | `/` | `chat` | `/review/step/chat` |
| **C2** 对话应用 | `/apps` | `chat-apps` | `/review/step/chat-apps` |
| **D** 检索（Phase 17） | `/search` | `search` | `/review/step/search` |
| **E** 文档 | `/documents` | `documents` | `/review/step/documents` |
| **F** 知识库配置 | `/kb` | `kb` | `/review/step/kb` |
| **G** 采集 | `/crawl` | `crawl` | `/review/step/crawl` |
| **H** 审计 | `/audit` | `audit` | `/review/step/audit` |
| **I** 用户 | `/users` | `users` | `/review/step/users` |
| **J** 无权限/404 | `/no-permission` 等 | `errors` | `/review/step/errors` |
| **K** 一页纸 | `/review` | — | 索引页 `/review` |
| **L–P** | 见各步路径 | 同上 id | 同上 |
| **Q** 5180 VM | 5180 全站 | `vm-5180` | `/review/step/vm-5180` |
| **Phase 16–17** | `/` Citation + `/search` 高亮 | `phase16-17` | `/review/step/phase16-17` |

Phase 16–17 浏览器通过后（步骤 **C §7** + **D**）：`bash scripts/tbox_phase16_17_finish.sh --archive`（完整清单见 **`/review/step/phase16-17`**）

---

## 三、三个「验收」入口分别是什么（先搞懂再点）

| 入口 | 在哪里 | 干什么用 |
|------|--------|----------|
| **本页验收** | 登录后主界面各页 **右下角** 圆角按钮「本页验收」 | 在当前真实页里边操作边打勾，和下面「确认页」**数据同步**（同一浏览器里）。 |
| **页面确认索引** | 浏览器地址栏输入：`http://127.0.0.1:5174/review`（端口按你的为准） | 一张表列出所有动线步骤，可进每一步的「完整确认页」。 |
| **完整确认页** | 例如 `http://127.0.0.1:5174/review/step/login` | 该步的说明、验收列表、备注、导出 HTML / 打印 PDF 说明等。 |

**开发环境默认**可以打开 `/review`；若打不开说明文字，检查 `web-tbox/.env` 里是否写了 **`VITE_REVIEW_PAGES=0`**（关掉的话改成删掉或 `1` 后重启 `npm run dev`）。

---

## 四、建议的验收顺序（按动线）

下面每一步都写：**你要点的 → 你应看到的 → 怎么算通过**。你可边做边在「本页验收」或「完整确认页」里勾选。

---

### 步骤 A：登录页 `/login`

1. 浏览器打开：`http://127.0.0.1:5174/login`（若已自动跳首页，可手动改成 `/login`）。
2. 看页面**上方或中间**是否有一段关于 **TBOX API 健康** 的提示（正常为绿色类说明，异常为黄/红）。
3. 输入你在 RAGFlow 里真实的 **邮箱、密码**，点 **登录**。
4. **通过标准**：能进入带左侧菜单的主界面；若账号无权限，可能进入「无权限」类页面（也算流程通）。

**可选**：点右下角 **「本页验收」**，展开后勾选「登录」相关条目；点 **「打开完整确认页」** 对照 `/review/step/login`。

---

### 步骤 B：工作台壳层（侧栏 + 顶栏）

1. 登录成功后，应看到 **左侧菜单**（条目随账号权限变化）。
2. 看 **顶栏右侧**：是否有 **昵称/邮箱** 和 **退出**。
3. **窄屏测试**（很重要）：
   - 按 **F12** 打开开发者工具 → 点 **「切换设备工具栏」**（手机图标），把宽度调到 **约 375px** 或小于 **768px**。
   - **通过标准**：顶栏左侧出现 **「菜单」**；点「菜单」后左侧 **抽屉菜单** 滑出；点灰色遮罩、侧栏里的 **✕**、或按键盘 **Esc** 能关闭。
4. 再拉宽窗口恢复桌面布局，侧栏应常显。

**本页验收**：在任意主界面页（如「对话」）点右下角「本页验收」，底部有 **「工作台壳层验收 →」** 链到壳层确认页；也可直接去 `/review/step/shell`。

---

### 步骤 C：对话 `/`

1. 左侧点 **「对话」**（或首页 `/`）。
2. **应用** 下拉里选 **「仅模型」** 或选一个真实应用（若列表为空，看页面是否提示「暂无应用」等，仍可试仅模型）。
3. 在底部输入框输入一句话，点 **发送**（或 Enter 发送）。
4. **通过标准**：助手有流式输出；点 **停止** 可中断；无应用时仍有说明文案。
5. 若有知识库应用：选应用、选会话或「首次发送时新建」，再发一条。
6. **导出**：有消息后可用 **Markdown / PDF / Word / PPT** 导出。
7. **引用联动（Phase 16）**：绑定知识库的应用提问后，若回答含 `[ID:0]` 等标记，**点击编号** → 右侧「本轮引用」对应片段**高亮并滚动**；点击侧栏片段可**反向高亮**正文引用编号。
   - **5180 准生产**：基址用 **5180**（非 5174 dev）；先 `bash scripts/tbox_phase16_17_handtest.sh`（含 bundle）
   - 与步骤 D 一并通过后：`bash scripts/tbox_phase16_17_finish.sh --archive`（可选确认页 **`/review/step/phase16-17`**）
   - **已知 backlog（2026-06-02）**：交互路径已实现，但 Citation/答案**呈现效果不理想** — 见 [`2026-05-24-tbox-capability-matrix-design.md`](./superpowers/specs/2026-05-24-tbox-capability-matrix-design.md) §8 **G3-CITATION-UX** / **G3-CHAT-ANSWER-UX**；不阻塞本步「能点、能亮」的功能验收，产品化改进留后续迭代。

**本页验收**：右下角 → 勾选「对话」条目；需要时去 `/review/step/chat`。

---

### 步骤 C2：对话应用 `/apps`

1. 使用具备 **`kb.configure`** 的账号登录；左侧应可见 **「对话应用」**。
2. 打开 **`/apps`**，点 **「新建对话应用」** 或 **「从模板：咨询/决策/辅导」**（`?template=consultation` 等），填写名称、绑定至少一个知识库、选择 Chat 模型，保存。
3. 编辑页应能配置 Prompt、开关、检索参数与高级项（Tavily、metadata 过滤等，视需要）。
4. 回到 **`/`**，在 **应用** 下拉中应出现新建应用；选应用后会话可发送，有库内容时引用侧栏应有 chunks。
5. **引用联动**：同步骤 C 第 7 点，点击 `[ID:n]` 与侧栏片段双向高亮。
6. **通过标准**：无需打开官方 `web/` 即可完成建应用并在对话页使用；页面文案不出现 RAGFlow 品牌。

**本页验收**：`/review/step/chat-apps`。

---

### 步骤 D：检索 `/search`（含 Phase 17 高亮）

**5180 准生产前置**（与 §2.1、步骤 C §7 一致）：仓库根先 `bash scripts/tbox_phase16_17_handtest.sh`（含 bundle 清单）；浏览器基址 **5180**（非 5174 dev）。

1. 左侧点 **「检索」**。
2. 选择 **有内容的知识库**，输入**可命中**的关键词，点 **检索**。
3. **Phase 17 高亮（必测）**：结果列表非空时，**点击某一条** → 该条目应 **高亮** 并 **scrollIntoView**（滚动到可见区域）；再点另一条，高亮应切换。
   - **已知 backlog（2026-06-02）**：高亮交互已实现，但检索结果**整体输出/可读性不理想** — 见矩阵 spec §8 **G3-SEARCH-UX**；不阻塞本步「能点、能亮」验收。
4. **其它通过标准**：结果区有 **「导出 Markdown / PDF / Excel / PPT」**；**故意**输入不可能命中的词，应出现 **「无命中」** 黄底说明；点 **「清空条件」** 后输入框与结果应被清掉。
5. 改知识库或改关键词后，旧结果不应继续误导（应被清掉或重新检索）。

**5180 准生产**：URL 为 `http://<host>:5180/search`。与 **步骤 C 第 7 点（Phase 16）** 均通过后：`handtest` → **C §7 + D**（可选 **`/review/step/phase16-17`**）→ **`bash scripts/tbox_phase16_17_finish.sh --archive`** 更新 VM 验收 §5。

**本页验收**：`/review/step/search`。

---

### 步骤 E：文档 / 知识库 `/documents`

1. 左侧点 **「文档 / 知识库」**。
2. 某一行点 **「管理文档」** 展开；试 **「上传文件」**（选一个小 txt/pdf）；若有权限，试把文件 **拖进** 展开的白色卡片区域。
3. 若文档/知识库很多：试 **「上一页 / 下一页」**（知识库表与文档表各自有分页时会出现）。
4. **阅读原文（2026-06-02）**：对已入库文档（含爬取的 HTML），点 **「阅读原文」** / **「下载原文」**（`GET /api/v1/documents/:id/preview`）。
5. **删除文档**：需账号有 **`doc.delete`**；点删除时浏览器应弹出 **确认框**，点「取消」则不应删。
6. **删除整个知识库**：需账号有 **`kb.dangerous`**（与「知识库配置」页删库一致）；无该权限时按钮旁会提示「无删库权限」，**不要**误判为前端坏了。

**本页验收**：`/review/step/documents`。

---

### 步骤 F：知识库配置 `/kb`

1. 左侧点 **「知识库配置」**（需账号有 **`kb.configure`** 权限；没有则菜单可能不显示，可跳过并记「无权限」）。
2. 顶部下拉框选 **一个知识库**，等待详情加载（名称、描述、嵌入模型、分块方法等应出现）。
3. 可做**小改验证**（勿破坏生产）：例如改 **描述** 一行字，点 **「保存配置」**，应提示成功或显示后端返回的错误信息；再点 **「放弃修改并重载」** 应恢复服务器上的值。
4. **`parser_config`** 为 JSON：故意写成非法 JSON 再保存，应在页面上看到 **JSON 校验错误**，而不应白屏。
5. **整库删除**：仅当账号有 **`kb.dangerous`** 时才会出现红色 **「删除此知识库」**；无权限时仅有一段说明文字。**通过标准**：有权限时删除前有确认框；无权限时不出现删除按钮。

**本页验收**：`/review/step/kb`。

---

### 步骤 G：采集 `/crawl`

1. 左侧点 **「采集」**（需 `crawl.manage`）。
2. 浏览列表；新建任务时可选 **「专项爬取」** 或 **「定时爬取」**，并填写 **关键词 / 最大深度 / 允许域名**（写入 `extra_config`，由 worker 消费）。
3. **搜索发现（Phase 67）**：在 **「搜索发现」** 区选择 **Provider = tavily**，填写 **query**（或点 **四类模板** 按钮：法规/技术/市场/产品行业）；Worker 须配置 **`TBOX_CRAWL_TAVILY_API_KEY`**（或 **`TAVILY_API_KEY`**）。可与种子 URL 并存；仅 query 无种子亦可（discover 补链）。
4. 绑定目标知识库时，下拉应显示 **库名称**（`page_size`≤100）；四类专题库各可建独立任务。
5. 试 **「新建 / 编辑 / 删除 / 执行一次」**；第二次执行同一任务应见 **`last_error`** 前缀 **`[tbox:TICK_OK]`** 且含 **`skipped_dup_url`** / **`skipped_dup_content`**（去重生效）。
6. **通过标准**：列表能加载；Discover + 策略字段保存后再次编辑仍可见；错误时有明确 **`[tbox:CODE]`** 提示（如无 Key → **`DISCOVER_NO_KEY`**）。

**本页验收**：`/review/step/crawl`。

---

### 步骤 H：审计 `/audit`

1. 左侧点 **「审计」**（需 `audit.read`）。
2. 切换 **知识库**、切换 **log 类型**（若有），看列表是否刷新。

**本页验收**：`/review/step/audit`。

---

### 步骤 I：用户与角色 `/users`

1. 左侧点 **「用户与角色」**（需权限或所有者规则，见产品说明）。
2. 能打开列表、查看成员即可；**勿随意改生产账号**。

**本页验收**：`/review/step/users`。

---

### 步骤 J：无权限与 404

1. **无权限**：用缺少某权限的账号登录后，手动在地址栏访问无权限的路径（若被拦截到 `/no-permission`），应看到说明与返回链接。
2. **404**：访问一个不存在的路径，例如 `http://127.0.0.1:5174/this-path-does-not-exist`，应看到 **页面不存在**。

**本页验收**：`/review/step/errors`。

---

### 步骤 K：导出「一页纸」（可选但推荐）

1. 打开 `http://127.0.0.1:5174/review`。
2. 任一步点 **「打开确认页」**。
3. 试 **「下载本步 HTML」**，到「下载」文件夹用浏览器打开该 HTML。
4. 试 **「打印 / 存 PDF…」**，在打印对话框中选 **另存为 PDF**（名称因系统/浏览器而异）。

**通过标准**：HTML 里能看到该步的验收项与勾选状态（与浏览器里一致）。

---

### 步骤 L–P：Phase 3 / P2 能力（可选，矩阵 P2 项）

> 对应 [`2026-05-24-tbox-phase3-plan.md`](./superpowers/plans/2026-05-24-tbox-phase3-plan.md) Task 11–15。无对应权限时跳过并记录。

| 步骤 | 路径 | 验收要点 | `/review/step/:id` |
|------|------|----------|----------------------|
| **L Office 导出** | `/`、`/search` | 对话 **导出 Word/PPT**；检索 **导出 Excel/PPT**；大结果有确认弹窗 | `chat` · `search` |
| **M 爬取高级源** | `/crawl` | 可选 **HTTP API 种子**、**认证 Header 配置名**；任务可创建并执行一次 | `crawl` |
| **N 文档高级** | `/documents` | 有 `doc.reparse` 时 **重新解析**；有 `export.data` / `doc.upload` 时 **导出/导入 ZIP** | `documents` |
| **O 审计筛选** | `/audit` | 时间/类型/状态/关键词筛选；**导出 CSV/Excel**（需 `export.data`） | `audit` |
| **P 多格式入库** | `/documents`、`/search` | 展开 **G1 多格式入库向导**；上传图片/Excel 时有分块提示；或跑 `scripts/tbox_g1_ingest_format_smoke.py` | `documents` |

**通过标准**：各步无 5xx；导出文件可打开；G1 四格式检索命中（见 smoke §5）。

---

### 步骤 Q：准生产 VM（5180，可选）

> 见 [`TBOX_VM_PRODUCTION_ACCEPTANCE.md`](./TBOX_VM_PRODUCTION_ACCEPTANCE.md)。浏览器基址 **`http://<VM-IP>:5180`**（非 5174 dev）。Review 确认页：**`/review/step/vm-5180`**（§2.2）。

**自动化（仓库根，Docker @ 9380 + 5180 已起）**：

```bash
bash scripts/tbox_setup_smoke_env.sh          # 可选：编辑 scripts/tbox_smoke.env
bash scripts/tbox_pre_release.sh              # 或 TBOX_PRE_RELEASE_VM=1 …
bash scripts/tbox_pre_release.sh --help       # 模式矩阵
```

**浏览器手测**：

1. 内网 **`http://<VM-IP>:5180/login`** — admin 与普通用户侧栏随 `permissions` 不同（VM §3 A–D）
2. **步骤 C §7**（Citation）+ **步骤 D**（检索高亮）在 5180 上完成
3. 可选 Walkthrough **L–P** 抽样（Office 导出、爬取、审计等）
4. 通过后：**`bash scripts/tbox_phase16_17_finish.sh --archive`**（更新 VM 验收 §5）

**新服务器部署后**：`bash scripts/deploy-on-new-server.sh` 完成 release smoke 后，见脚本末尾 **5180 / pre_release** 提示。

---

## 五、静态 HTML 线框（可选）

仓库里有 **`web-tbox/public/ui-pages/`**，开发时也可访问：

- `http://127.0.0.1:5174/ui-pages/index.html`

这是**纯静态**示意，没有登录与接口；用来对「每页长什么样」有个印象即可。

---

## 六、你执行完后怎么反馈「可以进入下一步开发」

建议你用一个简单表格（记事本即可）记下：

| 步骤 | 通过 / 未通过 | 未通过时的现象（复制报错或截图说明） |
|------|-----------------|--------------------------------------|
| A 登录 | | |
| B 壳层 | | |
| C 对话 | | |
| C2 对话应用 | | |
| D 检索 | | |
| E 文档/知识库 | | |
| F 知识库配置 | | |
| G 采集 | | |
| H 审计 | | |
| I 用户与角色 | | |
| J 无权限/404 | | |
| K 导出确认页（可选） | | |
| L–P Phase3 P2（可选） | | |
| Q 5180 VM / pre_release | | |
| Phase 16–17（handtest → review → finish） | | |

**Phase 16–17 归档**（与 VM 验收 §5 一致，须在 **5180** 浏览器完成 **C §7 + D** 后）：

1. `bash scripts/tbox_phase16_17_handtest.sh`
2. 可选确认页 **`/review/step/phase16-17`**
3. `bash scripts/tbox_phase16_17_finish.sh --archive`

- **全部通过**（含 **Q** 与 **Phase 16–17**）：执行上表第 3 步写 VM §5 ☑，并说明「准生产验收已通过」。
- **仅 dev（5174）通过、未做 5180**：继续按 §2.1 在 **5180** 完成 **Q** 与 **C/D Phase 16–17** 后再 `finish --archive`。
- **有未通过**：把 **步骤字母 + 现象 + 浏览器 F12 → Network 里失败请求的 URL 与状态码** 发给开发，先修再验。

---

## 七、常见问题

**Q：右下角没有「本页验收」？**
A：开发模式默认有。检查 `.env` 是否 `VITE_REVIEW_PAGES=0`；生产构建需 `VITE_REVIEW_PAGES=1`。

**Q：登录一直转圈或 401？**
A：核对后端地址、账号密码、以及 `VITE_AUTH_LOGIN_PATH` 是否与镜像版本匹配（见 `.env.example`）。

**Q：菜单里少很多项？**
A：由后端 `/v1/tbox/me` 下发的 **permissions** 决定，不是前端隐藏坏了。

---

文档版本：与当前仓库 `web-tbox` 行为对齐（含 `/kb` 对接官方 `GET/PUT /api/v1/datasets/:id`、删整库与 `kb.dangerous`）；若你本地分支较旧，以你拉到的代码为准。
