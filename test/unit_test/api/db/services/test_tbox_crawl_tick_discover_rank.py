#
#  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
#

from __future__ import annotations

import importlib.util
import sys
import unittest
import warnings
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

warnings.filterwarnings(
    "ignore",
    message="pkg_resources is deprecated as an API.*",
    category=UserWarning,
)

from common.tbox_crawl_discover import (
    DiscoverHit,
    DiscoverResult,
    EXTRA_SEARCH_PROVIDER,
    EXTRA_SEARCH_QUERIES,
)
from common.tbox_crawl_discover_rank import EXTRA_DISCOVER_RANK_MODE


def _load_crawl_task_service_module():
    repo_root = Path(__file__).resolve().parents[5]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

    def _stub(name: str) -> ModuleType:
        mod = ModuleType(name)
        sys.modules[name] = mod
        return mod

    api = _stub("api")
    api_db = _stub("api.db")
    api_db.UserTenantRole = SimpleNamespace(
        OWNER=SimpleNamespace(value="owner"),
        ADMIN=SimpleNamespace(value="admin"),
        NORMAL=SimpleNamespace(value="normal"),
    )
    db_models = _stub("api.db.db_models")

    class _OrmStub:
        id = None
        status = None
        tenant_id = None

        @classmethod
        def select(cls, *args, **kwargs):
            raise NotImplementedError("ORM stub")

        @classmethod
        def get_or_none(cls, *args, **kwargs):
            return None

        @classmethod
        def get_by_id(cls, *args, **kwargs):
            return None

        @classmethod
        def insert(cls, *args, **kwargs):
            raise NotImplementedError("ORM stub")

    db_models.Knowledgebase = _OrmStub
    db_models.TboxCrawlTask = _OrmStub
    db_models.UserTenant = _OrmStub
    services = _stub("api.db.services")
    services.__path__ = []  # type: ignore[attr-defined]
    ingest_svc = _stub("api.db.services.tbox_crawl_ingest_service")
    ingest_svc.ingest_http_api_seeds_into_kb = lambda *a, **k: (True, "", {})
    ingest_svc.ingest_rss_seeds_into_kb = lambda *a, **k: (True, "", {})
    ingest_svc.ingest_static_web_seeds_into_kb = lambda *a, **k: (True, "", {})
    seen_svc = _stub("api.db.services.tbox_crawl_seen_service")
    seen_svc.url_seen = lambda *a, **k: False
    kb_svc = _stub("api.db.services.knowledgebase_service")
    kb_svc.KnowledgebaseService = SimpleNamespace(get_by_id=lambda *_: (False, None))
    health_svc = _stub("api.db.services.tbox_crawl_health_service")
    health_svc.record_url_outcome_from_error = lambda *a, **k: None
    self_heal_svc = _stub("api.db.services.tbox_crawl_self_heal_service")
    self_heal_svc.run_self_heal = lambda *a, **k: None

    spec = importlib.util.spec_from_file_location(
        "tbox_crawl_task_service_under_test",
        repo_root / "api" / "db" / "services" / "tbox_crawl_task_service.py",
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


svc = _load_crawl_task_service_module()


class TestExecuteCrawlTickDiscoverRank(unittest.TestCase):
    def _task(self, **kwargs):
        defaults = dict(
            id="t1",
            tenant_id="u1",
            dataset_id="kb1",
            name="TBOX 技术趋势",
            source_type="static_web",
            seed_urls=[],
            extra_config={
                EXTRA_SEARCH_PROVIDER: "tavily",
                EXTRA_SEARCH_QUERIES: ["TBOX 技术趋势"],
                EXTRA_DISCOVER_RANK_MODE: "rules",
                "tbox_skip_http_probe": True,
            },
        )
        defaults.update(kwargs)
        return SimpleNamespace(**defaults)

    @patch.object(svc, "record_worker_tick")
    @patch.object(svc, "ingest_static_web_seeds_into_kb")
    @patch.object(svc, "KnowledgebaseService")
    @patch.object(svc, "kb_valid_for_tenant", return_value=True)
    @patch.object(svc, "run_discover")
    @patch.object(svc, "url_seen", return_value=False)
    @patch.object(svc, "get_task")
    def test_rank_filters_portal_keeps_article(
        self,
        mock_get,
        mock_url_seen,
        mock_discover,
        mock_kb_valid,
        mock_kb_svc,
        mock_ingest,
        mock_record,
    ):
        portal = DiscoverHit(
            url="https://portal.example.com/channel/list",
            title="首页 - 门户导航",
            snippet="网站首页 登录 注册 栏目",
            query="TBOX 技术趋势",
        )
        article = DiscoverHit(
            url="https://article.example.com/news/2024/tbox-whitepaper.html",
            title="TBOX 技术趋势白皮书",
            snippet="车联网架构分析",
            query="TBOX 技术趋势",
        )
        mock_get.return_value = self._task()
        mock_discover.return_value = DiscoverResult(
            hits=[portal, article],
            provider="tavily",
            queries_executed=1,
            raw_result_count=2,
            notes="",
        )
        mock_kb_svc.get_by_id.return_value = (True, SimpleNamespace(id="kb1"))
        mock_ingest.return_value = (
            True,
            "",
            {"ingested": 1, "skipped_dup_content": 0, "skipped_kw": 0},
        )

        svc.execute_crawl_task_stub_tick("t1")

        mock_ingest.assert_called_once()
        ingest_urls = mock_ingest.call_args.args[2]
        self.assertEqual(ingest_urls, [article.url])
        hit_by_url = mock_ingest.call_args.kwargs.get("hit_by_url") or {}
        self.assertEqual(hit_by_url.get(article.url), article)

        mock_record.assert_called_with("t1", ok=True, message=unittest.mock.ANY)
        msg = mock_record.call_args.kwargs["message"]
        self.assertIn("[tbox:TICK_OK]", msg)
        self.assertIn("skipped_serp_rank=1", msg)
        self.assertIn("discover_rank_kept=1", msg)
        self.assertIn("discover_hits=2", msg)

    @patch.object(svc, "url_seen", return_value=False)
    @patch.object(svc, "run_discover")
    def test_resolve_target_urls_rank_stats(self, mock_discover, mock_url_seen):
        portal = DiscoverHit(
            url="https://portal.example.com/channel/list",
            title="首页",
            snippet="栏目导航",
            query="TBOX",
        )
        article = DiscoverHit(
            url="https://article.example.com/news/2024/tbox-whitepaper.html",
            title="TBOX 报告",
            snippet="趋势",
            query="TBOX",
        )
        mock_discover.return_value = DiscoverResult(
            hits=[portal, article],
            provider="tavily",
            queries_executed=1,
            raw_result_count=2,
            notes="",
        )
        row = self._task()
        strategy = svc.parse_strategy(row.extra_config)
        urls, _note, stats, _disc, err, hit_by_url = svc._resolve_crawl_target_urls(
            row, strategy, dict(row.extra_config)
        )
        self.assertIsNone(err)
        self.assertEqual(stats.skipped_serp_rank, 1)
        self.assertEqual(stats.discover_rank_kept, 1)
        self.assertEqual(stats.discover_hits, 2)
        self.assertEqual(urls, [article.url])
        self.assertIn(article.url, hit_by_url)


if __name__ == "__main__":
    unittest.main()
