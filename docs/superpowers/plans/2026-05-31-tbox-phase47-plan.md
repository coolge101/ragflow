# TBOX 阶段 47（SMOKE_SCRIPTS phase16-17 专节 + Walkthrough §2.1 对齐）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `TBOX_SMOKE_SCRIPTS.md` 新增 Phase 16–17 专节；Walkthrough §2.1 与 VM §5 文案完全对齐。

**Architecture:** 文档专节 + 表格统一 `handtest → review → finish --archive`。

**Tech Stack:** Markdown、Python unittest（文档关键字）。

---

## Task 154: SMOKE_SCRIPTS Phase 16–17 专节

**Files:**
- Modify: `docs/TBOX_SMOKE_SCRIPTS.md`

- [x] 专节 + 三脚本/helper + plans 14–46

---

## Task 155: Walkthrough §2.1 对齐 VM §5

**Files:**
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md` §2.1

- [x] 表格与 §5 三步文案一致

---

## Task 156: 文档单测

**Files:**
- Create: `test/unit_test/scripts/test_tbox_smoke_scripts_doc.py`

- [x] 断言 SMOKE_SCRIPTS 含 phase16-17 专节关键字

---

## 验收

```bash
grep -q "## Phase 16" docs/TBOX_SMOKE_SCRIPTS.md
grep -q "handtest → /review/step/phase16-17" docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase47-plan.md`
