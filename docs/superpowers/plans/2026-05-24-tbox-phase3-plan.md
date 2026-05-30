# TBOX 阶段 3（P2）开发计划 — 骨架

> **前置**：[`2026-05-24-tbox-next-phase.md`](./2026-05-24-tbox-next-phase.md) 阶段 0–2（P0/P1）已完成或已手测验收。
> **Spec**：[`2026-05-24-tbox-capability-matrix-design.md`](../specs/2026-05-24-tbox-capability-matrix-design.md) §6 阶段 3。

**Goal：** 交付矩阵 **P2** 行：Office 导出、爬取高级源、文档高级能力；复审非目标边界。

---

## Task 11: Word/Excel/PPT 导出（G4-EXPORT-OFFICE）

**Files（计划）:**
- Create: `web-tbox/src/utils/exportOffice.ts`（或后端 endpoint）
- Modify: `ChatPage.tsx`、`SearchPage.tsx`

- [x] 选型：纯前端 `docx` / `xlsx`（`web-tbox/src/utils/exportOffice.ts`）
- [x] 检索结果 → Excel（列：序号、文档、相似度、片段）
- [x] 对话 → Word（标题 + 用户/助手段落）
- [x] 大文档性能提示（超 200 条消息 / 500 条检索片段时 confirm）
- [x] PPT 导出（Task 11b：`pptxgenjs`，`/` 与 `/search`）

### Task 11b: PPT 导出（G4-EXPORT-OFFICE 补全）

**Files:**
- Modify: `web-tbox/src/utils/exportOffice.ts`
- Modify: `web-tbox/src/pages/ChatPage.tsx`、`SearchPage.tsx`
- Dependency: `pptxgenjs`

- [x] 对话 → `.pptx`（封面 + 每条消息一页）
- [x] 检索 → `.pptx`（封面 + 每个片段一页）
- [x] 按需 `import("pptxgenjs")` 拆包

---

## Task 12: 爬取高级源（G2-CRAWL-AUTH / G2-CRAWL-API）

**Files（计划）:**
- Modify: `api/db/services/tbox_crawl_ingest_service.py`
- Modify: `docs/TBOX_API_BOUNDARY.md` §1.4 凭据说明

- [x] 需登录站点：环境变量 / secrets 映射（不入库）
- [x] API 拉取源：新 `source_type` **`http_api`** + `extra_config` 驱动
- [x] UI：`CrawlPage` 源类型扩展

---

## Task 13: 文档高级能力（G1-DOC-REPARSE / G1-KB-ZIP）

- [x] 文档重解析 UI + `doc.reparse` 权限（`POST /api/v1/documents/ingest`）
- [x] 整库 ZIP 导入/导出（客户端 ZIP + 官方 file GET / multipart upload）
- [x] 矩阵行回写

---

## Task 14: 审计筛选与导出（G5-UI-AUDIT P2）

- [x] `/audit` 时间/类型/状态/关键词筛选
- [x] CSV/Excel 导出（`export.data`）

---

## Task 15: G1 手测执行与矩阵闭环

**Files:**
- Modify: `docs/TBOX_INGEST_FORMAT_SMOKE.md`（填实测结果）

- [x] 实际上传 PDF/Word/Excel/图片样本并填表（`scripts/tbox_g1_ingest_format_smoke.py` API 冒烟）
- [x] 更新矩阵 `G1-OCR-IMAGE` 备注

---

## 验收

- [x] `npm run typecheck && npm run build`
- [x] `uv run pytest test/unit_test/common/test_tbox_crawl_strategy.py` 及相关
- [x] `TBOX_UI_ACCEPTANCE_WALKTHROUGH.md` 增补 P2 步骤

**Plan saved to:** `docs/superpowers/plans/2026-05-24-tbox-phase3-plan.md`
