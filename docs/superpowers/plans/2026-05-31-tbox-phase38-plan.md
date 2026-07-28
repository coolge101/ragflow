# TBOX 阶段 38（web-tbox README + GitHub 部署发版节 + journey L–P）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `web-tbox/README` 链 Walkthrough §2.2；`TBOX_DEPLOY_FROM_GITHUB` §6 发版链；`journeySteps` 与 Walkthrough L–P 验收要点对齐。

**Architecture:** 文档 + journey acceptance 增量；不新增脚本。

**Tech Stack:** Markdown、TypeScript。

---

## Task 127: web-tbox README

**Files:**
- Modify: `web-tbox/README.md`

- [x] Review §2.2、pre_release、5180 finish

---

## Task 128: DEPLOY_FROM_GITHUB 发版节

**Files:**
- Modify: `docs/TBOX_DEPLOY_FROM_GITHUB.md` §6

- [x] 与 Runbook §8.1 / pre_release 对齐

---

## Task 129: journeySteps L–P + Walkthrough

**Files:**
- Modify: `web-tbox/src/review/journeySteps.ts`
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md` L–P 表

- [x] chat/search/crawl/documents/audit 验收项与 L–P 一致

---

## 验收

```bash
grep -q "2.2" web-tbox/README.md
grep -q "pre_release.sh" docs/TBOX_DEPLOY_FROM_GITHUB.md
cd web-tbox && npm test -- --run 2>&1 | tail -3
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase38-plan.md`
