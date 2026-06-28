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

"""Pluggable search discover for TBOX crawl (v1 Tavily; v2 SearXNG)."""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Protocol

from common.tbox_crawl_dedup import canonicalize_url
from common.tbox_crawl_query_templates import apply_query_template
from common.tbox_crawl_ssrf_fetch import crawl_http_proxies
from common.tbox_crawl_strategy import url_allowed_by_domains

_LOG = logging.getLogger(__name__)

EXTRA_SEARCH_PROVIDER = "tbox_crawl_search_provider"
EXTRA_SEARCH_QUERIES = "tbox_crawl_search_queries"
EXTRA_SEARCH_LOCALE = "tbox_crawl_search_locale"
EXTRA_DISCOVER_MAX_URLS = "tbox_crawl_discover_max_urls"
EXTRA_DISCOVER_MAX_QUERIES = "tbox_crawl_discover_max_queries"
EXTRA_DISCOVER_MAX_RESULTS = "tbox_crawl_discover_max_results_per_query"
EXTRA_TAVILY_DEPTH = "tbox_crawl_tavily_depth"

_VALID_PROVIDERS = frozenset({"none", "tavily", "searxng", "auto"})
_VALID_LOCALES = frozenset({"zh", "en", "both"})
_VALID_TAVILY_DEPTH = frozenset({"basic", "advanced"})


class DiscoverProviderError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class DiscoverConfig:
    provider: str
    queries: tuple[str, ...]
    locale: str
    max_urls: int
    max_queries: int
    max_results_per_query: int
    tavily_depth: str


@dataclass(frozen=True)
class DiscoverHit:
    url: str
    title: str = ""
    snippet: str = ""
    query: str = ""


@dataclass(frozen=True)
class DiscoverResult:
    hits: list[DiscoverHit]
    provider: str
    queries_executed: int
    raw_result_count: int
    notes: str

    @property
    def urls(self) -> list[str]:
        return [h.url for h in self.hits if h.url]


def merge_discover_hits(hits: list[DiscoverHit]) -> list[DiscoverHit]:
    """Preserve order; drop empty URLs; dedupe by canonical URL (keep first hit metadata)."""
    seen: set[str] = set()
    out: list[DiscoverHit] = []
    for hit in hits:
        url = (hit.url or "").strip()
        if not url:
            continue
        canon = canonicalize_url(url)
        if not canon or canon in seen:
            continue
        seen.add(canon)
        out.append(hit)
    return out


def _search_item_snippet(item: dict[str, Any], *fields: str, max_len: int = 2000) -> str:
    for field in fields:
        val = (item.get(field) or "").strip()
        if val:
            return val[:max_len]
    return ""


def _filter_hits_by_allowed_domains(
    hits: list[DiscoverHit], allowed_domains: tuple[str, ...]
) -> list[DiscoverHit]:
    if not allowed_domains:
        return list(hits)
    return [h for h in hits if url_allowed_by_domains(h.url, allowed_domains)]


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


def _clamp_int(val: Any, default: int, *, lo: int, hi: int) -> int:
    try:
        n = int(val)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def parse_discover_config(extra_config: dict[str, Any] | None) -> DiscoverConfig:
    extra = extra_config or {}
    raw_provider = str(extra.get(EXTRA_SEARCH_PROVIDER) or "none").strip().lower()
    provider = raw_provider if raw_provider in _VALID_PROVIDERS else "none"
    queries = tuple(apply_query_template(extra))
    locale_raw = str(extra.get(EXTRA_SEARCH_LOCALE) or "both").strip().lower()
    locale = locale_raw if locale_raw in _VALID_LOCALES else "both"
    depth_raw = str(extra.get(EXTRA_TAVILY_DEPTH) or "basic").strip().lower()
    tavily_depth = depth_raw if depth_raw in _VALID_TAVILY_DEPTH else "basic"
    return DiscoverConfig(
        provider=provider,
        queries=queries,
        locale=locale,
        max_urls=_clamp_int(extra.get(EXTRA_DISCOVER_MAX_URLS), 10, lo=1, hi=100),
        max_queries=_clamp_int(extra.get(EXTRA_DISCOVER_MAX_QUERIES), 3, lo=1, hi=20),
        max_results_per_query=_clamp_int(extra.get(EXTRA_DISCOVER_MAX_RESULTS), 5, lo=1, hi=10),
        tavily_depth=tavily_depth,
    )


