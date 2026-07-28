# TBOX 阶段 37（Review 映射 + 用户手册发版节 + smoke example）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** Walkthrough 步骤 ↔ `/review/step/:id` 映射表；`TBOX_SYSTEM_USER_MANUAL` 发版节与 Runbook §8.1 对齐；`tbox_smoke.env.example` 补 pre_release 注释。

**Architecture:** 纯文档 + example 注释；引用 `journeySteps.ts` id。

**Tech Stack:** Markdown、bash 注释。

---

## Task 124: Review ↔ Walkthrough 映射

**Files:**
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md` §2.2

- [x] 步骤 A–Q ↔ journey id ↔ review URL

---

## Task 125: SYSTEM_USER_MANUAL 发版节

**Files:**
- Modify: `docs/TBOX_SYSTEM_USER_MANUAL.md` §5.4

- [x] 链到 Runbook §8.1 / SMOKE_ENV / pre_release --help

---

## Task 126: smoke.env.example

**Files:**
- Modify: `scripts/tbox_smoke.env.example`

- [x] pre_release / 双账号 / Phase 16–17 注释

---

## 验收

```bash
grep -q "review/step/chat" docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md
grep -q "pre_release.sh --help" docs/TBOX_SYSTEM_USER_MANUAL.md
grep -q "TBOX_PRE_RELEASE_VM" scripts/tbox_smoke.env.example
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase37-plan.md`
