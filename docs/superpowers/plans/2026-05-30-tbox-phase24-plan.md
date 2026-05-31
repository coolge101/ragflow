# TBOX 阶段 24（Post-merge Console 链 + 双账号门禁）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `web-tbox/` 变更后 post-merge 自动 force-recreate 5180；VM 验收可选 `TBOX_REQUIRE_DUAL_ACCOUNT=1`；刷新 S6 §5 漂移。

**Architecture:** `tbox_web_tbox_git_changed.sh` 检测 diff；post-merge 在 compose 后条件调用 `tbox_rebuild_console.sh`（跳过重复 npm check）。

**Tech Stack:** bash、Markdown。

---

## Task 80: web-tbox 变更检测

**Files:**
- Create: `scripts/tbox_web_tbox_git_changed.sh`

- [x] 默认对比 `merge-base..HEAD`；`TBOX_GIT_DIFF_BASE` 可覆盖

---

## Task 81: Post-merge 链 console 重建

**Files:**
- Modify: `scripts/tbox_post_upstream_merge.sh`
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §3

- [x] `TBOX_REBUILD_CONSOLE=auto|1|0`；auto 时在 web-tbox 有 diff 时重建

---

## Task 82: 双账号门禁

**Files:**
- Modify: `scripts/tbox_load_smoke_env.sh`
- Modify: `scripts/tbox_permissions_smoke.sh`
- Modify: `scripts/tbox_vm_production_acceptance.sh`
- Modify: `docs/TBOX_SMOKE_ENV.md`

- [x] `TBOX_REQUIRE_DUAL_ACCOUNT=1` 时 permissions 须 `normal_checked: true`

---

## Task 83: 文档 + S6 §5

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md`
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §5

- [x] Phase 24 行；漂移 `--fetch` 快照

---

## 验收

```bash
bash scripts/tbox_web_tbox_git_changed.sh
TBOX_REBUILD_CONSOLE=0 bash scripts/tbox_post_upstream_merge.sh   # dry path
bash scripts/tbox_web_tbox_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase24-plan.md`
