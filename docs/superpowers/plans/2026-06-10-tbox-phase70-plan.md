# Phase 70 — G3 UX 产品化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for task-by-task execution.
> **Spec**: [`2026-06-10-tbox-g3-ux-polish-design.md`](../specs/2026-06-10-tbox-g3-ux-polish-design.md)（已批准 2026-06-10）
> **Priority order**: **70.0** ANSWER → **70.1** CITATION → **70.2** SEARCH → **70.3** SCENARIO 联调

**Goal:** 5180 对话/检索输出达到可演示水准：净化内部标记、Citation/侧栏可读、检索卡片化。

**Architecture:** 纯 `web-tbox` 前端；`chatStreamSanitize` 过滤 SSE 累积正文；`ChunkListPanel` 共用 polish；场景模板仅补输出约束 + Walkthrough。

**Tech Stack:** React 19、Vitest、现有 `ChunkListPanel` / `ChatMessageContent`

**窄屏决策：** 沿用 `useNarrowLayout` 侧栏堆叠（**不做抽屉**，留后续 Phase）。

---

## Task 1: 流式答案净化（70.0）

**Files:**

- Create: `web-tbox/src/utils/chatStreamSanitize.ts`
- Create: `web-tbox/src/utils/chatStreamSanitize.test.ts`
- Modify: `web-tbox/src/pages/ChatPage.tsx` — stream + `mapSessionMessages`
- Modify: `web-tbox/src/utils/exportConsultationResult.ts` — export 前 sanitize assistant

- [x] **Step 1**: 单测 ≥5 cases（标签块、调试句、空行压缩、正文保留）
- [x] **Step 2**: `sanitizeChatFinal` 实现
- [x] **Step 3**: ChatPage 累积 raw、`setStreaming(sanitizeChatFinal(acc))`、done 存 sanitized
- [x] **Step 4**: `mapSessionMessages` assistant 行 sanitize；导出 Markdown/PDF 同样处理

---

## Task 2: Citation 与侧栏（70.1）

**Files:**

- Modify: `web-tbox/src/components/ChunkListPanel.tsx` — 相似度 badge、active 左边框、snippet 两行
- Modify: `web-tbox/src/components/ReferenceChunks.tsx` — 空态文案
- Modify: `web-tbox/src/components/ChatMessageContent.tsx` — 脚注触达与 active 态微调

- [x] **Step 1**: `formatSimilarityPercent` in `chunkDisplay.ts`
- [x] **Step 2**: ChunkListPanel 视觉升级（desktop + narrow 堆叠已有）
- [x] **Step 3**: ReferenceChunks 空态「本轮无知识库引用」

---

## Task 3: 检索结果（70.2）

**Files:**

- Modify: `web-tbox/src/utils/chunkDisplay.ts` — `splitHighlightSegments`
- Modify: `web-tbox/src/components/SearchResultList.tsx` — 传 `highlightQuery`
- Modify: `web-tbox/src/pages/SearchPage.tsx` — 弱命中 alert（max sim < 0.35）

- [x] **Step 1**: highlight 单测（escape + 中文词）
- [x] **Step 2**: SearchPage 弱命中条 + SearchResultList query 高亮

---

## Task 4: 场景联调 + 文档（70.3）

**Files:**

- Modify: `web-tbox/src/utils/chatAppScenarioTemplates.ts` — 输出约束句
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md` — 步骤 C/D Phase 70
- Modify: `docs/superpowers/specs/2026-06-10-tbox-g3-ux-polish-design.md` — 状态已批准

- [x] **Step 1**: 三套 system prompt 追加输出约束
- [x] **Step 2**: Walkthrough C/D 增补 Phase 70 通过标准

---

## Verification

```bash
cd web-tbox && npm run typecheck && npm test && npm run build
```

---

## Out of scope

- 窄屏引用抽屉（后续 Phase）
- 后端 SSE 改写
- 第四套场景模板
