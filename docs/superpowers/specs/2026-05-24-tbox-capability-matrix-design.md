# TBOX 能力矩阵与下一阶段范围 — 设计规格

**日期**：2026-05-24
**状态**：已批准（brainstorming 2026-05-24）；阶段 0–1 文档与 G5-BRAND 已落地（2026-05-24）
**Implementation plan**：[`docs/superpowers/plans/2026-05-24-tbox-next-phase.md`](../plans/2026-05-24-tbox-next-phase.md)

---

## 1. 产品定位

**基于知识库的咨询、决策、辅导系统**：将自有文档与网络爬取知识 Embedding 入库，经 RAG + 可扩展 LLM（首选用 DeepSeek）生成答案，输出可归档为 Markdown/PDF（后期扩展 Office），全部通过 **TBOX 自研 UI（`web-tbox/`）** 交付。

**引擎**：本仓库 RAGFlow fork（Apache License 2.0）。**商标**：对外 TBOX；用户可见界面不出现 RAGFlow/InfiniFlow 品牌；`LICENSE`/`NOTICE` 保留在分发包内。

---

## 2. 五条总体目标（G1–G5）

| ID | 目标 | 能力域 |
|----|------|--------|
| **G1** | 自有成果 Embedding（PDF、Word、Excel、图片等） | 入库、解析、分块、嵌入模型 |
| **G2** | 网络爬取（关键词；定时、专项等多种方式） | 采集任务、调度、合规、入库 |
| **G3** | LLM 对话（DeepSeek 优先，可扩展） | 模型配置、对话应用、流式对话、引用 |
| **G4** | 输出 MD/PDF；可扩展 Word/Excel/PPT | 咨询/检索/会话结果导出 |
| **G5** | RAGFlow 相关能力 + 自研 UI、合规 | 对照官方能力；`web-tbox` 实现；开源合规 |

**矩阵范围（已确认）**：仅围绕 G1–G5 反推必要能力；**不**以官方 `web/` 全菜单为对照基准。

---

## 3. 显式非目标（矩阵外）

下列能力**不在**本阶段「对齐官方 web」范围内；若后端 API 存在，矩阵中可标「API 有 / UI 不做」：

| 类别 | 示例 |
|------|------|
| Agent 工作流 | 画布、`/agents`、Agent 模板市场 |
| Memory | 长期记忆模块 |
| 文件管理器 | `/files`、Skills 目录 |
| 集成配置 UI | MCP、Data Source 连接器（**除** TBOX `/crawl`） |
| 对外嵌入 | Chat/Agent Share、Widget |
| 企业后台 | Admin 监控、Sandbox 设置（Enterprise） |
| GraphRAG 产品化 | 独立 KG 浏览/编辑 UI（引擎能力另议） |

**维护规则**：新增「非目标」须在本节登记并说明理由，避免 scope  creep。

---

## 4. 矩阵列定义

| 列 | 说明 |
|----|------|
| **ID** | 稳定标识，如 `G1-DOC-UPLOAD` |
| **能力** | 用户可理解的一句话 |
| **官方 RAGFlow** | ✅ 有 / ⚠️ 部分 / ❌ 无（注明 `web/` 路由或 REST） |
| **web-tbox** | ✅ 已有 / ⚠️ 简化 / ❌ 未做 |
| **后端** | 官方 REST / `/v1/tbox/*` / 需 TBOX 扩展 |
| **目标** | G1–G5 |
| **优先级** | P0 收尾 / P1 下一迭代 / P2 扩展 / — 非目标 |
| **备注** | 缺口、API、验收要点 |

**更新规则**：每完成一项 P0/P1 交付，须回写 **web-tbox** 列并在 PR 中 `@` 本文件对应 ID。

---

## 5. 能力矩阵（基线 2026-05-24）

### G1 — 自有成果 Embedding

