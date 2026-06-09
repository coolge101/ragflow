# Phase 68 — G2 Crawl Content Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提升 TBOX 爬取入库内容质量：SearXNG Discover（B）、trafilatura 正文抽取（A）、DB 参考源清单（C）。

**Architecture:** 在 Phase 67 tick 流水线中插入 URL 质量过滤与正文抽取；实现 `SearxngDiscoverProvider`；新增 `tbox_crawl_source_catalog` 表与 `/v1/tbox/crawl/sources` API；Docker 可选 searxng 服务。

**Tech Stack:** Python 3.12 / Peewee / trafilatura（已有）/ SearXNG JSON API / React web-tbox / pytest。

**Design Spec:** [`docs/superpowers/specs/2026-06-08-tbox-g2-crawl-quality-design.md`](../specs/2026-06-08-tbox-g2-crawl-quality-design.md)

**Priority order:** 68.0 (B) → 68.1 (A) → 68.2 (C)

---

## File map

| 文件 | 职责 |
|------|------|
| `common/tbox_crawl_url_quality.py` | URL 质量规则与 `filter_urls_by_quality` |
| `common/tbox_crawl_extract.py` | trafilatura 封装、`suggested_txt_filename` |
| `common/tbox_crawl_discover.py` | `SearxngDiscoverProvider` 实现；env base URL |
| `api/db/db_models.py` | `TboxCrawlSourceCatalog` |
| `api/db/services/tbox_crawl_source_catalog_service.py` | CRUD + import to task seeds |
| `api/db/services/tbox_crawl_task_service.py` | URL 质量、stats、`discover_skip_bfs` |
| `api/db/services/tbox_crawl_ingest_service.py` | 抽取 + `.txt` 上传 |
| `api/apps/tbox_app.py` | `/crawl/sources` + `import-sources` |
| `docker/docker-compose-base.yml` | searxng service (profile) |
| `docker/.env` template in docs | `TBOX_CRAWL_SEARXNG_BASE_URL` |
| `web-tbox/src/api/crawlSources.ts` | catalog API client |
| `web-tbox/src/pages/CrawlPage.tsx` | 参考源 UI + searxng provider 选项 |
| `web-tbox/src/utils/crawlExtraQuality.ts` | quality/extract extra keys |
| `scripts/tbox_phase68_crawl_quality_smoke.py` | E2E smoke |
| `test/unit_test/common/test_tbox_crawl_url_quality.py` | 单测 |
| `test/unit_test/common/test_tbox_crawl_extract.py` | 单测 |
| `test/unit_test/common/test_tbox_crawl_discover_searxng.py` | mock HTTP |

---

## Task 1: URL 质量模块（68.0 基础）

**Files:**
- Create: `common/tbox_crawl_url_quality.py`
- Test: `test/unit_test/common/test_tbox_crawl_url_quality.py`

- [ ] **Step 1: Write failing tests**

```python
import unittest
from common.tbox_crawl_url_quality import filter_urls_by_quality, url_passes_quality


class TestUrlQuality(unittest.TestCase):
    def test_rejects_site_root(self):
        self.assertFalse(url_passes_quality("https://www.miit.gov.cn/", "normal"))
        self.assertFalse(url_passes_quality("https://example.com/index.html", "normal"))

    def test_accepts_article_like_path(self):
        self.assertTrue(url_passes_quality("https://example.com/news/2024/tbox-whitepaper.html", "normal"))

    def test_off_mode_keeps_all(self):
        urls = ["https://a.com/", "https://b.com/x/y/z"]
        kept, skipped = filter_urls_by_quality(urls, mode="off")
        self.assertEqual(len(kept), 2)
        self.assertEqual(skipped, 0)
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd /home/vboxuser/ragflow && uv run pytest test/unit_test/common/test_tbox_crawl_url_quality.py -v
```

- [ ] **Step 3: Implement `url_passes_quality` + `filter_urls_by_quality`**

