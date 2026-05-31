# TBOX 阶段 58（QUICKSTART §1.3 ↔ print_release + handtest 手册链接）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** **`TBOX_QUICKSTART.md` §1.3** 与 **`tbox_print_release_next_steps.sh`** 文案对齐；**`tbox_phase16_17_handtest.sh`** 收尾链至 **手册 §5.4**。

**Architecture:** Markdown + bash echo + Harness/矩阵 + 单测扩展。

**Tech Stack:** bash、Markdown、Python unittest。

---

## Task 190: QUICKSTART §1.3 对齐

**Files:**
- Modify: `docs/TBOX_QUICKSTART.md`

- [x] Phase 16–17 链与 print_release / host_check / 手册 §5.4 一致

---

## Task 191: handtest 收尾手册链接

**Files:**
- Modify: `scripts/tbox_phase16_17_handtest.sh`

- [x] 收尾打印 SYSTEM_USER_MANUAL §5.4 · Walkthrough 步骤 D

---

## Task 192: Harness §9 Phase 58

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md`

- [x] 修订记录 + Phase 58 行 + 里程碑 0–58

---

## Task 193: 单测

**Files:**
- Modify: `test/unit_test/scripts/test_tbox_quickstart_doc.py`
- Modify: `test/unit_test/scripts/test_tbox_phase16_17_scripts.py`

- [x] §1.3 与 handtest 含步骤 D / 手册 §5.4

---

## 验收

```bash
grep -q "步骤 D" docs/TBOX_QUICKSTART.md
grep -q "SYSTEM_USER_MANUAL.md" scripts/tbox_phase16_17_handtest.sh
grep -q "Phase 58" docs/TBOX_KB_DELIVERY_HARNESS.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase58-plan.md`
