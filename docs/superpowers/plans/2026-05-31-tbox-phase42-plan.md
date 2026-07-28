# TBOX 阶段 42（发版提示 helper + Runbook §3 + phase16-17 journey）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `tbox_print_release_next_steps.sh` 统一三脚本 5180/pre_release 提示；DEPLOY_RUNBOOK §3.1.3 交叉引用；新增 **`phase16-17`** journey 步。

**Architecture:** 单点 bash helper；journey + Walkthrough §2.2 对齐。

**Tech Stack:** bash、Markdown、TypeScript。

---

## Task 139: 发版提示 helper

**Files:**
- Create: `scripts/tbox_print_release_next_steps.sh`
- Modify: `scripts/tbox-up.sh`
- Modify: `scripts/start-tbox-ragflow.sh`
- Modify: `scripts/deploy-on-new-server.sh`

- [x] 三脚本调用同一 helper

---

## Task 140: DEPLOY_RUNBOOK §3.1.3

**Files:**
- Modify: `docs/TBOX_DEPLOY_RUNBOOK.md`

- [x] tbox-up / start-tbox / deploy-on-new-server 对照表

---

## Task 141: journey phase16-17

**Files:**
- Modify: `web-tbox/src/review/journeySteps.ts`
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md` §2.2

- [x] `/review/step/phase16-17`

---

## 验收

```bash
bash scripts/tbox_print_release_next_steps.sh | grep pre_release
grep -q "3.1.3" docs/TBOX_DEPLOY_RUNBOOK.md
cd web-tbox && npm test -- --run 2>&1 | tail -2
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase42-plan.md`