常量：`EXTRA_URL_QUALITY_MODE = "tbox_crawl_url_quality_mode"`；解析 strict/normal/off。

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add common/tbox_crawl_url_quality.py test/unit_test/common/test_tbox_crawl_url_quality.py
git commit -m "feat(crawl): add URL quality filter for discover and BFS"
```

---

## Task 2: SearXNG Discover Provider（68.0 · B）

**Files:**
- Modify: `common/tbox_crawl_discover.py`
- Test: `test/unit_test/common/test_tbox_crawl_discover_searxng.py`

- [ ] **Step 1: Write failing test with mocked HTTP**

```python
from unittest.mock import patch, MagicMock
from common.tbox_crawl_discover import SearxngDiscoverProvider, DiscoverProviderError


@patch("common.tbox_crawl_discover.urllib.request.urlopen")
def test_searxng_parses_json(mock_open):
    mock_resp = MagicMock()
    mock_resp.read.return_value = b'{"results":[{"url":"https://example.com/a/b"}]}'
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = lambda *a: None
    mock_open.return_value = mock_resp
    p = SearxngDiscoverProvider("http://searxng:8080")
    r = p.discover(["TBOX 技术"], locale="zh", max_urls=5, max_queries=1, max_results_per_query=5, allowed_domains=())
    assert "https://example.com/a/b" in r.urls
```

- [ ] **Step 2: Run — expect FAIL** (`not implemented`)

- [ ] **Step 3: Implement `SearxngDiscoverProvider`**

- 读 `TBOX_CRAWL_SEARXNG_BASE_URL`；无 URL → `DiscoverProviderError("DISCOVER_NO_SEARXNG", ...)`
- `GET {base}/search?q=...&format=json`；locale → `language` 参数
- 合并 dedup；尊重 `allowed_domains`

- [ ] **Step 4: Wire `get_discover_provider("searxng")`**

- [ ] **Step 5: Run tests PASS**

- [ ] **Step 6: Commit**

---

## Task 3: Tick 编排接入 URL 质量（68.0）

**Files:**
- Modify: `api/db/services/tbox_crawl_task_service.py`
- Test: `test/unit_test/api/db/services/test_tbox_crawl_tick_url_quality.py`

- [ ] **Step 1: Extend `CrawlTickStats` with `skipped_low_quality_url`**

- [ ] **Step 2: In `_resolve_crawl_target_urls` after merge:**

```python
from common.tbox_crawl_url_quality import filter_urls_by_quality, parse_url_quality_mode

mode = parse_url_quality_mode(extra)
merged, n_skip_q = filter_urls_by_quality(merged, mode=mode)
stats.skipped_low_quality_url = n_skip_q
```

- seeds 不过滤；discovered 与 BFS 输出过滤（见 spec §3.3）

- [ ] **Step 3: `tbox_crawl_discover_skip_bfs`：discover URL 不进入 BFS queue**

- [ ] **Step 4: Unit test mock discover + assert homepage skipped**

- [ ] **Step 5: Commit**

---

## Task 4: Docker SearXNG（68.0）

**Files:**
- Modify: `docker/docker-compose-base.yml`
- Modify: `docs/TBOX_ENV_AND_VERSIONS.md`（env 说明）

- [ ] **Step 1: Add service**

```yaml
  searxng:
    profiles: ["crawl-discover"]
    image: searxng/searxng:latest
    ports:
      - "127.0.0.1:8888:8080"
    networks:
      - ragflow
```

- [ ] **Step 2: Document `docker compose --profile crawl-discover up -d searxng`**

- [ ] **Step 3: `docker/.env` example in docs only**（不提交真实 .env）

- [ ] **Step 4: Commit**

---

## Task 5: Phase 68.0 smoke（B 验收）

**Files:**
- Create: `scripts/tbox_phase68_crawl_quality_smoke.py`

- [ ] **Step 1: Script patches tech task: provider=searxng, empty seeds, queries only**

- [ ] **Step 2: Assert `discovered>=3`, `ingested>=2`, no root-only URLs in ingested set**

- [ ] **Step 3: Commit + manual run in container**

---

## Task 6: 正文抽取（68.1 · A）

**Files:**
- Create: `common/tbox_crawl_extract.py`
- Modify: `api/db/services/tbox_crawl_ingest_service.py`
- Test: `test/unit_test/common/test_tbox_crawl_extract.py`

- [ ] **Step 1: Test short HTML → skip; article HTML → len>=200**

- [ ] **Step 2: Implement `extract_main_text(body: bytes) -> str` using `parse_html_with_trafilatura`**

- [ ] **Step 3: In ingest loop: if `extra_config.tbox_crawl_extract_main_content` (default True):**

```python
text = extract_main_text(body)
if len(text) < min_chars:
    skipped_low_quality += 1
    continue
