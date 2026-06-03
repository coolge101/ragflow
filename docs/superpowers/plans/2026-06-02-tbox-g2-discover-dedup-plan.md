# Phase 67 — G2 Discover / Dedup / I18N Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 TBOX crawl worker 交付可插拔 **Discover（v1 Tavily）**、**dataset 级 dedup**、**I18N fetch**，使四类专题知识库可通过 search query 自动发现 URL 入库并跨 tick 去重。

**Architecture:** 新增 `common/tbox_crawl_discover.py` 与 `common/tbox_crawl_dedup.py`；DB 表 `tbox_crawl_seen`；`execute_crawl_task_stub_tick` 编排 discover → merge → pre-dedup → 现有 strategy/fetch → post-dedup → ingest；`web-tbox` 扩展 `/crawl` 表单。v2 预留 `searxng` stub。

**Tech Stack:** Python 3.12 / Peewee / `tavily` SDK / existing `tbox_crawl_ssrf_fetch` / React `web-tbox` / pytest + vitest。

**Design Spec:** [`docs/superpowers/specs/2026-06-02-tbox-g2-discover-dedup-design.md`](../specs/2026-06-02-tbox-g2-discover-dedup-design.md)

---

## File map

| 文件 | 职责 |
|------|------|
| `common/tbox_crawl_discover.py` | `DiscoverResult`、config 解析、`TavilyDiscoverProvider`、`SearxngDiscoverProvider` stub、工厂 |
| `common/tbox_crawl_dedup.py` | `canonicalize_url`、`content_sha256`、`CrawlDedupStore` 协议 + DB 实现 |
| `api/db/db_models.py` | `TboxCrawlSeen` 模型 |
| `api/db/services/tbox_crawl_seen_service.py` | upsert / exists / find_by_hash |
| `api/db/services/tbox_crawl_task_service.py` | tick 编排、tick summary |
| `api/db/services/tbox_crawl_ingest_service.py` | 接入 post-fetch dedup + seen 更新 |
| `common/tbox_crawl_ssrf_fetch.py` | `Accept-Language` header |
| `common/tbox_crawl_last_error.py` | 文档化新 code（可选常量） |
| `web-tbox/src/utils/crawlExtraDiscover.ts` | discover extra_config 键 |
| `web-tbox/src/utils/crawlDomainTemplates.ts` | 四类库默认 query |
| `web-tbox/src/pages/CrawlPage.tsx` | UI |
| `test/unit_test/common/test_tbox_crawl_discover.py` | discover 单测 |
| `test/unit_test/common/test_tbox_crawl_dedup.py` | dedup 单测 |
| `test/unit_test/api/db/services/test_tbox_crawl_tick_discover.py` | tick 集成 |
| `docs/TBOX_API_BOUNDARY.md` | §1.2–1.4 |

---

## Task 1: Discover 配置解析

**Files:**
- Create: `common/tbox_crawl_discover.py`（config 部分）
- Test: `test/unit_test/common/test_tbox_crawl_discover.py`

- [ ] **Step 1: Write failing tests for `parse_discover_config`**

```python
# test/unit_test/common/test_tbox_crawl_discover.py
from common.tbox_crawl_discover import parse_discover_config, EXTRA_SEARCH_PROVIDER

def test_parse_discover_defaults():
    cfg = parse_discover_config({})
    assert cfg.provider == "none"
    assert cfg.queries == ()
    assert cfg.locale == "both"
    assert cfg.max_urls == 10
    assert cfg.max_queries == 3
    assert cfg.max_results_per_query == 5
    assert cfg.tavily_depth == "basic"

def test_parse_discover_tavily():
    cfg = parse_discover_config({
        "tbox_crawl_search_provider": "tavily",
        "tbox_crawl_search_queries": ["TBOX 法规", "C-V2X standard"],
        "tbox_crawl_discover_max_urls": 8,
    })
    assert cfg.provider == "tavily"
    assert cfg.queries == ("TBOX 法规", "C-V2X standard")
    assert cfg.max_urls == 8
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /home/vboxuser/ragflow && uv run pytest test/unit_test/common/test_tbox_crawl_discover.py -v
```

