# Phase 70 — G2 Discover SERP 预筛 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 fetch 前用 SERP title/snippet 预筛 Discover 结果，提升技术趋势专题的有效文章 URL 命中率。

**Architecture:** 扩展 `DiscoverResult` 为 `DiscoverHit[]`；新增 `tbox_crawl_discover_rank` 规则打分与 `tbox_crawl_query_templates`；在 `_resolve_crawl_target_urls` 中插入 rank + Top-K；ingest 携带 title fallback。

**Tech Stack:** Python 3.12+ / Peewee / SearXNG & Tavily JSON API / React web-tbox / pytest。

**Design Spec:** [`docs/superpowers/specs/2026-06-22-tbox-g2-crawl-discover-rank-design.md`](../specs/2026-06-22-tbox-g2-crawl-discover-rank-design.md)

**Priority order:** 70.0 (DiscoverHit + rank + tick) → 70.0 (query template + bootstrap + smoke) → 70.2 (UI + catalog seeds)

---

## File map

| 文件 | 职责 |
|------|------|
| `common/tbox_crawl_discover.py` | `DiscoverHit`；`DiscoverResult.hits` + `urls` property；provider 填充 metadata |
| `common/tbox_crawl_discover_rank.py` | SERP 规则预评分、`rank_discover_hits()` |
| `common/tbox_crawl_query_templates.py` | `tech_trend` 模板、`apply_query_template()` |
| `api/db/services/tbox_crawl_task_service.py` | rank 插入点、`CrawlTickStats` 扩展、hit→ingest 传递 |
| `api/db/services/tbox_crawl_ingest_service.py` | title fallback、按 URL 查 hit metadata |
| `scripts/tbox_crawl_bootstrap_tech_trend.py` | tech 推荐 extra_config |
| `scripts/tbox_phase70_crawl_discover_rank_smoke.py` | E2E smoke |
| `web-tbox/src/utils/crawlExtraDiscover.ts` | 新 extra keys + 模板常量 |
| `web-tbox/src/pages/CrawlPage.tsx` | 专题模板下拉、tick 摘要新字段 |
| `test/unit_test/common/test_tbox_crawl_discover_hits.py` | DiscoverHit / provider metadata |
| `test/unit_test/common/test_tbox_crawl_discover_rank.py` | 打分规则 |
| `test/unit_test/common/test_tbox_crawl_query_templates.py` | 模板生成 |
| `test/unit_test/api/db/services/test_tbox_crawl_tick_discover_rank.py` | tick 统计 |

---

## Task 1: DiscoverHit 与 DiscoverResult 重构

**Files:**
- Modify: `common/tbox_crawl_discover.py`
- Create: `test/unit_test/common/test_tbox_crawl_discover_hits.py`
- Modify: `test/unit_test/common/test_tbox_crawl_discover_searxng.py`（若存在，更新断言）

- [ ] **Step 1: Write failing tests**

```python
import unittest
from common.tbox_crawl_discover import DiscoverHit, DiscoverResult


class TestDiscoverHit(unittest.TestCase):
    def test_urls_property_from_hits(self):
        hits = [
            DiscoverHit(url="https://a.com/news/1", title="TBOX 趋势", snippet="白皮书摘要", query="TBOX"),
            DiscoverHit(url="https://b.com/x", title="", snippet=""),
        ]
        result = DiscoverResult(
            hits=hits,
            provider="searxng",
            queries_executed=1,
            raw_result_count=2,
            notes="",
        )
        self.assertEqual(result.urls, ["https://a.com/news/1", "https://b.com/x"])
        self.assertEqual(result.hits[0].title, "TBOX 趋势")
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd C:/ragflow/ragflow
uv run pytest test/unit_test/common/test_tbox_crawl_discover_hits.py -v
```

- [ ] **Step 3: Implement dataclasses**

在 `common/tbox_crawl_discover.py` 顶部附近添加：

