# TBOX 阶段 52（ENV §6 + Walkthrough §6 反馈表）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `TBOX_ENV_AND_VERSIONS.md` §6 补 scripts unit 与 Phase 16–17 链；Walkthrough **§六** 反馈表与 VM §5 文案对齐。

**Architecture:** 文档表格 + 命令块；文档单测。

**Tech Stack:** Markdown、Python unittest。

---

## Task 169: ENV §6 扩展

**Files:**
- Modify: `docs/TBOX_ENV_AND_VERSIONS.md` §6

- [x] scripts_smoke / host_check / phase16-17 链

---

## Task 170: Walkthrough §六 反馈表

**Files:**
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md` §六

- [x] handtest → review → finish 与 §5 一致

---

## Task 171: 文档单测

**Files:**
- Create: `test/unit_test/scripts/test_tbox_env_versions_doc.py`
- Modify: `test/unit_test/scripts/test_tbox_quickstart_doc.py`

- [x] ENV §6 + Walkthrough §六 关键字

---

## 验收

```bash
grep -q "tbox_scripts_unit_check" docs/TBOX_ENV_AND_VERSIONS.md
grep -q "handtest" docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase52-plan.md`
