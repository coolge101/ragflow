# TBOX 阶段 59（finish 收尾 ↔ handtest + SMOKE_ENV §1.3）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** **`tbox_phase16_17_finish.sh`** 收尾与 handtest 文档链对齐；**`TBOX_SMOKE_ENV.md`** Phase 16–17 专节补 **QUICKSTART §1.3** 链接。

**Architecture:** bash echo + Markdown 交叉引用 + Harness/矩阵 + 单测扩展。

**Tech Stack:** bash、Markdown、Python unittest。

---

## Task 194: finish 收尾对齐

**Files:**
- Modify: `scripts/tbox_phase16_17_finish.sh`

- [x] QUICKSTART §1.3 · 手册 §5.4 · SMOKE_ENV · pre_release --help

---

## Task 195: SMOKE_ENV Phase 16–17

**Files:**
- Modify: `docs/TBOX_SMOKE_ENV.md`

- [x] 步骤 D 5180 准生产前置 + QUICKSTART §1.3 交叉引用

---

## Task 196: Harness §9 Phase 59

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md`

- [x] 修订记录 + Phase 59 行 + 里程碑 0–59

---

## Task 197: 单测

**Files:**
- Modify: `test/unit_test/scripts/test_tbox_phase16_17_scripts.py`
- Modify: `test/unit_test/scripts/test_tbox_pre_release_help.py`

- [x] finish 与 SMOKE_ENV 含 §1.3 / 步骤 D

---

## 验收

```bash
grep -q "QUICKSTART.md" scripts/tbox_phase16_17_finish.sh
grep -q "§1.3" docs/TBOX_SMOKE_ENV.md
grep -q "Phase 59" docs/TBOX_KB_DELIVERY_HARNESS.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase59-plan.md`
