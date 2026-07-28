import unittest
from unittest.mock import MagicMock, patch

from common.tbox_crawl_discover import DiscoverConfig, DiscoverResult
from common.tbox_crawl_discover_router import resolve_auto_provider, run_auto_discover


class TestDiscoverRouter(unittest.TestCase):
    @patch("common.tbox_crawl_discover_router.resolve_tavily_api_key", return_value="tvly-key")
    @patch(
        "common.tbox_crawl_discover_router.probe_searxng_health",
        return_value={"reachable": True, "engines_ok": 0, "results_count": 0, "configured": True, "degraded": True},
    )
    def test_auto_falls_back_to_tavily_when_degraded(self, _health, _key):
        decision = resolve_auto_provider({})
        self.assertEqual(decision.provider, "tavily")
        self.assertTrue(decision.degraded)

    @patch(
        "common.tbox_crawl_discover_router.probe_searxng_health",
        return_value={"reachable": True, "engines_ok": 3, "results_count": 2, "configured": True, "degraded": False},
    )
    def test_auto_uses_searxng_when_healthy(self, _health):
        decision = resolve_auto_provider({"tbox_crawl_discover_min_engines": 2})
        self.assertEqual(decision.provider, "searxng")
        self.assertFalse(decision.degraded)

    @patch("common.tbox_crawl_discover_router.resolve_auto_provider")
    @patch("common.tbox_crawl_discover_router.get_discover_provider")
    def test_run_auto_discover_delegates(self, mock_get_provider, mock_route):
        mock_route.return_value = MagicMock(
            provider="searxng",
            degraded=False,
            note="auto:searxng",
            searxng_health={"effective_engines": "bing"},
        )
        provider = MagicMock()
        provider.discover.return_value = DiscoverResult(
            urls=["https://example.com/a"],
            provider="searxng",
            queries_executed=1,
            raw_result_count=1,
            notes="",
        )
        mock_get_provider.return_value = provider
        cfg = DiscoverConfig(
            provider="auto",
            queries=("TBOX test",),
            locale="zh",
            max_urls=5,
            max_queries=1,
            max_results_per_query=5,
            tavily_depth="basic",
        )
        result = run_auto_discover(cfg, (), {})
        self.assertIsNotNone(result)
        self.assertEqual(result.provider, "auto")
        self.assertEqual(result.urls, ["https://example.com/a"])


if __name__ == "__main__":
    unittest.main()
