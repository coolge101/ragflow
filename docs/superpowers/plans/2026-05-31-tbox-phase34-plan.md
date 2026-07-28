# TBOX 阶段 34（gate 单测 + post-merge 双账号 + 手测归档链）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 双账号 gate 纳入 scripts 单测/CI；post-merge 透传 `TBOX_REQUIRE_DUAL_ACCOUNT`；Phase 16–17 手测 finish/archive 链（bundle 门禁 + `--confirm`）。

**Architecture:** Python subprocess 测 gate；`tbox_phase16_17_finish.sh` 串联 handtest → archive。

**Tech Stack:** bash、Python unittest、GitHub Actions。

---

## Task 115: gate 单测 + CI

**Files:**
- Create: `test/unit_test/scripts/test_tbox_smoke_env_gate.py`
- Modify: `scripts/tbox_scripts_unit_check.sh`
- Modify: `.github/workflows/tbox-python-unit.yml`

- [x] gate 三种 exit code；CI `scripts_smoke` 跑整个 `test/unit_test/scripts/`

---

## Task 116: post-merge 双账号透传

**Files:**
- Modify: `scripts/tbox_post_upstream_merge.sh`
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md`

- [x] `TBOX_REQUIRE_DUAL_ACCOUNT=1` 传入 pre_release

---

## Task 117: Phase 16–17 归档链

**Files:**
- Create: `scripts/tbox_phase16_17_finish.sh`
- Modify: `scripts/tbox_archive_phase16_17_handtest.sh`
- Modify: `scripts/tbox_phase16_17_handtest.sh`
- Modify: `docs/TBOX_SMOKE_SCRIPTS.md` 等

- [x] archive 前 bundle smoke；须 `--confirm`

---

## 验收

```bash
bash scripts/tbox_scripts_unit_check.sh
bash scripts/tbox_phase16_17_finish.sh
TBOX_SKIP_CONSOLE_BUNDLE_SMOKE=1 bash scripts/tbox_archive_phase16_17_handtest.sh --confirm
TBOX_SKIP_HOST_CHECK=1 bash scripts/tbox_pre_release.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase34-plan.md`
