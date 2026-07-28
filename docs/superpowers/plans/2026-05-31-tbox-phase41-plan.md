# TBOX 阶段 41（tbox-up 提示 + QUICKSTART §1.2 + global 手测）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `tbox-up.sh` 与 start-tbox/deploy 发版提示一致；QUICKSTART §1.2 补 S6 preflight / pre_release；`journeySteps` global 含 Phase 16–17 归档链。

**Architecture:** bash echo + 文档 + journey acceptance 增量。

**Tech Stack:** bash、Markdown、TypeScript。

---

## Task 136: tbox-up 发版提示

**Files:**
- Modify: `scripts/tbox-up.sh`

- [x] `TBOX_CONSOLE=1` 时 5180 + pre_release echo

---

## Task 137: QUICKSTART §1.2

**Files:**
- Modify: `docs/TBOX_QUICKSTART.md` §1.2、本机准生产路径

- [x] s6_preflight / post-merge / start-tbox --console

---

## Task 138: journey global Phase 16–17

**Files:**
- Modify: `web-tbox/src/review/journeySteps.ts`

- [x] global 步验收项 + Walkthrough 链

---

## 验收

```bash
grep -q "pre_release" scripts/tbox-up.sh
grep -q "s6_preflight" docs/TBOX_QUICKSTART.md
cd web-tbox && npm test -- --run 2>&1 | tail -2
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase41-plan.md`
