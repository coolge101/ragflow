# TBOX 阶段 17（S6 漂移例行 + 检索结果高亮）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 执行 S6 例行 upstream `--fetch` 并更新 Runbook；检索页结果列表支持点击高亮（与 Phase 16 引用侧栏交互一致）。

**Architecture:** `tbox_record_upstream_drift.sh --fetch` → Runbook §5；`SearchResultList` 复用 ReferenceChunks 交互模式。

**Tech Stack:** bash、Markdown 文档、`web-tbox` React/TS。

---

## Task 61: S6 上游漂移例行

**Files:**
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §5
- Modify: `docs/TBOX_ENV_AND_VERSIONS.md` §2 备注 ahead

- [x] `--fetch`：behind 0 / ahead 114 @ `373f5e1fe`

---

## Task 62: 检索结果可点击高亮

**Files:**
- Create: `web-tbox/src/components/SearchResultList.tsx`
- Modify: `web-tbox/src/pages/SearchPage.tsx`

- [x] 点击条目高亮 + scrollIntoView
- [x] 新检索 / 清空条件重置选中

---

## Task 63: 文档回写

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0
- Modify: `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md` §6
- Modify: `web-tbox/README.md`

- [x] Phase 17 行

---

## 验收

```bash
cd web-tbox && npm run typecheck && npm run build
bash scripts/tbox_record_upstream_drift.sh --fetch
```

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase17-plan.md`
