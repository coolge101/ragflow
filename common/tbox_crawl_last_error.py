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

"""Stable prefixes for crawl worker ``last_error`` (UI / ops grep)."""

from __future__ import annotations


def format_crawl_worker_error(code: str, detail: str = "", *, max_len: int = 65000) -> str:
    """
    Return ``[tbox:CODE] detail`` with a short machine-friendly *code*.

    *code* should be ``UPPER_SNAKE`` (e.g. ``HTTP_PROBE``); unsafe characters are stripped.
    """
    raw = (code or "ERR").strip().upper()
    safe = "".join(ch if ch.isalnum() or ch == "_" else "_" for ch in raw) or "ERR"
    d = (detail or "").strip()
    if d:
        out = f"[tbox:{safe}] {d}"
    else:
        out = f"[tbox:{safe}]"
    return out[:max_len]
