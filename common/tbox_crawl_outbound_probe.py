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

"""Outbound crawl subsystem probes for GET /v1/tbox/crawl/health (Phase 69.0+)."""

from __future__ import annotations

import os
from typing import Any

from common.tbox_crawl_discover import resolve_tavily_api_key
from common.tbox_crawl_searxng_health import probe_searxng_health


def _proxy_configured() -> dict[str, Any]:
    http_p = (os.environ.get("TBOX_CRAWL_HTTP_PROXY") or os.environ.get("HTTP_PROXY") or "").strip()
    https_p = (os.environ.get("TBOX_CRAWL_HTTPS_PROXY") or os.environ.get("HTTPS_PROXY") or http_p).strip()
    return {
        "http_proxy_configured": bool(http_p),
        "https_proxy_configured": bool(https_p),
    }


def probe_searxng(*, timeout: float = 12.0) -> dict[str, Any]:
    return probe_searxng_health(timeout=timeout)


def probe_tavily() -> dict[str, Any]:
    key = resolve_tavily_api_key()
    return {
        "configured": bool(key),
        "api_key_present": bool(key),
    }


def recommend_discover_provider(searxng: dict[str, Any], tavily: dict[str, Any]) -> str:
    if searxng.get("reachable") and not searxng.get("degraded"):
        return "searxng"
    if searxng.get("reachable") and searxng.get("results_count", 0) > 0:
        return "searxng"
    if tavily.get("api_key_present"):
        return "tavily"
    if searxng.get("configured"):
        return "searxng_degraded"
    return "none"


def build_crawl_health_report() -> dict[str, Any]:
    proxy = _proxy_configured()
    searxng = probe_searxng()
    tavily = probe_tavily()
    recommended = recommend_discover_provider(searxng, tavily)
    return {
        "proxy": proxy,
        "searxng": searxng,
        "tavily": tavily,
        "recommended_discover_provider": recommended,
        "self_heal_phase": "69.3",
    }
