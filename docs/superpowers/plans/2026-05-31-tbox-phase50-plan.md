# TBOX 阶段 50（UPSTREAM Runbook §3 + helper SMOKE 链接）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `TBOX_UPSTREAM_MERGE_RUNBOOK` §3 补 post-merge 后 Phase 16–17 三步链；`tbox_print_release_next_steps.sh` 输出补 SMOKE 文档与 handtest。

**Architecture:** bash echo + Runbook 专段；扩展 helper 单测。

**Tech Stack:** bash、Markdown、Python unittest。

---

## Task 163: helper SMOKE 链接 + 三步链

**Files:**
- Modify: `scripts/tbox_print_release_next_steps.sh`
- Modify: `test/unit_test/scripts/test_tbox_print_release_next_steps.py`

- [x] handtest + review + finish + SMOKE_SCRIPTS/SMOKE_ENV

---

## Task 164: UPSTREAM Runbook §3.2

**Files:**
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md`

- [x] post-merge 后三步链 + Runbook §8.1 交叉引用

---

## Task 165: Runbook 单测

**Files:**
- Modify: `test/unit_test/scripts/test_tbox_post_upstream_merge.py`

- [x] §3 含 phase16-17 链

---

## 验收

```bash
bash scripts/tbox_print_release_next_steps.sh | grep -q TBOX_SMOKE_SCRIPTS
grep -q "3.2" docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase50-plan.md`
