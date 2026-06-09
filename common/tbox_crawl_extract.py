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

"""Main-content extraction for TBOX static_web crawl ingest (Phase 68)."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

EXTRA_EXTRACT_MAIN_CONTENT = "tbox_crawl_extract_main_content"
EXTRA_MIN_EXTRACT_CHARS = "tbox_crawl_min_extract_chars"

_STRIP_WWW = re.compile(r"^www\.", re.I)


def parse_extract_enabled(extra_config: dict[str, Any] | None) -> bool:
    val = (extra_config or {}).get(EXTRA_EXTRACT_MAIN_CONTENT)
    if val is None:
        return True
    return bool(val)


def parse_min_extract_chars(extra_config: dict[str, Any] | None) -> int:
    raw = (extra_config or {}).get(EXTRA_MIN_EXTRACT_CHARS)
    if raw is None or raw == "":
        return 200
    try:
        return max(1, int(raw))
    except (TypeError, ValueError):
        return 200


def extract_main_text(body: bytes) -> str:
    if not body:
        return ""
    try:
        html = body.decode("utf-8", errors="ignore")
    except Exception:
        html = body.decode("latin-1", errors="ignore")
    try:
        import trafilatura  # type: ignore
        from trafilatura.settings import use_config  # type: ignore

        config = use_config()
        config.set("DEFAULT", "include_links", "True")
        config.set("DEFAULT", "include_tables", "True")
        text = trafilatura.extract(html, config=config) or ""
        return re.sub(r"[\n\r]+", "\n", text).strip()
    except Exception:
        return ""


def suggested_txt_filename(url: str, *, max_len: int = 180) -> str:
    parsed = urlparse((url or "").strip())
    host = _STRIP_WWW.sub("", (parsed.hostname or "page").lower())
    path = (parsed.path or "/").strip("/") or "index"
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "_", path)[: max_len - len(host) - 5]
    slug = slug.strip("._-") or "page"
    name = f"{host}_{slug}.txt"
    return name[:max_len]
