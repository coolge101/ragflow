# Phase 69 — G2 Crawl Self-Heal Implementation Plan

> **Spec**: [`2026-06-09-tbox-g2-crawl-self-heal-design.md`](../specs/2026-06-09-tbox-g2-crawl-self-heal-design.md)
> **Priority order**: **69.0** (HEALTH) → **69.1** (SEED-AUTO) → **69.2** (DISCOVER-AUTO) → **69.3** (RELEVANCE，独立 plan)

**Architecture:** 在 tick 后写入 url_health；self_heal worker 步骤无确认 PATCH 任务；discover `provider=auto` + SearXNG 引擎 overlay + HTTP proxy。

---

## Task 0: 矩阵与 Harness 同步

- [x] **Step 1**: 更新 `2026-05-24-tbox-capability-matrix-design.md` — G2-CRAWL-SELF-HEAL；§6 Phase 69.0–69.3
- [x] **Step 2**: 本 spec + plan 落盘
- [x] **Step 3**: Harness §9.0 S4「当前 P1」改为 Phase 69；§9.0 增 Phase 69 行

---

## Task 1: url_health 表与埋点（69.0）

**Files:**

- Create: `api/db/db_models.py` — `TboxCrawlUrlHealth`, `TboxCrawlSelfHealAudit`
- Create: `api/db/services/tbox_crawl_health_service.py`
- Modify: `api/db/services/tbox_crawl_ingest_service.py` — 成功/失败/outcome 埋点
- Modify: `api/db/services/tbox_crawl_task_service.py` — discover/probe 埋点

- [x] **Step 1**: 模型 + `init_database_tables`
- [x] **Step 2**: `record_url_outcome(task, url, outcome, source)`
- [x] **Step 3**: 单测 `test_tbox_crawl_health_service.py`

---

## Task 2: crawl/health API（69.0）

**Files:**

- Modify: `api/apps/tbox_app.py` — `GET /v1/tbox/crawl/health`
- Create: `common/tbox_crawl_outbound_probe.py` — proxy/SearXNG/Tavily 轻量探测

- [x] **Step 1**: health JSON：`searxng`, `providers`, `proxy_configured`
- [x] **Step 2**: 契约版本 + `web-tbox` 常量（若响应形状变更）

---

## Task 3: 坏种子自动 PATCH（69.1）

**Files:**

- Create: `common/tbox_crawl_self_heal.py`
- Create: `api/db/services/tbox_crawl_self_heal_service.py`
- Modify: `tbox_crawl_task_service.py` — tick 末尾 `run_self_heal(task_id)`

- [x] **Step 1**: `compute_seed_actions()` — prune / import_catalog
- [x] **Step 2**: **无确认** `PATCH` seed_urls + audit 行
- [x] **Step 3**: `TBOX_CRAWL_SELF_HEAL_INTERVAL_SEC` 防抖
- [x] **Step 4**: 单测 + 集成：知乎种子 3 失败 → 移除

---

## Task 4: Discover auto + SearXNG 引擎（69.2）

**Files:**

- Create: `common/tbox_crawl_discover_router.py`
- Create: `common/tbox_crawl_searxng_health.py`
- Modify: `common/tbox_crawl_discover.py` — `auto` provider
- Modify: `common/tbox_crawl_ssrf_fetch.py` — `TBOX_CRAWL_HTTP(S)_PROXY`
- Modify: `docker/searxng/settings.yml` — 引擎 allowlist 注释模板
- Modify: `docker/.env.example` — proxy + allowlist 文档键

- [ ] **Step 1**: SearXNG ping + `unresponsive_engines` → 禁用列表
- [ ] **Step 2**: `TBOX_CRAWL_SEARXNG_ENGINE_ALLOWLIST`
- [ ] **Step 3**: `provider=auto` 链：searxng → tavily → seed-only
- [ ] **Step 4**: proxy 注入 requests Session

---

## Task 5: UI + smoke（69.1–69.2）

**Files:**

- Modify: `web-tbox/src/pages/CrawlPage.tsx` — health 灯、heal-log
- Create: `scripts/tbox_phase69_crawl_self_heal_smoke.py`
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md` — 步骤 G Phase 69

- [ ] **Step 1**: Crawl 页 Discover 状态
- [ ] **Step 2**: smoke：坏种子任务 → audit 有 prune → 下次 tick ingested≥1
- [ ] **Step 3**: `npm run build` + console rebuild 说明

---

## Task 6: Phase 69.3 RELEVANCE（Out of scope for this plan）

- [ ] 独立 spec `2026-xx-xx-tbox-g2-crawl-relevance-design.md`
- [ ] 入库前 LLM/规则评分闸门

---

## Verification

```bash
# 69.0+
uv run pytest test/unit_test/common/test_tbox_crawl_*health* -q

# 69.2 smoke（API + worker 已起）
python scripts/tbox_phase69_crawl_self_heal_smoke.py
```

---

## Out of scope

- Phase 69.3 G2-CRAWL-RELEVANCE
- 无头浏览器、Firecrawl
