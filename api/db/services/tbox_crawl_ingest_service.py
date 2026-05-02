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

"""Ingest TBOX crawl seeds into a knowledge base (document row + parse queue)."""

from __future__ import annotations

import io
import logging
import os
from typing import Any

from api.constants import FILE_NAME_LEN_LIMIT
from api.db.services import duplicate_name
from api.db.services.document_service import DocumentService
from api.db.services.file_service import FileService
from common.data_source.rss_connector import RSSConnector
from common.tbox_crawl_origin_throttle import OriginFetchThrottler
from common.tbox_crawl_robots import RobotsOriginCache
from common.tbox_crawl_ssrf_fetch import fetch_url_body_capped, suggested_filename_from_url

_LOG = logging.getLogger(__name__)


def _safe_base_name(s: str, max_bytes: int) -> str:
    raw = (s or "").strip() or "entry"
    safe = "".join(c if c.isalnum() or c in " ._-()" else "_" for c in raw)
    b = safe.encode("utf-8")[:max_bytes]
    out = b.decode("utf-8", errors="ignore").strip()
    return out or "entry"


class _BytesUploadFile:
    __slots__ = ("filename", "_bio")

    def __init__(self, filename: str, blob: bytes):
        self.filename = filename
        self._bio = io.BytesIO(blob)

    def read(self) -> bytes:
        return self._bio.read()


def ingest_static_web_seeds_into_kb(
    kb: Any,
    tenant_id: str,
    seed_urls: list[str],
    *,
    max_urls: int | None = None,
    max_bytes: int | None = None,
    timeout_sec: float | None = None,
    skip_robots: bool = False,
    extra_config: dict[str, Any] | None = None,
) -> tuple[bool, str]:
    """
    Fetch each seed (SSRF-safe, capped), upload as a new file under *kb*, queue parse tasks.

    Returns ``(ok, message)``; *message* lists failures if ``ok`` is False.

    *extra_config* is forwarded to :func:`common.tbox_crawl_ssrf_fetch.fetch_url_body_capped` for
    ``effective_retry_statuses`` (``tbox_crawl_retry_extra_statuses``).
    """
    if kb is None or not getattr(kb, "id", None):
        return False, "invalid knowledge base"

    lim_raw = max_urls if max_urls is not None else os.environ.get("TBOX_CRAWL_INGEST_MAX", "5")
    lim = max(1, min(int(lim_raw), len(seed_urls)))
    max_b = int(max_bytes if max_bytes is not None else os.environ.get("TBOX_CRAWL_INGEST_MAX_BYTES", str(8 * 1024 * 1024)))
    timeout = float(timeout_sec if timeout_sec is not None else os.environ.get("TBOX_CRAWL_INGEST_TIMEOUT", os.environ.get("TBOX_CRAWL_FETCH_TIMEOUT", "60")))

    errs: list[str] = []
    kb_table_num_map: dict = {}
    robots_cache = None if skip_robots else RobotsOriginCache()
    throttle = OriginFetchThrottler(robots_cache)

    for url in seed_urls[:lim]:
        try:
            body, ctype = fetch_url_body_capped(
                url,
                max_bytes=max_b,
                timeout=timeout,
                robots_preflight=robots_cache,
                origin_throttle=throttle,
                extra_config=extra_config,
            )
            raw_name = suggested_filename_from_url(url, ctype)
            filename = duplicate_name(DocumentService.query, name=raw_name, kb_id=kb.id)
            fobj = _BytesUploadFile(filename, body)
            err, pairs = FileService.upload_document(kb, [fobj], tenant_id, src="web")
            if err:
                errs.append(f"{url}: {'; '.join(err)}")
                continue
            for doc, _blob in pairs:
                DocumentService.run(tenant_id, doc, kb_table_num_map)
            _LOG.info("tbox_crawl_ingest: queued doc name=%s kb_id=%s url=%s", filename, kb.id, url)
        except Exception as exc:
            _LOG.warning("tbox_crawl_ingest failed url=%s err=%s", url, exc)
            errs.append(f"{url}: {exc}")

    if errs:
        return False, "; ".join(errs)[:65000]
    return True, ""


