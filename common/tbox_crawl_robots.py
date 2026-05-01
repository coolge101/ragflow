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

"""robots.txt preflight (SSRF-safe fetch + urllib.robotparser)."""

from __future__ import annotations

import logging
import os
import time
from urllib.parse import urlparse, urlunparse
from urllib.robotparser import RobotFileParser

from common.tbox_crawl_ssrf_fetch import fetch_url_body_capped

_LOG = logging.getLogger(__name__)

_DEFAULT_UA = os.environ.get(
    "TBOX_CRAWL_HTTP_USER_AGENT",
    "TBOX-RAGFlow-Crawl/1.0 (+https://github.com/infiniflow/ragflow)",
)
_ROBOTS_MAX_BYTES = int(os.environ.get("TBOX_CRAWL_ROBOTS_MAX_BYTES", str(256 * 1024)))
_ROBOTS_TIMEOUT = float(os.environ.get("TBOX_CRAWL_ROBOTS_TIMEOUT", "10"))

_ALLOW_ALL = object()


def _robots_txt_url(target_url: str) -> str:
    p = urlparse(target_url.strip())
    if p.scheme not in ("http", "https") or not p.netloc:
        raise ValueError("invalid URL for robots origin")
    return urlunparse((p.scheme, p.netloc, "/robots.txt", "", "", ""))


def _origin_cache_key(target_url: str) -> tuple[str, str]:
    p = urlparse(target_url.strip())
    return (p.scheme.lower(), p.netloc.lower())


class RobotsOriginCache:
    """Per-tick cache: one fetch + parse of /robots.txt per origin (scheme+netloc)."""

    __slots__ = ("_entries", "_ua", "_timeout", "_max_bytes", "_robots_fetch_mono")

    def __init__(self, *, user_agent: str | None = None, timeout_sec: float | None = None, max_bytes: int | None = None):
        self._entries: dict[tuple[str, str], RobotFileParser | object] = {}
        self._ua = (user_agent or _DEFAULT_UA).strip() or "*"
        self._timeout = float(timeout_sec if timeout_sec is not None else _ROBOTS_TIMEOUT)
        self._max_bytes = int(max_bytes if max_bytes is not None else _ROBOTS_MAX_BYTES)
        self._robots_fetch_mono: dict[tuple[str, str], float] = {}

    def allowed(self, target_url: str) -> tuple[bool, str]:
        """
        Return (True, "") if fetch is allowed, else (False, short reason).

        Missing ``robots.txt`` (HTTP 404) → allow. Fetch/parse errors → allow with warning (rules unknown).
        """
        key = _origin_cache_key(target_url)
        if key in self._entries:
            return self._eval(target_url, self._entries[key])

        robots_url = _robots_txt_url(target_url)
        try:
            body, _ct = fetch_url_body_capped(
                robots_url,
                max_bytes=self._max_bytes,
                timeout=self._timeout,
                missing_ok_statuses=frozenset({404}),
            )
        except Exception as e:
            self._robots_fetch_mono[key] = time.monotonic()
            _LOG.warning("tbox_crawl_robots: cannot fetch %s (%s) — allow without rules", robots_url, e)
            self._entries[key] = _ALLOW_ALL
            return True, ""

        self._robots_fetch_mono[key] = time.monotonic()
        if not body:
            self._entries[key] = _ALLOW_ALL
            return True, ""

        rp = RobotFileParser()
        rp.set_url(robots_url)
        try:
            text = body.decode("utf-8", errors="replace")
            rp.parse(text.splitlines())
        except Exception as e:
            _LOG.warning("tbox_crawl_robots: parse failed %s (%s) — allow without rules", robots_url, e)
            self._entries[key] = _ALLOW_ALL
            return True, ""

        self._entries[key] = rp
        return self._eval(target_url, rp)

    def last_robots_network_mono(self, origin_key: tuple[str, str]) -> float:
        """``time.monotonic()`` after the last completed ``/robots.txt`` HTTP fetch for *origin_key* (0 if unknown)."""
        return float(self._robots_fetch_mono.get(origin_key, 0.0))

    def crawl_delay_seconds(self, target_url: str) -> float:
        """
        Parsed ``Crawl-delay`` for our user-agent from cached rules, or ``0.0``.

        Unknown rules / allow-all / missing entry → ``0.0``.
        """
        key = _origin_cache_key(target_url)
        ent = self._entries.get(key)
        if ent is None or ent is _ALLOW_ALL:
            return 0.0
        try:
            raw = ent.crawl_delay(self._ua)
        except AttributeError:
            return 0.0
        except Exception as e:
            _LOG.debug("tbox_crawl_robots: crawl_delay lookup failed (%s)", e)
            return 0.0
        if raw is None:
            return 0.0
        try:
            v = float(raw)
        except (TypeError, ValueError):
            return 0.0
        if v < 0.0:
            return 0.0
        return v

    def _eval(self, target_url: str, entry: RobotFileParser | object) -> tuple[bool, str]:
        if entry is _ALLOW_ALL:
            return True, ""
        try:
            if not entry.can_fetch(self._ua, target_url):
                return False, "blocked by robots.txt"
        except Exception as e:
            _LOG.warning("tbox_crawl_robots: can_fetch error for %s (%s) — allow", target_url, e)
            return True, ""
        return True, ""
