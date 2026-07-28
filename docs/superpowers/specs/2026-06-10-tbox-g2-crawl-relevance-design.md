# TBOX G2 入库前相关性闸门 — 设计规格（Phase 69.3）

> **状态**：已批准（2026-06-10）
> **能力 ID**：**G2-CRAWL-RELEVANCE**
> **矩阵**：[`2026-05-24-tbox-capability-matrix-design.md`](2026-05-24-tbox-capability-matrix-design.md) §G2、§6
> **前置**：Phase 68 EXTRACT/URL 质量；Phase 69.0–69.2 SELF-HEAL

---

## 1. 目标

在 **正文抽取之后、入库之前** 增加可选相关性闸门，过滤门户首页、导航页等与任务主题低相关的页面，减少「CTTIC 首页入库却标法规库」类问题。

## 2. 非目标

- 替换 `tbox_crawl_keywords`（关键词仍为硬过滤）
- 替换 URL 质量启发式（仍用于 discover/BFS）
- 跨租户全局相关性模型训练

---

## 3. 模式（`extra_config.tbox_crawl_relevance_mode`）

| 模式 | 说明 | 默认 |
|------|------|------|
| `off` | 不评分 | ✅ 默认（兼容旧任务） |
| `rules` | 规则/heuristic 评分 0–100 | |
| `llm` | 租户 Chat 模型 JSON 评分 | |
| `rules_then_llm` | 规则快筛；边界区再 LLM | |

**通过条件**：`score >= tbox_crawl_relevance_min_score`（默认 **60**）。

**LLM 不可用**：`rules_then_llm` 回退规则分；纯 `llm` 模式 **fail-open**（放行并记日志），避免无模型时阻断 tick。

---

## 4. 配置键

| 键 | 类型 | 默认 | 说明 |
|----|------|------|------|
| `tbox_crawl_relevance_mode` | string | `off` | 见上表 |
| `tbox_crawl_relevance_min_score` | int | `60` | 0–100 |
| `tbox_crawl_relevance_topic` | string | 空 | 评分主题；空则从 discover query / 任务名 / 关键词推断 |
| `tbox_crawl_relevance_llm_id` | string | 空 | 可选 Chat 模型 composite id |
| `tbox_crawl_relevance_max_chars` | int | `4000` | 送 LLM 的正文截断 |

---

## 5. 规则分（`rules`）

启发式叠加至 0–100：

- 门户/首页 URL（`/`、`/index.html`）→ 强降权
- 导航词密度（首页/登录/注册…）→ 降权
- `tbox_crawl_keywords` 命中 → 加权；配置了关键词但未命中 → 强降权
- discover query 词出现在正文 → 加权
- URL 含 article/news/detail 等段 → 加权

---

## 6. 集成点

- `ingest_static_web_seeds_into_kb`：extract + min_chars 之后调用 `passes_relevance_gate`
- 跳过计入 `skipped_relevance`；health outcome **`relevance`**
- tick 摘要：`skipped_relevance=N`

---

## 7. 验收

- 规则模式：CTTIC 首页类正文 `score < 60` 被跳过
- 技术趋势任务 + 关键词：相关文章通过
- LLM 模式：租户无 Chat 模型时不阻断 tick
- 5180 Crawl 页可配置 mode / min_score / topic

---

## 8. 修订

| 日期 | 变更 |
|------|------|
| 2026-06-10 | 初版 Phase 69.3 |