def resolve_tavily_api_key() -> str:
    return (os.environ.get("TBOX_CRAWL_TAVILY_API_KEY") or os.environ.get("TAVILY_API_KEY") or "").strip()


class DiscoverProvider(Protocol):
    def discover(
        self,
        queries: list[str],
        *,
        locale: str,
        max_urls: int,
        max_queries: int,
        max_results_per_query: int,
        allowed_domains: tuple[str, ...],
        tavily_depth: str,
        engines: str | None = None,
    ) -> DiscoverResult: ...


class TavilyDiscoverProvider:
    def __init__(self, api_key: str):
        self._api_key = api_key

    def discover(
        self,
        queries: list[str],
        *,
        locale: str,
        max_urls: int,
        max_queries: int,
        max_results_per_query: int,
        allowed_domains: tuple[str, ...],
        tavily_depth: str,
        engines: str | None = None,
    ) -> DiscoverResult:
        del engines
        from tavily import TavilyClient

        client = TavilyClient(api_key=self._api_key)
        collected: list[DiscoverHit] = []
        raw_count = 0
        executed = 0
        qlist = [q for q in queries if (q or "").strip()][:max_queries]
        for query in qlist:
            if len(collected) >= max_urls:
                break
            executed += 1
            qstr = query.strip()
            try:
                resp = client.search(
                    query=qstr,
                    search_depth=tavily_depth,
                    max_results=max_results_per_query,
                )
            except Exception as exc:
                msg = str(exc).lower()
                if "429" in msg or "rate" in msg or "quota" in msg or "credit" in msg:
                    raise DiscoverProviderError("DISCOVER_QUOTA", str(exc)) from exc
                if any(
                    tok in msg
                    for tok in (
                        "connection reset",
                        "connection aborted",
                        "connection refused",
                        "timed out",
                        "timeout",
                        "network is unreachable",
                        "name or service not known",
                        "failed to establish",
                        "ssl",
                        "certificate",
                    )
                ):
                    raise DiscoverProviderError("DISCOVER_NETWORK", str(exc)) from exc
                raise DiscoverProviderError("DISCOVER", str(exc)) from exc
            results = resp.get("results") if isinstance(resp, dict) else []
            if not isinstance(results, list):
                continue
            for item in results:
                if not isinstance(item, dict):
                    continue
                url = (item.get("url") or "").strip()
                if not url:
                    continue
                raw_count += 1
                if allowed_domains and not url_allowed_by_domains(url, allowed_domains):
                    continue
                title = (item.get("title") or "").strip()
                snippet = _search_item_snippet(item, "content", "raw_content")
                collected.append(DiscoverHit(url=url, title=title, snippet=snippet, query=qstr))
                if len(collected) >= max_urls:
                    break

        merged = merge_discover_hits(collected)
        merged = _filter_hits_by_allowed_domains(merged, allowed_domains)
        merged = merged[:max_urls]
        note = f"locale={locale}; queries={executed}; raw={raw_count}"
        return DiscoverResult(
            hits=merged,
            provider="tavily",
            queries_executed=executed,
            raw_result_count=raw_count,
            notes=note,
        )


