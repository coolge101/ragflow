# TBOX 阶段 62（setup_smoke_env ↔ example + Walkthrough §2.1 VM/SMOKE）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** **`tbox_setup_smoke_env.sh`** 收尾与 **`tbox_smoke.env.example`** 三步链对齐；Walkthrough **§2.1** 补 **VM §5** / **SMOKE_SCRIPTS** 链接。

**Architecture:** bash echo + Markdown 交叉引用 + Harness/矩阵 + 单测扩展。

**Tech Stack:** bash、Markdown、Python unittest。

---

## Task 206: setup_smoke_env 收尾

**Files:**
- Modify: `scripts/tbox_setup_smoke_env.sh`

- [x] Phase 16–17 handtest/finish + QUICKSTART §1.3 + VM §5

---

## Task 207: Walkthrough §2.1 链接

**Files:**
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`

- [x] VM §5 · SMOKE_SCRIPTS · smoke.env.example · 步骤 D

---

## Task 208: Harness §9 Phase 62

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md`

- [x] 修订记录 + Phase 62 行 + 里程碑 0–62

---

## Task 209: 单测

**Files:**
- Modify: `test/unit_test/scripts/test_tbox_setup_smoke_env.py`
- Modify: `test/unit_test/scripts/test_tbox_smoke_scripts_doc.py`

- [x] setup 与 Walkthrough §2.1 含 handtest / VM §5

---

## 验收

```bash
grep -q "tbox_phase16_17_handtest" scripts/tbox_setup_smoke_env.sh
grep -q "TBOX_VM_PRODUCTION_ACCEPTANCE" docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md
grep -q "Phase 62" docs/TBOX_KB_DELIVERY_HARNESS.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase62-plan.md`
