#
#  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
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
from common.tbox_crawl_discover import (
    DiscoverProviderError,
    DiscoverResult,
    EXTRA_SEARCH_PROVIDER,
    EXTRA_SEARCH_QUERIES,
)


class TestExecuteCrawlTickDiscover(unittest.TestCase):
    def _task(self, **kwargs):
        defaults = dict(
            id="t1",
            tenant_id="u1",
            dataset_id="kb1",
            source_type="static_web",
            seed_urls=["https://www.example.com/seed"],
            extra_config={
                EXTRA_SEARCH_PROVIDER: "tavily",
                EXTRA_SEARCH_QUERIES: ["TBOX 法规"],
                "tbox_skip_http_probe": True,
            },
        )
        defaults.update(kwargs)
        return SimpleNamespace(**defaults)

    @patch.object(svc, "record_worker_tick")
    @patch.object(svc, "ingest_static_web_seeds_into_kb")
    @patch.object(svc, "KnowledgebaseService")
    @patch.object(svc, "kb_valid_for_tenant", return_value=True)
    @patch.object(svc, "run_discover")
    @patch.object(svc, "url_seen", return_value=False)
    @patch.object(svc, "get_task")
    def test_discover_merge_ingest_summary(
        self,
        mock_get,
        mock_url_seen,
        mock_discover,
        mock_kb_valid,
        mock_kb_svc,
        mock_ingest,
        mock_record,
    ):
        mock_get.return_value = self._task()
        mock_discover.return_value = DiscoverResult(
            urls=["https://discovered.example.com/page"],
            provider="tavily",
            queries_executed=1,
            raw_result_count=1,
            notes="",
        )
        mock_kb_svc.get_by_id.return_value = (True, SimpleNamespace(id="kb1"))
        mock_ingest.return_value = (True, "", {"ingested": 1, "skipped_dup_content": 0, "skipped_kw": 0})

        svc.execute_crawl_task_stub_tick("t1")

        mock_ingest.assert_called_once()
        mock_record.assert_called_with("t1", ok=True, message=unittest.mock.ANY)
        msg = mock_record.call_args.kwargs["message"]
        self.assertIn("[tbox:TICK_OK]", msg)
        self.assertIn("discovered=1", msg)
        self.assertIn("ingested=1", msg)

    @patch.object(svc, "record_worker_tick")
    @patch.object(svc, "run_discover")
    @patch.object(svc, "get_task")
    def test_discover_no_key_records_error(self, mock_get, mock_discover, mock_record):
        mock_get.return_value = self._task()
        mock_discover.side_effect = DiscoverProviderError("DISCOVER_NO_KEY", "missing key")

        svc.execute_crawl_task_stub_tick("t1")

        mock_record.assert_called_once()
        self.assertFalse(mock_record.call_args.kwargs["ok"])
        self.assertIn("DISCOVER_NO_KEY", mock_record.call_args.kwargs["message"])

    @patch.object(svc, "record_worker_tick")
    @patch.object(svc, "run_discover")
    @patch.object(svc, "url_seen", return_value=True)
    @patch.object(svc, "get_task")
    def test_discover_empty_after_dedup(self, mock_get, mock_url_seen, mock_discover, mock_record):
        mock_get.return_value = self._task(seed_urls=[])
        mock_discover.return_value = DiscoverResult(
            urls=["https://discovered.example.com/page"],
            provider="tavily",
            queries_executed=1,
            raw_result_count=1,
            notes="",
        )

        svc.execute_crawl_task_stub_tick("t1")

        mock_record.assert_called_once()
        self.assertFalse(mock_record.call_args.kwargs["ok"])
        self.assertIn("DISCOVER_EMPTY", mock_record.call_args.kwargs["message"])


if __name__ == "__main__":
    unittest.main()
