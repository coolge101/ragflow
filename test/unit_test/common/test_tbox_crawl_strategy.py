#
#  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#

from __future__ import annotations

import unittest
from unittest.mock import patch

from common.tbox_crawl_strategy import (
    EXTRA_CRAWL_ALLOWED_DOMAINS,
    EXTRA_CRAWL_KEYWORDS,
    EXTRA_CRAWL_MAX_DEPTH,
    content_matches_keywords,
    expand_static_web_urls,
    extract_html_links,
    filter_urls_by_allowed_domains,
    parse_strategy,
    resolve_target_urls,
    url_allowed_by_domains,
)


class TestParseStrategy(unittest.TestCase):
    def test_defaults(self):
        s = parse_strategy({})
        self.assertEqual(s.keywords, ())
        self.assertIsNone(s.max_depth)
        self.assertEqual(s.allowed_domains, ())

    def test_parses_keys(self):
        s = parse_strategy(
            {
                EXTRA_CRAWL_KEYWORDS: ["政策", "补贴"],
                EXTRA_CRAWL_MAX_DEPTH: 2,
                EXTRA_CRAWL_ALLOWED_DOMAINS: ["Example.COM", "news.example.com"],
            }
        )
        self.assertEqual(s.keywords, ("政策", "补贴"))
        self.assertEqual(s.max_depth, 2)
        self.assertEqual(s.allowed_domains, ("example.com", "news.example.com"))


class TestAllowedDomains(unittest.TestCase):
    def test_empty_allows_all(self):
        self.assertTrue(url_allowed_by_domains("https://any.example/x", ()))

    def test_exact_and_suffix(self):
        allowed = ("example.com",)
        self.assertTrue(url_allowed_by_domains("https://www.example.com/a", allowed))
        self.assertTrue(url_allowed_by_domains("https://news.example.com/a", allowed))
        self.assertFalse(url_allowed_by_domains("https://evil.com/a", allowed))

    def test_filter_list(self):
        kept, skipped = filter_urls_by_allowed_domains(
            ["https://a.example.com/1", "https://b.other/2"],
            ("example.com",),
        )
        self.assertEqual(kept, ["https://a.example.com/1"])
        self.assertEqual(skipped, ["https://b.other/2"])


class TestKeywords(unittest.TestCase):
    def test_empty_matches(self):
        self.assertTrue(content_matches_keywords(b"hello", ()))

    def test_case_insensitive(self):
        self.assertTrue(content_matches_keywords(b"Hello POLICY", ("policy",)))
        self.assertFalse(content_matches_keywords(b"Hello", ("missing",)))


class TestExtractHtmlLinks(unittest.TestCase):
    def test_extracts_absolute_and_relative(self):
        html = b'<html><a href="/b">x</a><a href="https://other.com/c">y</a></html>'
        links = extract_html_links(html, "https://example.com/a")
        self.assertIn("https://example.com/b", links)
        self.assertIn("https://other.com/c", links)


class TestExpandStaticWebUrls(unittest.TestCase):
    def test_no_depth_returns_filtered_seeds(self):
        strategy = parse_strategy({EXTRA_CRAWL_ALLOWED_DOMAINS: ["example.com"]})
        urls, note = expand_static_web_urls(
            ["https://example.com/", "https://other.com/"],
            strategy=strategy,
            skip_robots=True,
            extra_config={},
        )
        self.assertEqual(urls, ["https://example.com/"])
        self.assertIn("skipped", note)

    @patch("common.tbox_crawl_strategy.fetch_url_body_capped")
    def test_depth_follows_links(self, mock_fetch):
        mock_fetch.return_value = (
            b'<html><a href="https://example.com/child">c</a></html>',
            "text/html",
        )
        strategy = parse_strategy({EXTRA_CRAWL_MAX_DEPTH: 1, EXTRA_CRAWL_ALLOWED_DOMAINS: ["example.com"]})
        urls, _note = expand_static_web_urls(
            ["https://example.com/"],
            strategy=strategy,
            skip_robots=True,
            extra_config={},
            max_urls=10,
        )
        self.assertEqual(urls[0], "https://example.com/")
        self.assertIn("https://example.com/child", urls)


class TestResolveTargetUrls(unittest.TestCase):
    def test_rss_only_filters_domains(self):
        strategy = parse_strategy({EXTRA_CRAWL_ALLOWED_DOMAINS: ["feed.example.com"]})
        urls, _note = resolve_target_urls(
            ["https://feed.example.com/rss", "https://other.com/rss"],
            source_type="rss",
            strategy=strategy,
            skip_robots=True,
            extra_config={},
        )
        self.assertEqual(urls, ["https://feed.example.com/rss"])


if __name__ == "__main__":
    unittest.main()