```python
@dataclass(frozen=True)
class DiscoverHit:
    url: str
    title: str = ""
    snippet: str = ""
    query: str = ""


@dataclass(frozen=True)
class DiscoverResult:
    hits: list[DiscoverHit]
    provider: str
    queries_executed: int
    raw_result_count: int
    notes: str

    @property
    def urls(self) -> list[str]:
        return [h.url for h in self.hits if h.url]
```

删除旧版 `DiscoverResult` 中 `urls: list[str]` 字段；所有构造处改为 `hits=[DiscoverHit(url=u, ...)]`。

- [ ] **Step 4: Fix compile errors in same file**

全局搜索 `DiscoverResult(` 与 `.urls` 赋值；Tavily/Searxng provider 暂用 `DiscoverHit(url=url)`（Task 2 补 metadata）。

- [ ] **Step 5: Run — expect PASS**

```bash
uv run pytest test/unit_test/common/test_tbox_crawl_discover_hits.py test/unit_test/common/test_tbox_crawl_discover*.py -v
```

- [ ] **Step 6: Commit**

```bash
git add common/tbox_crawl_discover.py test/unit_test/common/test_tbox_crawl_discover_hits.py
git commit -m "feat(crawl): add DiscoverHit and DiscoverResult.hits"
```

---

## Task 2: Provider 保留 title/snippet

**Files:**
- Modify: `common/tbox_crawl_discover.py`（`TavilyDiscoverProvider`, `SearxngDiscoverProvider`）
- Modify: `test/unit_test/common/test_tbox_crawl_discover_searxng.py`

- [ ] **Step 1: Write failing test**

```python
@patch("common.tbox_crawl_discover.urllib.request.urlopen")
def test_searxng_keeps_title_and_content(mock_open):
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps({
        "results": [{
            "url": "https://example.com/news/2024/tbox.html",
            "title": "TBOX 白皮书",
            "content": "摘要内容",
        }]
    }).encode()
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = lambda *a: None
    mock_open.return_value = mock_resp
    p = SearxngDiscoverProvider("http://searxng:8080")
    r = p.discover(["TBOX"], locale="zh", max_urls=5, max_queries=1,
                   max_results_per_query=5, allowed_domains=(), tavily_depth="basic")
    assert len(r.hits) == 1
    assert r.hits[0].title == "TBOX 白皮书"
    assert "摘要" in r.hits[0].snippet
    assert r.hits[0].query == "TBOX"
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement provider changes**

SearXNG 循环内：

```python
title = (item.get("title") or "").strip()
snippet = (item.get("content") or item.get("snippet") or "").strip()[:2000]
collected.append(DiscoverHit(url=url, title=title, snippet=snippet, query=query.strip()))
```

Tavily 同理：`content` / `raw_content` 截断 → snippet；`query` 设为当前 query 字符串。

`merge_url_lists` 仅适用于 URL；改为按 canonical URL dedup hits（保留首条 metadata）。

新增 helper：

```python
def merge_discover_hits(hits: list[DiscoverHit]) -> list[DiscoverHit]:
    seen: set[str] = set()
    out: list[DiscoverHit] = []
    for h in hits:
        canon = canonicalize_url(h.url)
        if not canon or canon in seen:
            continue
        seen.add(canon)
        out.append(h)
    return out
```

- [ ] **Step 4: Run tests PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(crawl): preserve SERP title and snippet in discover providers"
```

---

## Task 3: SERP 规则预评分模块

**Files:**
- Create: `common/tbox_crawl_discover_rank.py`
- Create: `test/unit_test/common/test_tbox_crawl_discover_rank.py`

- [ ] **Step 1: Write failing tests**

