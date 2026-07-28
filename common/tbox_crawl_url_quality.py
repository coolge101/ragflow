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

"""Heuristic URL quality filter for crawl discover / BFS expansion (Phase 68)."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

EXTRA_URL_QUALITY_MODE = "tbox_crawl_url_quality_mode"
EXTRA_DISCOVER_SKIP_BFS = "tbox_crawl_discover_skip_bfs"

_VALID_MODES = frozenset({"strict", "normal", "off"})

_SKIP_PATH_SEGMENTS = frozenset(
    {
        "login",
        "signin",
        "sign-in",
        "register",
        "signup",
        "download",
        "downloads",
        "tag",
        "tags",
        "search",
        "cart",
        "checkout",
        "oauth",
    }
)

_ARTICLE_HINT_SEGMENTS = frozenset(
    {
        "article",
        "articles",
        "news",
        "post",
        "posts",
        "blog",
        "content",
        "detail",
        "wiki",
        "paper",
        "whitepaper",
        "report",
        "zhuanlan",
    }
)

_YEAR_IN_PATH = re.compile(r"^20\d{2}$")


def parse_url_quality_mode(extra_config: dict[str, Any] | None) -> str:
    raw = str((extra_config or {}).get(EXTRA_URL_QUALITY_MODE) or "normal").strip().lower()
    return raw if raw in _VALID_MODES else "normal"


def discover_skip_bfs(extra_config: dict[str, Any] | None) -> bool:
    val = (extra_config or {}).get(EXTRA_DISCOVER_SKIP_BFS)
    if val is None:
        return True
    return bool(val)


def _path_segments(url: str) -> list[str]:
    try:
        path = (urlparse(url.strip()).path or "").strip("/")
    except Exception:
        return []
    if not path:
        return []
    return [s.lower() for s in path.split("/") if s]


def _has_article_hint(segments: list[str]) -> bool:
    for seg in segments:
        if seg in _ARTICLE_HINT_SEGMENTS:
            return True
        if _YEAR_IN_PATH.match(seg):
            return True
    return False


def url_passes_quality(url: str, mode: str = "normal") -> bool:
    if mode == "off":
        return True
    u = (url or "").strip()
    if not u:
        return False
    try:
        parsed = urlparse(u)
    except Exception:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    path = (parsed.path or "").strip()
    if path in ("", "/"):
        return False
    lower_path = path.lower()
    if lower_path in ("/index.html", "/index.htm", "/index.php", "/default.html"):
        return False
    segments = _path_segments(u)
    if not segments:
        return False
    for seg in segments:
        if seg in _SKIP_PATH_SEGMENTS:
            return False
    depth = len(segments)
    article_hint = _has_article_hint(segments)
    if mode == "strict":
        return depth >= 3 or article_hint
    # normal
    return depth >= 2 or article_hint


def filter_urls_by_quality(
    urls: list[str],
    *,
    mode: str = "normal",
) -> tuple[list[str], int]:
    if mode == "off":
        return list(urls), 0
    kept: list[str] = []
    skipped = 0
    for url in urls:
        u = (url or "").strip()
        if not u:
            continue
        if url_passes_quality(u, mode):
            kept.append(u)
        else:
            skipped += 1
    return kept, skipped
