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

"""URL canonicalization, content fingerprints, and crawl seen-store helpers."""

from __future__ import annotations

import hashlib
import re
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

_STRIP_WWW = re.compile(r"^www\.", re.I)
_TRACKING_QUERY_PREFIXES = ("utm_",)
_TRACKING_QUERY_KEYS = frozenset({"fbclid", "gclid", "mc_eid"})


def content_sha256(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


def _normalize_host(host: str) -> str:
    h = (host or "").strip().lower().strip(".")
    return _STRIP_WWW.sub("", h)


def canonicalize_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""
    parsed = urlparse(raw)
    scheme = (parsed.scheme or "https").lower()
    host = _normalize_host(parsed.hostname or "")
    if not host:
        return raw
    port = parsed.port
    netloc = host
    if port and not ((scheme == "http" and port == 80) or (scheme == "https" and port == 443)):
        netloc = f"{host}:{port}"

    path = parsed.path or ""
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")

    kept: list[tuple[str, str]] = []
    for k, v in parse_qsl(parsed.query, keep_blank_values=True):
        kl = k.lower()
        if kl in _TRACKING_QUERY_KEYS or any(kl.startswith(p) for p in _TRACKING_QUERY_PREFIXES):
            continue
        kept.append((k, v))
    query = urlencode(kept, doseq=True)

    return urlunparse((scheme, netloc, path, "", query, ""))


def filter_urls_not_seen(dataset_id: str, urls: list[str], *, seen_fn) -> tuple[list[str], int]:
    """Drop URLs whose canonical form exists in *seen_fn(dataset_id, canonical)*."""
    if not dataset_id:
        return list(urls), 0
    kept: list[str] = []
    skipped = 0
    for url in urls:
        canon = canonicalize_url(url)
        if not canon:
            continue
        if seen_fn(dataset_id, canon):
            skipped += 1
            continue
        kept.append(url)
    return kept, skipped


def merge_url_lists(*parts: list[str]) -> list[str]:
    """Preserve order; drop empty; dedupe by canonical URL."""
    out: list[str] = []
    seen: set[str] = set()
    for part in parts:
        for url in part:
            u = (url or "").strip()
            if not u:
                continue
            canon = canonicalize_url(u)
            if canon in seen:
                continue
            seen.add(canon)
            out.append(u)
    return out