| ID | 能力 | 官方 | web-tbox | 后端 | 优先级 | 备注 |
|----|------|------|----------|------|--------|------|
| G1-DOC-UPLOAD | 多格式文档上传 | ✅ `/datasets/.../documents` | ✅ `/documents` | 官方 REST | P0 | PDF/Word/Excel/txt 等随 deepdoc |
| G1-DOC-PARSE | 触发解析/分块 | ✅ `POST .../parse` | ✅ 「开始解析」 | 官方 REST | ✅ | 上传后默认未开始属正常 |
| G1-KB-CONFIG | 嵌入模型、分块方法、parser_config | ✅ dataset setting | ✅ `/kb` | 官方 REST | ✅ | 已有分块时改嵌入模型受限（官方规则） |
| G1-KB-CREATE | 新建空知识库 | ✅ | ✅ `/documents` | 官方 REST | ✅ | 需 `doc.upload` 或 `kb.configure` |
| G1-KB-DELETE | 删除整库 | ✅ | ✅ `/documents`、`/kb` | 官方 REST | ✅ | 需 `kb.dangerous` |
| G1-DOC-DELETE | 删除单文档 | ✅ | ✅ `/documents` | 官方 REST | ✅ | 需 `doc.delete` |
| G1-OCR-IMAGE | 图片/OCR 深度理解 | ✅ deepdoc | ✅ **`/documents` G1 向导** | deepdoc | P1 | 格式表 + 分块提示；PNG `picture` + OCR 回退；Excel 表头+数据行 |
| G1-DOC-REPARSE | 文档重解析 | ✅ | ✅ **`/documents`** ingest | 官方 REST | P2 | `doc.reparse` + `POST /documents/ingest` |
| G1-DOC-VERSION | 文档版本管理 | ⚠️ 视版本 | ❌ | 官方 REST | P2 | 非目标可延后 |
| G1-KB-ZIP | 整库 ZIP 导入/导出 | ⚠️ 无专用 REST | ✅ 浏览器 ZIP | `GET /v1/document/get` + upload | P2 | `export.data` / `doc.upload` |

### G2 — 网络爬取

| ID | 能力 | 官方 | web-tbox | 后端 | 优先级 | 备注 |
|----|------|------|----------|------|--------|------|
| G2-CRAWL-STATIC | 静态网页入库 | —（TBOX） | ✅ | `/v1/tbox/crawl/*` + worker | ✅ | `static_web` |
| G2-CRAWL-RSS | RSS 入库 | —（TBOX） | ✅ | 同上 | ✅ | |
| G2-CRAWL-SCHED | 定时 + 手动执行 | 需求已定 | ✅ cron + 「执行一次」 | TBOX | ✅ | |
| G2-CRAWL-ROBOTS | robots / SSRF / 礼貌爬取 | —（TBOX） | ✅ 后端 | TBOX common | ✅ | 见 Harness §9.4 |
| G2-CRAWL-UI | 任务 CRUD 基础 UI | — | ✅ `/crawl` | TBOX | ✅ | |
| G2-CRAWL-KEYWORD | **关键词策略 UI** | — | ✅ 表单 + worker | TBOX | **P1** | 入库前正文过滤 |
| G2-CRAWL-MODE | **专项 vs 定时** 任务类型 | — | ✅ 任务类型选择 | TBOX | **P1** | 专项=无 Cron + 手动 run |
| G2-CRAWL-AUTH | 需登录站点 | 需求 §7 | ✅ profile + env headers | TBOX common | P2 | **`TBOX_CRAWL_AUTH_<PROFILE>_HEADERS`** |
| G2-CRAWL-API | API 拉取源 | 需求 §7 | ✅ **`http_api`** | TBOX ingest | P2 | JSON 数组 → `.txt` |

### G3 — LLM 对话

