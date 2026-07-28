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
from common.tbox_crawl_api import api_item_to_document, extract_api_items, parse_api_config
from common.tbox_crawl_origin_throttle import OriginFetchThrottler
from common.tbox_crawl_robots import RobotsOriginCache
from common.tbox_crawl_encoding import mime_from_content_type, normalize_html_bytes_for_storage
from common.tbox_crawl_ssrf_fetch import fetch_url_body_capped, suggested_filename_from_url
from api.db.services.tbox_crawl_seen_service import content_seen, record_seen
from api.db.services import tbox_crawl_health_service as crawl_health_svc
from common.tbox_crawl_dedup import canonicalize_url, content_sha256
from common.tbox_crawl_extract import (
    extract_main_text,
    parse_extract_enabled,
    parse_min_extract_chars,
    suggested_txt_filename,
)
from common.tbox_crawl_strategy import content_matches_keywords, parse_strategy
from common.tbox_crawl_relevance import passes_relevance_gate

_LOG = logging.getLogger(__name__)


def _maybe_prepend_title(text: str, title: str | None, min_chars: int) -> str:
    t = (text or "").strip()
    title = (title or "").strip()
    if len(t) >= min_chars or not title:
        return t
    return f"# {title}\n\n{t}".strip()


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
    dataset_id: str | None = None,
    dedup: bool = True,
    discovered_canonical: set[str] | None = None,
    seed_canonical: set[str] | None = None,
    task_id: str | None = None,
    task_name: str = "",
    hit_by_url: dict[str, Any] | None = None,
) -> tuple[bool, str, dict[str, int]]:
    """
    Fetch each seed (SSRF-safe, capped), upload as a new file under *kb*, queue parse tasks.

    Returns ``(ok, message, stats)``; *message* lists failures if ``ok`` is False.
    *stats* keys: ``ingested``, ``skipped_dup_content``, ``skipped_kw``, ``skipped_low_quality``.

    *extra_config* is forwarded to :func:`common.tbox_crawl_ssrf_fetch.fetch_url_body_capped` for
    ``effective_retry_statuses`` (``tbox_crawl_retry_extra_statuses``).
    """
    stats = {
        "ingested": 0,
        "ingested_urls": [],
        "skipped_dup_content": 0,
        "skipped_kw": 0,
        "skipped_low_quality": 0,
        "skipped_relevance": 0,
        "ingest_failures": 0,
    }
    if kb is None or not getattr(kb, "id", None):
        return False, "invalid knowledge base", stats

    ds = dataset_id or str(getattr(kb, "id", "") or "")
    disc = discovered_canonical or set()
    seeds_set = seed_canonical or {canonicalize_url(u) for u in seed_urls if canonicalize_url(u)}

    lim_raw = max_urls if max_urls is not None else os.environ.get("TBOX_CRAWL_INGEST_MAX", "5")
    goal_raw = os.environ.get("TBOX_CRAWL_INGEST_GOAL", "1")
    scan_raw = os.environ.get("TBOX_CRAWL_INGEST_SCAN_MAX", "")
    lim = max(1, int(lim_raw))
    goal = max(1, min(lim, int(goal_raw)))
    scan_max = int(scan_raw) if str(scan_raw).strip() else max(lim * 5, 20)
    scan_max = max(goal, min(scan_max, len(seed_urls)))
    max_b = int(max_bytes if max_bytes is not None else os.environ.get("TBOX_CRAWL_INGEST_MAX_BYTES", str(8 * 1024 * 1024)))
    timeout = float(timeout_sec if timeout_sec is not None else os.environ.get("TBOX_CRAWL_INGEST_TIMEOUT", os.environ.get("TBOX_CRAWL_FETCH_TIMEOUT", "60")))

    errs: list[str] = []
    kb_table_num_map: dict = {}
    robots_cache = None if skip_robots else RobotsOriginCache()
    throttle = OriginFetchThrottler(robots_cache)
    strategy = parse_strategy(extra_config)
    extract_on = parse_extract_enabled(extra_config)
    min_chars = parse_min_extract_chars(extra_config)
    skipped_kw = 0
    skipped_dup_content = 0
    skipped_low_quality = 0
    skipped_relevance = 0
    ingested = 0
    ingested_urls: list[str] = []

    def _source_tag(canon: str) -> str:
        if canon in disc:
            return "discover"
        if canon in seeds_set:
            return "seed"
        return "expand"

    def _health(url: str, outcome: str, *, source: str | None = None) -> None:
        if not task_id:
            return
        try:
            canon = canonicalize_url(url)
            crawl_health_svc.record_url_outcome(
                tenant_id=tenant_id,
                task_id=task_id,
                url=url,
                outcome=outcome,
                source=source or _source_tag(canon),
            )
        except Exception as exc:
            _LOG.debug("tbox_crawl_health record skipped url=%s err=%s", url, exc)

    for url in seed_urls[:scan_max]:
        if ingested >= goal:
            break
        try:
            body, ctype = fetch_url_body_capped(
                url,
                max_bytes=max_b,
                timeout=timeout,
                robots_preflight=robots_cache,
                origin_throttle=throttle,
                extra_config=extra_config,
            )
            if extract_on:
                text = extract_main_text(body, ctype)
                hit = None
                if hit_by_url:
                    canon = canonicalize_url(url)
                    hit = hit_by_url.get(url) or (hit_by_url.get(canon) if canon else None)
                if hit is not None:
                    text = _maybe_prepend_title(text, getattr(hit, "title", None), min_chars)
                if len(text) < min_chars:
                    skipped_low_quality += 1
                    _LOG.info("tbox_crawl_ingest: quality skip (short extract) url=%s", url)
                    _health(url, "low_quality")
                    continue
                ok_rel, rel_score, rel_reason = passes_relevance_gate(
                    text,
                    url,
                    tenant_id=tenant_id,
                    extra_config=extra_config,
                    task_name=task_name,
                    keywords=strategy.keywords,
                )
                if not ok_rel:
                    skipped_relevance += 1
                    _LOG.info(
                        "tbox_crawl_ingest: relevance skip url=%s score=%s reason=%s",
                        url,
                        rel_score,
                        rel_reason,
                    )
                    _health(url, "relevance")
                    continue
                body = text.encode("utf-8")
            else:
                if "html" in mime_from_content_type(ctype):
                    body = normalize_html_bytes_for_storage(body, ctype)
            h = content_sha256(body)
            if dedup and ds and content_seen(ds, h):
                skipped_dup_content += 1
                _LOG.info("tbox_crawl_ingest: content dedup skip url=%s", url)
                _health(url, "dup")
                continue
            if not content_matches_keywords(body, strategy.keywords):
                skipped_kw += 1
                _LOG.info("tbox_crawl_ingest: keyword filter skip url=%s", url)
                _health(url, "keyword")
                continue
            if extract_on:
                raw_name = suggested_txt_filename(url)
            else:
                raw_name = suggested_filename_from_url(url, ctype)
            filename = duplicate_name(DocumentService.query, name=raw_name, kb_id=kb.id)
            fobj = _BytesUploadFile(filename, body)
            err, pairs = FileService.upload_document(kb, [fobj], tenant_id, src="web")
            if err:
                errs.append(f"{url}: {'; '.join(err)}")
                _health(url, "http_error")
                continue
            for doc, _blob in pairs:
                DocumentService.run(tenant_id, doc, kb_table_num_map)
            canon = canonicalize_url(url)
            if canon and ds:
                src_tag = _source_tag(canon)
                record_seen(ds, canon, content_sha256=h, source=src_tag)
            ingested += 1
            ingested_urls.append(url)
            _health(url, "ok")
            _LOG.info("tbox_crawl_ingest: queued doc name=%s kb_id=%s url=%s", filename, kb.id, url)
        except Exception as exc:
            _LOG.warning("tbox_crawl_ingest failed url=%s err=%s", url, exc)
            errs.append(f"{url}: {exc}")
            if task_id:
                crawl_health_svc.record_url_outcome_from_error(
                    tenant_id=tenant_id,
                    task_id=task_id,
                    url=url,
                    error_message=str(exc),
                    source=_source_tag(canonicalize_url(url) or ""),
                )

    stats["ingested"] = ingested
    stats["ingested_urls"] = ingested_urls
    stats["skipped_dup_content"] = skipped_dup_content
    stats["skipped_kw"] = skipped_kw
    stats["skipped_low_quality"] = skipped_low_quality
    stats["skipped_relevance"] = skipped_relevance
    stats["ingest_failures"] = len(errs)

    if ingested > 0:
        if errs:
            _LOG.warning(
                "tbox_crawl_ingest: partial success ingested=%s failures=%s",
                ingested,
                "; ".join(errs[:5]),
            )
        return True, "", stats

    if errs or skipped_low_quality or skipped_kw or skipped_relevance:
        parts: list[str] = []
        if errs:
            parts.append("; ".join(errs[:20]))
        if skipped_low_quality:
            parts.append(f"{skipped_low_quality} page(s) skipped by quality filter")
        if skipped_kw and not errs and not skipped_low_quality and not skipped_relevance:
            parts.append(f"all {skipped_kw} page(s) skipped by keyword filter")
        elif skipped_kw:
            parts.append(f"{skipped_kw} page(s) skipped by keyword filter")
        if skipped_relevance:
            parts.append(f"{skipped_relevance} page(s) skipped by relevance gate")
        return False, "; ".join(parts)[:65000], stats
    return True, "", stats


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
    strategy = parse_strategy(extra_config)
    skipped_kw = 0

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
                    label = doc.semantic_identifier or ""
                    if not content_matches_keywords(label + "\n" + blob.decode("utf-8", errors="ignore"), strategy.keywords):
                        skipped_kw += 1
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
    if n_done == 0 and skipped_kw > 0:
        return False, f"all {skipped_kw} RSS entr(y/ies) skipped by keyword filter"
    return True, ""


