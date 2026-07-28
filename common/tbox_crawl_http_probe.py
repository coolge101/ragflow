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

"""Lightweight HTTP reachability checks for TBOX crawl seeds (no full page ingest)."""

from __future__ import annotations

import logging
import os
from typing import Any

from common.tbox_crawl_origin_throttle import OriginFetchThrottler
from common.tbox_crawl_robots import RobotsOriginCache
from common.tbox_crawl_ssrf_fetch import probe_url_streaming_cap

_LOG = logging.getLogger(__name__)

_READ_CHUNK = int(os.environ.get("TBOX_CRAWL_HTTP_READ_BYTES", "8192"))


def probe_seed_urls(
    seed_urls: list[str],
    *,
    max_urls: int | None = None,
    timeout_sec: float | None = None,
    skip_robots: bool = False,
    extra_config: dict[str, Any] | None = None,
) -> tuple[bool, str]:
    """
    Stream GET for up to ``max_urls`` seeds (bounded read; no KB ingest).

    Returns (ok, message). ``message`` is empty on full success; otherwise a short reason.

    Uses the same manual redirect + SSRF + optional *robots.txt* rules as page fetch
    (:func:`common.tbox_crawl_ssrf_fetch.probe_url_streaming_cap`): each redirect hop is
    ``assert_url_is_safe`` on each hop and, unless ``skip_robots`` is true, evaluated against
    ``/robots.txt`` via :class:`common.tbox_crawl_robots.RobotsOriginCache`.
    """
    if not seed_urls:
        return False, "no seed_urls"

    lim_raw = max_urls if max_urls is not None else int(os.environ.get("TBOX_CRAWL_FETCH_PROBE_MAX", "5"))
    lim = max(1, min(int(lim_raw), len(seed_urls)))
    timeout = float(timeout_sec if timeout_sec is not None else os.environ.get("TBOX_CRAWL_FETCH_TIMEOUT", "12"))

    robots_cache = None if skip_robots else RobotsOriginCache()
    throttle = OriginFetchThrottler(robots_cache)

    for url in seed_urls[:lim]:
        code, err = probe_url_streaming_cap(
            url,
            timeout=timeout,
            max_read_bytes=_READ_CHUNK,
            robots_preflight=robots_cache,
            origin_throttle=throttle,
            extra_config=extra_config,
        )
        if err:
            return False, f"{url}: {err}"
        _LOG.info("tbox_crawl_http_probe ok url=%s code=%s", url, code)

    if len(seed_urls) > lim:
        _LOG.info("tbox_crawl_http_probe: skipped %s additional seed(s) (probe cap)", len(seed_urls) - lim)
    return True, ""