| ID | 能力 | 官方 | web-tbox | 后端 | 优先级 | 备注 |
|----|------|------|----------|------|--------|------|
| G3-MODEL-KEY | 供应商 API Key、模型列表 | ✅ profile/model | ✅ `/kb` | `/v1/llm/*` | ✅ | |
| G3-MODEL-DEEPSEEK | DeepSeek 对话 | ✅ conf/models | ✅ API 冒烟 + `/kb` Key | 官方 LLM | **P0** | **`scripts/tbox_g3_deepseek_smoke.py`**；新租户仍须在 `/kb` 配 Key |
| G3-APP-CRUD | 对话应用完整配置 | ✅ next-chats | ✅ `/apps` | `/api/v1/chats` | P0 | Chat Apps 主体已完成 |
| G3-CHAT-STREAM | 流式对话 + 引用 | ✅ | ✅ `/` | SSE completions | ✅ | `reference.chunks` + **Citation 点击高亮**（Phase 16） |
| G3-CHAT-SESSION | 会话列表/切换 | ✅ | ✅ `/` | chats sessions API | ✅ | |
| G3-SCENARIO | **咨询/决策/辅导** 场景模板 | ❌ 无预设 | ✅ `/apps` 模板 | `/apps` 数据 | **P1** | 三套 Prompt/检索预设 |
| G3-SEARCH | 知识库内检索试用 | ✅ next-search | ✅ `/search` | dataset search | ✅ | 结果条目点击高亮（Phase 17） |

### G4 — 结果导出

| ID | 能力 | 官方 | web-tbox | 后端 | 优先级 | 备注 |
|----|------|------|----------|------|--------|------|
| G4-EXPORT-MD | 对话/检索结果 **Markdown** | ⚠️ Agent 侧思路 | ✅ **`/`、`/search`** | 纯前端可行 | **P1** | UTF-8 下载 |
| G4-EXPORT-PDF | 结果 **PDF** | ⚠️ | ✅ **打印为 PDF** | 打印或前端库 | **P1** | 浏览器 另存为 PDF |
| G4-EXPORT-OFFICE | Word/Excel/PPT | ⚠️ | ✅ **Word / Excel / PPT** | 纯前端 docx/xlsx/pptxgenjs | P2 | `/` Word+PPT；`/search` Excel+PPT |
| G4-EXPORT-REVIEW | 验收一页纸 HTML/PDF | — | ✅ `/review` | 本地 | ✅ | 非业务咨询结果 |

### G5 — 自研 UI 与合规

| ID | 能力 | 官方 | web-tbox | 后端 | 优先级 | 备注 |
|----|------|------|----------|------|--------|------|
| G5-UI-SHELL | 登录、权限壳、窄屏 | ✅ 官方 web | ✅ MainLayout | `/v1/tbox/me` | ✅ | 双账号 API：`TBOX_SMOKE_ENV.md` |
| G5-UI-USERS | 用户与 TBOX 权限 | ✅ team | ✅ `/users` | TBOX managed-users | ✅ | |
| G5-UI-AUDIT | 入库/流水线日志 | ✅ ingestions | ✅ **`/audit`** 筛选+导出 | 官方 REST | P2 | 时间/状态/关键词；CSV/Excel |
| G5-BRAND | 用户可见零 RAGFlow 品牌 | — | ✅ | — | P0 | 2026-05-24 阶段 1 文案清理 |
| G5-MATRIX | 本能力矩阵维护 | — | 本文 | — | **P0** | Phase 52 @ `9d2961fb6`；§6 Phase 0–52；Harness §9.0 同步 |
| G5-LICENSE | Apache 2.0 合规 | LICENSE | ✅ 分发包 | — | P0 | UI 不用商标 |

---

## 6. 下一阶段范围（摘要）

