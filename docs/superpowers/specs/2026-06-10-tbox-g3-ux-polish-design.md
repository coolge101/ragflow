# TBOX G3 对话/检索 UX 产品化 — 设计规格（Phase 70）

> **状态**：已批准（2026-06-10）
> **能力 ID**：**G3-CHAT-ANSWER-UX** · **G3-CITATION-UX** · **G3-SEARCH-UX** · **G3-SCENARIO**（验收联调）
> **矩阵**：[`2026-05-24-tbox-capability-matrix-design.md`](2026-05-24-tbox-capability-matrix-design.md) §8、§6 Phase 70
> **前置**：Phase 16（Citation 联动）、Phase 17（检索高亮）、Phase 19（`ChunkListPanel` 共用）；**G3-SCENARIO** 模板已存在于 `chatAppScenarioTemplates.ts`

---

## 1. 背景与目标

### 1.1 背景（5180 手测 2026-06-02）

Phase 16–17 **功能已交付**（双向高亮、Vitest、Walkthrough 路径），但手测反馈 **「能点、能亮，但不像咨询产品」**：

|  backlog ID | 页面 | 核心问题 |
|-------------|------|----------|
| **G3-CHAT-ANSWER-UX** | `/` | 流式正文暴露 `<retrieving>`、检索链路等 **内部标记** |
| **G3-CITATION-UX** | `/` | `[ID:n]` / 圆形脚注难读；侧栏 chunk **信息密度低**、高亮弱 |
| **G3-SEARCH-UX** | `/search` | 片段难扫读；**相似度/排序**不直观；弱命中无引导 |

**G3-SCENARIO**（咨询/决策/辅导三套模板）**已实现**；缺口是模板产出在 UI 上仍受上述 UX 问题影响，需在 Phase 70 末 **联调验收**。

### 1.2 目标

在不改 RAGFlow 后端协议的前提下，使 **5180 三类场景** 的输出达到「可给客户演示」水准：

1. **用户只见咨询正文**，内部检索过程可折叠或剥离。
2. **引用可扫读、可点击、与侧栏一致**（对话 `/` 与检索 `/search` 共用组件语言）。
3. **检索页像「证据列表」**，而非 debug chunk dump。

### 1.3 非目标

- 重写 RAG 检索算法或 rerank（仍用现有 `/api/v1/chat/completions`、dataset search）
- Agent 多步推理 UI（完整 trace /debug 面板留 P2）
- 新建第四套场景模板（仅 polish + 验收现有三套）
- 官方 `web/` 改动

---

## 2. 方案对比（已选推荐方案）

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| **A. 前端净化 + 组件 polish（推荐）** | SSE 层过滤 + `ChatMessageContent` / `ChunkListPanel` / `SearchResultList` 视觉与 IA 升级 | 无后端依赖；与 Phase 19 共用组件；可分期 70.0→70.2 | 无法消除模型胡写的内部句（需 Prompt 辅助） |
| **B. 仅改 Prompt / 场景模板** | 强化 system prompt「勿输出检索过程」 | 零 UI 工作量 | 不可靠；streaming 仍可能漏标记 |
| **C. 后端 SSE 改写** | API 网关剥离 agent 标记 | 彻底 | 侵入 RAGFlow 主链；与 TBOX 边界冲突 |

**结论：采用方案 A**，B 作为 70.3 场景模板 **补充约束**，不做 C。

---

## 3. 子阶段划分

| 子阶段 | 矩阵 ID | 主要文件 | 交付摘要 |
|--------|---------|----------|----------|
| **70.0** | G3-CHAT-ANSWER-UX | `web-tbox/src/utils/chatStreamSanitize.ts`（新）、`ChatPage.tsx` | 流式/最终正文剥离内部标记；可选「显示检索过程」调试开关（默认关） |
| **70.1** | G3-CITATION-UX | `ChatMessageContent.tsx`、`ReferenceChunks.tsx`、`ChunkListPanel.tsx` | 脚注样式升级；侧栏 doc 标题 + 相似度 + 高亮条；窄屏折叠 |
| **70.2** | G3-SEARCH-UX | `SearchResultList.tsx`、`SearchPage.tsx`、`chunkDisplay.ts` | 结果卡片：排名、得分条、关键词高亮；空/弱命中文案 |
| **70.3** | G3-SCENARIO 验收 | `chatAppScenarioTemplates.ts`（微调 prompt）、Walkthrough 步骤 C/D | 三套模板各 1 条黄金路径手测；与 70.0–70.2 一并验收 |

**推荐实施顺序**：**70.0 → 70.1 → 70.2 → 70.3**（答案净化优先，否则 Citation/检索 polish 仍会被垃圾正文拖累）。

---

## 4. 详细设计

### 4.1 Phase 70.0 — 流式答案净化（G3-CHAT-ANSWER-UX）

**新增** `chatStreamSanitize.ts`：

- `sanitizeChatDelta(raw: string): string` — 增量过滤
- `sanitizeChatFinal(text: string): string` — 整段收尾

**默认剥离规则**（可单测覆盖）：

