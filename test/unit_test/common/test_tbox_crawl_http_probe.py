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

from common.tbox_crawl_http_probe import probe_seed_urls


class TestProbeSeedUrls(unittest.TestCase):
    def test_empty_seeds(self):
        self.assertEqual(probe_seed_urls([]), (False, "no seed_urls"))

    @patch("common.tbox_crawl_http_probe.probe_url_streaming_cap", return_value=(200, None))
    def test_success_skip_robots(self, _mock_probe):
        ok, msg = probe_seed_urls(["https://a.example/"], skip_robots=True)
        self.assertTrue(ok)
        self.assertEqual(msg, "")

    @patch("common.tbox_crawl_http_probe.probe_url_streaming_cap", return_value=(503, "HTTP 503"))
    def test_probe_failure_message(self, _mock_probe):
        ok, msg = probe_seed_urls(["https://b.example/"], skip_robots=True)
        self.assertFalse(ok)
        self.assertIn("https://b.example/", msg)
        self.assertIn("HTTP 503", msg)

    @patch("common.tbox_crawl_http_probe.probe_url_streaming_cap", return_value=(200, None))
    def test_max_urls_limits_iterations(self, mock_probe):
        seeds = [f"https://h{i}.example/" for i in range(10)]
        ok, msg = probe_seed_urls(seeds, max_urls=2, skip_robots=True)
        self.assertTrue(ok)
        self.assertEqual(mock_probe.call_count, 2)
