import unittest
from unittest.mock import patch

from common.tbox_crawl_outbound_probe import build_crawl_health_report, recommend_discover_provider


class TestCrawlOutboundProbe(unittest.TestCase):
    def test_recommend_tavily_when_searxng_degraded(self):
        searxng = {"reachable": True, "degraded": True, "results_count": 0}
        tavily = {"api_key_present": True}
        self.assertEqual(recommend_discover_provider(searxng, tavily), "tavily")

    @patch("common.tbox_crawl_outbound_probe.probe_tavily", return_value={"api_key_present": False})
    @patch(
        "common.tbox_crawl_outbound_probe.probe_searxng",
        return_value={"configured": False, "reachable": False},
    )
    def test_build_report(self, _mock_searx, _mock_tav):
        report = build_crawl_health_report()
        self.assertIn("searxng", report)
        self.assertIn("recommended_discover_provider", report)
        self.assertEqual(report["self_heal_phase"], "69.0")


if __name__ == "__main__":
    unittest.main()
