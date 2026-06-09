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

"""Outbound crawl subsystem probes for GET /v1/tbox/crawl/health (Phase 69.0)."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from common.tbox_crawl_discover import resolve_searxng_base_url, resolve_tavily_api_key


def _proxy_configured() -> dict[str, Any]:
    http_p = (os.environ.get("TBOX_CRAWL_HTTP_PROXY") or os.environ.get("HTTP_PROXY") or "").strip()
    https_p = (os.environ.get("TBOX_CRAWL_HTTPS_PROXY") or os.environ.get("HTTPS_PROXY") or http_p).strip()
    return {
        "http_proxy_configured": bool(http_p),
        "https_proxy_configured": bool(https_p),
    }


def probe_searxng(*, timeout: float = 12.0) -> dict[str, Any]:
    base = resolve_searxng_base_url()
    if not base:
        return {
            "configured": False,
            "reachable": False,
            "results_count": 0,
            "engines_ok": 0,
            "unresponsive_engines": [],
            "error": "TBOX_CRAWL_SEARXNG_BASE_URL not set",
        }
    params = urllib.parse.urlencode({"q": "ping", "format": "json"})
    url = f"{base.rstrip('/')}/search?{params}"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception as exc:
        return {
            "configured": True,
            "base_url": base,
            "reachable": False,
            "results_count": 0,
            "engines_ok": 0,
            "unresponsive_engines": [],
            "error": str(exc),
        }
    results = body.get("results") if isinstance(body, dict) else []
    unresponsive = body.get("unresponsive_engines") if isinstance(body, dict) else []
    if not isinstance(results, list):
        results = []
    if not isinstance(unresponsive, list):
        unresponsive = []
    allow_raw = (os.environ.get("TBOX_CRAWL_SEARXNG_ENGINE_ALLOWLIST") or "").strip()
    return {
        "configured": True,
        "base_url": base,
        "reachable": True,
        "results_count": len(results),
        "engines_ok": 1 if results else 0,
        "unresponsive_engines": unresponsive[:20],
        "engine_allowlist": [x.strip() for x in allow_raw.split(",") if x.strip()],
        "degraded": len(results) == 0 and len(unresponsive) > 0,
    }


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
        "self_heal_phase": "69.0",
    }
