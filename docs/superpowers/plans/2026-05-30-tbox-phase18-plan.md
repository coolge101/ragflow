# TBOX 阶段 18（双账号 smoke env + Walkthrough 16–17）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 固化 `TBOX_SMOKE_NORMAL_*` 双账号权限冒烟配置；补全 Phase 16–17 UI 验收 Walkthrough。

**Architecture:** `scripts/tbox_smoke.env.example` + `tbox_load_smoke_env.sh` 由各 smoke 脚本 source；文档链到 VM 验收 §3 D。

**Tech Stack:** bash、Markdown、`web-tbox` journeySteps。

---

## Task 64: Smoke 环境变量模板

**Files:**
- Create: `scripts/tbox_smoke.env.example`
- Create: `scripts/tbox_load_smoke_env.sh`
- Create: `docs/TBOX_SMOKE_ENV.md`
- Modify: `.gitignore`（`scripts/tbox_smoke.env`）
- Modify: `tbox_release_smoke.sh`、`tbox_login_smoke.sh`、`tbox_permissions_smoke.sh`、`tbox_chat_apps_smoke.sh`

- [x] 复制 example → env 后双账号 permissions 可跑
- [x] docker exec 传递非空 NORMAL_* 变量

---

## Task 65: Walkthrough / journey 回写

**Files:**
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`（步骤 C/C2/D）
- Modify: `web-tbox/src/review/journeySteps.ts`

- [x] Citation 点击高亮、检索结果高亮验收要点

---

## Task 66: 部署文档交叉引用

**Files:**
- Modify: `docs/TBOX_DEPLOY_RUNBOOK.md`
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md` §2
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0

- [x] Phase 18 行 + TBOX_SMOKE_ENV 链接

---

## 验收

```bash
bash scripts/tbox_permissions_smoke.sh   # admin only OK
# 配置 scripts/tbox_smoke.env 后 normal_checked: true
```

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase18-plan.md`
