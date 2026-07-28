# TBOX 阶段 21（web-tbox test 纳入 CI / post-merge）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 将 Phase 20 的 `npm test` 纳入 GitHub **`web-tbox.yml`** 与 **`tbox_post_upstream_merge.sh`**，与 typecheck/build 同链。

**Architecture:** 新增 `scripts/tbox_web_tbox_check.sh` 作为本地/ post-merge 单一入口。

**Tech Stack:** GitHub Actions、`bash`、`vitest`。

---

## Task 71: CI workflow

**Files:**
- Modify: `.github/workflows/web-tbox.yml`

- [x] `npm test` 在 typecheck 与 build 之间

---

## Task 72: post-merge 链

**Files:**
- Create: `scripts/tbox_web_tbox_check.sh`
- Modify: `scripts/tbox_post_upstream_merge.sh`

- [x] post-merge 调用统一脚本

---

## Task 73: 文档

**Files:**
- Modify: `docs/TBOX_ENV_AND_VERSIONS.md` §6
- Modify: `docs/TBOX_QUICKSTART.md`
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §3
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0

- [x] Phase 21 行

---

## 验收

```bash
bash scripts/tbox_web_tbox_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase21-plan.md`