Expected: `ModuleNotFoundError` or `ImportError`

- [ ] **Step 3: Implement constants + `DiscoverConfig` + `parse_discover_config`**

在 `common/tbox_crawl_discover.py` 定义：

```python
EXTRA_SEARCH_PROVIDER = "tbox_crawl_search_provider"
EXTRA_SEARCH_QUERIES = "tbox_crawl_search_queries"
EXTRA_SEARCH_LOCALE = "tbox_crawl_search_locale"
EXTRA_DISCOVER_MAX_URLS = "tbox_crawl_discover_max_urls"
EXTRA_DISCOVER_MAX_QUERIES = "tbox_crawl_discover_max_queries"
EXTRA_DISCOVER_MAX_RESULTS = "tbox_crawl_discover_max_results_per_query"
EXTRA_TAVILY_DEPTH = "tbox_crawl_tavily_depth"

@dataclass(frozen=True)
class DiscoverConfig:
    provider: str
    queries: tuple[str, ...]
    locale: str
    max_urls: int
    max_queries: int
    max_results_per_query: int
    tavily_depth: str
```

复用 `tbox_crawl_strategy._parse_string_list` 解析 queries；`provider` 非法值归 `none`；数值 clamp（`max_results_per_query` ≤ 10）。

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add common/tbox_crawl_discover.py test/unit_test/common/test_tbox_crawl_discover.py
git commit -m "feat(crawl): parse discover extra_config for Phase 67"
```

---

## Task 2: URL 规范化与 content hash

**Files:**
- Create: `common/tbox_crawl_dedup.py`
- Test: `test/unit_test/common/test_tbox_crawl_dedup.py`

- [ ] **Step 1: Write failing tests**

```python
from common.tbox_crawl_dedup import canonicalize_url, content_sha256

def test_canonicalize_strips_fragment_and_utm():
    u = "https://WWW.Example.com/path/?utm_source=x&b=2#frag"
    assert canonicalize_url(u) == "https://example.com/path?b=2"

def test_canonicalize_trailing_slash():
    assert canonicalize_url("https://example.com/foo/") == "https://example.com/foo"

def test_content_sha256_stable():
    assert content_sha256(b"hello") == content_sha256(b"hello")
    assert content_sha256(b"a") != content_sha256(b"b")
```

- [ ] **Step 2: Run test — FAIL**

- [ ] **Step 3: Implement `canonicalize_url` + `content_sha256`**

- tracking params 最小集：`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, `gclid`
- host 去 `www.` 与 `tbox_crawl_strategy._normalize_host` 一致

- [ ] **Step 4: Run test — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(crawl): URL canonicalize and content sha256 for dedup"
```

---

## Task 3: `tbox_crawl_seen` 数据模型与服务

**Files:**
- Modify: `api/db/db_models.py`
- Create: `api/db/services/tbox_crawl_seen_service.py`
- Test: `test/unit_test/common/test_tbox_crawl_dedup.py`（追加 DB 用例，mock Peewee 或 sqlite 若项目惯例允许；否则 service 层 mock `TboxCrawlSeen`）

- [ ] **Step 1: Add model `TboxCrawlSeen`**

```python
class TboxCrawlSeen(DataBaseModel):
    id = CharField(max_length=32, primary_key=True)
    dataset_id = CharField(max_length=32, null=False, index=True)
    url_canonical = CharField(max_length=2048, null=False)
    content_sha256 = CharField(max_length=64, null=True, index=True)
    source = CharField(max_length=16, null=False, default="discover")
    first_seen_at = DateTimeField(null=False)
    last_seen_at = DateTimeField(null=False)

    class Meta:
        db_table = "tbox_crawl_seen"
        indexes = ((("dataset_id", "url_canonical"), True),)