| 阶段 | 名称 | 矩阵优先级 | 主要交付 |
|------|------|------------|----------|
| **0** | 矩阵与基线 | P0 文档 | 本文 + plan + Harness §1 升级 + DeepSeek 手测 |
| **1** | P0 收尾 | P0 行 | 去品牌、Chat Apps 文档、镜像含 TBOX 后端、验收对齐 |
| **2** | P1 补齐 | P1 行 | MD/PDF 导出 → 三类场景模板 → 爬取关键词 UI → G1 手测 |
| **3** | P2 扩展 | P2 行 | Office 导出、爬取高级源、文档高级能力；矩阵复审 |
| **4** | G1 闭环 + 交付硬化 | P1 缺口 | G1 冒烟修复、Harness 同步；S5 Docker 准备（见 phase4 plan） |
| **5** | G3 + S6/S7 | P0/P1 | DeepSeek API 冒烟、上游合并 Runbook、发版对抗 checklist（见 phase5 plan） |
| **6** | 发版门禁 + S0 | 运维 | `tbox_release_smoke.sh`、基线 commit、Excel UI 提示（见 phase6 plan） |
| **7** | S7 实测 + 部署闭环 | 运维 | S7 对抗记录、deploy 接入 release smoke、镜像重建说明（见 phase7 plan） |
| **8** | S6 差异快照 | 运维 | `tbox_upstream_divergence.sh`、基线/里程碑更新（见 phase8 plan） |
| **9** | VM 验收 + G1 向导 | 产品/运维 | **`TBOX_VM_PRODUCTION_ACCEPTANCE.md`**、`G1IngestFormatGuide`（见 phase9 plan） |
| **10** | S6 后栈加固 | 运维 | **`tbox_verify_stack_image.sh`**、Dockerfile `COPY scripts`（见 phase10 plan） |
| **11** | 运维硬化 | 运维 | post-merge 校验链、build 磁盘 recovery（见 phase11 plan） |
| **12** | 5180 产品验收闭环 | 产品/运维 | **`tbox_record_vm_acceptance.sh`**、登录 JWT 修复 — phase12 plan |
| **13** | 收尾与例行运维 | 运维/产品 | 漂移记录、P2 smoke、5180 手测 — phase13 plan |
| **14** | G3 对话应用 API 回归 | 产品 | **`tbox_chat_apps_smoke.sh`** — phase14 plan |
| **15** | G5 权限 API 回归 | 产品/运维 | **`tbox_permissions_smoke.sh`** — phase15 plan |
| **16** | G3 Citation 侧栏联动 | 产品 | **`ChatMessageContent` / `ReferenceChunks`** — phase16 plan |
| **17** | S6 漂移 + 检索高亮 | 运维/产品 | Runbook §5 **`--fetch`**；**`SearchResultList`** — phase17 plan |
| **18** | 双账号 smoke env | 运维 | **`scripts/tbox_smoke.env.example`** + Walkthrough 16–17 — phase18 plan |
| **19** | ChunkListPanel 共用 | 产品 | **`ChunkListPanel`** 统一引用/检索 UI — phase19 plan |
| **20** | chunk/citation 单元测试 | 产品 | **`npm test`** Vitest — phase20 plan |
| **21** | test 纳入 CI / post-merge | 运维 | **`web-tbox.yml`** + **`tbox_web_tbox_check.sh`** — phase21 plan |
| **22** | VM 验收 6 步 + 漂移 | 运维 | VM acceptance + Runbook §5 — phase22 plan |
| **23** | Console 重建 | 运维/产品 | **`tbox_rebuild_console.sh`** — phase23 plan |
| **24–39** | 发版链 / smoke / S6 | 运维/产品 | post-merge console、smoke suite、§5 钉扎、host check、双账号 gate、pre_release 矩阵、Review 映射 — phase24–39 plans |
| **40** | start-tbox + §6 Q | 运维 | **`start-tbox-ragflow.sh --console`** + G5-MATRIX — phase40 plan |
| **41** | tbox-up + QUICKSTART | 运维 | **`tbox-up.sh`** 5180 提示 + journey global — phase41 plan |
| **42** | 发版提示 helper + phase16-17 journey | 运维 | **`tbox_print_release_next_steps.sh`** + Runbook §3.1.3 + **`/review/step/phase16-17`** — phase42 plan |
| **43** | helper 单测 + QUICKSTART §1.3 + 手册 | 运维/产品 | scripts unit + **`tbox_host_check`** + SYSTEM_USER_MANUAL §5.4 — phase43 plan |
| **44** | DEPLOY_FROM_GITHUB §6 + smoke example | 运维 | GitHub §6 对齐 + **`tbox_smoke.env.example`** + example 单测 — phase44 plan |
| **45** | CONSOLE_REBUILD + setup_smoke_env | 运维 | **`TBOX_CONSOLE_REBUILD.md`** + **`tbox_setup_smoke_env.sh`** + rebuild 收尾 — phase45 plan |
| **46** | phase16-17 脚本 + VM §5 | 运维 | **`handtest`/`finish`** + **`TBOX_VM_PRODUCTION_ACCEPTANCE.md`** §5 — phase46 plan |
| **47** | SMOKE_SCRIPTS + Walkthrough §2.1 | 运维/产品 | Phase 16–17 专节 + §2.1 与 VM §5 — phase47 plan |
| **48** | SMOKE_ENV + pre_release --help | 运维 | env 专节 + pre_release 三步链 — phase48 plan |
| **49** | post-merge + Runbook §8.1 | 运维 | post-merge 收尾 + SMOKE 交叉引用 — phase49 plan |
| **50** | UPSTREAM §3.2 + helper SMOKE | 运维 | merge Runbook §3.2 + print_release SMOKE 链接 — phase50 plan |
| **51** | QUICKSTART §6 + Harness §9 | 运维/产品 | §6 phase16-17 + §9 里程碑 — phase51 plan |
| **52** | ENV §6 + Walkthrough §六 | 运维/产品 | CI 对号 + 反馈表与 VM §5 — phase52 plan |
| **42–50** | 发版链文档闭环 | 运维/产品 | helper → SMOKE → VM §5 → UPSTREAM §3.2 — phase42–50 plans |