```python
import unittest
from common.tbox_crawl_discover import DiscoverHit
from common.tbox_crawl_discover_rank import score_discover_hit, rank_discover_hits, parse_discover_rank_mode


class TestDiscoverRank(unittest.TestCase):
    def test_portal_homepage_scores_low(self):
        h = DiscoverHit(
            url="https://www.cttic.cn/",
            title="首页 - CTTIC",
            snippet="网站首页 登录 注册",
            query="TBOX",
        )
        score = score_discover_hit(h, topic="车联网 TBOX", mode="rules")
        self.assertLess(score, 55)

    def test_article_url_scores_high(self):
        h = DiscoverHit(
            url="https://example.com/news/2024/tbox-whitepaper.html",
            title="TBOX 技术趋势白皮书",
            snippet="车联网架构分析",
            query="TBOX 技术趋势",
        )
        score = score_discover_hit(h, topic="TBOX 技术趋势", mode="rules")
        self.assertGreaterEqual(score, 55)

    def test_rank_filters_and_sorts(self):
        hits = [
            DiscoverHit(url="https://a.com/", title="首页", snippet=""),
            DiscoverHit(url="https://b.com/news/1", title="TBOX 报告", snippet="趋势"),
        ]
        kept, skipped = rank_discover_hits(hits, topic="TBOX", mode="rules", min_score=55, max_keep=5)
        self.assertEqual(skipped, 1)
        self.assertEqual(len(kept), 1)
        self.assertIn("news", kept[0].url)
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `common/tbox_crawl_discover_rank.py`**

```python
EXTRA_DISCOVER_RANK_MODE = "tbox_crawl_discover_rank_mode"
EXTRA_DISCOVER_RANK_MIN_SCORE = "tbox_crawl_discover_rank_min_score"
EXTRA_DISCOVER_MAX_FETCH = "tbox_crawl_discover_max_fetch"
_DEFAULT_MIN_SCORE = 55

def parse_discover_rank_mode(extra: dict | None) -> str:
    raw = str((extra or {}).get(EXTRA_DISCOVER_RANK_MODE) or "off").strip().lower()
    return raw if raw in ("off", "rules", "rules_then_llm") else "off"

def score_discover_hit(hit: DiscoverHit, *, topic: str, mode: str) -> int:
    if mode == "off":
        return 100
    # start at 50 baseline; apply spec §4.2 deltas using
    # common.tbox_crawl_url_quality._has_article_hint, _path_segments
    # and common.tbox_crawl_relevance._NAV_TOKENS for nav detection
    ...

def rank_discover_hits(
    hits: list[DiscoverHit],
    *,
    topic: str,
    mode: str,
    min_score: int,
    max_keep: int,
) -> tuple[list[DiscoverHit], int]:
    if mode == "off":
        return hits[:max_keep], 0
    scored = [(score_discover_hit(h, topic=topic, mode="rules"), h) for h in hits]
    kept = [h for s, h in scored if s >= min_score]
    kept.sort(key=lambda h: next(s for s, x in scored if x is h), reverse=True)
    skipped = len(hits) - len(kept)
    return kept[:max_keep], skipped
```

`rules_then_llm` 在 Phase 70.0 **等同 rules**（文档注释预留 70.1）。

- [ ] **Step 4: Run PASS**

```bash
uv run pytest test/unit_test/common/test_tbox_crawl_discover_rank.py -v
```

- [ ] **Step 5: Commit**

---

## Task 4: Query 模板（tech_trend）

**Files:**
- Create: `common/tbox_crawl_query_templates.py`
- Create: `test/unit_test/common/test_tbox_crawl_query_templates.py`
- Modify: `common/tbox_crawl_discover.py` — `parse_discover_config` 前调用模板

- [ ] **Step 1: Write failing test**

```python
from common.tbox_crawl_query_templates import apply_query_template

def test_tech_trend_generates_bilingual_queries():
    extra = {
        "tbox_crawl_query_template": "tech_trend",
        "tbox_crawl_keywords": ["车联网", "TBOX"],
        "tbox_crawl_search_queries": ["自定义 query"],
    }
    queries = apply_query_template(extra)
    assert "自定义 query" in queries
    assert any("白皮书" in q or "whitepaper" in q.lower() for q in queries)
    assert len(queries) >= 4
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```python
EXTRA_QUERY_TEMPLATE = "tbox_crawl_query_template"
EXTRA_QUERY_TEMPLATE_MODE = "tbox_crawl_query_template_mode"  # merge|replace, default merge

def apply_query_template(extra: dict | None) -> list[str]:
    extra = dict(extra or {})
    name = str(extra.get(EXTRA_QUERY_TEMPLATE) or "").strip()
    user = extra.get("tbox_crawl_search_queries") or []
    # normalize user to list
    if name != "tech_trend":
        return user_queries_only
    generated = build_tech_trend_queries(extra)  # 4-6 strings from keywords/task name
    mode = str(extra.get(EXTRA_QUERY_TEMPLATE_MODE) or "merge").lower()
    if mode == "replace" and not user:
        return generated
    return dedupe_merge(user + generated)
```