| 模式 | 示例 |
|------|------|
| XML/标签块 | `<retrieving>…</retrieving>`、`<search>…</search>` |
| 英文调试句 | `Searching by …`、`Retrieval \d+ results`、`Next step is to search` |
| 空行压缩 | 连续 3+ 换行 → 2 |

**集成点**：`ChatPage.tsx` 的 `streamChatCompletions` `delta` 回调 **先 sanitize 再 append**；历史消息加载时对 assistant 内容同样 sanitize（幂等）。

**调试开关**（可选，localStorage `tbox.chat.showRetrievalTrace=1`）：开启时在消息下方折叠展示 **原始 stream**（仅开发/验收，默认隐藏）。

**不在本阶段**：改 LLM 或 chat app API schema。

### 4.2 Phase 70.1 — Citation 与侧栏（G3-CITATION-UX）

**`ChatMessageContent`**：

- 脚注按钮：增大触达面积；`active` 态加左侧色条；`aria` 保持
- 无效引用（越界 `[ID:n]`）显示为 muted「?」且不可点（现状保留）

**`ChunkListPanel`（compact / 引用侧栏）**：

- 每条：**文档名**（ellipsis + title tooltip）+ **相似度 badge** + **2 行 snippet**
- `active` 项：左边框 3px primary + 背景 `#eff6ff`
- 空引用：`ReferenceChunks` 显示「本轮无知识库引用」+ 链到 `/apps` 调整 top_n

**布局**：`ChatPage` 已用 `useNarrowLayout` 将侧栏 **堆叠于主栏下方**（Phase 70 **不做抽屉**，留后续迭代）。

### 4.3 Phase 70.2 — 检索结果（G3-SEARCH-UX）

**`SearchResultList` / `ChunkListPanel`（comfortable）**：

- 卡片顶栏：`#rank` · 文档名 · **相似度百分比**（复用 `formatSimilaritySuffix`）
- 正文：`formatChunkSnippet` 增加 **query 词高亮**（`<mark>` 或背景色，注意 XSS：仅 escape 后替换）
- **弱命中**：最高相似度 < 0.35 时页顶 alert「相关性较低，建议换关键词或扩大 top_k」
- **空结果**：保留现有 empty + 链到知识库文档页

**与 70.1 共用**：同一 `ChunkListPanel` token（颜色、圆角、active 态），避免两页风格分裂。

### 4.4 Phase 70.3 — 场景模板联调（G3-SCENARIO）

**现状**：`CHAT_APP_SCENARIOS` + `createChatAppFormFromScenario` 已存在。

**本阶段**：

1. 在三套 system prompt 末追加 **输出约束**（与 70.0 规则一致，双保险）：
   - 勿输出检索过程、内部标签、逐步推理标题
   - 咨询：先结论后依据；决策：选项对比表；辅导：分步编号
2. Walkthrough **步骤 C**（对话）、**步骤 D**（检索）各增 **Phase 70 通过标准**（无内部标记、引用可点、检索卡片可读）
3. 可选：`tbox_phase70_g3_ux_smoke.sh` — bundle 特征串 + Vitest 已有用例仍绿

---

## 5. 验收标准

| 项 | 通过标准 |
|----|----------|
| 70.0 | 对含 `<retrieving>` 的 fixture stream，UI **不可见** 该标签；Vitest ≥5 cases |
| 70.1 | 点击脚注 ↔ 侧栏高亮；侧栏含 doc 名 + 相似度；Walkthrough C **产品化** 勾选 |
| 70.2 | 检索列表含得分与 highlight；弱命中有提示；Walkthrough D 勾选 |
| 70.3 | 咨询/决策/辅导各 1 次对话 + 1 次检索，**无 debug 句**、引用/结果可读 |
| 构建 | `cd web-tbox && npm run typecheck && npm test && npm run build` |
| Console | `docker compose build tbox-console` 通过 |

---

## 6. 测试策略

- **单元**：`chatStreamSanitize.test.ts`；`chunkDisplay.test.ts` 扩展 highlight
- **组件**：可选 RTL 测 `ChatMessageContent` active 态
- **手测**：`TBOX_UI_ACCEPTANCE_WALKTHROUGH.md` 步骤 C/D 增补 Phase 70
- **不新增** 后端 pytest（纯前端 Phase）

---

## 7. 文档与 Harness 同步（实现时）

- 矩阵 §8 backlog 项在 70.x 完成后改 **✅**
- Harness §9.0 Phase 70 行改 **✅** 并指 plan
- Plan 文件：**`docs/superpowers/plans/2026-06-10-tbox-phase70-plan.md`**（本 spec 批准后编写）

---

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 过度过滤误伤正文 | sanitize 仅匹配 **已知内部模式**；单测 + 黄金样本 |
| 高亮 XSS | 先 escape HTML 再高亮 |
| 窄屏侧栏工时 | 70.1 核心先做 desktop；抽屉为 70.1b |
| 模型仍输出垃圾 | 70.3 prompt 约束 + 70.0 过滤双保险 |

---

## 9. 修订记录

| 日期 | 变更 |
|------|------|
| 2026-06-10 | 初版：Phase 70.0–70.3；方案 A；矩阵 §8 backlog → P1 |
