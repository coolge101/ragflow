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

"""Query templates for TBOX crawl discover (Phase 70)."""

from __future__ import annotations

import re
from typing import Any

EXTRA_QUERY_TEMPLATE = "tbox_crawl_query_template"
EXTRA_QUERY_TEMPLATE_MODE = "tbox_crawl_query_template_mode"
EXTRA_SEARCH_QUERIES = "tbox_crawl_search_queries"
EXTRA_CRAWL_KEYWORDS = "tbox_crawl_keywords"
EXTRA_CRAWL_ALLOWED_DOMAINS = "tbox_crawl_allowed_domains"
EXTRA_RELEVANCE_TOPIC = "tbox_crawl_relevance_topic"

_VALID_MODES = frozenset({"merge", "replace"})
_DEFAULT_TOPIC = "车联网 TBOX"
_GENERIC_KEYWORDS = frozenset({"技术", "technology", "tech", "白皮书", "whitepaper"})


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


def _dedupe_preserve_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        key = item.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(key)
    return out


def _normalize_user_queries(extra: dict[str, Any]) -> list[str]:
    return _parse_string_list(extra.get(EXTRA_SEARCH_QUERIES))


def _infer_topic(extra: dict[str, Any]) -> str:
    explicit = str(extra.get(EXTRA_RELEVANCE_TOPIC) or "").strip()
    if explicit:
        return explicit[:256]

    keywords = _parse_string_list(extra.get(EXTRA_CRAWL_KEYWORDS))
    picked: list[str] = []
    for kw in keywords:
        lowered = kw.lower()
        if kw in _GENERIC_KEYWORDS or lowered in _GENERIC_KEYWORDS:
            continue
        picked.append(kw)
        if len(picked) >= 2:
            break
    if picked:
        return " ".join(picked)[:256]
    if keywords:
        return " ".join(keywords[:2])[:256]
    return _DEFAULT_TOPIC


def _allowed_domains(extra: dict[str, Any]) -> list[str]:
    return _parse_string_list(extra.get(EXTRA_CRAWL_ALLOWED_DOMAINS))


def _gov_site_clause(extra: dict[str, Any]) -> bool:
    return any("gov.cn" in d.lower() for d in _allowed_domains(extra))


def build_tech_trend_queries(extra: dict[str, Any]) -> list[str]:
    """Generate 4–6 bilingual tech-trend search queries from task context."""
    topic = _infer_topic(extra)
    queries = [
        f"{topic} 技术趋势 白皮书",
        f"{topic} technology trend whitepaper",
        f"{topic} 智能网联 架构",
        "车联网 TBOX 架构 2024 2025",
        f"{topic} automotive technology roadmap",
    ]
    if _gov_site_clause(extra):
        queries.append(f"{topic} 行业报告 site:gov.cn OR site:miit.gov.cn")
    return queries[:6]


def apply_query_template(extra: dict[str, Any] | None) -> list[str]:
    """Resolve discover search queries from optional template + user overrides."""
    cfg = dict(extra or {})
    user_queries = _normalize_user_queries(cfg)
    name = str(cfg.get(EXTRA_QUERY_TEMPLATE) or "").strip().lower()
    if name != "tech_trend":
        return user_queries

    generated = build_tech_trend_queries(cfg)
    mode = str(cfg.get(EXTRA_QUERY_TEMPLATE_MODE) or "merge").strip().lower()
    if mode not in _VALID_MODES:
        mode = "merge"

    if mode == "replace" and not user_queries:
        return _dedupe_preserve_order(generated)
    return _dedupe_preserve_order(user_queries + generated)