body = text.encode("utf-8")
filename = suggested_txt_filename(url)
```

- [ ] **Step 4: `content_sha256` on extracted text**

- [ ] **Step 5: Extend tick stats `skipped_low_quality`**

- [ ] **Step 6: Commit**

---

## Task 7: web-tbox quality/extract 表单（68.1）

**Files:**
- Create: `web-tbox/src/utils/crawlExtraQuality.ts`
- Modify: `web-tbox/src/pages/CrawlPage.tsx`
- Modify: `web-tbox/src/utils/crawlLastError.ts`（新 code 文案）

- [ ] **Step 1: UI fields: url quality mode, extract toggle, min chars**

- [ ] **Step 2: Provider select 增加 `searxng` 并默认提示 Docker**

- [ ] **Step 3: `npm run build` in web-tbox**

- [ ] **Step 4: Commit**

---

## Task 8: 参考源 catalog DB（68.2 · C）

**Files:**
- Modify: `api/db/db_models.py`
- Create: `api/db/services/tbox_crawl_source_catalog_service.py`
- Modify: `api/db/init_data.py` or migration hook if project uses one

- [ ] **Step 1: Model `TboxCrawlSourceCatalog` per spec §5.1**

- [ ] **Step 2: Service: list/create/update/delete/import_to_task_seeds**

- [ ] **Step 3: Seed 4 topics default rows optional in bootstrap script**

- [ ] **Step 4: Commit**

---

## Task 9: catalog API + UI（68.2）

**Files:**
- Modify: `api/apps/tbox_app.py`
- Create: `web-tbox/src/api/crawlSources.ts`
- Modify: `web-tbox/src/pages/CrawlPage.tsx`

- [ ] **Step 1: Routes GET/POST/PATCH/DELETE `/crawl/sources`**

- [ ] **Step 2: POST `/crawl/tasks/<id>/import-sources`**

- [ ] **Step 3: CrawlPage「参考源」panel + 导入按钮**

- [ ] **Step 4: API tests in `test/unit_test/api/apps/tbox_app_isolated/`**

- [ ] **Step 5: Commit**

---

## Task 10: 文档与矩阵（68 收尾）

**Files:**
- Modify: `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md`
- Modify: `docs/TBOX_API_BOUNDARY.md`
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md`

- [ ] **Step 1: Matrix G2-CRAWL-EXTRACT / SOURCES / DISCOVER+ 状态 ✅**

- [ ] **Step 2: Walkthrough 步骤 G 增 Phase 68 验收项**

- [ ] **Step 3: Commit**

---

## Task 11: Console rebuild + 5180 手测记录

- [ ] **Step 1: `TBOX_SKIP_WEB_TBOX_CHECK=1 bash scripts/tbox_rebuild_console.sh`**

- [ ] **Step 2: Append `docs/TBOX_5180_HANDTEST_2026-06-08.md` Phase 68 结果**

- [ ] **Step 3: Commit**

---

## Spec coverage self-check

| Spec § | Task |
|--------|------|
| §3 URL 质量 | Task 1, 3 |
| §6 SearXNG Docker | Task 4 |
| §3.2 Provider searxng | Task 2 |
| §4 正文抽取 | Task 6, 7 |
| §5 catalog | Task 8, 9 |
| §8 测试 | Tasks 1–5, 6, 9 |
| §10 文档 | Task 10, 11 |

---

## Out of scope (Phase 69)

- G2-CRAWL-RELEVANCE LLM scoring
- Firecrawl / headless browser
- Auto-promote discover URL to catalog without user action
