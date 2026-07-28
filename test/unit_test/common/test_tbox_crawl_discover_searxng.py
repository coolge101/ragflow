import unittest
from unittest.mock import patch

from common.tbox_crawl_discover import SearxngDiscoverProvider, resolve_searxng_base_url


class TestSearxngDiscover(unittest.TestCase):
    @patch.object(SearxngDiscoverProvider, "_fetch_json")
    def test_searxng_parses_json(self, mock_fetch):
        mock_fetch.return_value = {"results": [{"url": "https://example.com/news/2024/tbox-report.html"}]}
        provider = SearxngDiscoverProvider("http://searxng:8080")
        result = provider.discover(
            ["TBOX 技术"],
            locale="zh",
            max_urls=5,
            max_queries=1,
            max_results_per_query=5,
            allowed_domains=(),
            tavily_depth="basic",
        )
        self.assertIn("https://example.com/news/2024/tbox-report.html", result.urls)
        self.assertEqual(result.provider, "searxng")

    def test_resolve_base_url_from_env(self):
        with patch.dict("os.environ", {"TBOX_CRAWL_SEARXNG_BASE_URL": "http://localhost:8888/"}):
            self.assertEqual(resolve_searxng_base_url(), "http://localhost:8888")


if __name__ == "__main__":
    unittest.main()
