# TBOX 阶段 44（DEPLOY_FROM_GITHUB §6 + smoke example phase16-17）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** GitHub 部署手册 §6 与 Runbook §3.1.3 / QUICKSTART §1.3 对齐；`tbox_smoke.env.example` 补 Phase 16–17 / helper 链；example 单测。

**Architecture:** 文档交叉引用 + example 注释；scripts unit 断言 example 关键行。

**Tech Stack:** Markdown、bash 注释、Python unittest。

---

## Task 145: DEPLOY_FROM_GITHUB §6

**Files:**
- Modify: `docs/TBOX_DEPLOY_FROM_GITHUB.md` §6

- [x] 三脚本 + helper + phase16-17 / review 链

---

## Task 146: smoke.env.example + SMOKE_ENV

**Files:**
- Modify: `scripts/tbox_smoke.env.example`
- Modify: `docs/TBOX_SMOKE_ENV.md`

- [x] handtest / finish / review / helper 注释

---

## Task 147: example 单测

**Files:**
- Create: `test/unit_test/scripts/test_tbox_smoke_env_example.py`

- [x] 断言 example 含 phase16-17 与 helper 关键字

---

## 验收

```bash
grep -q "tbox_print_release_next_steps" docs/TBOX_DEPLOY_FROM_GITHUB.md
grep -q "phase16-17" scripts/tbox_smoke.env.example
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase44-plan.md`
