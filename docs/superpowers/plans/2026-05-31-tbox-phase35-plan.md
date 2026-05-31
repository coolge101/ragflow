# TBOX 阶段 35（pre_release 矩阵 + CI 本地对号 + Walkthrough 对齐）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `tbox_pre_release.sh --help` 模式矩阵；QUICKSTART §6 补 `scripts_smoke` 本地对号；Walkthrough/VM 验收与 `finish --archive` 链对齐。

**Architecture:** 文档 + pre_release 内嵌 help；不新增重型脚本。

**Tech Stack:** bash、Markdown。

---

## Task 118: pre_release 模式矩阵

**Files:**
- Modify: `scripts/tbox_pre_release.sh`（`--help`）
- Modify: `docs/TBOX_SMOKE_SCRIPTS.md`

- [x] 四种模式 + 组合 env 表

---

## Task 119: QUICKSTART §6 + ENV §6

**Files:**
- Modify: `docs/TBOX_QUICKSTART.md` §6
- Modify: `docs/TBOX_ENV_AND_VERSIONS.md` §6（若需）

- [x] `scripts_smoke` / `host_check` / `pre_release` 本地对号

---

## Task 120: Walkthrough + VM 验收对齐

**Files:**
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md` §2.1
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md` §2

- [x] `tbox_phase16_17_finish.sh --archive` 链

---

## 验收

```bash
bash scripts/tbox_pre_release.sh --help
bash scripts/tbox_scripts_unit_check.sh
TBOX_SKIP_HOST_CHECK=1 bash scripts/tbox_pre_release.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase35-plan.md`
