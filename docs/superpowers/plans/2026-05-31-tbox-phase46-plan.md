# TBOX 阶段 46（phase16-17 脚本收尾 + VM §5 文案统一）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `handtest`/`finish` 收尾对齐 review + helper；修复 `finish.sh` case 语法；VM 验收 §5 文案统一。

**Architecture:** bash echo + record `phase16_17_mark` 文案；文档 §5 说明段。

**Tech Stack:** bash、Markdown、Python unittest。

---

## Task 151: handtest / finish / archive 收尾

**Files:**
- Modify: `scripts/tbox_phase16_17_handtest.sh`
- Modify: `scripts/tbox_phase16_17_finish.sh`（修复 case 语法）
- Modify: `scripts/tbox_archive_phase16_17_handtest.sh`

- [x] review URL + helper + 统一 finish --archive

---

## Task 152: VM §5 文案

**Files:**
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md`
- Modify: `scripts/tbox_record_vm_acceptance.sh`

- [x] §5 说明 + phase16_17_mark 统一

---

## Task 153: 单测

**Files:**
- Create: `test/unit_test/scripts/test_tbox_phase16_17_scripts.py`

- [x] handtest 输出含 review / finish

---

## 验收

```bash
bash -n scripts/tbox_phase16_17_finish.sh
bash scripts/tbox_scripts_unit_check.sh
grep -q "review/step/phase16-17" docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase46-plan.md`
