# TBOX 阶段 31（Scripts 单测门禁 + §5 保留探测）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `tbox_scripts_unit_check.sh` 纳入 pre_release 与 CI；`record --no-probe` 保留 §5 已有 pass 行。

**Architecture:** unittest 无 Docker；§5 overlay 从锚点表格读取旧值。

**Tech Stack:** bash、pytest/unittest、GitHub Actions。

---

## Task 105: scripts 单测门禁

**Files:**
- Create: `scripts/tbox_scripts_unit_check.sh`
- Modify: `scripts/tbox_pre_release.sh`
- Modify: `scripts/tbox_post_upstream_merge.sh`

- [x] web-tbox 后跑 scripts unit

---

## Task 106: record §5 保留

**Files:**
- Modify: `scripts/tbox_record_vm_acceptance.sh`

- [x] `--no-probe` overlay 已有 pass 行

---

## Task 107: CI scripts_smoke 矩阵

**Files:**
- Modify: `.github/workflows/tbox-python-unit.yml`
- Modify: `docs/TBOX_ENV_AND_VERSIONS.md` §6

- [x] 新 suite `scripts_smoke`

---

## Task 108: 文档 + S6 §5

**Files:**
- Modify: `docs/TBOX_SMOKE_SCRIPTS.md`
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0

- [x] Phase 31 行

---

## 验收

```bash
bash scripts/tbox_scripts_unit_check.sh
bash scripts/tbox_record_vm_acceptance.sh --run-suite --write-section5
TBOX_PHASE16_17_HANDTEST_DONE=1 bash scripts/tbox_record_vm_acceptance.sh --no-probe --write-section5
python3 test/unit_test/scripts/test_tbox_console_bundle_smoke.py -q
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase31-plan.md`
