# TBOX 阶段 28（§5 自动钉扎 + record 增强）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `tbox_record_vm_acceptance.sh --write-section5` 自动更新 VM 验收 §5；补充 smoke suite / dual check 状态；post-merge 收尾写 §5。

**Architecture:** Markdown 锚点 `<!-- tbox-vm-section5:start/end -->`；Python 替换表格。

**Tech Stack:** bash、Python3、Markdown。

---

## Task 95: §5 锚点与写入

**Files:**
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md`
- Modify: `scripts/tbox_record_vm_acceptance.sh`

- [x] `--write-section5` / `--run-suite`；表格含 smoke suite

---

## Task 96: post-merge 收尾

**Files:**
- Modify: `scripts/tbox_post_upstream_merge.sh`
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §3

- [x] VM 通过后 `TBOX_RECORD_WRITE_SECTION5=1` 写 §5

---

## Task 97: 文档 + S6 §5

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0
- Modify: `docs/TBOX_DEPLOY_RUNBOOK.md`

- [x] Phase 28 行

---

## 验收

```bash
bash scripts/tbox_record_vm_acceptance.sh --write-section5
bash scripts/tbox_record_vm_acceptance.sh --run-suite --write-section5   # 可选
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase28-plan.md`
