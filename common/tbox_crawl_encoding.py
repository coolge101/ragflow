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

"""Detect charset for crawl HTTP bodies (CN sites often GBK/GB18030, not UTF-8)."""

from __future__ import annotations

import re

_CHARSET_PARAM = re.compile(r"charset\s*=\s*['\"]?([a-zA-Z0-9._-]+)", re.I)
_META_CHARSET = re.compile(
    rb"""<meta[^>]+charset\s*=\s*['"]?([^'">\s]+)""",
    re.I,
)
_META_HTTP_EQUIV = re.compile(
    rb"""<meta[^>]+http-equiv\s*=\s*['"]?content-type['"]?[^>]+content\s*=\s*['"][^'"]*charset\s*=\s*([^'">\s]+)""",
    re.I,
)

_ENCODING_ALIASES = {
    "gb2312": "gb18030",
    "gbk": "gb18030",
    "x-gbk": "gb18030",
    "cp936": "gb18030",
    "utf8": "utf-8",
    "ascii": "utf-8",
}


def normalize_encoding(name: str | None) -> str | None:
    if not name:
        return None
    key = name.strip().lower().replace("_", "-")
    if not key:
        return None
    return _ENCODING_ALIASES.get(key, key)


def encoding_from_content_type(content_type: str | None) -> str | None:
    if not content_type:
        return None
    m = _CHARSET_PARAM.search(content_type)
    return normalize_encoding(m.group(1)) if m else None


def encoding_from_html_meta(body: bytes) -> str | None:
    head = body[:16384]
    for pattern in (_META_CHARSET, _META_HTTP_EQUIV):
        m = pattern.search(head)
        if m:
            try:
                raw = m.group(1).decode("ascii", errors="ignore")
            except Exception:
                continue
            enc = normalize_encoding(raw)
            if enc:
                return enc
    return None


def _chardet_guess(body: bytes) -> str | None:
    try:
        import chardet
    except ImportError:
        return None
    sample = body[:65536]
    if not sample:
        return None
    result = chardet.detect(sample)
    enc = normalize_encoding(result.get("encoding") if isinstance(result, dict) else None)
    confidence = float(result.get("confidence") or 0) if isinstance(result, dict) else 0.0
    if enc and confidence >= 0.55:
        return enc
    return None


def decode_response_body(body: bytes, content_type: str | None = None) -> str:
    """Decode HTTP body bytes using Content-Type, HTML meta, chardet, then common CN fallbacks."""
    if not body:
        return ""

    candidates: list[str] = []
    for enc in (
        encoding_from_content_type(content_type),
        encoding_from_html_meta(body),
        _chardet_guess(body),
        "utf-8",
        "gb18030",
        "big5",
    ):
        if enc and enc not in candidates:
            candidates.append(enc)

    for enc in candidates:
        try:
            return body.decode(enc)
        except (LookupError, UnicodeDecodeError):
            continue
    return body.decode("utf-8", errors="replace")


def mime_from_content_type(content_type: str | None) -> str:
    if not content_type:
        return ""
    return content_type.split(";", 1)[0].strip().lower()


def ensure_utf8_html_document(html: str) -> str:
    """Re-encode HTML as UTF-8 and force meta charset so preview matches stored bytes."""
    cleaned = re.sub(
        r"<meta[^>]+charset\s*=\s*[^>]+>",
        "",
        html,
        flags=re.I,
    )
    cleaned = re.sub(
        r"""<meta[^>]+http-equiv\s*=\s*['"]?content-type['"]?[^>]*>""",
        "",
        cleaned,
        flags=re.I,
    )
    if re.search(r"<head[^>]*>", cleaned, re.I):
        return re.sub(r"(<head[^>]*>)", r'\1<meta charset="utf-8">', cleaned, count=1, flags=re.I)
    if re.search(r"<html[^>]*>", cleaned, re.I):
        return re.sub(
            r"(<html[^>]*>)",
            r'\1<head><meta charset="utf-8"></head>',
            cleaned,
            count=1,
            flags=re.I,
        )
    return f'<html><head><meta charset="utf-8"></head><body>{cleaned}</body></html>'


def normalize_html_bytes_for_storage(body: bytes, content_type: str | None = None) -> bytes:
    """Decode with detected charset and store as UTF-8 HTML so browser preview renders CN text."""
    mime = mime_from_content_type(content_type)
    if "html" not in mime and not _META_CHARSET.search(body[:4096]):
        return body
    html = ensure_utf8_html_document(decode_response_body(body, content_type))
    return html.encode("utf-8")