在 `parse_discover_config` 开头：

```python
extra = apply_query_template_to_extra(extra_config)  # writes merged queries back
```

或直接在 `parse_discover_config` 内调用 `apply_query_template`。

- [ ] **Step 4: Run PASS + commit**

---

## Task 5: Tick 编排接入 rank + 统计

**Files:**
- Modify: `api/db/services/tbox_crawl_task_service.py`
- Create: `test/unit_test/api/db/services/test_tbox_crawl_tick_discover_rank.py`

- [ ] **Step 1: Extend `CrawlTickStats`**

```python
@dataclass
class CrawlTickStats:
    ...
    discover_hits: int = 0
    skipped_serp_rank: int = 0
    discover_rank_kept: int = 0
```

更新 `__str__` / tick 摘要格式化。

- [ ] **Step 2: Write failing integration test**

Mock `run_discover` 返回 2 hits（1 门户 + 1 文章）；断言 `skipped_serp_rank==1`，最终 target_urls 仅含文章 URL。

- [ ] **Step 3: Modify `_resolve_crawl_target_urls`**

在 URL 质量过滤之后、dedup 之前：

```python
from common.tbox_crawl_discover_rank import parse_discover_rank_mode, rank_discover_hits, ...
from common.tbox_crawl_relevance import infer_relevance_topic

discover_hits: list[DiscoverHit] = [DiscoverHit(url=u) for u in discovered]  # 改为从 result.hits 取
if discover_result is not None:
    discover_hits = list(discover_result.hits)
stats.discover_hits = len(discover_hits)

rank_mode = parse_discover_rank_mode(extra)
min_score = parse_min_score(extra, default=55)
max_fetch = parse_discover_max_fetch(extra)  # env TBOX_CRAWL_INGEST_MAX fallback
topic = infer_relevance_topic(extra, task_name=row.name or "")

ranked_hits, stats.skipped_serp_rank = rank_discover_hits(
    discover_hits, topic=topic, mode=rank_mode, min_score=min_score, max_keep=max_fetch,
)
stats.discover_rank_kept = len(ranked_hits)
discovered = [h.url for h in ranked_hits]
```

若 rank 后 `discovered` 为空且无 seed → 返回 note `DISCOVER_RANK_EMPTY`（不抛异常，与现网 tick 摘要风格一致）。

- [ ] **Step 4: Pass hit metadata to ingest**

在 `execute_crawl_task_stub_tick` 中维护 `url → DiscoverHit` dict，传入 `ingest_static_web_batch(..., hit_by_url=...)`。

- [ ] **Step 5: Run tests + commit**

---

## Task 6: Ingest title fallback

**Files:**
- Modify: `api/db/services/tbox_crawl_ingest_service.py`
- Modify: `test/unit_test/api/db/services/test_tbox_crawl_ingest_dedup.py` 或新建 `test_tbox_crawl_ingest_title_fallback.py`

- [ ] **Step 1: Write failing test**

Mock fetch 返回短 HTML；提供 hit title；断言上传内容以 `# Title` 开头且长度 ≥ min_extract_chars。

- [ ] **Step 2: Implement**

在抽取后、长度判断前：

```python
def _maybe_prepend_title(text: str, title: str | None, min_chars: int) -> str:
    t = (text or "").strip()
    title = (title or "").strip()
    if len(t) >= min_chars or not title:
        return t
    merged = f"# {title}\n\n{t}".strip()
    return merged
```

`ingest_static_web_batch` 签名增加可选 `hit_by_url: dict[str, DiscoverHit] | None = None`。

- [ ] **Step 3: Run PASS + commit**

---

## Task 7: Bootstrap + smoke

