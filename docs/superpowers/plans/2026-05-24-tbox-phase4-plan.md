# TBOX 阶段 4（G1 闭环 + 交付硬化）开发计划

> **前置**：[`2026-05-24-tbox-phase3-plan.md`](./2026-05-24-tbox-phase3-plan.md) Task 11–15 已完成。
> **Spec**：[`2026-05-24-tbox-capability-matrix-design.md`](../specs/2026-05-24-tbox-capability-matrix-design.md)

**Goal：** 关闭 G1 冒烟缺口（Excel/PNG 0 chunk）、同步 Harness 进度，并为 S5 Docker 交付铺路。

---

## Task 16: G1 冒烟缺口修复（G1-OCR-IMAGE / G1-DOC-UPLOAD）

**根因（2026-05-24 API 冒烟）：**
- **PNG**：OCR 有文本但 `len(txt)≤32` 时走 CV LLM；未配置默认 **image2text** 模型则 `picture.py` 返回空列表。
- **Excel**：`ExcelParser` 将第 1 行作表头、第 2 行起作数据；单行 xlsx 产生 0 section。

**Files:**
- Modify: `rag/app/picture.py`（CV LLM 失败时回退 OCR 文本）
- Modify: `scripts/tbox_g1_ingest_format_smoke.py`（Excel 表头+数据行样本）
- Modify: `docs/TBOX_INGEST_FORMAT_SMOKE.md` §5
- Modify: 矩阵 `G1-OCR-IMAGE` 备注

- [x] picture OCR 回退 + 冒烟脚本 Excel 样本
- [x] 重跑冒烟并回写文档

---

## Task 17: Harness / 矩阵 Phase 3 闭环

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0
- Modify: `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md` §6

- [x] §9.0 标记 P2（Phase 3）已落地
- [x] §6 增加阶段 4 摘要行

---

## Task 18: S5 Docker 交付准备（Harness §9.1 S5）

**Files:**
- Modify: `docker/README.md`
- Modify: `docs/TBOX_QUICKSTART.md`

- [x] 第三方冷启动 checklist（Compose + `.env.example` 对照）
- [x] amd64 验证说明

---

## 验收

- [x] `uv run python3 scripts/tbox_g1_ingest_format_smoke.py` — PDF/Word/Excel/PNG 检索命中
- [x] `npm run typecheck && npm run build`
- [x] `uv run pytest test/unit_test/common/test_tbox_crawl_strategy.py -q`

**下一阶段：** [`2026-05-24-tbox-phase5-plan.md`](./2026-05-24-tbox-phase5-plan.md)

**Plan saved to:** `docs/superpowers/plans/2026-05-24-tbox-phase4-plan.md`
