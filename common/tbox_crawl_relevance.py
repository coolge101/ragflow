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

"""Pre-ingest relevance scoring gate for TBOX crawl (Phase 69.3)."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

from common.tbox_crawl_discover import parse_discover_config
from common.tbox_crawl_strategy import content_matches_keywords
from common.tbox_crawl_url_quality import _has_article_hint, _path_segments

_LOG = logging.getLogger(__name__)

EXTRA_RELEVANCE_MODE = "tbox_crawl_relevance_mode"
EXTRA_RELEVANCE_MIN_SCORE = "tbox_crawl_relevance_min_score"
EXTRA_RELEVANCE_TOPIC = "tbox_crawl_relevance_topic"
EXTRA_RELEVANCE_LLM_ID = "tbox_crawl_relevance_llm_id"
EXTRA_RELEVANCE_MAX_CHARS = "tbox_crawl_relevance_max_chars"

_VALID_MODES = frozenset({"off", "rules", "llm", "rules_then_llm"})
_DEFAULT_MIN_SCORE = 60
_DEFAULT_MAX_LLM_CHARS = 4000
_BORDER_DELTA = 15

_NAV_TOKENS = (
    "首页",
    "主页",
    "登录",
    "注册",
    "sign in",
    "sign up",
    "log in",
    "home",
    "navigation",
    "nav menu",
    "网站地图",
    "sitemap",
)


@dataclass(frozen=True)
class RelevanceConfig:
    mode: str
    min_score: int
    topic: str
    llm_id: str | None
    max_llm_chars: int


def _as_int(val: Any, default: int, *, lo: int, hi: int) -> int:
    try:
        n = int(val)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def infer_relevance_topic(
    extra_config: dict[str, Any] | None,
    *,
    task_name: str = "",
) -> str:
    extra = extra_config or {}
    explicit = str(extra.get(EXTRA_RELEVANCE_TOPIC) or "").strip()
    if explicit:
        return explicit[:512]
    dcfg = parse_discover_config(extra)
    if dcfg.queries:
        return dcfg.queries[0][:512]
    name = (task_name or "").strip()
    if name:
        return name[:512]
    keywords = extra.get("tbox_crawl_keywords")
    if isinstance(keywords, list):
        parts = [str(k).strip() for k in keywords if str(k).strip()]
        if parts:
            return ", ".join(parts)[:512]
    if isinstance(keywords, str) and keywords.strip():
        return keywords.strip()[:512]
    return "general crawl topic"


def parse_relevance_config(extra_config: dict[str, Any] | None, *, task_name: str = "") -> RelevanceConfig:
    extra = extra_config or {}
    mode_raw = str(extra.get(EXTRA_RELEVANCE_MODE) or "off").strip().lower()
    mode = mode_raw if mode_raw in _VALID_MODES else "off"
    llm_raw = str(extra.get(EXTRA_RELEVANCE_LLM_ID) or "").strip()
    return RelevanceConfig(
        mode=mode,
        min_score=_as_int(extra.get(EXTRA_RELEVANCE_MIN_SCORE), _DEFAULT_MIN_SCORE, lo=0, hi=100),
        topic=infer_relevance_topic(extra, task_name=task_name),
        llm_id=llm_raw or None,
        max_llm_chars=_as_int(extra.get(EXTRA_RELEVANCE_MAX_CHARS), _DEFAULT_MAX_LLM_CHARS, lo=500, hi=20000),
    )


def _is_homepage_url(url: str) -> bool:
    try:
        path = (urlparse((url or "").strip()).path or "").strip()
    except Exception:
        return False
    lower = path.lower()
    return lower in ("", "/", "/index.html", "/index.htm", "/index.php", "/default.html", "/home")


def _looks_like_portal_page(text: str) -> bool:
    sample = (text or "")[:2500].lower()
    if not sample:
        return True
    nav_hits = sum(1 for tok in _NAV_TOKENS if tok in sample)
    if nav_hits >= 4:
        return True
    link_count = len(re.findall(r"https?://", sample))
    if link_count >= 8 and len(sample) < 3500:
        return True
    lines = [ln.strip() for ln in sample.splitlines() if ln.strip()]
    if len(lines) <= 3 and nav_hits >= 2:
        return True
    return False


def _query_terms(extra_config: dict[str, Any] | None) -> tuple[str, ...]:
    extra = extra_config or {}
    dcfg = parse_discover_config(extra)
    terms: list[str] = []
    for q in dcfg.queries:
        for tok in re.split(r"[\s,，;；/|]+", q):
            t = tok.strip()
            if len(t) >= 2:
                terms.append(t)
    return tuple(dict.fromkeys(terms))


def score_relevance_rules(
    text: str,
    url: str,
    *,
    keywords: tuple[str, ...],
    query_terms: tuple[str, ...],
) -> tuple[int, str]:
    score = 50
    reasons: list[str] = []

    if _is_homepage_url(url):
        score -= 35
        reasons.append("homepage_url")

    segments = _path_segments(url)
    if _has_article_hint(segments):
        score += 15
        reasons.append("article_url")

    if keywords:
        if content_matches_keywords(text, keywords):
            score += 25
            reasons.append("keyword_hit")
        else:
            score -= 30
            reasons.append("keyword_miss")

    hay = (text or "").lower()
    for term in query_terms[:8]:
        if term.lower() in hay:
            score += 12
            reasons.append("query_hit")
            break

    if _looks_like_portal_page(text):
        score -= 25
        reasons.append("portal_like")

    if len(hay) >= 800:
        score += 5

    return max(0, min(100, score)), ",".join(reasons) or "rules"


def _parse_llm_score(raw: str) -> tuple[int | None, str]:
    text = (raw or "").strip()
    if not text:
        return None, "empty_llm_response"
    fence = re.search(r"\{[^{}]*\}", text, re.DOTALL)
    blob = fence.group(0) if fence else text
    try:
        data = json.loads(blob)
    except json.JSONDecodeError:
        m = re.search(r"\b(\d{1,3})\b", text)
        if m:
            return max(0, min(100, int(m.group(1)))), "numeric_fallback"
        return None, "json_parse_failed"
    if not isinstance(data, dict):
        return None, "not_object"
    score_raw = data.get("score")
    try:
        score = int(score_raw)
    except (TypeError, ValueError):
        return None, "invalid_score"
    reason = str(data.get("reason") or "llm")[:200]
    return max(0, min(100, score)), reason


def score_relevance_llm(
    tenant_id: str,
    text: str,
    *,
    topic: str,
    extra_config: dict[str, Any] | None,
) -> tuple[int | None, str]:
    cfg = parse_relevance_config(extra_config)
    snippet = (text or "")[: cfg.max_llm_chars]
    if not snippet.strip():
        return 0, "empty_text"

    try:
        from api.db.joint_services.tenant_model_service import (
            get_model_config_from_provider_instance,
            get_tenant_default_model_by_type,
        )
        from api.db.services.llm_service import LLMBundle
        from common.constants import LLMType
    except Exception as exc:
        _LOG.debug("relevance llm import failed: %s", exc)
        return None, "llm_import_failed"

    model_config = None
    if cfg.llm_id:
        try:
            model_config = get_model_config_from_provider_instance(tenant_id, LLMType.CHAT, cfg.llm_id)
        except Exception:
            model_config = None
    if not model_config:
        model_config = get_tenant_default_model_by_type(tenant_id, LLMType.CHAT)
    if not model_config:
        return None, "no_chat_model"

    prompt = f'Topic: {topic}\n\nPage text (truncated):\n{snippet}\n\nReturn JSON only: {{"score": 0-100, "reason": "short"}}'
    try:
        llm = LLMBundle(tenant_id, model_config)
        response = llm._run_coroutine_sync(
            llm.async_chat(
                system=("You score how relevant a crawled web page is to the given topic. 0 = portal/login/unrelated; 80+ = on-topic article. Output JSON only."),
                history=[{"role": "user", "content": prompt}],
                gen_conf={"temperature": 0.1, "max_tokens": 256},
            )
        )
        return _parse_llm_score(str(response or ""))
    except Exception as exc:
        _LOG.info("relevance llm call failed tenant=%s err=%s", tenant_id, exc)
        return None, str(exc)[:200]


def passes_relevance_gate(
    text: str,
    url: str,
    *,
    tenant_id: str,
    extra_config: dict[str, Any] | None,
    task_name: str = "",
    keywords: tuple[str, ...] = (),
) -> tuple[bool, int, str]:
    """
    Returns (pass, score, reason).

    When mode is ``off``, always passes with score 100.
    """
    cfg = parse_relevance_config(extra_config, task_name=task_name)
    if cfg.mode == "off":
        return True, 100, "off"

    query_terms = _query_terms(extra_config)
    rule_score, rule_reason = score_relevance_rules(
        text,
        url,
        keywords=keywords,
        query_terms=query_terms,
    )

    if cfg.mode == "rules":
        return rule_score >= cfg.min_score, rule_score, rule_reason

    if cfg.mode == "rules_then_llm":
        if rule_score >= cfg.min_score + _BORDER_DELTA:
            return True, rule_score, rule_reason
        if rule_score < cfg.min_score - _BORDER_DELTA:
            return False, rule_score, rule_reason
        llm_score, llm_reason = score_relevance_llm(
            tenant_id,
            text,
            topic=cfg.topic,
            extra_config=extra_config,
        )
        if llm_score is None:
            ok = rule_score >= cfg.min_score
            return ok, rule_score, f"llm_unavailable;{rule_reason}"
        ok = llm_score >= cfg.min_score
        return ok, llm_score, f"llm:{llm_reason};rules={rule_score}"

    if cfg.mode == "llm":
        llm_score, llm_reason = score_relevance_llm(
            tenant_id,
            text,
            topic=cfg.topic,
            extra_config=extra_config,
        )
        if llm_score is None:
            return True, rule_score, f"llm_unavailable_pass;{llm_reason}"
        return llm_score >= cfg.min_score, llm_score, f"llm:{llm_reason}"

    return True, 100, "unknown_mode"
