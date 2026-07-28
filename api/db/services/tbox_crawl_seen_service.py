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

from datetime import datetime

from api.db.db_models import TboxCrawlSeen
from common.misc_utils import get_uuid
from common.tbox_crawl_dedup import url_canonical_hash


def url_seen(dataset_id: str, url_canonical: str) -> bool:
    if not dataset_id or not url_canonical:
        return False
    uhash = url_canonical_hash(url_canonical)
    return TboxCrawlSeen.select().where((TboxCrawlSeen.dataset_id == dataset_id) & (TboxCrawlSeen.url_canonical_hash == uhash)).exists()


def content_seen(dataset_id: str, content_sha256: str) -> bool:
    if not dataset_id or not content_sha256:
        return False
    return TboxCrawlSeen.select().where((TboxCrawlSeen.dataset_id == dataset_id) & (TboxCrawlSeen.content_sha256 == content_sha256)).exists()


def record_seen(
    dataset_id: str,
    url_canonical: str,
    *,
    content_sha256: str | None,
    source: str,
) -> None:
    if not dataset_id or not url_canonical:
        return
    now = datetime.now()
    uhash = url_canonical_hash(url_canonical)
    row = TboxCrawlSeen.get_or_none((TboxCrawlSeen.dataset_id == dataset_id) & (TboxCrawlSeen.url_canonical_hash == uhash))
    if row is None:
        TboxCrawlSeen.insert(
            id=get_uuid(),
            dataset_id=dataset_id,
            url_canonical=url_canonical[:2048],
            url_canonical_hash=uhash,
            content_sha256=content_sha256,
            source=(source or "crawl")[:16],
            first_seen_at=now,
            last_seen_at=now,
        ).execute()
        return
    updates: dict = {"last_seen_at": now}
    if content_sha256 and row.content_sha256 != content_sha256:
        updates["content_sha256"] = content_sha256
    TboxCrawlSeen.update(**updates).where(TboxCrawlSeen.id == row.id).execute()
