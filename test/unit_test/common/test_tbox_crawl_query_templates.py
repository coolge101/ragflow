#
#  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
#

from __future__ import annotations

import unittest

from common.tbox_crawl_query_templates import (
    EXTRA_QUERY_TEMPLATE,
    EXTRA_QUERY_TEMPLATE_MODE,
    apply_query_template,
    build_tech_trend_queries,
)


class TestTboxCrawlQueryTemplates(unittest.TestCase):
    def test_tech_trend_generates_bilingual_queries(self):
        extra = {
            EXTRA_QUERY_TEMPLATE: "tech_trend",
            "tbox_crawl_keywords": ["车联网", "TBOX"],
            "tbox_crawl_search_queries": ["自定义 query"],
        }
        queries = apply_query_template(extra)
        self.assertIn("自定义 query", queries)
        self.assertTrue(any("白皮书" in q or "whitepaper" in q.lower() for q in queries))
        self.assertGreaterEqual(len(queries), 4)

    def test_empty_template_returns_user_queries_only(self):
        queries = apply_query_template({"tbox_crawl_search_queries": ["a", "b"]})
        self.assertEqual(queries, ["a", "b"])

    def test_unknown_template_returns_user_queries_only(self):
        extra = {
            EXTRA_QUERY_TEMPLATE: "unknown_template",
            "tbox_crawl_search_queries": ["only user"],
        }
        self.assertEqual(apply_query_template(extra), ["only user"])

    def test_replace_mode_uses_generated_when_user_empty(self):
        extra = {
            EXTRA_QUERY_TEMPLATE: "tech_trend",
            EXTRA_QUERY_TEMPLATE_MODE: "replace",
            "tbox_crawl_keywords": ["车联网", "TBOX"],
        }
        queries = apply_query_template(extra)
        self.assertGreaterEqual(len(queries), 4)
        self.assertTrue(any("白皮书" in q or "whitepaper" in q.lower() for q in queries))

    def test_replace_mode_merges_when_user_has_queries(self):
        extra = {
            EXTRA_QUERY_TEMPLATE: "tech_trend",
            EXTRA_QUERY_TEMPLATE_MODE: "replace",
            "tbox_crawl_keywords": ["车联网", "TBOX"],
            "tbox_crawl_search_queries": ["自定义 query"],
        }
        queries = apply_query_template(extra)
        self.assertIn("自定义 query", queries)
        self.assertGreaterEqual(len(queries), 4)

    def test_merge_mode_dedupes(self):
        extra = {
            EXTRA_QUERY_TEMPLATE: "tech_trend",
            EXTRA_QUERY_TEMPLATE_MODE: "merge",
            "tbox_crawl_keywords": ["车联网", "TBOX"],
            "tbox_crawl_search_queries": ["车联网 TBOX 技术趋势 白皮书"],
        }
        queries = apply_query_template(extra)
        self.assertEqual(len(queries), len(set(queries)))

    def test_tech_trend_adds_gov_site_clause(self):
        extra = {
            "tbox_crawl_keywords": ["车联网", "TBOX"],
            "tbox_crawl_allowed_domains": ["miit.gov.cn", "gov.cn"],
        }
        queries = build_tech_trend_queries(extra)
        self.assertTrue(any("site:gov.cn" in q for q in queries))

    def test_parse_discover_config_uses_template(self):
        from common.tbox_crawl_discover import parse_discover_config

        cfg = parse_discover_config(
            {
                EXTRA_QUERY_TEMPLATE: "tech_trend",
                "tbox_crawl_keywords": ["车联网", "TBOX"],
                "tbox_crawl_search_queries": ["自定义 query"],
            }
        )
        self.assertIn("自定义 query", cfg.queries)
        self.assertGreaterEqual(len(cfg.queries), 4)


if __name__ == "__main__":
    unittest.main()
