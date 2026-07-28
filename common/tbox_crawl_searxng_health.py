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

"""SearXNG health probe and engine overlay for discover auto-routing (Phase 69.2)."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from common.tbox_crawl_discover import resolve_searxng_base_url
from common.tbox_crawl_ssrf_fetch import crawl_http_proxies

EXTRA_DISCOVER_MIN_ENGINES = "tbox_crawl_discover_min_engines"
DEFAULT_DISCOVER_MIN_ENGINES = 2


def parse_engine_allowlist() -> list[str]:
    raw = (os.environ.get("TBOX_CRAWL_SEARXNG_ENGINE_ALLOWLIST") or "").strip()
    return [x.strip() for x in raw.split(",") if x.strip()]


def parse_discover_min_engines(extra_config: dict[str, Any] | None) -> int:
    extra = extra_config or {}
    try:
        n = int(extra.get(EXTRA_DISCOVER_MIN_ENGINES, DEFAULT_DISCOVER_MIN_ENGINES))
    except (TypeError, ValueError):
        n = DEFAULT_DISCOVER_MIN_ENGINES
    return max(0, min(n, 50))


def _urlopen_json(req: urllib.request.Request, *, timeout: float) -> dict[str, Any]:
    proxies = crawl_http_proxies()
    if proxies:
        proxy_map: dict[str, str] = {}
        if proxies.get("http"):
            proxy_map["http"] = proxies["http"]
            proxy_map["https"] = proxies.get("https") or proxies["http"]
        elif proxies.get("https"):
            proxy_map["https"] = proxies["https"]
        handler = urllib.request.ProxyHandler(proxy_map) if proxy_map else urllib.request.ProxyHandler({})
        opener = urllib.request.build_opener(handler)
        with opener.open(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8", errors="replace"))
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def count_engines_ok(body: dict[str, Any]) -> int:
    results = body.get("results") if isinstance(body, dict) else []
    if not isinstance(results, list):
        return 0
    engines: set[str] = set()
    for item in results:
        if isinstance(item, dict):
            eng = (item.get("engine") or "").strip()
            if eng:
                engines.add(eng)
    if engines:
        return len(engines)
    return 1 if results else 0


def resolve_effective_engines(allowlist: list[str], unresponsive: list[str]) -> str | None:
    """Comma-separated SearXNG ``engines`` param; None = server default."""
    if not allowlist:
        return None
    blocked = {str(x).strip().lower() for x in unresponsive if str(x).strip()}
    good = [e for e in allowlist if e.strip().lower() not in blocked]
    return ",".join(good) if good else None


def is_searxng_degraded(health: dict[str, Any], *, min_engines: int) -> bool:
    if not health.get("reachable"):
        return True
    return int(health.get("engines_ok") or 0) < max(0, min_engines)


def probe_searxng_health(*, timeout: float = 12.0, min_engines: int | None = None) -> dict[str, Any]:
    """Ping SearXNG JSON search and summarize engine availability."""
    base = resolve_searxng_base_url()
    allowlist = parse_engine_allowlist()
    if not base:
        return {
            "configured": False,
            "reachable": False,
            "results_count": 0,
            "engines_ok": 0,
            "unresponsive_engines": [],
            "engine_allowlist": allowlist,
            "effective_engines": None,
            "degraded": True,
            "error": "TBOX_CRAWL_SEARXNG_BASE_URL not set",
        }

    engines_param = ",".join(allowlist) if allowlist else None
    params: dict[str, str] = {"q": "ping", "format": "json"}
    if engines_param:
        params["engines"] = engines_param
    url = f"{base.rstrip('/')}/search?{urllib.parse.urlencode(params)}"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        body = _urlopen_json(req, timeout=timeout)
    except Exception as exc:
        return {
            "configured": True,
            "base_url": base,
            "reachable": False,
            "results_count": 0,
            "engines_ok": 0,
            "unresponsive_engines": [],
            "engine_allowlist": allowlist,
            "effective_engines": engines_param,
            "degraded": True,
            "error": str(exc),
        }

    results = body.get("results") if isinstance(body, dict) else []
    unresponsive = body.get("unresponsive_engines") if isinstance(body, dict) else []
    if not isinstance(results, list):
        results = []
    if not isinstance(unresponsive, list):
        unresponsive = []
    engines_ok = count_engines_ok(body if isinstance(body, dict) else {})
    effective = resolve_effective_engines(allowlist, unresponsive) or engines_param
    threshold = DEFAULT_DISCOVER_MIN_ENGINES if min_engines is None else min_engines
    return {
        "configured": True,
        "base_url": base,
        "reachable": True,
        "results_count": len(results),
        "engines_ok": engines_ok,
        "unresponsive_engines": unresponsive[:30],
        "engine_allowlist": allowlist,
        "effective_engines": effective,
        "degraded": is_searxng_degraded(
            {"reachable": True, "engines_ok": engines_ok},
            min_engines=threshold,
        ),
    }
