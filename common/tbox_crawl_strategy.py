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

"""Parse ``extra_config`` crawl strategy keys and apply domain / keyword / depth rules."""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urljoin, urlparse

from common.tbox_crawl_origin_throttle import OriginFetchThrottler
from common.tbox_crawl_robots import RobotsOriginCache
from common.tbox_crawl_ssrf_fetch import fetch_url_body_capped

_LOG = logging.getLogger(__name__)

EXTRA_CRAWL_KEYWORDS = "tbox_crawl_keywords"
EXTRA_CRAWL_MAX_DEPTH = "tbox_crawl_max_depth"
EXTRA_CRAWL_ALLOWED_DOMAINS = "tbox_crawl_allowed_domains"

_STRIP_WWW = re.compile(r"^www\.", re.I)


@dataclass(frozen=True)
class CrawlStrategy:
    keywords: tuple[str, ...]
    max_depth: int | None
    allowed_domains: tuple[str, ...]


def _parse_string_list(val: Any) -> list[str]:
    if val is None:
        return []
    if isinstance(val, str):
        parts = re.split(r"[\n,，;；]+", val)
        return [p.strip() for p in parts if p.strip()]
    if isinstance(val, (list, tuple)):
        out: list[str] = []
        for item in val:
            s = str(item).strip()
            if s:
                out.append(s)
        return out
    return []


def _normalize_host(host: str) -> str:
    h = (host or "").strip().lower().strip(".")
    return _STRIP_WWW.sub("", h)


def _normalize_domain_rule(rule: str) -> str:
    d = (rule or "").strip().lower().strip(".")
    return _STRIP_WWW.sub("", d)


def parse_strategy(extra_config: dict[str, Any] | None) -> CrawlStrategy:
    extra = extra_config or {}
    keywords = tuple(_parse_string_list(extra.get(EXTRA_CRAWL_KEYWORDS)))
    allowed = tuple(_normalize_domain_rule(d) for d in _parse_string_list(extra.get(EXTRA_CRAWL_ALLOWED_DOMAINS)) if d.strip())

    raw_depth = extra.get(EXTRA_CRAWL_MAX_DEPTH)
    max_depth: int | None
    if raw_depth is None or raw_depth == "":
        max_depth = None
    else:
        try:
            max_depth = max(0, int(raw_depth))
        except (TypeError, ValueError):
            max_depth = None

    return CrawlStrategy(keywords=keywords, max_depth=max_depth, allowed_domains=allowed)


def url_allowed_by_domains(url: str, allowed_domains: tuple[str, ...]) -> bool:
    if not allowed_domains:
        return True
    try:
        host = _normalize_host(urlparse(url.strip()).hostname or "")
    except Exception:
        return False
    if not host:
        return False
    for rule in allowed_domains:
        if not rule:
            continue
        if host == rule or host.endswith("." + rule):
            return True
    return False


def filter_urls_by_allowed_domains(urls: list[str], allowed_domains: tuple[str, ...]) -> tuple[list[str], list[str]]:
    if not allowed_domains:
        return list(urls), []
    kept: list[str] = []
    skipped: list[str] = []
    for url in urls:
        u = (url or "").strip()
        if not u:
            continue
        if url_allowed_by_domains(u, allowed_domains):
            kept.append(u)
        else:
            skipped.append(u)
    return kept, skipped


def content_matches_keywords(body: bytes | str, keywords: tuple[str, ...]) -> bool:
    if not keywords:
        return True
    if isinstance(body, bytes):
        try:
            text = body.decode("utf-8", errors="ignore")
        except Exception:
            text = body.decode("latin-1", errors="ignore")
    else:
        text = body
    hay = text.lower()
    return any(kw.lower() in hay for kw in keywords if kw)


class _LinkExtractor(HTMLParser):
    __slots__ = ("base_url", "links")

    def __init__(self, base_url: str):
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        href = None
        for k, v in attrs:
            if k.lower() == "href" and v:
                href = v.strip()
                break
        if not href or href.startswith(("#", "mailto:", "javascript:", "tel:")):
            return
        abs_url = urljoin(self.base_url, href)
        parsed = urlparse(abs_url)
        if parsed.scheme not in ("http", "https"):
            return
        self.links.append(abs_url.split("#", 1)[0])


