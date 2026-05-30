# TBOX 阶段 15（G5 权限 API 回归）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 将 §3 D「普通用户 vs admin 权限差异」沉淀为可自动化 API 冒烟；admin 必测，双账号在配置 env 时必测。

**Architecture:** `GET /v1/tbox/me` 的 `permissions` 与 `MainLayout` 侧栏对齐；bash 包装与 G3 chat apps 相同 runner；纳入 `tbox_release_smoke.sh`。

**Tech Stack:** Python 3、`requests`、`api.utils.crypt`、bash。

---

## Task 55: 权限 API 冒烟

**Files:**
- Create: `scripts/tbox_permissions_smoke.py`
- Create: `scripts/tbox_permissions_smoke.sh`

- [x] admin 登录 → `/v1/tbox/me` 含 `user.manage`、`audit.read`
- [x] 可选 `TBOX_SMOKE_NORMAL_EMAIL` + `TBOX_SMOKE_NORMAL_PASSWORD` → 普通用户无 admin 权限、有基础权限
- [x] 退出码 0 于当前栈

---

## Task 56: 纳入发版链

**Files:**
- Modify: `scripts/tbox_release_smoke.sh`（[6/6] permissions）
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md` §2

- [x] release smoke 6 步含 permissions

---

## Task 57: 文档与 Harness

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0
- Modify: `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md` §6
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md` §5

- [ ] Phase 15 行 + §5 HEAD 钉扎

---

## 验收

```bash
bash scripts/tbox_permissions_smoke.sh
bash scripts/tbox_release_smoke.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase15-plan.md`
