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
import warnings
from types import SimpleNamespace
from unittest.mock import patch

warnings.filterwarnings(
    "ignore",
    message="pkg_resources is deprecated as an API.*",
    category=UserWarning,
)

from api.db.services import tbox_crawl_task_service as svc
from common.tbox_crawl_strategy import EXTRA_CRAWL_ALLOWED_DOMAINS


class TestExecuteCrawlTickStrategy(unittest.TestCase):
    def _task(self, **kwargs):
        defaults = dict(
            id="t1",
            tenant_id="u1",
            dataset_id=None,
            source_type="static_web",
            seed_urls=["https://www.example.com/seed", "https://blocked.other/seed"],
            extra_config={EXTRA_CRAWL_ALLOWED_DOMAINS: ["example.com"]},
        )
        defaults.update(kwargs)
        return SimpleNamespace(**defaults)

    @patch.object(svc, "record_worker_tick")
    @patch.object(svc, "probe_seed_urls")
    @patch.object(svc, "get_task")
    def test_allowed_domains_filters_before_probe(self, mock_get, mock_probe, mock_record):
        mock_get.return_value = self._task()
        mock_probe.return_value = (True, "")

        svc.execute_crawl_task_stub_tick("t1")

        mock_probe.assert_called_once()
        urls = mock_probe.call_args[0][0]
        self.assertEqual(urls, ["https://www.example.com/seed"])
        mock_record.assert_called_with("t1", ok=True, message=unittest.mock.ANY)
        msg = mock_record.call_args.kwargs["message"]
        self.assertIn("[tbox:TICK_OK]", msg)

    @patch.object(svc, "record_worker_tick")
    @patch.object(svc, "probe_seed_urls")
    @patch.object(svc, "get_task")
    def test_all_seeds_blocked_records_strategy_error(self, mock_get, mock_probe, mock_record):
        mock_get.return_value = self._task(
            seed_urls=["https://blocked.other/only"],
            extra_config={EXTRA_CRAWL_ALLOWED_DOMAINS: ["example.com"]},
        )

        svc.execute_crawl_task_stub_tick("t1")

        mock_probe.assert_not_called()
        mock_record.assert_called_once()
        self.assertFalse(mock_record.call_args.kwargs["ok"])
        self.assertIn("STRATEGY", mock_record.call_args.kwargs["message"])


if __name__ == "__main__":
    unittest.main()
