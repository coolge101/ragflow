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

"""Classify crawl URL outcomes for health scoring (Phase 69.0)."""

from __future__ import annotations

VALID_OUTCOMES = frozenset(
    {
        "ok",
        "robots",
        "timeout",
        "low_quality",
        "keyword",
        "dup",
        "http_error",
        "probe_fail",
        "unknown",
    }
)


def classify_outcome_from_message(message: str) -> str:
    msg = (message or "").lower()
    if "robots" in msg:
        return "robots"
    if "timeout" in msg or "timed out" in msg:
        return "timeout"
    if "quality" in msg or "extract" in msg:
        return "low_quality"
    if "keyword" in msg:
        return "keyword"
    if "dup" in msg:
        return "dup"
    if "connection" in msg or "network" in msg or "refused" in msg:
        return "timeout"
    if "http" in msg or "403" in msg or "404" in msg or "500" in msg:
        return "http_error"
    return "unknown"


def compute_health_score(*, success_count: int, fail_count: int, last_outcome: str) -> int:
    total = success_count + fail_count
    if total <= 0:
        return 50
    ratio = success_count / total
    score = int(round(ratio * 100))
    if last_outcome in ("robots", "timeout", "http_error") and fail_count >= 2:
        score = min(score, 25)
    if last_outcome == "ok" and success_count >= 1:
        score = max(score, 60)
    return max(0, min(100, score))
