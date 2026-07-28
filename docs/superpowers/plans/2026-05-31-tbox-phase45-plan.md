# TBOX 阶段 45（CONSOLE_REBUILD + setup_smoke_env 收尾）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `TBOX_CONSOLE_REBUILD.md` 补 helper / review / 三脚本链；`tbox_setup_smoke_env.sh` 收尾打印 pre_release + helper；setup 单测。

**Architecture:** 文档交叉引用 Runbook §3.1.3；bash echo 与 helper 对齐。

**Tech Stack:** bash、Markdown、Python unittest。

---

## Task 148: CONSOLE_REBUILD 文档

**Files:**
- Modify: `docs/TBOX_CONSOLE_REBUILD.md`
- Modify: `scripts/tbox_rebuild_console.sh`（收尾提示）

- [x] phase16-17 / review / helper / Runbook §3.1.3

---

## Task 149: setup_smoke_env 收尾

**Files:**
- Modify: `scripts/tbox_setup_smoke_env.sh`

- [x] 成功路径打印 pre_release + helper

---

## Task 150: setup 单测

**Files:**
- Create: `test/unit_test/scripts/test_tbox_setup_smoke_env.py`

- [x] `--check-only` 输出含 helper

---

## 验收

```bash
grep -q "tbox_print_release_next_steps" docs/TBOX_CONSOLE_REBUILD.md
bash scripts/tbox_scripts_unit_check.sh
bash scripts/tbox_setup_smoke_env.sh --check-only 2>&1 | grep -q pre_release
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase45-plan.md`
