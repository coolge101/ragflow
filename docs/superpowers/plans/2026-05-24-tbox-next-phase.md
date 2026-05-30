# TBOX 下一阶段开发 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以 [能力矩阵 spec](../specs/2026-05-24-tbox-capability-matrix-design.md) 为单一真相，完成 **阶段 0–1（P0 收尾）**，并为 **阶段 2（P1 补齐）** 预留可执行 Task。

**Architecture:** 文档矩阵驱动优先级 → P0 收尾（品牌、文档、DeepSeek 手测、镜像）→ P1 按 G4→G3→G2→G1 顺序交付。不展开 Agent/MCP 等非目标。

**Tech Stack:** `web-tbox`（Vite/React）、RAGFlow Quart API、`/v1/tbox/*`、Docker Compose。

**Spec:** `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md`

---

## File Structure（本计划创建/修改）

| 文件 | 职责 |
|------|------|
| `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md` | 能力矩阵（已批准） |
| `docs/superpowers/plans/2026-05-24-tbox-next-phase.md` | 本计划 |
| `docs/TBOX_KB_DELIVERY_HARNESS.md` | §1 五条目标、§8 修订、链到矩阵 |
| `docs/TBOX_PHASE2_PAGE_REQUIREMENTS_MEMO.md` | 链到矩阵；与 G4/G2 对齐 |
| `docs/TBOX_QUICKSTART.md` | 文档索引 + DeepSeek 手测步骤 |
| `web-tbox/src/pages/DocumentsPage.tsx` 等 | G5-BRAND 用户可见文案 |
| `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md` | 矩阵 P0 验收项 |

---

## 阶段 0：矩阵与基线（文档）