```

在 `db_models.py` 迁移段末尾添加 `migrate()` 创建表（follow `TboxCrawlTask` 同模式；若无独立 migrate 则 Peewee `create_tables` 启动时创建 — 查 `init_data.py` / 现有 Tbox 表如何落地）。

- [ ] **Step 2: Implement service**

```python
def url_seen(dataset_id: str, url_canonical: str) -> bool: ...
def content_seen(dataset_id: str, content_sha256: str) -> bool: ...
def record_seen(dataset_id: str, url_canonical: str, *, content_sha256: str | None, source: str) -> None: ...
```

`record_seen`：存在则 update `last_seen_at` + 可选更新 hash；不存在则 insert。

- [ ] **Step 3: Unit tests with mocked model**（参考 `test_tbox_crawl_task_service.py` 风格）

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(crawl): tbox_crawl_seen model and dedup store service"
```

---

## Task 4: Tavily DiscoverProvider

**Files:**
- Modify: `common/tbox_crawl_discover.py`
- Test: `test/unit_test/common/test_tbox_crawl_discover.py`

- [ ] **Step 1: Write failing test with mocked TavilyClient**

```python
@patch("common.tbox_crawl_discover.TavilyClient")
def test_tavily_discover_filters_domains(mock_client_cls):
    mock_client_cls.return_value.search.return_value = {
        "results": [
            {"url": "https://news.example.com/a", "title": "A"},
            {"url": "https://evil.com/b", "title": "B"},
        ]
    }
    provider = TavilyDiscoverProvider(api_key="tvly-test")
    res = provider.discover(
        ["query"],
        locale="both",
        max_urls=10,
        max_queries=1,
        allowed_domains=("example.com",),
    )
    assert res.urls == ["https://news.example.com/a"]
    assert res.queries_executed == 1
```

- [ ] **Step 2: Implement `DiscoverResult`, `TavilyDiscoverProvider`, `resolve_tavily_api_key()`**

```python
def resolve_tavily_api_key() -> str:
    return (os.environ.get("TBOX_CRAWL_TAVILY_API_KEY") or os.environ.get("TAVILY_API_KEY") or "").strip()
```

`search()` kwargs: `search_depth=cfg.tavily_depth`, `max_results=cfg.max_results_per_query`。

locale `both`：执行全部 queries（不翻译）；`zh`/`en` 在 v1 **同样执行全部 queries**（locale 仅 UI 提示 + 未来过滤；spec 允许 v1 不拆 query 语言检测 — 用户自行填中英列表）。

合并 URL：dedupe by canonical within discover pass；cap `max_urls`。

- [ ] **Step 3: Implement `get_discover_provider(name)` + `SearxngDiscoverProvider` stub**

```python
class SearxngDiscoverProvider:
    def discover(self, *args, **kwargs):
        raise DiscoverProviderError("DISCOVER_PROVIDER", "searxng provider not implemented (Phase 67.2)")
```