def ingest_rss_seeds_into_kb(
    kb: Any,
    tenant_id: str,
    feed_urls: list[str],
    *,
    max_feeds: int | None = None,
    max_entries: int | None = None,
    skip_robots: bool = False,
    extra_config: dict[str, Any] | None = None,
) -> tuple[bool, str]:
    """
    Treat each seed URL as an RSS/Atom feed: fetch entries via :class:`RSSConnector`,
    upload each entry as ``.txt`` under *kb*, then queue parse tasks.

    Caps: ``TBOX_CRAWL_RSS_MAX_FEEDS`` (default **3**), ``TBOX_CRAWL_RSS_MAX_ENTRIES`` (default **30**) per tick.
    Feed HTTP timeout: ``TBOX_CRAWL_INGEST_TIMEOUT`` (fallback ``TBOX_CRAWL_FETCH_TIMEOUT``), same as ``static_web`` ingest.

    *extra_config* is passed to :class:`common.data_source.rss_connector.RSSConnector` for the same
    ``effective_retry_statuses`` whitelist as page fetch.
    """
    if kb is None or not getattr(kb, "id", None):
        return False, "invalid knowledge base"

    mf_raw = max_feeds if max_feeds is not None else os.environ.get("TBOX_CRAWL_RSS_MAX_FEEDS", "3")
    me_raw = max_entries if max_entries is not None else os.environ.get("TBOX_CRAWL_RSS_MAX_ENTRIES", "30")
    max_f = max(1, min(int(mf_raw), len(feed_urls)))
    cap = max(1, int(me_raw))
    feed_timeout = float(os.environ.get("TBOX_CRAWL_INGEST_TIMEOUT", os.environ.get("TBOX_CRAWL_FETCH_TIMEOUT", "60")))

    errs: list[str] = []
    kb_table_num_map: dict = {}
    n_done = 0
    name_budget = max(32, FILE_NAME_LEN_LIMIT - 8)
    robots_cache = None if skip_robots else RobotsOriginCache()
    throttle = OriginFetchThrottler(robots_cache)

    for feed_url in feed_urls[:max_f]:
        fu = (feed_url or "").strip()
        if not fu:
            continue
        try:
            if robots_cache is not None:
                ok_r, msg_r = robots_cache.allowed(fu)
                if not ok_r:
                    errs.append(f"{fu}: {msg_r}")
                    continue
            inner_batch = min(100, cap)
            conn = RSSConnector(
                fu,
                batch_size=max(1, inner_batch),
                origin_throttle=throttle,
                robots_preflight=robots_cache,
                request_timeout_sec=feed_timeout,
                extra_config=extra_config,
            )
            conn.load_credentials({})
            for batch in conn.load_from_state():
                for doc in batch:
                    if n_done >= cap:
                        break
                    blob = doc.blob if isinstance(doc.blob, (bytes, bytearray)) else bytes(doc.blob or b"")
                    if not blob:
                        continue
                    base = _safe_base_name(doc.semantic_identifier, name_budget)
                    raw_name = f"{base}.txt"
                    filename = duplicate_name(DocumentService.query, name=raw_name, kb_id=kb.id)
                    fobj = _BytesUploadFile(filename, blob)
                    err, pairs = FileService.upload_document(kb, [fobj], tenant_id, src="web")
                    if err:
                        errs.append(f"{fu} entry {filename!r}: {'; '.join(err)}")
                        continue
                    for drow, _blob in pairs:
                        DocumentService.run(tenant_id, drow, kb_table_num_map)
                    n_done += 1
                    _LOG.info("tbox_crawl_rss_ingest: queued doc name=%s kb_id=%s feed=%s", filename, kb.id, fu)
                if n_done >= cap:
                    break
            throttle.record_hop_finished(fu)
        except Exception as exc:
            _LOG.warning("tbox_crawl_rss_ingest failed feed=%s err=%s", fu, exc)
            errs.append(f"{fu}: {exc}")

    if errs:
        return False, "; ".join(errs)[:65000]
    return True, ""
