# TBOX 阶段 66（SMOKE_SCRIPTS S6 专节 + QUICKSTART §1.2 ↔ DEPLOY §6/§8）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** **`TBOX_SMOKE_SCRIPTS.md`** 增 **S6 upstream merge** 专节（`s6_preflight` ↔ `post_merge`）；**`TBOX_QUICKSTART.md` §1.2** 与 **DEPLOY_FROM_GITHUB §6/§8** 交叉引用对齐。

**Architecture:** Markdown 交叉引用 + Harness/单测扩展。

**Tech Stack:** Markdown、Python unittest。

---

## Task 221: SMOKE_SCRIPTS S6 专节

**Files:**
- Modify: `docs/TBOX_SMOKE_SCRIPTS.md`

- [x] s6_preflight ↔ post_merge · DEPLOY §6/§8 · QUICKSTART §1.2 · Phase 16–17

---

## Task 222: QUICKSTART §1.2 对齐

**Files:**
- Modify: `docs/TBOX_QUICKSTART.md`

- [x] DEPLOY_FROM_GITHUB §6/§8 · SMOKE_SCRIPTS S6 · Phase 16–17 链

---

## Task 223: Harness §9 Phase 66

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md`

- [x] 修订记录 + Phase 66 行 + 里程碑 0–66

---

## Task 224: 单测

**Files:**
- Modify: `test/unit_test/scripts/test_tbox_smoke_scripts_doc.py`
- Modify: `test/unit_test/scripts/test_tbox_quickstart_doc.py`

- [x] SMOKE_SCRIPTS S6 专节 + QUICKSTART §1.2 含 DEPLOY §6/§8

---

## 验收

```bash
grep -q "## S6 upstream merge" docs/TBOX_SMOKE_SCRIPTS.md
grep -q "DEPLOY_FROM_GITHUB" docs/TBOX_QUICKSTART.md
grep -q "Phase 66" docs/TBOX_KB_DELIVERY_HARNESS.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase66-plan.md`
