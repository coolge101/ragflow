# TBOX 阶段 40（start-tbox 提示 + Walkthrough §6 Q + G5-MATRIX 钉扎）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `start-tbox-ragflow.sh --console` 收尾与 deploy 一致；Walkthrough §6 反馈表补 Q；G5-MATRIX 钉扎 Phase 39 HEAD。

**Architecture:** bash echo + 文档表格；矩阵一行状态更新。

**Tech Stack:** bash、Markdown。

---

## Task 133: start-tbox-ragflow 发版提示

**Files:**
- Modify: `scripts/start-tbox-ragflow.sh`

- [x] `--console` 后打印 setup + pre_release + finish

---

## Task 134: Walkthrough §6

**Files:**
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md` §6

- [x] Q 行 + Phase 16–17 / pre_release 说明

---

## Task 135: G5-MATRIX 钉扎

**Files:**
- Modify: `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md`

- [x] G5-MATRIX 状态列 + 修订记录

---

## 验收

```bash
bash scripts/start-tbox-ragflow.sh --help | grep -q pre_release || true
grep -q "| Q 5180" docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md
grep -q "Phase 39" docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase40-plan.md`
