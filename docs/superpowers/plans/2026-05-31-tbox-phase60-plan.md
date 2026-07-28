# TBOX 阶段 60（SMOKE_SCRIPTS ↔ SMOKE_ENV + archive QUICKSTART §1.3）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** **`TBOX_SMOKE_SCRIPTS.md`** Phase 16–17 专节与 **SMOKE_ENV** 对齐；**`tbox_archive_phase16_17_handtest.sh`** 收尾链至 **QUICKSTART §1.3**。

**Architecture:** Markdown 交叉引用 + bash echo + Harness/矩阵 + 单测扩展。

**Tech Stack:** bash、Markdown、Python unittest。

---

## Task 198: SMOKE_SCRIPTS Phase 16–17 对齐

**Files:**
- Modify: `docs/TBOX_SMOKE_SCRIPTS.md`

- [x] 步骤 D + QUICKSTART §1.3 + 同一链与 SMOKE_ENV 一致

---

## Task 199: archive 收尾 QUICKSTART §1.3

**Files:**
- Modify: `scripts/tbox_archive_phase16_17_handtest.sh`

- [x] ARCHIVE OK 后打印 §1.3 · SMOKE_ENV · SMOKE_SCRIPTS

---

## Task 200: Harness §9 Phase 60

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md`

- [x] 修订记录 + Phase 60 行 + 里程碑 0–60

---

## Task 201: 单测

**Files:**
- Modify: `test/unit_test/scripts/test_tbox_smoke_scripts_doc.py`
- Modify: `test/unit_test/scripts/test_tbox_phase16_17_scripts.py`

- [x] SMOKE_SCRIPTS 与 archive 含 §1.3 / 步骤 D

---

## 验收

```bash
grep -q "步骤 D" docs/TBOX_SMOKE_SCRIPTS.md
grep -q "QUICKSTART.md" scripts/tbox_archive_phase16_17_handtest.sh
grep -q "Phase 60" docs/TBOX_KB_DELIVERY_HARNESS.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase60-plan.md`
