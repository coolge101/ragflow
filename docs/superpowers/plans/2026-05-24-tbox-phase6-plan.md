# TBOX 阶段 6（发版门禁 + S0 基线）开发计划

> **前置**：[`2026-05-24-tbox-phase5-plan.md`](./2026-05-24-tbox-phase5-plan.md) 已 commit/push。
> **Spec**：[`2026-05-24-tbox-capability-matrix-design.md`](../specs/2026-05-24-tbox-capability-matrix-design.md)

**Goal：** 统一发版冒烟入口、更新 S0 基线 commit、补齐 G1 Excel 产品提示。

---

## Task 22: 发版冒烟脚本（Harness §7.6）

**Files:**
- Create: `scripts/tbox_release_smoke.sh`
- Modify: `docs/TBOX_QUICKSTART.md` §6
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §7.6

- [x] health + G1 + G3 一键脚本
- [x] 文档链入

---

## Task 23: S0 基线 commit 更新

**Files:**
- Modify: `docs/TBOX_ENV_AND_VERSIONS.md` §2

- [x] 钉扎当前 `HEAD` 与记录日期

---

## Task 24: G1 Excel 上传提示（Documents UI）

**Files:**
- Modify: `web-tbox/src/pages/DocumentsPage.tsx`

- [x] 说明 Excel 须表头行 + 数据行（`ExcelParser` 约定）

---

## 验收

- [x] `bash scripts/tbox_release_smoke.sh`
- [x] `cd web-tbox && npm run typecheck`

**Plan saved to:** `docs/superpowers/plans/2026-05-24-tbox-phase6-plan.md`
