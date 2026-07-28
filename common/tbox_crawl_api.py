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
#  See the License for the License for the specific language governing permissions and
#  limitations under the License.
#

"""Parse JSON API crawl responses into ingestible text documents."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

EXTRA_CRAWL_API_ITEMS_PATH = "tbox_crawl_api_items_path"
EXTRA_CRAWL_API_CONTENT_FIELDS = "tbox_crawl_api_content_fields"
EXTRA_CRAWL_API_ID_FIELD = "tbox_crawl_api_id_field"

_DEFAULT_CONTENT_FIELDS = ("title", "content", "text", "body", "description", "summary", "name")


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


@dataclass(frozen=True)
class ApiCrawlConfig:
    items_path: str
    content_fields: tuple[str, ...]
    id_field: str


def parse_api_config(extra_config: dict[str, Any] | None) -> ApiCrawlConfig:
    extra = extra_config or {}
    items_path = str(extra.get(EXTRA_CRAWL_API_ITEMS_PATH) or "").strip()
    fields_raw = _parse_string_list(extra.get(EXTRA_CRAWL_API_CONTENT_FIELDS))
    content_fields = tuple(fields_raw) if fields_raw else _DEFAULT_CONTENT_FIELDS
    id_field = str(extra.get(EXTRA_CRAWL_API_ID_FIELD) or "id").strip() or "id"
    return ApiCrawlConfig(items_path=items_path, content_fields=content_fields, id_field=id_field)


def navigate_json_path(root: Any, path: str) -> Any:
    """Follow dot-separated keys; empty *path* returns *root* unchanged."""
    cur = root
    for part in (path or "").split("."):
        token = part.strip()
        if not token:
            continue
        if isinstance(cur, dict):
            cur = cur.get(token)
        else:
            raise ValueError(f"cannot navigate path segment {token!r} on non-object")
    return cur


def extract_api_items(body: bytes, config: ApiCrawlConfig) -> list[Any]:
    try:
        root = json.loads(body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError(f"invalid JSON response: {exc}") from exc

    if not config.items_path:
        if not isinstance(root, list):
            raise ValueError("response root is not a JSON array; set tbox_crawl_api_items_path")
        return root

    node = navigate_json_path(root, config.items_path)
    if not isinstance(node, list):
        raise ValueError(f"path {config.items_path!r} did not resolve to a JSON array")
    return node


def api_item_to_document(item: Any, config: ApiCrawlConfig) -> tuple[str, str]:
    """
    Return ``(text, base_name)`` for one API item.

    *base_name* is a filesystem-safe stem (no extension).
    """
    if isinstance(item, str):
        text = item.strip()
        return text, "entry"

    if not isinstance(item, dict):
        text = json.dumps(item, ensure_ascii=False)
        return text, "entry"

    parts: list[str] = []
    for field in config.content_fields:
        val = item.get(field)
        if val is None:
            continue
        if isinstance(val, (dict, list)):
            parts.append(json.dumps(val, ensure_ascii=False))
        else:
            s = str(val).strip()
            if s:
                parts.append(s)

    if parts:
        text = "\n\n".join(parts)
    else:
        text = json.dumps(item, ensure_ascii=False)

    id_val = item.get(config.id_field) if config.id_field else None
    if id_val is not None and str(id_val).strip():
        base = str(id_val).strip()
    elif parts:
        base = parts[0][:80]
    else:
        base = "entry"

    safe = "".join(c if c.isalnum() or c in " ._-()" else "_" for c in base).strip() or "entry"
    return text, safe[:120]
