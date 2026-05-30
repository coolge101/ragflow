# TBOX 阶段 5（G3 闭环 + S6/S7 交付硬化）开发计划

> **前置**：[`2026-05-24-tbox-phase4-plan.md`](./2026-05-24-tbox-phase4-plan.md) Task 16–18 已完成（待 commit）。
> **Spec**：[`2026-05-24-tbox-capability-matrix-design.md`](../specs/2026-05-24-tbox-capability-matrix-design.md)

**Goal：** 关闭 **G3-MODEL-DEEPSEEK** 自动化冒烟缺口；落地 **S6 上游合并** 与 **S7 发版对抗** 文档。

---

## Task 19: G3 DeepSeek API 冒烟（G3-MODEL-DEEPSEEK）

**Files:**
- Create: `scripts/tbox_g3_deepseek_smoke.py`
- Create: `docs/TBOX_DEEPSEEK_SMOKE.md`
- Modify: 矩阵 `G3-MODEL-DEEPSEEK` 备注

- [x] 脚本：health → LLM list → 可选 `TBOX_SMOKE_DEEPSEEK_API_KEY` → `POST /api/v1/chat/completions`
- [x] 文档与矩阵回写

---

## Task 20: S6 上游合并 Runbook（Harness §9.1 S6）

**Files:**
- Create: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md`
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0

- [x] 2～4 周合并流程、冲突清单、记录模板

---

## Task 21: S7 发版对抗 checklist（Harness §9.1 S7）

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §7.3 或新增 §7.5
- Modify: `docs/TBOX_QUICKSTART.md` §6

- [x] `RAGFLOW_ADVERSARIAL_TESTS=1` 发版前步骤与归档说明

---

## 验收

- [x] `uv run python3 scripts/tbox_g3_deepseek_smoke.py`（无 Key 时 `skipped` 分支清晰）
- [x] `npm run typecheck && npm run build`
- [ ] Phase 4 + Phase 5 未提交改动一并 commit

**Plan saved to:** `docs/superpowers/plans/2026-05-24-tbox-phase5-plan.md`
