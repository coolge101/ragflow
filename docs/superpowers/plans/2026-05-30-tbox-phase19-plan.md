# TBOX 阶段 19（ChunkListPanel 共用组件）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 将 Phase 16–17 对话引用侧栏与检索结果列表抽为共用 `ChunkListPanel`，减少重复并统一交互。

**Architecture:** `chunkDisplay.ts` 归一化字段；`ChunkListPanel` 负责高亮/滚动；`ReferenceChunks` / `SearchResultList` 为薄包装。

**Tech Stack:** `web-tbox` React/TS。

---

## Task 67: 共用 chunk 展示层

**Files:**
- Create: `web-tbox/src/utils/chunkDisplay.ts`
- Create: `web-tbox/src/components/ChunkListPanel.tsx`
- Modify: `ReferenceChunks.tsx`、`SearchResultList.tsx`

- [x] 行为与 Phase 16–17 一致（compact / comfortable 密度）
- [x] `searchChunkSnippet` 仍可用

---

## Task 68: 文档回写

**Files:**
- Modify: `web-tbox/README.md`
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0
- Modify: `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md` §6

- [x] Phase 19 行

---

## 验收

```bash
cd web-tbox && npm run typecheck && npm run build
```

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase19-plan.md`
