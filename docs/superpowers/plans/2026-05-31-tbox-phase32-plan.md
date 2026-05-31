# TBOX 阶段 32（Host 检查链 + smoke env 初始化）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `tbox_host_check.sh` 合并 web-tbox + scripts 单测；`tbox_setup_smoke_env.sh` 初始化双账号 env；pre/post-merge 简化。

**Architecture:** host check = 宿主机无 Docker 门禁；setup 复制 example 并校验。

**Tech Stack:** bash、Markdown。

---

## Task 109: Host 检查链

**Files:**
- Create: `scripts/tbox_host_check.sh`
- Modify: `scripts/tbox_pre_release.sh`
- Modify: `scripts/tbox_post_upstream_merge.sh`

- [x] 替代分散的 web-tbox + scripts unit 调用

---

## Task 110: smoke env 初始化

**Files:**
- Create: `scripts/tbox_setup_smoke_env.sh`
- Modify: `docs/TBOX_SMOKE_ENV.md`

- [x] `cp example` + dual check 提示

---

## Task 111: 文档 + S6 §5

**Files:**
- Modify: `docs/TBOX_SMOKE_SCRIPTS.md`
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §5

- [x] Phase 32 行

---

## 验收

```bash
bash scripts/tbox_host_check.sh
bash scripts/tbox_setup_smoke_env.sh
TBOX_SKIP_HOST_CHECK=1 bash scripts/tbox_pre_release.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase32-plan.md`
