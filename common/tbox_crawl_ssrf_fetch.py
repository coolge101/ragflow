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

"""SSRF-safe HTTP GET with redirect validation (DNS pinning), capped body size."""

from __future__ import annotations

import os
from typing import Any

from urllib.parse import urljoin, urlparse

import requests

from common.ssrf_guard import assert_url_is_safe, pin_dns
from common.tbox_crawl_origin_throttle import OriginFetchThrottler

_MAX_REDIRECTS = 10
_REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})
_DEFAULT_UA = os.environ.get(
    "TBOX_CRAWL_HTTP_USER_AGENT",
    "TBOX-RAGFlow-Crawl/1.0 (+https://github.com/infiniflow/ragflow)",
)


def _ssrf_redirecting_stream_get(
    start_url: str,
    *,
    timeout: float,
    headers: dict[str, str],
    robots_preflight: Any | None = None,
    origin_throttle: OriginFetchThrottler | None = None,
) -> requests.Response:
    """
    Manual redirect loop with :func:`assert_url_is_safe` and optional *robots_preflight* per hop.

    Optional *origin_throttle* enforces spacing between GETs to the same origin (after robots
    preflight when applicable). Caller must still ``record_hop_finished`` for the **final** hop
    after draining/closing the returned response (see :func:`fetch_url_body_capped`).

    Caller must ``close()`` the returned response.
    """
    current_url = start_url.strip()
    response: requests.Response | None = None
    for _ in range(_MAX_REDIRECTS + 1):
        current_hostname, current_ip = assert_url_is_safe(current_url)
        if robots_preflight is not None:
            ok_r, msg_r = robots_preflight.allowed(current_url)
            if not ok_r:
                raise ValueError(msg_r)
        if origin_throttle is not None:
            origin_throttle.wait_before_hop(current_url)
        with pin_dns(current_hostname, current_ip):
            response = requests.get(
                current_url,
                timeout=timeout,
                allow_redirects=False,
                headers=headers,
                stream=True,
            )

        if response.status_code not in _REDIRECT_STATUSES:
            return response

        location = response.headers.get("Location")
        if origin_throttle is not None:
            try:
                origin_throttle.record_hop_finished(response.url or current_url)
            except Exception:
                pass
        response.close()
        if not location:
            return response

        current_url = urljoin(current_url, location)
    raise ValueError(f"Exceeded {_MAX_REDIRECTS} redirects fetching {start_url!r}")


def _drain_response_body(response: requests.Response, max_bytes: int) -> None:
    n = 0
    for chunk in response.iter_content(chunk_size=65536):
        if not chunk:
            continue
        n += len(chunk)
        if n >= max_bytes:
            break


def fetch_url_body_capped(
    url: str,
    *,
    max_bytes: int,
    timeout: float,
    missing_ok_statuses: frozenset[int] | None = None,
    robots_preflight: Any | None = None,
    origin_throttle: OriginFetchThrottler | None = None,
) -> tuple[bytes, str | None]:
    """
    GET *url* with manual redirect handling; each hop passes :func:`assert_url_is_safe`.

    Returns ``(body, content_type)`` where content_type is stripped of parameters.
    Raises ``ValueError`` on HTTP errors, empty body, or oversize beyond *max_bytes* (read is capped).

    If *missing_ok_statuses* is set (e.g. ``frozenset({404})``) and the final status is in it, the body is
    drained up to *max_bytes* and ``(b"", None)`` is returned (caller treats as “no file”, e.g. robots.txt).

    If *robots_preflight* is set, it must provide ``allowed(url: str) -> tuple[bool, str]``; it is invoked at
    the start of each redirect hop before ``GET`` (same user-agent as the request).

    If *origin_throttle* is set, spacing between GETs to the same origin is enforced (see
    :class:`common.tbox_crawl_origin_throttle.OriginFetchThrottler`).
    """
    if max_bytes <= 0:
        raise ValueError("max_bytes must be positive")

    headers = {"User-Agent": _DEFAULT_UA}
    response = _ssrf_redirecting_stream_get(
        url.strip(),
        timeout=timeout,
        headers=headers,
        robots_preflight=robots_preflight,
        origin_throttle=origin_throttle,
    )

    try:
        if response.status_code >= 400:
            if missing_ok_statuses and response.status_code in missing_ok_statuses:
                _drain_response_body(response, max_bytes)
                return b"", None
            raise ValueError(f"HTTP {response.status_code}")

        ct = response.headers.get("Content-Type")
        if ct and ";" in ct:
            ct = ct.split(";", 1)[0].strip()

        buf = bytearray()
        for chunk in response.iter_content(chunk_size=65536):
            if not chunk:
                continue
            remaining = max_bytes - len(buf)
            if remaining <= 0:
                break
            buf.extend(chunk[:remaining])
        body = bytes(buf)
        if not body:
            raise ValueError("empty response body")
        return body, ct
    finally:
        fin_url = getattr(response, "url", None) or url.strip()
        response.close()
        if origin_throttle is not None:
            try:
                origin_throttle.record_hop_finished(str(fin_url))
            except Exception:
                pass


def probe_url_streaming_cap(
    url: str,
    *,
    timeout: float,
    max_read_bytes: int,
    robots_preflight: Any | None = None,
    origin_throttle: OriginFetchThrottler | None = None,
) -> tuple[int, str | None]:
    """
    Same redirect / SSRF / robots rules as :func:`fetch_url_body_capped`, but only reads up to
    *max_read_bytes* of the final response body (reachability probe).

    Returns ``(status_code, error_or_none)`` where *error_or_none* is set on failure (HTTP ≥400,
    ``ValueError`` from SSRF/robots/redirects, or ``requests`` errors). ``status_code`` may be ``0``
    when no HTTP status applies.
    """
    if max_read_bytes <= 0:
        return 0, "max_read_bytes must be positive"

    headers = {"User-Agent": _DEFAULT_UA}
    try:
        response = _ssrf_redirecting_stream_get(
            url.strip(),
            timeout=timeout,
            headers=headers,
            robots_preflight=robots_preflight,
            origin_throttle=origin_throttle,
        )
        try:
            if response.status_code >= 400:
                return response.status_code, f"HTTP {response.status_code}"
            _drain_response_body(response, max_read_bytes)
            return response.status_code, None
        finally:
            fin_url = getattr(response, "url", None) or url.strip()
            response.close()
            if origin_throttle is not None:
                try:
                    origin_throttle.record_hop_finished(str(fin_url))
                except Exception:
                    pass
    except ValueError as e:
        return 0, str(e)
    except requests.RequestException as e:
        return 0, str(e)


def suggested_filename_from_url(url: str, content_type: str | None) -> str:
    """Basename for storage (caller may still pass through duplicate_name)."""
    parsed = urlparse(url)
    path = (parsed.path or "").rstrip("/")
    base = path.split("/")[-1] if path else ""
    base = base.split("?", 1)[0].strip() or "page"
    # strip obvious junk
    safe = "".join(c if c.isalnum() or c in "._-+" else "_" for c in base)[:180] or "page"

    ct = (content_type or "").lower()
    lower = safe.lower()
    has_ext = "." in safe and lower.rsplit(".", 1)[-1] in (
        "html",
        "htm",
        "pdf",
        "txt",
        "md",
        "json",
        "xml",
        "csv",
    )
    if has_ext:
        return safe
    if "pdf" in ct:
        return f"{safe}.pdf"
    if "html" in ct:
        return f"{safe}.html"
    return f"{safe}.bin"
