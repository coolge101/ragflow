#
#  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
#

from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from common.tbox_crawl_discover import (
    DiscoverProviderError,
    DiscoverResult,
    EXTRA_SEARCH_PROVIDER,
    EXTRA_SEARCH_QUERIES,
    get_discover_provider,
    parse_discover_config,
    run_discover,
)


class TestTboxCrawlDiscover(unittest.TestCase):
    def test_parse_discover_config_defaults(self):
        cfg = parse_discover_config({})
        self.assertEqual(cfg.provider, "none")
        self.assertEqual(cfg.queries, ())

    def test_parse_discover_config_queries(self):
        cfg = parse_discover_config(
            {
                EXTRA_SEARCH_PROVIDER: "tavily",
                EXTRA_SEARCH_QUERIES: ["q1", "q2"],
            }
        )
        self.assertEqual(cfg.provider, "tavily")
        self.assertEqual(cfg.queries, ("q1", "q2"))

    def test_get_discover_provider_no_key(self):
        with patch.dict(os.environ, {"TBOX_CRAWL_TAVILY_API_KEY": "", "TAVILY_API_KEY": ""}, clear=False):
            with self.assertRaises(DiscoverProviderError) as ctx:
                get_discover_provider("tavily")
        self.assertEqual(ctx.exception.code, "DISCOVER_NO_KEY")

    @patch("common.tbox_crawl_discover.get_discover_provider")
    def test_run_discover_none_when_provider_none(self, mock_get):
        cfg = parse_discover_config({EXTRA_SEARCH_QUERIES: ["x"]})
        self.assertIsNone(run_discover(cfg, ()))
        mock_get.assert_not_called()

    @patch("common.tbox_crawl_discover.get_discover_provider")
    def test_run_discover_delegates(self, mock_get):
        provider = mock_get.return_value
        provider.discover.return_value = DiscoverResult(
            urls=["https://a.com"],
            provider="tavily",
            queries_executed=1,
            raw_result_count=1,
            notes="",
        )
        cfg = parse_discover_config({EXTRA_SEARCH_PROVIDER: "tavily", EXTRA_SEARCH_QUERIES: ["TBOX test"]})
        with patch.dict(os.environ, {"TAVILY_API_KEY": "k"}, clear=False):
            result = run_discover(cfg, ("a.com",))
        self.assertIsNotNone(result)
        self.assertEqual(result.urls, ["https://a.com"])


if __name__ == "__main__":
    unittest.main()
