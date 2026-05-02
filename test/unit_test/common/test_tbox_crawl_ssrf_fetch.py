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

import os
import unittest
from unittest.mock import patch

import requests

from common.tbox_crawl_ssrf_fetch import _retry_delay_seconds


class TestTboxCrawlSsrfFetch(unittest.TestCase):
    def _resp(self, retry_after: str | None = None) -> requests.Response:
        r = requests.Response()
        r.status_code = 429
        if retry_after is not None:
            r.headers["Retry-After"] = retry_after
        return r

    def test_retry_after_delta_seconds(self):
        r = self._resp("3")
        d = _retry_delay_seconds(r, attempt_idx=0)
        self.assertGreaterEqual(d, 0.0)
        self.assertLessEqual(d, 30.0)

    def test_retry_after_invalid_fallback_backoff(self):
        r = self._resp("not-a-valid-header")
        d0 = _retry_delay_seconds(r, attempt_idx=0)
        d1 = _retry_delay_seconds(r, attempt_idx=1)
        self.assertGreaterEqual(d0, 0.0)
        self.assertGreaterEqual(d1, d0)

    def test_retry_backoff_base_429_override(self):
        r = requests.Response()
        r.status_code = 429
        with patch.dict(os.environ, {"TBOX_CRAWL_RETRY_BACKOFF_BASE_429": "3"}, clear=False):
            self.assertAlmostEqual(_retry_delay_seconds(r, 0), 3.0)
            self.assertAlmostEqual(_retry_delay_seconds(r, 1), 6.0)


if __name__ == "__main__":
    unittest.main()
