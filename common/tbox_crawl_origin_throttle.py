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

"""Per-origin spacing between outbound crawl GETs (robots Crawl-delay + env floor/cap)."""

from __future__ import annotations

import os
import time
from typing import Any
from urllib.parse import urlparse


def _origin_key(url: str) -> tuple[str, str]:
    p = urlparse((url or "").strip())
    return (p.scheme.lower(), p.netloc.lower())


def _truthy_env(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes", "on")


class OriginFetchThrottler:
    """
    Enforces a minimum gap between **successful scheduling** of GETs to the same origin
    (scheme + host, case-folded).

    Uses :meth:`crawl_delay_seconds` on ``robots_cache`` when present (unless
    ``TBOX_CRAWL_SKIP_CRAWL_DELAY``), capped by ``TBOX_CRAWL_MAX_CRAWL_DELAY_SEC``, and floored by
    ``TBOX_CRAWL_MIN_ORIGIN_INTERVAL``. Also accounts for a prior ``/robots.txt`` fetch via
    ``last_robots_network_mono`` on the cache when available.
    """

    __slots__ = ("_robots", "_min_interval", "_max_crawl_delay", "_skip_crawl_delay", "_last_finish")

    def __init__(
        self,
        robots_cache: Any | None,
        *,
        min_interval_sec: float | None = None,
        max_crawl_delay_sec: float | None = None,
        skip_crawl_delay: bool | None = None,
    ):
        self._robots = robots_cache
        self._min_interval = float(min_interval_sec if min_interval_sec is not None else os.environ.get("TBOX_CRAWL_MIN_ORIGIN_INTERVAL", "0"))
        self._max_crawl_delay = float(max_crawl_delay_sec if max_crawl_delay_sec is not None else os.environ.get("TBOX_CRAWL_MAX_CRAWL_DELAY_SEC", "60"))
        self._skip_crawl_delay = bool(skip_crawl_delay) if skip_crawl_delay is not None else _truthy_env("TBOX_CRAWL_SKIP_CRAWL_DELAY")
        self._last_finish: dict[tuple[str, str], float] = {}

    def _effective_delay_sec(self, url: str) -> float:
        d = max(0.0, self._min_interval)
        if not self._skip_crawl_delay and self._robots is not None:
            fn = getattr(self._robots, "crawl_delay_seconds", None)
            if callable(fn):
                try:
                    cd = float(fn(url) or 0.0)
                except (TypeError, ValueError):
                    cd = 0.0
                if cd > 0.0:
                    cap = self._max_crawl_delay
                    capped = min(cd, cap) if cap > 0.0 else cd
                    d = max(d, capped)
        return d

    def wait_before_hop(self, url: str) -> None:
        """Sleep if needed before issuing a GET to *url*'s origin."""
        if not (url or "").strip():
            return
        try:
            key = _origin_key(url)
        except Exception:
            return
        if not key[0] or not key[1]:
            return
        if key[0] not in ("http", "https"):
            return

        req = self._effective_delay_sec(url)
        if req <= 0.0:
            return

        now = time.monotonic()
        t_finish = self._last_finish.get(key)
        t_robots = 0.0
        if self._robots is not None:
            lr = getattr(self._robots, "last_robots_network_mono", None)
            if callable(lr):
                try:
                    t_robots = float(lr(key))
                except Exception:
                    t_robots = 0.0

        ref = 0.0
        if t_finish is not None:
            ref = max(ref, t_finish)
        if t_robots > 0.0:
            ref = max(ref, t_robots)

        if ref <= 0.0 and t_finish is None:
            return

        wait = max(0.0, req - (now - ref))
        if wait > 0.0:
            time.sleep(wait)

    def record_hop_finished(self, url: str) -> None:
        """Mark the origin of *url* as having completed a GET (body drained or connection closed)."""
        if not (url or "").strip():
            return
        try:
            key = _origin_key(url)
        except Exception:
            return
        if not key[0] or not key[1]:
            return
        self._last_finish[key] = time.monotonic()