### Task 0: Harness §1 升级为五条产品目标

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md`

- [x] **Step 1:** §1 增加 G1–G5 表 + 链到矩阵 spec
- [x] **Step 2:** §8 修订记录增加 2026-05-24 行
- [x] **Step 3:** §9.0 增加一行「能力矩阵 / 下一阶段 plan」说明

### Task 1: 文档交叉引用

**Files:**
- Modify: `docs/TBOX_PHASE2_PAGE_REQUIREMENTS_MEMO.md`
- Modify: `docs/TBOX_QUICKSTART.md`

- [x] **Step 1:** PHASE2 文首增加矩阵 spec 链接
- [x] **Step 2:** QUICKSTART §5 增加矩阵 + plan 链接
- [x] **Step 3:** QUICKSTART 增加 **§3.2 DeepSeek 手测**（G3-MODEL-DEEPSEEK）

### Task 2: DeepSeek 手测步骤（文档）

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §7.5

- [x] **Step 1:** 将手测路径改为仅 **`web-tbox`**（`/kb` 配 Key → `/apps` 或 `/` 流式一轮）
- [x] **Step 2:** 验收勾选：health OK、无 502、引用侧栏可选

---

## 阶段 1：P0 收尾

### Task 3: 全站品牌清理（G5-BRAND）

**Files:**
- Modify: `web-tbox/src/pages/DocumentsPage.tsx`
- Modify: `web-tbox/src/pages/KbConfigPage.tsx`
- Modify: `web-tbox/src/pages/AuditPage.tsx`

- [x] **Step 1:** 替换用户可见「官方 web/RAGFlow/与官方一致」为 TBOX 表述
- [x] **Step 2:** 验证

```bash
rg -n "RAGFlow|官方界面|官方 web|官方 \`web|与官方" web-tbox/src/pages --glob '*.tsx'
```

Expected: 仅剩 `/**` 注释块内 RAGFlow 技术指代

- [x] **Step 3:**

```bash
cd web-tbox && npm run typecheck && npm run build
```

### Task 4: 矩阵 P0 行回写

**Files:**
- Modify: `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md`

- [x] **Step 1:** G5-BRAND 行 web-tbox 改为 ✅（Task 3 完成后）
- [x] **Step 2:** §7 验收清单勾选已完成的 P0 文档项

### Task 5: Chat Apps 文档收尾（G3-APP-CRUD P0）

**Files:**
- Modify: `docs/TBOX_UI_DESIGN_DETAIL.md`（§ 增加 `/apps` 现状一句，若缺失）
- Modify: `docs/TBOX_DEPLOY_RUNBOOK.md`（一期范围表含 `/apps`，若缺失）

- [x] **Step 1:** 确认 RUNBOOK、DESIGN_DETAIL、WALKTHROUGH 已含 `/apps`；缺则补一句
- [x] **Step 2:** `npm run typecheck && npm run build` 仍 PASS

---

## 阶段 2：P1 补齐（后续迭代，本计划仅列 Task 骨架）

> **执行顺序**：G4 导出 → G3 场景模板 → G2 爬取 UI → G1 手测文档

### Task 6: 对话/检索 Markdown + PDF 导出（G4-EXPORT-MD/PDF）

**Files（计划）:**
- Create: `web-tbox/src/utils/exportConsultationResult.ts`
- Modify: `web-tbox/src/pages/ChatPage.tsx`
- Modify: `web-tbox/src/pages/SearchPage.tsx`

- [x] 设计导出内容 schema（消息 + 引用 / 检索 rows）
- [x] MD：`Blob` + `download` 文件名 `tbox-chat-{date}.md`
- [x] PDF：打印窗口或 `window.print` 专用样式（与 review 流类似）
- [x] 验收：中英文 UTF-8；大会话性能提示

### Task 7: 咨询/决策/辅导 三套应用模板（G3-SCENARIO）

**Files（计划）:**
- Create: `web-tbox/src/utils/chatAppScenarioTemplates.ts`
- Modify: `web-tbox/src/pages/ChatAppsPage.tsx` 或 `ChatAppEditPage.tsx`

- [x] 三套 `createEmptyChatAppForm()` 衍生：system prompt、prologue、top_n 等差异
- [x] 「从模板新建」入口
- [x] 对话页空态链到对应模板

### Task 8: 爬取关键词与任务类型 UI（G2-CRAWL-KEYWORD/MODE）

**Files（计划）:**
- Modify: `web-tbox/src/pages/CrawlPage.tsx`
- Reference: `docs/TBOX_API_BOUNDARY.md` §1.2 `extra_config`

- [x] 表单项：关键词列表、最大深度、允许域名（映射 extra_config）
- [x] 任务类型：定时 / 专项（专项 = 无 cron 或单次 + 手动 run）

### Task 9: G1 多格式样本手测（G1-OCR-IMAGE）

**Files（计划）:**
- Create: `docs/TBOX_INGEST_FORMAT_SMOKE.md`

- [x] PDF/Word/Excel/图片各 1 样本上传→解析→检索/对话引用

---

## 阶段 P1 收尾（文档与验收）

### Task 10: 验收与矩阵闭环

**Files:**
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`
- Modify: `web-tbox/src/review/journeySteps.ts`
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0
- Modify: `docs/TBOX_PHASE2_PAGE_REQUIREMENTS_MEMO.md`
- Create: `docs/superpowers/plans/2026-05-24-tbox-phase3-plan.md`

- [x] 验收文档增补：导出、场景模板、爬取策略
- [x] `journeySteps` 与 P1 行为对齐
- [x] Harness §9.0 P1 状态更新
- [x] 创建 P2 phase3 plan 骨架
- [x] 单元测试：`test_tbox_crawl_strategy.py`、`test_tbox_crawl_tick_strategy.py`

```bash
cd web-tbox && npm run typecheck && npm run build
uv run pytest test/unit_test/common/test_tbox_crawl_strategy.py test/unit_test/api/db/services/test_tbox_crawl_tick_strategy.py -q
```

---

## Plan complete (through P1 + Task 10)

| Spec 要求 | Plan Task |
|-----------|-----------|
| G1–G5 矩阵 | Task 0, 4, 10 |
| 非目标节 | spec §3（无需 Task） |
| 阶段 0 基线 | Task 0–2 |
| 阶段 1 P0 | Task 3–5 |
| 阶段 2 P1 | Task 6–10 |
| Harness §1 一致 | Task 0 |

**下一阶段：** [`2026-05-24-tbox-phase3-plan.md`](./2026-05-24-tbox-phase3-plan.md)（P2：Office 导出、爬取高级源等）

**Plan saved to:** `docs/superpowers/plans/2026-05-24-tbox-next-phase.md`
