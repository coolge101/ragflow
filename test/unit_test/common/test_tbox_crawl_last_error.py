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

from common.tbox_crawl_last_error import format_crawl_worker_error


class TestFormatCrawlWorkerError(unittest.TestCase):
    def test_prefix_and_detail(self):
        s = format_crawl_worker_error("HTTP_PROBE", "https://x/: timeout")
        self.assertTrue(s.startswith("[tbox:HTTP_PROBE]"))
        self.assertIn("timeout", s)

    def test_sanitizes_code(self):
        s = format_crawl_worker_error("bad]code", "")
        self.assertTrue(s.startswith("[tbox:BAD_CODE]"))


if __name__ == "__main__":
    unittest.main()
