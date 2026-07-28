import unittest
from unittest.mock import patch

from common.tbox_crawl_searxng_health import (
    count_engines_ok,
    is_searxng_degraded,
    parse_engine_allowlist,
    probe_searxng_health,
    resolve_effective_engines,
)


class TestSearxngHealth(unittest.TestCase):
    def test_count_engines_ok(self):
        body = {"results": [{"engine": "bing", "url": "https://a.com"}, {"engine": "bing", "url": "https://b.com"}]}
        self.assertEqual(count_engines_ok(body), 1)

    def test_resolve_effective_engines_filters_unresponsive(self):
        eff = resolve_effective_engines(["bing", "google"], ["google", "timeout"])
        self.assertEqual(eff, "bing")

    def test_is_degraded_below_min(self):
        self.assertTrue(is_searxng_degraded({"reachable": True, "engines_ok": 1}, min_engines=2))
        self.assertFalse(is_searxng_degraded({"reachable": True, "engines_ok": 2}, min_engines=2))

    @patch("common.tbox_crawl_searxng_health._urlopen_json")
    @patch("common.tbox_crawl_searxng_health.resolve_searxng_base_url", return_value="http://searxng:8080")
    def test_probe_health_ok(self, _base, mock_json):
        mock_json.return_value = {
            "results": [{"engine": "bing", "url": "https://example.com/x"}],
            "unresponsive_engines": ["google"],
        }
        with patch.dict("os.environ", {"TBOX_CRAWL_SEARXNG_ENGINE_ALLOWLIST": "bing,google"}, clear=False):
            health = probe_searxng_health(min_engines=1)
        self.assertTrue(health["reachable"])
        self.assertEqual(health["effective_engines"], "bing")
        self.assertFalse(health["degraded"])

    def test_parse_allowlist(self):
        with patch.dict("os.environ", {"TBOX_CRAWL_SEARXNG_ENGINE_ALLOWLIST": "bing, sogou"}, clear=False):
            self.assertEqual(parse_engine_allowlist(), ["bing", "sogou"])


if __name__ == "__main__":
    unittest.main()