- [ ] **Step 4: Test `get_discover_provider("none")` returns None**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(crawl): Tavily discover provider with domain filter"
```

---

## Task 5: Tick 编排（discover + pre-dedup + summary）

**Files:**
- Modify: `api/db/services/tbox_crawl_task_service.py`
- Create: `test/unit_test/api/db/services/test_tbox_crawl_tick_discover.py`

- [ ] **Step 1: Extract helper `_resolve_crawl_target_urls(row, strategy, extra) -> tuple[list[str], str, DiscoverStats]`**

逻辑：

1. `cfg = parse_discover_config(extra)`
2. 若 `cfg.provider != "none"` 且有 queries：调用 provider；无 key → raise/return error `DISCOVER_NO_KEY`
3. `merged = list(dict.fromkeys(discovered + seeds))` 保序去重
4. pre-dedup：若 `dataset_id` 有值，filter `url_seen` → stats.skipped_dup_url
5. `resolve_target_urls(merged, ...)`
6. 返回 `(target_urls, note, stats)`

- [ ] **Step 2: Wire into `execute_crawl_task_stub_tick`**

替换现有直接 `seeds = row.seed_urls` → `resolve_target_urls(seeds)` 为 helper 输出。

成功 tick：`record_worker_tick(ok=True, message=format_tick_summary(stats))`
格式示例：`discovered=5 ingested=2 skipped_dup_url=3 skipped_dup_content=1`

失败：`DISCOVER_EMPTY` 当 provider=tavily、queries 非空、merge 后 0 URL。

- [ ] **Step 3: Integration test**（mock discover + mock ingest，参考 `test_tbox_crawl_tick_strategy.py`）

- [ ] **Step 4: Run**

```bash
uv run pytest test/unit_test/api/db/services/test_tbox_crawl_tick_discover.py test/unit_test/api/db/services/test_tbox_crawl_tick_strategy.py -q
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(crawl): discover and pre-fetch dedup in worker tick"
```

---

## Task 6: Ingest 路径 post-fetch dedup

**Files:**
- Modify: `api/db/services/tbox_crawl_ingest_service.py`
- Modify: `common/tbox_crawl_dedup.py`（如需 `IngestDedupContext` dataclass）

- [ ] **Step 1: Extend `ingest_static_web_seeds_into_kb` signature**

新增可选参数：`dataset_id: str | None = None`（从 `kb.id` 传入）、`dedup: bool = True`。

循环内 fetch 后：

```python
h = content_sha256(body)
if dedup and dataset_id and content_seen(dataset_id, h):
    skipped_content += 1
    continue
# ... existing keyword + upload ...
record_seen(dataset_id, canonicalize_url(url), content_sha256=h, source="discover"|"seed"|"expand")
```

- [ ] **Step 2: Unit test** mock `content_seen` / `record_seen`

- [ ] **Step 3: Pass `dataset_id=kb.id` from tick**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(crawl): post-fetch content dedup before ingest"
```

---

## Task 7: I18N — Accept-Language on fetch

**Files:**
- Modify: `common/tbox_crawl_ssrf_fetch.py`
- Test: `test/unit_test/common/test_tbox_crawl_ssrf_fetch.py`（若无则追加最小用例）

- [ ] **Step 1: Test that default headers include Accept-Language**

mock requests 断言 header 含 `Accept-Language: zh-CN,en;q=0.9` 或 env `TBOX_CRAWL_ACCEPT_LANGUAGE` 覆盖值。

- [ ] **Step 2: Implement in `build_fetch_headers` / fetch path**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(crawl): Accept-Language header for i18n fetch"
```

---

## Task 8: web-tbox Discover UI + 四类库模板

**Files:**
- Create: `web-tbox/src/utils/crawlExtraDiscover.ts`
- Create: `web-tbox/src/utils/crawlDomainTemplates.ts`
- Modify: `web-tbox/src/pages/CrawlPage.tsx`
- Modify: `web-tbox/src/utils/crawlExtraStrategy.ts`（`stripStrategyKeys` 合并 strip discover keys）

- [ ] **Step 1: `crawlExtraDiscover.ts`**

导出常量键、`DiscoverFields`、`discoverFieldsFromExtra`、`mergeDiscoverIntoExtra`、`formatDiscoverSummary`。

- [ ] **Step 2: `crawlDomainTemplates.ts`**

```typescript
export const CRAWL_DOMAIN_TEMPLATES = {
  regulations: { label: "法规与标准", queries: ["TBOX 车联网 标准 法规", "C-V2X TBOX standard regulation"] },
  tech: { label: "技术发展趋势", queries: ["车联网 TBOX 技术架构 白皮书", "automotive TBOX technology trend"] },
  market: { label: "市场与产业趋势", queries: ["TBOX 市场规模 产业链", "connected vehicle TBOX market report"] },
  product: { label: "产品与行业情报", queries: ["TBOX 产品 竞品", "telematics box vendor comparison"] },
} as const;
```

- [ ] **Step 3: CrawlPage 表单**

- Provider select：`none` / `tavily`
- queries textarea、locale select、max_urls、max_queries
- 四按钮「套用模板：…」→ 填充 queries + 设 provider=tavily
- 说明 Tavily Key 在 worker env

- [ ] **Step 4: typecheck + build**

```bash
cd web-tbox && npm run typecheck && npm run build
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web-tbox): crawl discover UI and four KB query templates"
```

---

## Task 9: 文档与矩阵回写

**Files:**
- Modify: `docs/TBOX_API_BOUNDARY.md`
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`（步骤 G）
- Modify: `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md`（67.0 完成后 G2 行 ✅）
- Modify: `docs/TBOX_5180_HANDTEST_2026-06-02.md`（留复测节）

