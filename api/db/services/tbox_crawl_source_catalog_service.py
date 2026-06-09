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
from urllib.parse import urlparse

from api.db.db_models import TboxCrawlSourceCatalog, TboxCrawlTask
from common.constants import StatusEnum
from common.misc_utils import get_uuid
from common.tbox_crawl_dedup import canonicalize_url, url_canonical_hash

ALLOWED_TOPICS = frozenset({"regulations", "tech", "market", "product"})


def _normalize_host(url: str) -> str:
    try:
        return (urlparse(url.strip()).hostname or "").lower()
    except Exception:
        return ""


def catalog_row_to_dict(row: TboxCrawlSourceCatalog) -> dict:
    return {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "topic": row.topic,
        "label": row.label,
        "url": row.url,
        "domain": row.domain,
        "enabled": bool(row.enabled),
        "created_by": row.created_by,
        "create_time": row.create_time,
        "update_time": row.update_time,
    }


def list_sources(
    tenant_id: str,
    *,
    topic: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[int, list[TboxCrawlSourceCatalog]]:
    q = TboxCrawlSourceCatalog.select().where((TboxCrawlSourceCatalog.tenant_id == tenant_id) & (TboxCrawlSourceCatalog.status == StatusEnum.VALID.value))
    if topic:
        q = q.where(TboxCrawlSourceCatalog.topic == topic)
    total = q.count()
    rows = list(q.order_by(TboxCrawlSourceCatalog.update_time.desc()).paginate(page, page_size))
    return total, rows


def create_source(
    *,
    tenant_id: str,
    created_by: str,
    topic: str,
    label: str,
    url: str,
    enabled: bool = True,
) -> TboxCrawlSourceCatalog:
    topic = (topic or "").strip().lower()
    if topic not in ALLOWED_TOPICS:
        raise ValueError("invalid topic")
    u = (url or "").strip()
    if not u:
        raise ValueError("url is required")
    canon = canonicalize_url(u)
    if not canon:
        raise ValueError("invalid url")
    uhash = url_canonical_hash(canon)
    sid = get_uuid()
    TboxCrawlSourceCatalog.insert(
        id=sid,
        tenant_id=tenant_id,
        topic=topic,
        label=(label or "").strip() or u,
        url=u,
        url_canonical=canon,
        url_canonical_hash=uhash,
        domain=_normalize_host(u),
        enabled=enabled,
        created_by=created_by,
        status=StatusEnum.VALID.value,
    ).execute()
    return TboxCrawlSourceCatalog.get_by_id(sid)


def get_source(source_id: str) -> TboxCrawlSourceCatalog | None:
    row = TboxCrawlSourceCatalog.get_or_none(TboxCrawlSourceCatalog.id == source_id)
    if row is None or str(row.status) != StatusEnum.VALID.value:
        return None
    return row


def update_source(row: TboxCrawlSourceCatalog, fields: dict) -> TboxCrawlSourceCatalog:
    for key, val in fields.items():
        if key == "url" and val:
            u = str(val).strip()
            canon = canonicalize_url(u)
            if not canon:
                raise ValueError("invalid url")
            setattr(row, "url", u)
            setattr(row, "url_canonical", canon)
            setattr(row, "url_canonical_hash", url_canonical_hash(canon))
            setattr(row, "domain", _normalize_host(u))
        elif key == "topic" and val:
            topic = str(val).strip().lower()
            if topic not in ALLOWED_TOPICS:
                raise ValueError("invalid topic")
            setattr(row, "topic", topic)
        elif hasattr(row, key):
            setattr(row, key, val)
    row.save()
    return row


def soft_delete_source(row: TboxCrawlSourceCatalog) -> None:
    row.status = StatusEnum.INVALID.value
    row.save()


def import_sources_to_task(
    task: TboxCrawlTask,
    *,
    topic: str,
    replace: bool = False,
) -> TboxCrawlTask:
    topic = (topic or "").strip().lower()
    if topic not in ALLOWED_TOPICS:
        raise ValueError("invalid topic")
    _total, rows = list_sources(task.tenant_id, topic=topic, page=1, page_size=500)
    urls = [r.url for r in rows if r.enabled]
    if replace:
        task.seed_urls = urls
    else:
        from common.tbox_crawl_dedup import merge_url_lists

        task.seed_urls = merge_url_lists(list(task.seed_urls or []), urls)
    task.update_time = datetime.now()
    task.save()
    return task
