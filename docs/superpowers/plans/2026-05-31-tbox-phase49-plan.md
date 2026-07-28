# TBOX 阶段 49（post-merge 收尾 + Runbook §8.1 交叉引用）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `tbox_post_upstream_merge.sh` 收尾对齐 VM §5 三步链；`DEPLOY_RUNBOOK` §8.1 与 SMOKE 文档完全交叉引用。

**Architecture:** bash echo + Runbook 表格/专段；scripts unit 断言 post-merge 收尾文案。

**Tech Stack:** bash、Markdown、Python unittest。

---

## Task 160: post-merge 收尾

**Files:**
- Modify: `scripts/tbox_post_upstream_merge.sh`

- [x] handtest → review → finish + helper

---

## Task 161: Runbook §8.1

**Files:**
- Modify: `docs/TBOX_DEPLOY_RUNBOOK.md` §8.1

- [x] 三步链 + SMOKE_SCRIPTS/SMOKE_ENV 交叉引用

---

## Task 162: post-merge 单测

**Files:**
- Create: `test/unit_test/scripts/test_tbox_post_upstream_merge.py`

- [x] 脚本含三步链关键字

---

## 验收

```bash
grep -q "phase16-17" scripts/tbox_post_upstream_merge.sh
grep -q "SMOKE_SCRIPTS.md" docs/TBOX_DEPLOY_RUNBOOK.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase49-plan.md`
