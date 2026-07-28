# TBOX 阶段 9（准生产 VM 验收 + G1-OCR 向导 UI）开发计划

> **前置**：Phase 8 已 push。
> **Spec**：G1-OCR-IMAGE、VM 准生产设计 §1.2

**Goal：** 交付 VM 5180 验收清单/脚本；`/documents` G1 多格式入库向导 UI。

---

## Task 32: 准生产 VM 验收

**Files:**
- Create: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md`
- Create: `scripts/tbox_vm_production_acceptance.sh`

- [x] 自动化 + 手测 checklist

---

## Task 33: G1-OCR 向导 UI（G1-OCR-IMAGE）

**Files:**
- Create: `web-tbox/src/utils/g1IngestFormatGuide.ts`
- Create: `web-tbox/src/components/G1IngestFormatGuide.tsx`
- Modify: `web-tbox/src/pages/DocumentsPage.tsx`

- [x] 格式表 + 上传分块 mismatch 提示 + 新建库分块说明

---

## Task 34: 矩阵 / Walkthrough 回写

- [x] `G1-OCR-IMAGE` web-tbox → ✅
- [x] Walkthrough 链到 VM 验收与 G1 向导

---

## 验收

- [x] `cd web-tbox && npm run typecheck`
- [x] `bash scripts/tbox_vm_production_acceptance.sh`（console 栈运行中；G1 冒烟 PNG 用 `picture` 分块）

**Plan saved to:** `docs/superpowers/plans/2026-05-24-tbox-phase9-plan.md`

**后续：** [`2026-05-30-tbox-phase10-plan.md`](./2026-05-30-tbox-phase10-plan.md)（S6 merge 后栈加固）