def extract_html_links(body: bytes, base_url: str) -> list[str]:
    parser = _LinkExtractor(base_url)
    try:
        parser.feed(body.decode("utf-8", errors="ignore"))
    except Exception as exc:
        _LOG.debug("extract_html_links failed base=%s err=%s", base_url, exc)
        return []
    return parser.links


def _is_html_content_type(content_type: str | None) -> bool:
    ct = (content_type or "").lower()
    return "html" in ct or not ct


def expand_static_web_urls(
    seed_urls: list[str],
    *,
    strategy: CrawlStrategy,
    skip_robots: bool,
    extra_config: dict[str, Any] | None,
    max_urls: int | None = None,
    max_bytes: int | None = None,
    timeout_sec: float | None = None,
) -> tuple[list[str], str]:
    """
    Apply allowed-domain filter; optionally BFS-expand by ``strategy.max_depth``.

    Returns ``(urls, note)`` where *note* is non-empty when seeds were dropped or capped.
    """
    filtered, skipped = filter_urls_by_allowed_domains(seed_urls, strategy.allowed_domains)
    notes: list[str] = []
    if skipped:
        notes.append(f"allowed_domains skipped {len(skipped)} seed(s)")

    if not filtered:
        return [], "; ".join(notes) or "no URLs pass allowed_domains"

    max_depth = strategy.max_depth
    if max_depth is None or max_depth <= 0:
        return filtered, "; ".join(notes)

    lim_raw = max_urls if max_urls is not None else os.environ.get("TBOX_CRAWL_EXPAND_MAX", "20")
    lim = max(1, int(lim_raw))
    max_b = int(max_bytes if max_bytes is not None else os.environ.get("TBOX_CRAWL_EXPAND_MAX_BYTES", str(512 * 1024)))
    timeout = float(timeout_sec if timeout_sec is not None else os.environ.get("TBOX_CRAWL_FETCH_TIMEOUT", "60"))

    robots_cache = None if skip_robots else RobotsOriginCache()
    throttle = OriginFetchThrottler(robots_cache)

    ordered: list[str] = []
    seen: set[str] = set()
    queue: list[tuple[str, int]] = [(u, 0) for u in filtered]

    while queue and len(ordered) < lim:
        url, depth = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        ordered.append(url)

        if depth >= max_depth:
            continue

        try:
            body, ctype = fetch_url_body_capped(
                url,
                max_bytes=max_b,
                timeout=timeout,
                robots_preflight=robots_cache,
                origin_throttle=throttle,
                extra_config=extra_config,
            )
        except Exception as exc:
            _LOG.info("tbox_crawl_expand: skip links from %s (%s)", url, exc)
            continue

        if not _is_html_content_type(ctype):
            continue

        for link in extract_html_links(body, url):
            if link in seen:
                continue
            if not url_allowed_by_domains(link, strategy.allowed_domains):
                continue
            queue.append((link, depth + 1))

    if len(seen) > lim:
        notes.append(f"expand capped at {lim} URL(s)")
    return ordered[:lim], "; ".join(notes)


def resolve_target_urls(
    seed_urls: list[str],
    *,
    source_type: str,
    strategy: CrawlStrategy,
    skip_robots: bool,
    extra_config: dict[str, Any] | None,
) -> tuple[list[str], str]:
    """Resolve URLs to probe/ingest for one tick."""
    st = (source_type or "static_web").strip()
    if st in ("rss", "http_api"):
        kept, skipped = filter_urls_by_allowed_domains(seed_urls, strategy.allowed_domains)
        if not kept:
            label = "feed URLs" if st == "rss" else "API endpoint(s)"
            return [], f"no {label} pass allowed_domains"
        note = f"allowed_domains skipped {len(skipped)} seed(s)" if skipped else ""
        return kept, note

    return expand_static_web_urls(
        seed_urls,
        strategy=strategy,
        skip_robots=skip_robots,
        extra_config=extra_config,
    )
