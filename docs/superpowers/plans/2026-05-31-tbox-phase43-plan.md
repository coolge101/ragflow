# TBOX 阶段 43（helper 单测 + QUICKSTART §1.3 + 手册 §5.4）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `tbox_print_release_next_steps.sh` 纳入 scripts unit；QUICKSTART §1.3 三脚本表；`SYSTEM_USER_MANUAL` §5.4 补 phase16-17 / helper 链。

**Architecture:** Python unittest 断言 helper 输出；文档与 Runbook §3.1.3 交叉引用。

**Tech Stack:** bash、Python unittest、Markdown。

---

## Task 142: helper 单测 + host_check 提示

**Files:**
- Create: `test/unit_test/scripts/test_tbox_print_release_next_steps.py`
- Modify: `scripts/tbox_host_check.sh`

- [x] unittest 覆盖 pre_release / finish / 三脚本引用

---

## Task 143: QUICKSTART §1.3

**Files:**
- Modify: `docs/TBOX_QUICKSTART.md`

- [x] 三脚本 + helper 对照表；VM 路径补 helper

---

## Task 144: SYSTEM_USER_MANUAL §5.4

**Files:**
- Modify: `docs/TBOX_SYSTEM_USER_MANUAL.md`
- Modify: `web-tbox/README.md`

- [x] phase16-17 / `/review/step/phase16-17` / helper

---

## 验收

```bash
bash scripts/tbox_scripts_unit_check.sh
grep -q "1.3" docs/TBOX_QUICKSTART.md
grep -q "phase16-17" docs/TBOX_SYSTEM_USER_MANUAL.md
bash scripts/tbox_host_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase43-plan.md`
