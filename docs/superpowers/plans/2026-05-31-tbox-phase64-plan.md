# TBOX 阶段 64（UPSTREAM §3.2 ↔ Runbook §8.1 + post_merge QUICKSTART §1.3）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** **`TBOX_UPSTREAM_MERGE_RUNBOOK.md` §3.2** 与 **DEPLOY Runbook §8.1** 交叉引用对齐；**`tbox_post_upstream_merge.sh`** 收尾补 **QUICKSTART §1.3** 链接。

**Architecture:** Markdown + bash echo + Harness/矩阵 + 单测扩展。

**Tech Stack:** bash、Markdown、Python unittest。

---

## Task 213: UPSTREAM §3.2 对齐

**Files:**
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md`

- [x] 步骤 D + §8.1 + Walkthrough §2.1 + 同一链

---

## Task 214: post_merge 收尾 QUICKSTART §1.3

**Files:**
- Modify: `scripts/tbox_post_upstream_merge.sh`

- [x] QUICKSTART §1.3 · DEPLOY §8.1 · Walkthrough step D

---

## Task 215: Harness §9 Phase 64

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md`

- [x] 修订记录 + Phase 64 行 + 里程碑 0–64

---

## Task 216: 单测

**Files:**
- Modify: `test/unit_test/scripts/test_tbox_post_upstream_merge.py`

- [x] UPSTREAM §3.2 与 post_merge 含 §1.3 / 步骤 D

---

## 验收

```bash
grep -q "步骤 D" docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md
grep -q "QUICKSTART.md" scripts/tbox_post_upstream_merge.sh
grep -q "Phase 64" docs/TBOX_KB_DELIVERY_HARNESS.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase64-plan.md`
