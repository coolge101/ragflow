# TBOX 阶段 14（G3 对话应用 API 回归）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 为 `/apps` 对话应用模块增加可自动化 CRUD 冒烟，纳入发版链，降低 5180 手测后回归成本。

**Architecture:** Python 脚本 `tbox_chat_apps_smoke.py` 经 Docker 内 `requests` + `crypt` 登录；bash 包装与 G1/G3 相同 runner；挂入 `tbox_release_smoke.sh` 第 4 步。

**Tech Stack:** Python 3、`requests`、`api.utils.crypt`、bash。

---

## Task 52: 对话应用 CRUD 冒烟

**Files:**
- Create: `scripts/tbox_chat_apps_smoke.py`
- Create: `scripts/tbox_chat_apps_smoke.sh`

- [x] login → list → create → get → delete
- [x] 退出码 0 于当前栈

---

## Task 53: 纳入发版链

**Files:**
- Modify: `scripts/tbox_release_smoke.sh`（[4/5] chat apps）
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md` §2

- [x] release smoke 5 步：health / G1 / G3 / chat apps / P2

---

## Task 54: 文档与 Harness

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0
- Modify: `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md` §6

- [x] Phase 14 行 + phase13 → phase14 链

---

## 验收

```bash
bash scripts/tbox_chat_apps_smoke.sh
bash scripts/tbox_vm_production_acceptance.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase14-plan.md`
