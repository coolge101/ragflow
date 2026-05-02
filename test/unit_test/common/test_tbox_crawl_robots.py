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

from common.tbox_crawl_robots import RobotsOriginCache, _origin_cache_key, _robots_txt_url


class TestRobotsTxtUrl(unittest.TestCase):
    def test_https_origin(self):
        self.assertEqual(_robots_txt_url("https://example.com/path?q=1"), "https://example.com/robots.txt")

    def test_http_preserves_netloc(self):
        self.assertEqual(_robots_txt_url("http://cdn.example:8080/"), "http://cdn.example:8080/robots.txt")

    def test_invalid_scheme_raises(self):
        with self.assertRaises(ValueError):
            _robots_txt_url("ftp://example.com/")

    def test_empty_netloc_raises(self):
        with self.assertRaises(ValueError):
            _robots_txt_url("https:///nohost")


class TestOriginCacheKey(unittest.TestCase):
    def test_lowercases_scheme_and_netloc(self):
        self.assertEqual(_origin_cache_key("HTTPS://Ex.Ample.Com:443/foo"), ("https", "ex.ample.com:443"))


class TestRobotsOriginCache(unittest.TestCase):
    @patch("common.tbox_crawl_robots.fetch_url_body_capped", return_value=(b"", None))
    def test_empty_body_allow_all(self, _mock_fetch):
        c = RobotsOriginCache()
        ok, reason = c.allowed("https://origin.example/page")
        self.assertTrue(ok)
        self.assertEqual(reason, "")

    @patch("common.tbox_crawl_robots.fetch_url_body_capped")
    def test_disallow_root_blocks(self, mock_fetch):
        mock_fetch.return_value = (b"User-agent: *\nDisallow: /\n", "text/plain")
        c = RobotsOriginCache(user_agent="TestAgent/1")
        ok, reason = c.allowed("https://blocked.example/any")
        self.assertFalse(ok)
        self.assertIn("robots", reason.lower())

    @patch("common.tbox_crawl_robots.fetch_url_body_capped", return_value=(b"User-agent: *\nDisallow:\n", "text/plain"))
    def test_last_robots_network_mono_after_fetch(self, _mock_fetch):
        c = RobotsOriginCache()
        self.assertTrue(c.allowed("https://mono.example/page")[0])
        key = ("https", "mono.example")
        self.assertGreater(c.last_robots_network_mono(key), 0.0)

    @patch(
        "common.tbox_crawl_robots.fetch_url_body_capped",
        return_value=(b"User-agent: *\nCrawl-delay: 2\nDisallow:\n", "text/plain"),
    )
    def test_crawl_delay_seconds_star_block(self, _mock_fetch):
        c = RobotsOriginCache()
        self.assertTrue(c.allowed("https://cdelay.example/")[0])
        self.assertEqual(c.crawl_delay_seconds("https://cdelay.example/other"), 2.0)
