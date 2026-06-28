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

"""Discover provider auto-routing: SearXNG → Tavily → none (Phase 69.2)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from common.tbox_crawl_discover import (
    DiscoverConfig,
    DiscoverProviderError,
    DiscoverResult,
    SearxngDiscoverProvider,
    get_discover_provider,
    resolve_tavily_api_key,
)
from common.tbox_crawl_searxng_health import is_searxng_degraded, parse_discover_min_engines, probe_searxng_health


@dataclass(frozen=True)
class DiscoverRouteDecision:
    provider: str
    degraded: bool
    note: str
    searxng_health: dict[str, Any] | None


def resolve_auto_provider(extra_config: dict[str, Any] | None) -> DiscoverRouteDecision:
    """Choose discover backend for ``provider=auto``."""
    min_engines = parse_discover_min_engines(extra_config)
    health = probe_searxng_health(min_engines=min_engines)
    tavily_ok = bool(resolve_tavily_api_key())

    if health.get("reachable") and not is_searxng_degraded(health, min_engines=min_engines):
        return DiscoverRouteDecision(
            "searxng",
            False,
            f"auto:searxng engines_ok={health.get('engines_ok', 0)}",
            health,
        )

    if is_searxng_degraded(health, min_engines=min_engines) and tavily_ok:
        return DiscoverRouteDecision(
            "tavily",
            True,
            "auto:tavily (searxng_degraded)",
            health,
        )

    if health.get("reachable") and int(health.get("results_count") or 0) > 0:
        return DiscoverRouteDecision(
            "searxng",
            True,
            "auto:searxng degraded but results>0",
            health,
        )

    if tavily_ok:
        return DiscoverRouteDecision(
            "tavily",
            True,
            "auto:tavily (searxng unavailable or empty)",
            health,
        )

    if health.get("configured"):
        return DiscoverRouteDecision(
            "searxng",
            True,
            "auto:searxng last-resort",
            health,
        )

    return DiscoverRouteDecision("none", True, "auto:no provider configured", health)


def run_auto_discover(
    cfg: DiscoverConfig,
    allowed_domains: tuple[str, ...],
    extra_config: dict[str, Any] | None = None,
) -> DiscoverResult | None:
    if not cfg.queries:
        return None

    decision = resolve_auto_provider(extra_config)
    if decision.provider == "none":
        return DiscoverResult(
            hits=[],
            provider="auto",
            queries_executed=0,
            raw_result_count=0,
            notes=decision.note,
        )

    try:
        provider = get_discover_provider(decision.provider)
    except DiscoverProviderError:
        if decision.provider == "searxng" and resolve_tavily_api_key():
            provider = get_discover_provider("tavily")
            decision = DiscoverRouteDecision("tavily", True, decision.note + "; fallback tavily", decision.searxng_health)
        else:
            raise

    if provider is None:
        return DiscoverResult(hits=[], provider="auto", queries_executed=0, raw_result_count=0, notes=decision.note)

    engines = None
    if decision.provider == "searxng" and decision.searxng_health:
        engines = decision.searxng_health.get("effective_engines")

    if isinstance(provider, SearxngDiscoverProvider):
        result = provider.discover(
            list(cfg.queries),
            locale=cfg.locale,
            max_urls=cfg.max_urls,
            max_queries=cfg.max_queries,
            max_results_per_query=cfg.max_results_per_query,
            allowed_domains=allowed_domains,
            tavily_depth=cfg.tavily_depth,
            engines=engines,
        )
    else:
        result = provider.discover(
            list(cfg.queries),
            locale=cfg.locale,
            max_urls=cfg.max_urls,
            max_queries=cfg.max_queries,
            max_results_per_query=cfg.max_results_per_query,
            allowed_domains=allowed_domains,
            tavily_depth=cfg.tavily_depth,
        )

    note = f"{decision.note}; degraded={decision.degraded}; routed={decision.provider}"
    if result.notes:
        note = f"{note}; {result.notes}"
    return DiscoverResult(
        hits=list(result.hits),
        provider="auto",
        queries_executed=result.queries_executed,
        raw_result_count=result.raw_result_count,
        notes=note,
    )