详细 Task 见 **`docs/TBOX_KB_DELIVERY_HARNESS.md`** §9.0 与 `docs/superpowers/plans/2026-05-31-tbox-phase*-plan.md`。

---

## 7. 验收标准（本规格）

- [x] 团队能用本矩阵回答：某能力要不要做、现在有没有、下一项做什么。
- [x] G1–G5 每项目标至少有一条 **P1** 或 **P0** 能力已规划或已完成。
- [x] 非目标清单与五条目标无矛盾。
- [x] `TBOX_KB_DELIVERY_HARNESS.md` §1 与本文 G1–G5 一致。
- [x] P0/P1 已交付项对应矩阵行 **web-tbox** 列已更新（2026-05-24）。

---

## 8. 相关文档

| 文档 | 关系 |
|------|------|
| [`TBOX_KB_DELIVERY_HARNESS.md`](../../TBOX_KB_DELIVERY_HARNESS.md) | 总纲、§9 迭代进度 |
| [`TBOX_PHASE2_PAGE_REQUIREMENTS_MEMO.md`](../../TBOX_PHASE2_PAGE_REQUIREMENTS_MEMO.md) | G4/G2 部分 UI 备忘 |
| [`2026-05-21-tbox-chat-apps-design.md`](2026-05-21-tbox-chat-apps-design.md) | G3 `/apps` 详细规格 |
| [`TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`](../../TBOX_UI_ACCEPTANCE_WALKTHROUGH.md) | 手测验收 |

---

## 9. 修订记录

| 日期 | 变更 |
|------|------|
| 2026-05-24 | 初版：G1–G5 矩阵、非目标、阶段 0–3 摘要；brainstorming 批准 |
| 2026-05-24 | P1 行回写（G4/G3/G2）；§7 验收勾选；worker 策略见 `common/tbox_crawl_strategy.py` |
| 2026-05-24 | Phase 0–7 里程碑完成（phase3–7 plan）；G3-MODEL-DEEPSEEK ✅；发版门禁 `tbox_release_smoke.sh` |
| 2026-05-31 | §6 Phase 52；ENV §6 + Walkthrough §六 与 VM §5 — phase52 |
