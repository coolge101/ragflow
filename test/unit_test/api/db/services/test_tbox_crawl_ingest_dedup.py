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

from api.db.services import tbox_crawl_ingest_service as ingest_svc


class TestIngestStaticWebDedup(unittest.TestCase):
    @patch.object(ingest_svc, "record_seen")
    @patch.object(ingest_svc, "content_seen", return_value=True)
    @patch.object(ingest_svc, "fetch_url_body_capped", return_value=(b"dup-body", "text/html"))
    def test_skips_duplicate_content(self, mock_fetch, mock_content_seen, mock_record):
        kb = SimpleNamespace(id="kb1")
        ok, msg, stats = ingest_svc.ingest_static_web_seeds_into_kb(
            kb,
            "tenant1",
            ["https://example.com/page"],
            skip_robots=True,
            max_urls=1,
            dataset_id="kb1",
        )
        self.assertTrue(ok)
        self.assertEqual(stats["skipped_dup_content"], 1)
        self.assertEqual(stats["ingested"], 0)
        mock_record.assert_not_called()

    @patch.object(ingest_svc, "DocumentService")
    @patch.object(ingest_svc, "FileService")
    @patch.object(ingest_svc, "record_seen")
    @patch.object(ingest_svc, "content_seen", return_value=False)
    @patch.object(ingest_svc, "fetch_url_body_capped", return_value=(b"fresh-body", "text/html"))
    def test_ingests_and_records_seen(
        self,
        mock_fetch,
        mock_content_seen,
        mock_record,
        mock_file_svc,
        mock_doc_svc,
    ):
        mock_file_svc.upload_document.return_value = ([], [(SimpleNamespace(id="d1"), b"fresh-body")])
        mock_doc_svc.query = lambda **kwargs: []
        mock_doc_svc.run = lambda *args, **kwargs: None

        kb = SimpleNamespace(id="kb1")
        ok, msg, stats = ingest_svc.ingest_static_web_seeds_into_kb(
            kb,
            "tenant1",
            ["https://example.com/page"],
            skip_robots=True,
            max_urls=1,
            dataset_id="kb1",
            discovered_canonical={"https://example.com/page"},
        )
        self.assertTrue(ok)
        self.assertEqual(stats["ingested"], 1)
        mock_record.assert_called_once()
        self.assertEqual(mock_record.call_args.kwargs["source"], "discover")


if __name__ == "__main__":
    unittest.main()
