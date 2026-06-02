# TBOX 阶段 30（Post-merge 整合 + 手测归档）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** post-merge 用 `tbox_pre_release.sh` 替代重复 smoke/VM；修复 pre_release VM 双跑；`tbox_archive_phase16_17_handtest.sh` 一键归档。

**Architecture:** post-merge 末尾 `TBOX_PRE_RELEASE_VM=1` + `TBOX_SKIP_WEB_TBOX_CHECK=1`；手测归档 = env + `--no-probe --write-section5`。

**Tech Stack:** bash、Markdown。

---

## Task 101: 修复 pre_release VM 双跑

**Files:**
- Modify: `scripts/tbox_pre_release.sh`

- [x] `TBOX_PRE_RELEASE_VM=1` 时仅 `record --run-smoke --write-section5`

---

## Task 102: post-merge 整合

**Files:**
- Modify: `scripts/tbox_post_upstream_merge.sh`
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §3

- [x] 去掉独立 release smoke + VM + record，改 pre_release

---

## Task 103: 手测归档脚本

**Files:**
- Create: `scripts/tbox_archive_phase16_17_handtest.sh`
- Modify: `docs/TBOX_CONSOLE_REBUILD.md`
- Modify: `docs/TBOX_SMOKE_SCRIPTS.md`

- [x] 设置 `TBOX_PHASE16_17_HANDTEST_DONE=1` 并写 §5

---

## Task 104: 文档 + S6 §5

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0

- [x] Phase 30 行

---

## 验收

```bash
bash scripts/tbox_archive_phase16_17_handtest.sh   # 仅写 §5，不代替浏览器手测
TBOX_SKIP_WEB_TBOX_CHECK=1 TBOX_PRE_RELEASE_VM=1 bash scripts/tbox_pre_release.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase30-plan.md`