- [ ] **Step 1: API_BOUNDARY** — 列出 §4 extra_config 键 + env `TBOX_CRAWL_TAVILY_API_KEY` / `TBOX_CRAWL_ACCEPT_LANGUAGE`

- [ ] **Step 2: Walkthrough G** — discover 表单、Tavily Key、dedup 复跑步骤

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: Phase 67 discover/dedup API boundary and walkthrough"
```

---

## Task 10: 5180 smoke 与 console rebuild

**Files:**
- Modify: `docker/.env.example` 或 `docs/TBOX_QUICKSTART.md`（Tavily Key 说明，**不提交 secrets**）

- [ ] **Step 1: Worker env**

在 5180 栈为 crawl worker 设置 `TBOX_CRAWL_TAVILY_API_KEY`（本地 `.env` 不入库）。

- [ ] **Step 2: 创建/更新 crawl 任务**

- 库：TBOX-法规
- provider：tavily
- queries：spec 示例 2 中 + 2 英
- `allowed_domains`：目标站
- 执行一次 → ≥2 文档

- [ ] **Step 3: 再执行一次** → 验证 dedup（无暴增、`last_error`/日志含 skipped）

- [ ] **Step 4: 英文 smoke** — TBOX-技术趋势 或 TBOX-市场趋势，1 英文 URL preview 200

- [ ] **Step 5: Rebuild console**

```bash
bash scripts/tbox_rebuild_console.sh
```

- [ ] **Step 6: 更新 `TBOX_5180_HANDTEST_2026-06-02.md` 复测结果 + commit**

```bash
git commit -m "docs: Phase 67.0 5180 discover/dedup smoke results"
```

---

## Task 11: CI 与回归

- [ ] **Step 1: Run Python unit matrix**

```bash
uv run pytest test/unit_test/common/test_tbox_crawl_discover.py test/unit_test/common/test_tbox_crawl_dedup.py test/unit_test/api/db/services/test_tbox_crawl_tick_discover.py test/unit_test/api/db/services/test_tbox_crawl_tick_strategy.py -q
```

- [ ] **Step 2: Run web-tbox check**

```bash
cd web-tbox && npm run typecheck && npm test && npm run build
```

- [ ] **Step 3: Fix any regressions; final commit if needed**

---

## Spec coverage self-review

| Spec § | Task |
|--------|------|
| Discover provider 可插拔 + Tavily v1 | Task 1, 4, 5 |
| SearXNG stub v2 | Task 4 |
| extra_config 键 | Task 1, 8, 9 |
| dedup 两阶段 + tbox_crawl_seen | Task 2, 3, 5, 6 |
| I18N Accept-Language | Task 7 |
| tick summary / error codes | Task 5 |
| UI + 四类模板 | Task 8 |
| 文档 | Task 9 |
| smoke 验收 | Task 10 |
| 兼容 provider=none | Task 5（无 queries 时行为不变） |

**Out of scope (67.2+):** SearXNG 实现、G2-CRAWL-RELEVANCE、租户级 dedup、MCP。

---

## 版本切分

| 交付 | Tasks |
|------|-------|
| **67.0** | Task 1–10（1 库 smoke） |
| **67.1** | Task 8 模板 + 复制任务到另外 3 库（手测文档） |
| **67.2** | 新 plan：实现 `SearxngDiscoverProvider` |

**Plan saved to:** `docs/superpowers/plans/2026-06-02-tbox-g2-discover-dedup-plan.md`
