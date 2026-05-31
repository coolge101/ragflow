# TBOX 阶段 56（pre_release --help ↔ host_check + README 步骤 D）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `tbox_pre_release.sh --help` 与 **`tbox_host_check.sh`** 收尾交叉引用；**`web-tbox/README`** 补 Walkthrough **步骤 D handtest** 链接。

**Architecture:** bash heredoc + README 文案 + Harness/矩阵 + 单测扩展。

**Tech Stack:** bash、Markdown、Python unittest。

---

## Task 182: pre_release --help 交叉引用

**Files:**
- Modify: `scripts/tbox_pre_release.sh`

- [x] host_check / ENV §6.1 / Walkthrough 步骤 D handtest

---

## Task 183: web-tbox README 步骤 D

**Files:**
- Modify: `web-tbox/README.md`

- [x] 5180 handtest 先行 + C §7 + D 链

---

## Task 184: Harness §9 Phase 56

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md`

- [x] 修订记录 + Phase 56 行 + 里程碑 0–56

---

## Task 185: 单测

**Files:**
- Modify: `test/unit_test/scripts/test_tbox_pre_release_help.py`
- Modify: `test/unit_test/scripts/test_tbox_web_tbox_readme_doc.py`

- [x] help 含 host_check / 步骤 D；README 含 handtest 前置

---

## 验收

```bash
bash scripts/tbox_pre_release.sh --help | grep -q tbox_host_check
grep -q "步骤 D" web-tbox/README.md
grep -q "Phase 56" docs/TBOX_KB_DELIVERY_HARNESS.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase56-plan.md`
