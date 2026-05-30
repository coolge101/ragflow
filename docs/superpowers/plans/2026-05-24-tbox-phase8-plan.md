# TBOX 阶段 8（S6 差异快照 + 里程碑）开发计划

> **前置**：[`2026-05-24-tbox-phase7-plan.md`](./2026-05-24-tbox-phase7-plan.md) 已 commit/push。
> **Spec**：[`2026-05-24-tbox-capability-matrix-design.md`](../specs/2026-05-24-tbox-capability-matrix-design.md)

**Goal：** S6 上游差异可重复快照；S0 基线钉扎；Harness/矩阵标记 Phase 0–7 里程碑完成。

---

## Task 29: S6 上游差异快照脚本

**Files:**
- Create: `scripts/tbox_upstream_divergence.sh`
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §6

- [x] ahead/behind 输出 + 2026-05-24 快照记录

---

## Task 30: S0 基线更新（Phase 7 HEAD）

**Files:**
- Modify: `docs/TBOX_ENV_AND_VERSIONS.md` §2

- [x] HEAD `363d28341` + 备注

---

## Task 31: 里程碑闭环（Harness §9.0 / 矩阵 §9）

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0
- Modify: `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md` §9

- [x] Phase 0–7 完成说明；后续以 S6 合并 + 运维为主

---

## 验收

- [x] `bash scripts/tbox_upstream_divergence.sh`
- [x] `bash scripts/tbox_release_smoke.sh`

**Plan saved to:** `docs/superpowers/plans/2026-05-24-tbox-phase8-plan.md`
