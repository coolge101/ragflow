# TBOX 阶段 63（Runbook §3.1.3/§8.1 ↔ §2.1 + Harness 54–62 摘要）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** **`TBOX_DEPLOY_RUNBOOK.md` §3.1.3 / §8.1** 与 Walkthrough **§2.1** 发版链对齐；Harness **§9** 增 **Phase 54–62** 文档闭环摘要。

**Architecture:** Markdown 交叉引用 + Harness 修订/进度行 + 单测扩展。

**Tech Stack:** Markdown、Python unittest。

---

## Task 210: Runbook §3.1.3 / §8.1 对齐

**Files:**
- Modify: `docs/TBOX_DEPLOY_RUNBOOK.md`

- [x] 步骤 D + QUICKSTART §1.3 + Walkthrough §2.1 + 同一链

---

## Task 211: Harness §9 Phase 54–62 摘要

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md`

- [x] Phase 54–62 摘要行 + Phase 63 + 里程碑 0–63

---

## Task 212: 单测

**Files:**
- Modify: `test/unit_test/scripts/test_tbox_post_upstream_merge.py`
- Modify: `test/unit_test/scripts/test_tbox_web_tbox_check.py`

- [x] Runbook §8.1 / Harness 54–62 摘要

---

## 验收

```bash
grep -q "步骤 D" docs/TBOX_DEPLOY_RUNBOOK.md
grep -q "Phase 54–62" docs/TBOX_KB_DELIVERY_HARNESS.md
grep -q "Phase 63" docs/TBOX_KB_DELIVERY_HARNESS.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase63-plan.md`
