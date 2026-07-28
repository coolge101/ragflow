# TBOX 阶段 29（发版门禁 + record 快速钉扎）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 一键 `tbox_pre_release.sh`（web-tbox → smoke suite → §5）；`--no-probe` 仅更新 HEAD/手测标记；冒烟脚本索引文档。

**Architecture:** pre_release 调用 `record --run-suite --write-section5`；可选 `TBOX_PRE_RELEASE_VM=1` 跑 7 步 VM。

**Tech Stack:** bash、Markdown。

---

## Task 98: 发版门禁

**Files:**
- Create: `scripts/tbox_pre_release.sh`
- Modify: `docs/TBOX_DEPLOY_RUNBOOK.md`
- Modify: `docs/TBOX_QUICKSTART.md`

- [x] 默认 suite + §5；可选 VM

---

## Task 99: record --no-probe

**Files:**
- Modify: `scripts/tbox_record_vm_acceptance.sh`

- [x] 跳过重复 probe，仅钉扎 HEAD/日期/手测 env

---

## Task 100: 脚本索引 + S6 §5

**Files:**
- Create: `docs/TBOX_SMOKE_SCRIPTS.md`
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §5

- [x] Phase 29 行

---

## 验收

```bash
bash scripts/tbox_pre_release.sh
bash scripts/tbox_record_vm_acceptance.sh --no-probe --write-section5
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase29-plan.md`