**Files:**
- Modify: `scripts/tbox_crawl_bootstrap_tech_trend.py`
- Create: `scripts/tbox_phase70_crawl_discover_rank_smoke.py`

- [ ] **Step 1: Update bootstrap extra_config**

按 spec §5.2 写入：`auto`、`tech_trend` 模板、`discover_rank_mode=rules`、`relevance_mode=rules`、`min_extract_chars=300`；**移除** `https://www.miit.gov.cn/` 与 `https://www.cttic.cn/` 纯首页 seed（或改为 catalog 深链）。

- [ ] **Step 2: Create smoke script**

逻辑：login → PATCH task → POST run → GET task → 断言 `last_error` 含 `discover_hits=`、`skipped_serp_rank=`、`ingested>=`（或 dedup skip  acceptable）。

```bash
cd C:/ragflow/ragflow
export TBOX_SMOKE_BASE_URL=http://127.0.0.1:9380
uv run python scripts/tbox_phase70_crawl_discover_rank_smoke.py
```

- [ ] **Step 3: Run smoke on 5180 栈（需 SearXNG 或 Tavily 其一可用）**

- [ ] **Step 4: Commit**

---

## Task 8: UI — 专题模板与 tick 摘要（70.2）

**Files:**
- Modify: `web-tbox/src/utils/crawlExtraDiscover.ts`
- Modify: `web-tbox/src/pages/CrawlPage.tsx`
- Modify: `web-tbox/src/utils/crawlExtraQuality.ts`（rank keys）

- [ ] **Step 1: Add constants**

```typescript
export const EXTRA_QUERY_TEMPLATE = "tbox_crawl_query_template";
export const EXTRA_DISCOVER_RANK_MODE = "tbox_crawl_discover_rank_mode";
export const QUERY_TEMPLATES = [
  { value: "", label: "无" },
  { value: "tech_trend", label: "技术趋势" },
];
```

- [ ] **Step 2: CrawlPage 增加模板 Select**

选择 `tech_trend` 时自动 PATCH extra：rank=rules、url_quality=strict、relevance=rules（与 spec 一致）；允许用户覆盖。

- [ ] **Step 3: Tick 摘要 UI 解析新字段**

在现有 `last_error` 解析处增加 `discover_hits`、`skipped_serp_rank`、`discover_rank_kept` 展示。

- [ ] **Step 4: `npm run typecheck && npm test` in web-tbox**

- [ ] **Step 5: Commit**

---

## Task 9: Catalog tech 种子（70.2，可选）

**Files:**
- Modify: `scripts/tbox_crawl_bootstrap_tech_trend.py` 或新增 `scripts/tbox_seed_tech_catalog.py`
- API: `POST /v1/tbox/crawl/sources`（已有）

- [ ] **Step 1: 脚本插入 ≥3 条 tech 参考源**

示例 topic=`tech`：工信部栏目 deep link、行业媒体 article 列表页（非根路径）。

- [ ] **Step 2: smoke 或 bootstrap 验证「导入种子」**

- [ ] **Step 3: Commit**

---

## Spec coverage checklist

| Spec § | Task |
|--------|------|
| DiscoverHit / Result | Task 1–2 |
| SERP rank rules | Task 3 |
| Query template tech_trend | Task 4 |
| Tick stats | Task 5 |
| title fallback | Task 6 |
| Bootstrap + smoke 验收 | Task 7 |
| UI 模板 + 摘要 | Task 8 |
| Catalog seeds | Task 9 |
| rules_then_llm | 70.1 — **不在本 plan** |

---

## 5180 手测清单（Phase 70 完成时）

1. `TBOX_CONSOLE=1 bash docker/tbox-compose-up.sh` 栈可用
2. 运行 `scripts/tbox_phase70_crawl_discover_rank_smoke.py`
3. 5180 打开采集任务 → 选「技术趋势」模板 → Run
4. 确认 tick 摘要：`discover_hits ≥ 5`，`skipped_serp_rank > 0`，`ingested ≥ 2`
5. KB 抽 10 篇人工 spot check ≥ 7 篇像文章
