# TBOX 阶段 27（Smoke 套件 + 双账号校验 + 5180 Walkthrough）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 一键 `tbox_smoke_suite.sh`（console + login + release）；`tbox_dual_account_check.sh`；Walkthrough 补 5180 准生产节。

**Architecture:** suite 组合既有 smoke；dual check 复用 `_tbox_smoke_dual_account_configured`。

**Tech Stack:** bash、Markdown。

---

## Task 91: Smoke 套件

**Files:**
- Create: `scripts/tbox_smoke_suite.sh`
- Modify: `docs/TBOX_SMOKE_ENV.md`
- Modify: `docs/TBOX_DEPLOY_RUNBOOK.md`

- [x] console bundle → login → release smoke

---

## Task 92: 双账号 env 校验

**Files:**
- Create: `scripts/tbox_dual_account_check.sh`
- Modify: `scripts/tbox_vm_production_acceptance.sh`（失败提示）

- [x] 半填 / 未填时清晰 exit 1

---

## Task 93: 5180 Walkthrough

**Files:**
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`
- Modify: `docs/TBOX_QUICKSTART.md`

- [x] §2.1 5180 准生产与 Phase 16–17 手测链

---

## Task 94: 文档 + S6 §5

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md`
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §5

- [x] Phase 27 行

---

## 验收

```bash
bash scripts/tbox_dual_account_check.sh    # 无 env 时 exit 1 预期
bash scripts/tbox_console_bundle_smoke.sh
bash scripts/tbox_smoke_suite.sh           # 需 Docker 栈
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase27-plan.md`
