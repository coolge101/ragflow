# TBOX 阶段 51（QUICKSTART §6 + Harness §9 里程碑）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `TBOX_QUICKSTART.md` §6 补 Phase 16–17 / helper / post-merge 链；Harness §9.0 增 Phase 51 与 Phase 42–50 摘要修订记录。

**Architecture:** 文档 §6 命令块 + Harness 进度表；QUICKSTART 文档单测。

**Tech Stack:** Markdown、Python unittest。

---

## Task 166: QUICKSTART §6

**Files:**
- Modify: `docs/TBOX_QUICKSTART.md` §6

- [x] phase16-17 三步 + helper + UPSTREAM §3.2

---

## Task 167: Harness §9

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0 + 修订记录

- [x] Phase 51 行 + Phase 42–50 摘要 + 里程碑 0–51

---

## Task 168: QUICKSTART 单测

**Files:**
- Create: `test/unit_test/scripts/test_tbox_quickstart_doc.py`

- [x] §6 含 handtest / print_release

---

## 验收

```bash
grep -q "phase16_17_handtest" docs/TBOX_QUICKSTART.md
grep -q "Phase 51" docs/TBOX_KB_DELIVERY_HARNESS.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase51-plan.md`
