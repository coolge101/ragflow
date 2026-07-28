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

from __future__ import annotations

import logging

from api.db.db_models import TboxCrawlUrlHealth
from common.constants import StatusEnum
from common.misc_utils import get_uuid
from common.tbox_crawl_dedup import canonicalize_url, url_canonical_hash
from common.tbox_crawl_health_outcome import VALID_OUTCOMES, classify_outcome_from_message, compute_health_score

_LOG = logging.getLogger(__name__)


def _normalize_outcome(outcome: str) -> str:
    o = (outcome or "unknown").strip().lower()
    return o if o in VALID_OUTCOMES else "unknown"


def record_url_outcome(
    *,
    tenant_id: str,
    task_id: str,
    url: str,
    outcome: str,
    source: str = "seed",
    http_status: int | None = None,
) -> None:
    """Upsert per-task URL health after probe/ingest/discover fetch."""
    tid = (tenant_id or "").strip()
    task = (task_id or "").strip()
    canon = canonicalize_url(url)
    if not tid or not task or not canon:
        return
    outcome_n = _normalize_outcome(outcome)
    uhash = url_canonical_hash(canon)
    src = (source or "seed")[:16]
    row = TboxCrawlUrlHealth.get_or_none(
        (TboxCrawlUrlHealth.tenant_id == tid) & (TboxCrawlUrlHealth.task_id == task) & (TboxCrawlUrlHealth.url_canonical_hash == uhash) & (TboxCrawlUrlHealth.status == StatusEnum.VALID.value)
    )
    if row is None:
        success = 1 if outcome_n == "ok" else 0
        fail = 0 if outcome_n == "ok" else 1
        score = compute_health_score(success_count=success, fail_count=fail, last_outcome=outcome_n)
        TboxCrawlUrlHealth.insert(
            id=get_uuid(),
            tenant_id=tid,
            task_id=task,
            url=url[:2048],
            url_canonical=canon[:2048],
            url_canonical_hash=uhash,
            source=src,
            success_count=success,
            fail_count=fail,
            last_outcome=outcome_n,
            last_http_status=http_status,
            health_score=score,
            auto_disabled=False,
            status=StatusEnum.VALID.value,
        ).execute()
        return
    success = int(row.success_count or 0)
    fail = int(row.fail_count or 0)
    if outcome_n == "ok":
        success += 1
    else:
        fail += 1
    score = compute_health_score(success_count=success, fail_count=fail, last_outcome=outcome_n)
    updates = {
        "success_count": success,
        "fail_count": fail,
        "last_outcome": outcome_n,
        "health_score": score,
        "source": src,
    }
    if http_status is not None:
        updates["last_http_status"] = http_status
    TboxCrawlUrlHealth.update(**updates).where(TboxCrawlUrlHealth.id == row.id).execute()


def record_url_outcome_from_error(
    *,
    tenant_id: str,
    task_id: str,
    url: str,
    error_message: str,
    source: str = "seed",
) -> None:
    record_url_outcome(
        tenant_id=tenant_id,
        task_id=task_id,
        url=url,
        outcome=classify_outcome_from_message(error_message),
        source=source,
    )


def health_row_to_dict(row: TboxCrawlUrlHealth) -> dict:
    return {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "task_id": row.task_id,
        "url": row.url,
        "url_canonical": row.url_canonical,
        "source": row.source,
        "success_count": row.success_count,
        "fail_count": row.fail_count,
        "last_outcome": row.last_outcome,
        "last_http_status": row.last_http_status,
        "health_score": row.health_score,
        "auto_disabled": bool(row.auto_disabled),
        "create_time": row.create_time,
        "update_time": row.update_time,
    }


def list_task_url_health(
    task_id: str,
    *,
    tenant_id: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[int, list[TboxCrawlUrlHealth]]:
    q = TboxCrawlUrlHealth.select().where((TboxCrawlUrlHealth.task_id == task_id) & (TboxCrawlUrlHealth.status == StatusEnum.VALID.value))
    if tenant_id:
        q = q.where(TboxCrawlUrlHealth.tenant_id == tenant_id)
    total = q.count()
    rows = list(q.order_by(TboxCrawlUrlHealth.health_score.asc(), TboxCrawlUrlHealth.update_time.desc()).paginate(page, page_size))
    return total, rows
