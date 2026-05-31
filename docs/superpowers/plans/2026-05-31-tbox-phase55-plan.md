# TBOX 阶段 55（host_check 与 web_tbox_check 对齐 + Walkthrough D handtest）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `tbox_host_check.sh` 收尾与 **`tbox_web_tbox_check.sh`** 一致；Walkthrough **步骤 D** 补 **handtest 先行** 说明。

**Architecture:** bash echo 对齐 + Walkthrough 文案 + Harness/矩阵里程碑 + 脚本单测。

**Tech Stack:** bash、Markdown、Python unittest。

---

## Task 178: host_check 收尾对齐

**Files:**
- Modify: `scripts/tbox_host_check.sh`

- [x] Phase 16–17 / print_release / ENV §6.1 提示（与 web_tbox_check 一致）

---

## Task 179: Walkthrough 步骤 D handtest 前置

**Files:**
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`

- [x] 5180 手测前先 `tbox_phase16_17_handtest.sh`；与 C §7 / §2.1 一致

---

## Task 180: Harness §9 Phase 55

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md`

- [x] 修订记录 + Phase 55 行 + 里程碑 0–55

---

## Task 181: host_check 单测

**Files:**
- Create: `test/unit_test/scripts/test_tbox_host_check.py`

- [x] 脚本含 phase16-17 / ENV 提示

---

## 验收

```bash
grep -q "tbox_phase16_17_handtest" scripts/tbox_host_check.sh
grep -q "handtest" docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md
grep -q "Phase 55" docs/TBOX_KB_DELIVERY_HARNESS.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase55-plan.md`
