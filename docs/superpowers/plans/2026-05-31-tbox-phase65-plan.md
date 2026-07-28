# TBOX 阶段 65（s6_preflight ↔ post_merge + DEPLOY_FROM_GITHUB §6/§8）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** **`tbox_s6_preflight.sh`** 收尾与 **`tbox_post_upstream_merge.sh`** / Phase 16–17 链对齐；**`TBOX_DEPLOY_FROM_GITHUB.md` §6 / §8** 补 S6 merge 交叉引用。

**Architecture:** bash echo + Markdown 交叉引用 + Harness/单测。

**Tech Stack:** bash、Markdown、Python unittest。

---

## Task 217: s6_preflight 收尾

**Files:**
- Modify: `scripts/tbox_s6_preflight.sh`

- [x] post_merge · UPSTREAM §3.2 · DEPLOY_FROM_GITHUB §6 · QUICKSTART §1.3

---

## Task 218: DEPLOY_FROM_GITHUB §6 / §8

**Files:**
- Modify: `docs/TBOX_DEPLOY_FROM_GITHUB.md`

- [x] §6 S6 merge 链 + §8 日常 upstream 收尾

---

## Task 219: Harness §9 Phase 65

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md`

- [x] 修订记录 + Phase 65 行 + 里程碑 0–65

---

## Task 220: 单测

**Files:**
- Create: `test/unit_test/scripts/test_tbox_s6_preflight.py`

- [x] s6_preflight 与 DEPLOY_FROM_GITHUB §6 含 post_merge / §1.3

---

## 验收

```bash
grep -q "post_upstream_merge" scripts/tbox_s6_preflight.sh
grep -q "s6_preflight" docs/TBOX_DEPLOY_FROM_GITHUB.md
grep -q "Phase 65" docs/TBOX_KB_DELIVERY_HARNESS.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase65-plan.md`
