# TBOX 阶段 23（Console 重建 + 双账号配置校验）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 提供 Phase 16–17 5180 手测前的 **`tbox_rebuild_console.sh`**；permissions smoke 拒绝半填双账号 env。

**Architecture:** 脚本 = host check → docker build → force-recreate → curl；Dockerfile 内嵌 test。

**Tech Stack:** bash、Docker、`docs/TBOX_CONSOLE_REBUILD.md`。

---

## Task 77: Console 重建脚本

**Files:**
- Create: `scripts/tbox_rebuild_console.sh`
- Create: `docs/TBOX_CONSOLE_REBUILD.md`
- Modify: `docker/Dockerfile.tbox-console`
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md` §2

- [x] 一键重建 + 5180 探测

---

## Task 78: 双账号 env 校验

**Files:**
- Modify: `scripts/tbox_permissions_smoke.py`
- Modify: `docs/TBOX_SMOKE_ENV.md`

- [x] 仅填 EMAIL 或 PASSWORD 之一时 fail 并提示

---

## Task 79: 文档

**Files:**
- Modify: `docs/TBOX_DEPLOY_RUNBOOK.md` §7.3
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0

- [x] Phase 23 行

---

## 验收

```bash
bash scripts/tbox_rebuild_console.sh   # 需 Docker + 网络（npm ci 在镜像内）
```

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase23-plan.md`