class SearxngDiscoverProvider:
    def __init__(self, base_url: str):
        self._base = base_url.rstrip("/")

    def discover(
        self,
        queries: list[str],
        *,
        locale: str,
        max_urls: int,
        max_queries: int,
        max_results_per_query: int,
        allowed_domains: tuple[str, ...],
        tavily_depth: str,
        engines: str | None = None,
    ) -> DiscoverResult:
        del tavily_depth  # unused for SearXNG
        collected: list[DiscoverHit] = []
        raw_count = 0
        executed = 0
        qlist = [q for q in queries if (q or "").strip()][:max_queries]
        lang = "zh-CN" if locale in ("zh", "both") else "en-US"
        for query in qlist:
            if len(collected) >= max_urls:
                break
            executed += 1
            qstr = query.strip()
            params: dict[str, str] = {
                "q": qstr,
                "format": "json",
                "language": lang,
            }
            if engines:
                params["engines"] = engines
            req_url = f"{self._base}/search?{urllib.parse.urlencode(params)}"
            try:
                req = urllib.request.Request(req_url, headers={"Accept": "application/json"})
                body = self._fetch_json(req)
            except urllib.error.HTTPError as exc:
                if exc.code == 429:
                    raise DiscoverProviderError("DISCOVER_QUOTA", str(exc)) from exc
                raise DiscoverProviderError("DISCOVER", str(exc)) from exc
            except Exception as exc:
                msg = str(exc).lower()
                if any(
                    tok in msg
                    for tok in (
                        "connection reset",
                        "connection refused",
                        "timed out",
                        "timeout",
                        "network is unreachable",
                        "name or service not known",
                    )
                ):
                    raise DiscoverProviderError("DISCOVER_NETWORK", str(exc)) from exc
                raise DiscoverProviderError("DISCOVER", str(exc)) from exc
            results = body.get("results") if isinstance(body, dict) else []
            if not isinstance(results, list):
                continue
            for item in results[:max_results_per_query]:
                if not isinstance(item, dict):
                    continue
                url = (item.get("url") or "").strip()
                if not url:
                    continue
                raw_count += 1
                if allowed_domains and not url_allowed_by_domains(url, allowed_domains):
                    continue
                title = (item.get("title") or "").strip()
                snippet = _search_item_snippet(item, "content", "snippet")
                collected.append(DiscoverHit(url=url, title=title, snippet=snippet, query=qstr))
                if len(collected) >= max_urls:
                    break

        merged = merge_discover_hits(collected)
        merged = _filter_hits_by_allowed_domains(merged, allowed_domains)
        merged = merged[:max_urls]
        note = f"locale={locale}; queries={executed}; raw={raw_count}"
        return DiscoverResult(
            hits=merged,
            provider="searxng",
            queries_executed=executed,
            raw_result_count=raw_count,
            notes=note,
        )

    def _fetch_json(self, req: urllib.request.Request) -> dict:
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
            with opener.open(req, timeout=30) as resp:
                parsed = json.loads(resp.read().decode("utf-8", errors="replace"))
                return parsed if isinstance(parsed, dict) else {}
        with urllib.request.urlopen(req, timeout=30) as resp:
            parsed = json.loads(resp.read().decode("utf-8", errors="replace"))
            return parsed if isinstance(parsed, dict) else {}


def resolve_searxng_base_url() -> str:
    return (os.environ.get("TBOX_CRAWL_SEARXNG_BASE_URL") or "").strip().rstrip("/")


def get_discover_provider(name: str) -> DiscoverProvider | None:
    n = (name or "none").strip().lower()
    if n in ("", "none"):
        return None
    if n == "tavily":
        key = resolve_tavily_api_key()
        if not key:
            raise DiscoverProviderError("DISCOVER_NO_KEY", "TBOX_CRAWL_TAVILY_API_KEY or TAVILY_API_KEY not set")
        return TavilyDiscoverProvider(key)
    if n == "searxng":
        base = resolve_searxng_base_url()
        if not base:
            raise DiscoverProviderError("DISCOVER_NO_SEARXNG", "TBOX_CRAWL_SEARXNG_BASE_URL not set")
        return SearxngDiscoverProvider(base)
    raise DiscoverProviderError("DISCOVER_PROVIDER", f"unknown discover provider: {name}")


def run_discover(
    cfg: DiscoverConfig,
    allowed_domains: tuple[str, ...],
    extra_config: dict[str, Any] | None = None,
) -> DiscoverResult | None:
    if cfg.provider == "none" or not cfg.queries:
        return None
    if cfg.provider == "auto":
        from common.tbox_crawl_discover_router import run_auto_discover

        return run_auto_discover(cfg, allowed_domains, extra_config)
    provider = get_discover_provider(cfg.provider)
    if provider is None:
        return None
    return provider.discover(
        list(cfg.queries),
        locale=cfg.locale,
        max_urls=cfg.max_urls,
        max_queries=cfg.max_queries,
        max_results_per_query=cfg.max_results_per_query,
        allowed_domains=allowed_domains,
        tavily_depth=cfg.tavily_depth,
    )


def discover_url_set(result: DiscoverResult | None) -> set[str]:
    if result is None:
        return set()
    return {canonicalize_url(u) for u in result.urls if canonicalize_url(u)}
