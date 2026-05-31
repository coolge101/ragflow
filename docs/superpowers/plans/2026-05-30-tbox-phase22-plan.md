# TBOX 阶段 22（VM 验收链 + 漂移例行）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 将 `tbox_web_tbox_check.sh` 纳入 VM 准生产验收；刷新 S6 Runbook §5；增强 `tbox_record_vm_acceptance.sh` §5 草稿。

**Architecture:** VM acceptance 6 步；record 脚本输出与 §5 表对齐。

**Tech Stack:** bash、Markdown。

---

## Task 74: VM 验收 6 步

**Files:**
- Modify: `scripts/tbox_vm_production_acceptance.sh`
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md` §2

- [x] [5/6] web-tbox check；`TBOX_SKIP_WEB_TBOX_CHECK=1` 可跳过

---

## Task 75: 记录脚本增强

**Files:**
- Modify: `scripts/tbox_record_vm_acceptance.sh`

- [x] §5 草稿含 web-tbox / permissions 双账号提示

---

## Task 76: S6 漂移 + 文档

**Files:**
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §5
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0

- [x] `--fetch` 快照

---

## 验收

```bash
bash scripts/tbox_web_tbox_check.sh
bash scripts/tbox_record_vm_acceptance.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase22-plan.md`
