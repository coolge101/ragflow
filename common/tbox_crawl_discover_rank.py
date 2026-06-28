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

"""SERP rule pre-ranking for TBOX crawl discover (Phase 70)."""

from __future__ import annotations

import os
import re
from typing import Any
from urllib.parse import urlparse

from common.tbox_crawl_discover import DiscoverHit
from common.tbox_crawl_relevance import _NAV_TOKENS
from common.tbox_crawl_url_quality import _has_article_hint, _path_segments

EXTRA_DISCOVER_RANK_MODE = "tbox_crawl_discover_rank_mode"
EXTRA_DISCOVER_RANK_MIN_SCORE = "tbox_crawl_discover_rank_min_score"
EXTRA_DISCOVER_MAX_FETCH = "tbox_crawl_discover_max_fetch"

_VALID_MODES = frozenset({"off", "rules", "rules_then_llm"})
_DEFAULT_MIN_SCORE = 55

_LIST_PAGE_TOKENS = (
    "更多",
    "下一页",
    "栏目",
    "列表",
    "list page",
    "next page",
)

_HOMEPAGE_PATHS = frozenset(
    {
        "",
        "/",
        "/index.html",
        "/index.htm",
        "/index.php",
        "/default.html",
        "/home",
    }
)


def _as_int(val: Any, default: int, *, lo: int, hi: int) -> int:
    try:
        n = int(val)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def parse_discover_rank_mode(extra: dict[str, Any] | None) -> str:
    raw = str((extra or {}).get(EXTRA_DISCOVER_RANK_MODE) or "off").strip().lower()
    return raw if raw in _VALID_MODES else "off"


def parse_discover_rank_min_score(extra: dict[str, Any] | None, default: int = _DEFAULT_MIN_SCORE) -> int:
    return _as_int((extra or {}).get(EXTRA_DISCOVER_RANK_MIN_SCORE), default, lo=0, hi=100)


def parse_discover_max_fetch(extra: dict[str, Any] | None) -> int:
    extra = extra or {}
    raw = extra.get(EXTRA_DISCOVER_MAX_FETCH)
    if raw is None or str(raw).strip() == "":
        raw = os.environ.get("TBOX_CRAWL_INGEST_MAX", "5")
    return max(1, _as_int(raw, 5, lo=1, hi=100))


def _is_homepage_path(url: str) -> bool:
    try:
        path = (urlparse((url or "").strip()).path or "").strip()
    except Exception:
        return False
    return path.lower() in _HOMEPAGE_PATHS


def _topic_query_terms(topic: str, query: str) -> tuple[str, ...]:
    terms: list[str] = []
    for src in (topic, query):
        for tok in re.split(r"[\s,，;；/|]+", src or ""):
            t = tok.strip()
            if len(t) >= 2:
                terms.append(t)
    return tuple(dict.fromkeys(terms))


def _contains_nav_token(text: str) -> bool:
    hay = (text or "").lower()
    return any(tok in hay for tok in _NAV_TOKENS)


def _contains_list_page_token(text: str) -> bool:
    hay = (text or "").lower()
    return any(tok in hay for tok in _LIST_PAGE_TOKENS)


def _topic_query_bonus(title: str, snippet: str, *, topic: str, query: str) -> int:
    hay = f"{title or ''} {snippet or ''}".lower()
    if not hay.strip():
        return 0
    hits = sum(1 for term in _topic_query_terms(topic, query) if term.lower() in hay)
    if hits >= 2:
        return 25
    if hits == 1:
        return 10
    return 0


def _score_url_only(hit: DiscoverHit, *, topic: str) -> int:
    score = 50
    url = (hit.url or "").strip()
    segments = _path_segments(url)

    if _is_homepage_path(url):
        score -= 40
    elif _has_article_hint(segments):
        score += 15

    url_lower = url.lower()
    path_hits = sum(1 for term in _topic_query_terms(topic, hit.query) if term.lower() in url_lower)
    if path_hits >= 2:
        score += 25
    elif path_hits == 1:
        score += 10

    return max(0, min(70, score))


def score_discover_hit(hit: DiscoverHit, *, topic: str, mode: str) -> int:
    if mode == "off":
        return 100

    title = (hit.title or "").strip()
    snippet = (hit.snippet or "").strip()
    if not title and not snippet:
        return _score_url_only(hit, topic=topic)

    score = 50
    url = (hit.url or "").strip()
    segments = _path_segments(url)

    if _is_homepage_path(url):
        score -= 40

    combined = f"{title} {snippet}"
    if _contains_nav_token(combined):
        score -= 30

    if _has_article_hint(segments):
        score += 15

    score += _topic_query_bonus(title, snippet, topic=topic, query=hit.query)

    if len(title) < 8 and not _has_article_hint(segments):
        score -= 20

    if _contains_list_page_token(snippet):
        score -= 25

    return max(0, min(100, score))


def rank_discover_hits(
    hits: list[DiscoverHit],
    *,
    topic: str,
    mode: str,
    min_score: int,
    max_keep: int,
) -> tuple[list[DiscoverHit], int]:
    if mode == "off":
        return hits[:max_keep], 0

    # rules_then_llm: Phase 70.0 uses rules only; LLM rerank reserved for 70.1.
    score_mode = "rules"
    scored: list[tuple[int, int, DiscoverHit]] = []
    for index, hit in enumerate(hits):
        scored.append((score_discover_hit(hit, topic=topic, mode=score_mode), index, hit))

    passing = [(score, index, hit) for score, index, hit in scored if score >= min_score]
    skipped = len(hits) - len(passing)
    passing.sort(key=lambda item: (-item[0], item[1]))
    kept = [hit for _score, _index, hit in passing[:max_keep]]
    return kept, skipped
