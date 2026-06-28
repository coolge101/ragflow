#
#  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
#

from __future__ import annotations

import importlib.util
import sys
import unittest
import warnings
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

warnings.filterwarnings(
    "ignore",
    message="pkg_resources is deprecated as an API.*",
    category=UserWarning,
)

from common.tbox_crawl_discover import DiscoverHit
from common.tbox_crawl_extract import EXTRA_MIN_EXTRACT_CHARS


def _load_ingest_service_module():
    repo_root = Path(__file__).resolve().parents[5]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

    def _stub(name: str) -> ModuleType:
        mod = ModuleType(name)
        sys.modules[name] = mod
        return mod

    api = _stub("api")
    constants = _stub("api.constants")
    constants.FILE_NAME_LEN_LIMIT = 255
    api_db = _stub("api.db")
    services = _stub("api.db.services")
    services.__path__ = []  # type: ignore[attr-defined]
    services.duplicate_name = lambda query, **kwargs: kwargs.get("name", "file.txt")

    doc_svc = _stub("api.db.services.document_service")

    class _DocSvcStub:
        @staticmethod
        def query(**kwargs):
            return []

        @staticmethod
        def run(*args, **kwargs):
            return None

    doc_svc.DocumentService = _DocSvcStub

    file_svc = _stub("api.db.services.file_service")

    class _FileSvcStub:
        @staticmethod
        def upload_document(kb, files, tenant_id, src="web"):
            return ([], [])

    file_svc.FileService = _FileSvcStub

    seen_svc = _stub("api.db.services.tbox_crawl_seen_service")
    seen_svc.content_seen = lambda *a, **k: False
    seen_svc.record_seen = lambda *a, **k: None

    health_svc = _stub("api.db.services.tbox_crawl_health_service")
    health_svc.record_url_outcome = lambda *a, **k: None
    health_svc.record_url_outcome_from_error = lambda *a, **k: None

    data_source = _stub("common.data_source")
    data_source.__path__ = []  # type: ignore[attr-defined]
    rss_connector = _stub("common.data_source.rss_connector")

    class _RSSConnectorStub:
        def __init__(self, *args, **kwargs):
            pass

        def load_credentials(self, *args, **kwargs):
            return None

        def load_from_state(self):
            return iter([])

    rss_connector.RSSConnector = _RSSConnectorStub

    spec = importlib.util.spec_from_file_location(
        "tbox_crawl_ingest_service_under_test",
        repo_root / "api" / "db" / "services" / "tbox_crawl_ingest_service.py",
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


ingest_svc = _load_ingest_service_module()


class TestMaybePrependTitle(unittest.TestCase):
    def test_returns_text_when_long_enough(self):
        text = "x" * 50
        self.assertEqual(ingest_svc._maybe_prepend_title(text, "Title", 20), text)

    def test_prepends_title_when_short(self):
        title = "Long Discover Hit Title From Search Results Page"
        merged = ingest_svc._maybe_prepend_title("brief", title, 50)
        self.assertEqual(merged, f"# {title}\n\nbrief")
        self.assertGreaterEqual(len(merged), 50)

    def test_no_title_returns_short_text(self):
        self.assertEqual(ingest_svc._maybe_prepend_title("brief", "", 50), "brief")
        self.assertEqual(ingest_svc._maybe_prepend_title("brief", None, 50), "brief")


class TestIngestTitleFallback(unittest.TestCase):
    @patch.object(ingest_svc, "passes_relevance_gate", return_value=(True, 1.0, "ok"))
    @patch.object(ingest_svc, "extract_main_text", return_value="brief")
    @patch.object(ingest_svc, "DocumentService")
    @patch.object(ingest_svc, "FileService")
    @patch.object(ingest_svc, "record_seen")
    @patch.object(ingest_svc, "content_seen", return_value=False)
    @patch.object(ingest_svc, "fetch_url_body_capped", return_value=(b"<html>brief</html>", "text/html"))
    def test_short_extract_with_title_passes_min_length(
        self,
        mock_fetch,
        mock_content_seen,
        mock_record,
        mock_file_svc,
        mock_doc_svc,
        mock_extract,
        mock_relevance,
    ):
        url = "https://example.com/article"
        title = "Long Discover Hit Title From Search Results Page"
        min_chars = 50
        extra_config = {EXTRA_MIN_EXTRACT_CHARS: min_chars}
        hit = DiscoverHit(url=url, title=title, snippet="", query="q1")

        uploaded: list[bytes] = []

        def _capture_upload(kb, files, tenant_id, src="web"):
            for f in files:
                uploaded.append(f.read())
            return ([], [(SimpleNamespace(id="d1"), uploaded[-1] if uploaded else b"")])

        mock_file_svc.upload_document.side_effect = _capture_upload
        mock_doc_svc.query = lambda **kwargs: []
        mock_doc_svc.run = lambda *args, **kwargs: None

        kb = SimpleNamespace(id="kb1")
        ok, msg, stats = ingest_svc.ingest_static_web_seeds_into_kb(
            kb,
            "tenant1",
            [url],
            skip_robots=True,
            max_urls=1,
            dataset_id="kb1",
            extra_config=extra_config,
            hit_by_url={url: hit},
        )

        self.assertTrue(ok, msg)
        self.assertEqual(stats["ingested"], 1)
        self.assertEqual(stats["skipped_low_quality"], 0)
        self.assertEqual(len(uploaded), 1)
        body_text = uploaded[0].decode("utf-8")
        self.assertTrue(body_text.startswith(f"# {title}"))
        self.assertGreaterEqual(len(body_text), min_chars)

    @patch.object(ingest_svc, "passes_relevance_gate", return_value=(True, 1.0, "ok"))
    @patch.object(ingest_svc, "extract_main_text", return_value="brief")
    @patch.object(ingest_svc, "fetch_url_body_capped", return_value=(b"<html>brief</html>", "text/html"))
    def test_short_extract_without_title_skipped(
        self,
        mock_fetch,
        mock_extract,
        mock_relevance,
    ):
        url = "https://example.com/article"
        min_chars = 50
        extra_config = {EXTRA_MIN_EXTRACT_CHARS: min_chars}

        kb = SimpleNamespace(id="kb1")
        ok, msg, stats = ingest_svc.ingest_static_web_seeds_into_kb(
            kb,
            "tenant1",
            [url],
            skip_robots=True,
            max_urls=1,
            dataset_id="kb1",
            extra_config=extra_config,
        )

        self.assertFalse(ok)
        self.assertEqual(stats["ingested"], 0)
        self.assertEqual(stats["skipped_low_quality"], 1)


if __name__ == "__main__":
    unittest.main()
