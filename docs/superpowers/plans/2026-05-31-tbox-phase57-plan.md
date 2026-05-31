# TBOX 阶段 57（手册 §5.4 ↔ README D + print_release 交叉引用）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** **`TBOX_SYSTEM_USER_MANUAL.md` §5.4** 与 **web-tbox README** 步骤 D 文案对齐；**`tbox_print_release_next_steps.sh`** 补 **pre_release --help** / host_check / Walkthrough D 链接。

**Architecture:** Markdown 文案 + bash echo + Harness/矩阵 + 单测扩展。

**Tech Stack:** bash、Markdown、Python unittest。

---

## Task 186: 手册 §5.4 步骤 D

**Files:**
- Modify: `docs/TBOX_SYSTEM_USER_MANUAL.md`

- [x] 5180 准生产前置 + C §7 + D 与 README 一致

---

## Task 187: print_release helper 交叉引用

**Files:**
- Modify: `scripts/tbox_print_release_next_steps.sh`

- [x] pre_release --help · host_check · Walkthrough D · ENV §6.1

---

## Task 188: Harness §9 Phase 57

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md`

- [x] 修订记录 + Phase 57 行 + 里程碑 0–57

---

## Task 189: 单测

**Files:**
- Modify: `test/unit_test/scripts/test_tbox_print_release_next_steps.py`
- Modify: `test/unit_test/scripts/test_tbox_web_tbox_readme_doc.py`

- [x] helper 与手册 §5.4 含步骤 D / pre_release --help

---

## 验收

```bash
grep -q "步骤 D" docs/TBOX_SYSTEM_USER_MANUAL.md
bash scripts/tbox_print_release_next_steps.sh | grep -q "pre_release.sh --help"
grep -q "Phase 57" docs/TBOX_KB_DELIVERY_HARNESS.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase57-plan.md`