def ingest_http_api_seeds_into_kb(
    kb: Any,
    tenant_id: str,
    api_urls: list[str],
    *,
    max_endpoints: int | None = None,
    max_items: int | None = None,
    max_bytes: int | None = None,
    timeout_sec: float | None = None,
    skip_robots: bool = False,
    extra_config: dict[str, Any] | None = None,
) -> tuple[bool, str]:
    """
    GET each seed as a JSON API (SSRF-safe), expand items per ``extra_config`` API keys,
    upload each item as ``.txt`` under *kb*, then queue parse tasks.

    Caps: ``TBOX_CRAWL_API_MAX_ENDPOINTS`` (default **3**), ``TBOX_CRAWL_API_MAX_ITEMS`` (default **30**) per tick.
    Auth headers: ``extra_config.tbox_crawl_auth_profile`` → env ``TBOX_CRAWL_AUTH_<PROFILE>_HEADERS``.
    """
    if kb is None or not getattr(kb, "id", None):
        return False, "invalid knowledge base"

    me_raw = max_endpoints if max_endpoints is not None else os.environ.get("TBOX_CRAWL_API_MAX_ENDPOINTS", "3")
    mi_raw = max_items if max_items is not None else os.environ.get("TBOX_CRAWL_API_MAX_ITEMS", "30")
    max_e = max(1, min(int(me_raw), len(api_urls)))
    cap = max(1, int(mi_raw))
    max_b = int(max_bytes if max_bytes is not None else os.environ.get("TBOX_CRAWL_INGEST_MAX_BYTES", str(8 * 1024 * 1024)))
    timeout = float(timeout_sec if timeout_sec is not None else os.environ.get("TBOX_CRAWL_INGEST_TIMEOUT", os.environ.get("TBOX_CRAWL_FETCH_TIMEOUT", "60")))

    api_cfg = parse_api_config(extra_config)
    strategy = parse_strategy(extra_config)
    errs: list[str] = []
    kb_table_num_map: dict = {}
    n_done = 0
    skipped_kw = 0
    name_budget = max(32, FILE_NAME_LEN_LIMIT - 8)
    robots_cache = None if skip_robots else RobotsOriginCache()
    throttle = OriginFetchThrottler(robots_cache)

    for api_url in api_urls[:max_e]:
        url = (api_url or "").strip()
        if not url:
            continue
        try:
            body, _ctype = fetch_url_body_capped(
                url,
                max_bytes=max_b,
                timeout=timeout,
                robots_preflight=robots_cache,
                origin_throttle=throttle,
                extra_config=extra_config,
            )
            items = extract_api_items(body, api_cfg)
            for item in items:
                if n_done >= cap:
                    break
                text, base = api_item_to_document(item, api_cfg)
                if not text.strip():
                    continue
                if not content_matches_keywords(text, strategy.keywords):
                    skipped_kw += 1
                    continue
                raw_name = f"{_safe_base_name(base, name_budget)}.txt"
                filename = duplicate_name(DocumentService.query, name=raw_name, kb_id=kb.id)
                fobj = _BytesUploadFile(filename, text.encode("utf-8"))
                err, pairs = FileService.upload_document(kb, [fobj], tenant_id, src="web")
                if err:
                    errs.append(f"{url} item {filename!r}: {'; '.join(err)}")
                    continue
                for drow, _blob in pairs:
                    DocumentService.run(tenant_id, drow, kb_table_num_map)
                n_done += 1
                _LOG.info("tbox_crawl_api_ingest: queued doc name=%s kb_id=%s api=%s", filename, kb.id, url)
        except Exception as exc:
            _LOG.warning("tbox_crawl_api_ingest failed url=%s err=%s", url, exc)
            errs.append(f"{url}: {exc}")

    if errs:
        return False, "; ".join(errs)[:65000]
    if n_done == 0 and skipped_kw > 0:
        return False, f"all {skipped_kw} API item(s) skipped by keyword filter"
    if n_done == 0:
        return False, "no API items ingested"
    return True, ""
