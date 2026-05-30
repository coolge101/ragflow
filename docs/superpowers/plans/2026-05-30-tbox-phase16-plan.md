# TBOX 阶段 16（G3 Citation 侧栏联动）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 关闭 `TBOX_UI_DESIGN_DETAIL.md` §3.2 的 **`onCitation` TODO**：回答中 `[ID:n]` 可点击，与右侧引用侧栏双向高亮。

**Architecture:** 轻量移植主 fork `citation-utils`；`ChatMessageContent` 解析标记；`ReferenceChunks` 支持 `activeChunkIndex` + 滚动；助手消息持久化 `reference`。

**Tech Stack:** `web-tbox` React/TS，无新增 npm 依赖。

---

## Task 58: Citation 解析与消息渲染

**Files:**
- Create: `web-tbox/src/utils/citationUtils.ts`
- Create: `web-tbox/src/components/ChatMessageContent.tsx`
- Modify: `web-tbox/src/pages/ChatPage.tsx`

- [x] `[ID:n]` / `[n]` 可点击；无效索引降级为静态文本
- [x] 流式与历史助手消息均支持

---

## Task 59: 侧栏双向联动

**Files:**
- Modify: `web-tbox/src/components/ReferenceChunks.tsx`

- [x] 片段列表可点击高亮
- [x] `scrollIntoView` 滚动到激活项

---

## Task 60: 文档回写

**Files:**
- Modify: `docs/TBOX_UI_DESIGN_DETAIL.md` §3.2
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0
- Modify: `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md` §6
- Modify: `web-tbox/README.md`

- [x] Phase 16 行 + onCitation 状态更新

---

## 验收

```bash
cd web-tbox && npm run typecheck && npm run build
```

5180 手测：绑定知识库的应用发一问 → 回答含 `[ID:0]` 等 → 点击编号与侧栏片段联动高亮。

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase16-plan.md`
