# TBOX 阶段 48（SMOKE_ENV 专节交叉引用 + pre_release --help）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `TBOX_SMOKE_ENV.md` 补 Phase 16–17 专节并链到 SMOKE_SCRIPTS；`tbox_pre_release.sh --help` 与收尾输出对齐 VM §5 三步链。

**Architecture:** 文档专节 + bash `--help`/echo；scripts unit 断言 help 输出。

**Tech Stack:** bash、Markdown、Python unittest。

---

## Task 157: SMOKE_ENV Phase 16–17 专节

**Files:**
- Modify: `docs/TBOX_SMOKE_ENV.md`

- [x] 三步链 + 交叉引用 SMOKE_SCRIPTS 专节

---

## Task 158: pre_release --help + 收尾

**Files:**
- Modify: `scripts/tbox_pre_release.sh`

- [x] handtest → review → finish + helper

---

## Task 159: pre_release help 单测

**Files:**
- Create: `test/unit_test/scripts/test_tbox_pre_release_help.py`

- [x] `--help` 含 phase16-17 链

---

## 验收

```bash
bash scripts/tbox_pre_release.sh --help | grep -q handtest
grep -q "Phase 16–17 浏览器手测" docs/TBOX_SMOKE_ENV.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase48-plan.md`
