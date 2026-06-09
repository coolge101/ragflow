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
import os
from typing import Any

from api.db.db_models import TboxCrawlSelfHealAudit, TboxCrawlTask, TboxCrawlUrlHealth
from api.db.services import tbox_crawl_source_catalog_service as catalog_svc
from common.constants import StatusEnum
from common.misc_utils import get_uuid
from common.tbox_crawl_dedup import canonicalize_url, url_canonical_hash
from common.tbox_crawl_self_heal import (
    CATALOG_MIN_HEALTH_SCORE,
    DEFAULT_CATALOG_HEALTH_SCORE,
    UrlHealthSnapshot,
    apply_seed_heal_plan,
    compute_seed_heal_plan,
    parse_self_heal_config,
)
from common.time_utils import current_timestamp

_LOG = logging.getLogger(__name__)

SYSTEM_ACTOR = "system:self_heal"


def self_heal_interval_sec() -> int:
    raw = os.environ.get("TBOX_CRAWL_SELF_HEAL_INTERVAL_SEC", "300")
    try:
        return max(0, int(raw))
    except ValueError:
        return 300


def _get_task_row(task_id: str) -> TboxCrawlTask | None:
    row = TboxCrawlTask.get_or_none(TboxCrawlTask.id == task_id)
    if row is None or row.status != StatusEnum.VALID.value:
        return None
    return row


def audit_row_to_dict(row: TboxCrawlSelfHealAudit) -> dict:
    return {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "task_id": row.task_id,
        "action": row.action,
        "before_json": row.before_json or {},
        "after_json": row.after_json or {},
        "reason": row.reason or "",
        "created_by": row.created_by,
        "create_time": row.create_time,
        "update_time": row.update_time,
    }


def list_heal_log(
    task_id: str,
    *,
    tenant_id: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[int, list[TboxCrawlSelfHealAudit]]:
    q = TboxCrawlSelfHealAudit.select().where((TboxCrawlSelfHealAudit.task_id == task_id) & (TboxCrawlSelfHealAudit.status == StatusEnum.VALID.value))
    if tenant_id:
        q = q.where(TboxCrawlSelfHealAudit.tenant_id == tenant_id)
    total = q.count()
    rows = list(q.order_by(TboxCrawlSelfHealAudit.create_time.desc()).paginate(page, page_size))
    return total, rows


def _recent_self_heal(task_id: str, interval_sec: int) -> bool:
    if interval_sec <= 0:
        return False
    row = (
        TboxCrawlSelfHealAudit.select()
        .where((TboxCrawlSelfHealAudit.task_id == task_id) & (TboxCrawlSelfHealAudit.status == StatusEnum.VALID.value) & (TboxCrawlSelfHealAudit.action.in_(["prune_seed", "import_catalog"])))
        .order_by(TboxCrawlSelfHealAudit.create_time.desc())
        .first()
    )
    if row is None or not row.create_time:
        return False
    age_ms = current_timestamp() - int(row.create_time)
    return age_ms < interval_sec * 1000


def _load_health_snapshots(task_id: str, tenant_id: str) -> dict[str, UrlHealthSnapshot]:
    rows = list(TboxCrawlUrlHealth.select().where((TboxCrawlUrlHealth.task_id == task_id) & (TboxCrawlUrlHealth.tenant_id == tenant_id) & (TboxCrawlUrlHealth.status == StatusEnum.VALID.value)))
    out: dict[str, UrlHealthSnapshot] = {}
    for row in rows:
        canon = (row.url_canonical or "").strip()
        if not canon:
            continue
        out[canon] = UrlHealthSnapshot(
            url=row.url,
            url_canonical=canon,
            health_score=int(row.health_score or 0),
            fail_count=int(row.fail_count or 0),
            last_outcome=str(row.last_outcome or "unknown"),
        )
    return out


def _catalog_health_score(tenant_id: str, task_id: str, url: str) -> int:
    canon = canonicalize_url(url)
    if not canon:
        return 0
    uhash = url_canonical_hash(canon)
    row = (
        TboxCrawlUrlHealth.select()
        .where((TboxCrawlUrlHealth.tenant_id == tenant_id) & (TboxCrawlUrlHealth.url_canonical_hash == uhash) & (TboxCrawlUrlHealth.status == StatusEnum.VALID.value))
        .order_by(TboxCrawlUrlHealth.health_score.desc())
        .first()
    )
    if row is None:
        return DEFAULT_CATALOG_HEALTH_SCORE
    return int(row.health_score or 0)


def _healthy_catalog_urls(tenant_id: str, topic: str, task_id: str, *, min_score: int) -> list[str]:
    _total, rows = catalog_svc.list_sources(tenant_id, topic=topic, page=1, page_size=500)
    good: list[str] = []
    for row in rows:
        if not row.enabled:
            continue
        score = _catalog_health_score(tenant_id, task_id, row.url)
        if score >= min_score:
            good.append(row.url)
    return good


def _write_audit(
    *,
    tenant_id: str,
    task_id: str,
    action: str,
    before_json: dict,
    after_json: dict,
    reason: str,
) -> None:
    TboxCrawlSelfHealAudit.insert(
        id=get_uuid(),
        tenant_id=tenant_id,
        task_id=task_id,
        action=action,
        before_json=before_json,
        after_json=after_json,
        reason=(reason or "")[:65000],
        created_by=SYSTEM_ACTOR,
        status=StatusEnum.VALID.value,
    ).execute()


def _maybe_add_discovered_to_catalog(
    task_row: Any,
    *,
    ingested_urls: list[str],
    discovered_canonical: set[str],
    topic: str | None,
) -> list[str]:
    if not topic or not ingested_urls:
        return []
    added: list[str] = []
    tenant_id = task_row.tenant_id
    created_by = task_row.created_by or SYSTEM_ACTOR
    for url in ingested_urls:
        canon = canonicalize_url(url)
        if not canon or canon not in discovered_canonical:
            continue
        uhash = url_canonical_hash(canon)
        existing = catalog_svc.list_sources(tenant_id, topic=topic, page=1, page_size=500)[1]
        if any(r.url_canonical_hash == uhash for r in existing):
            continue
        try:
            catalog_svc.create_source(
                tenant_id=tenant_id,
                created_by=created_by,
                topic=topic,
                label=canon[:256],
                url=url,
                enabled=True,
            )
            added.append(url)
            _write_audit(
                tenant_id=tenant_id,
                task_id=task_row.id,
                action="add_catalog_source",
                before_json={"url": url, "topic": topic},
                after_json={"url": url, "topic": topic, "enabled": True},
                reason=f"discover ingest ok → catalog topic={topic}",
            )
        except Exception as exc:
            _LOG.debug("self_heal catalog add skipped url=%s err=%s", url, exc)
    return added


def run_self_heal(
    task_id: str,
    *,
    ingested_urls: list[str] | None = None,
    discovered_canonical: set[str] | None = None,
) -> bool:
    """
    Apply seed self-heal after a worker tick (no user confirmation).

    Returns True when task seed_urls or catalog was mutated.
    """
    row = _get_task_row(task_id)
    if row is None:
        return False

    extra = dict(row.extra_config or {})
    cfg = parse_self_heal_config(extra, task_name=str(row.name or ""))
    if not cfg.enabled:
        return False

    interval = self_heal_interval_sec()

    changed = False
    topic = cfg.catalog_topic
    if topic:
        added = _maybe_add_discovered_to_catalog(
            row,
            ingested_urls=list(ingested_urls or []),
            discovered_canonical=discovered_canonical or set(),
            topic=topic,
        )
        if added:
            changed = True

    if _recent_self_heal(task_id, interval):
        _LOG.debug("self_heal seed PATCH skipped task_id=%s (interval %ss)", task_id, interval)
        return changed

    seeds_before = list(row.seed_urls or [])
    if not cfg.auto_prune_seeds and not cfg.auto_import_catalog:
        return changed

    health_map = _load_health_snapshots(task_id, row.tenant_id)
    catalog_good: list[str] = []
    if cfg.auto_import_catalog and topic:
        catalog_good = _healthy_catalog_urls(
            row.tenant_id,
            topic,
            task_id,
            min_score=CATALOG_MIN_HEALTH_SCORE,
        )

    plan = compute_seed_heal_plan(
        seeds_before,
        health_map,
        config=cfg,
        catalog_healthy_urls=catalog_good,
    )
    if not plan.prune_urls and not plan.import_catalog:
        return changed

    seeds_after = apply_seed_heal_plan(seeds_before, plan)
    if seeds_after == seeds_before:
        return changed

    before_snap = {"seed_urls": seeds_before}
    after_snap = {"seed_urls": seeds_after}
    reason = "; ".join(plan.reasons)[:65000]

    if plan.import_catalog and plan.catalog_urls:
        _write_audit(
            tenant_id=row.tenant_id,
            task_id=task_id,
            action="import_catalog",
            before_json=before_snap,
            after_json=after_snap,
            reason=reason,
        )

    if plan.prune_urls:
        _write_audit(
            tenant_id=row.tenant_id,
            task_id=task_id,
            action="prune_seed",
            before_json=before_snap,
            after_json=after_snap,
            reason=reason,
        )

    row.seed_urls = seeds_after
    row.save()
    _LOG.info(
        "self_heal task_id=%s pruned=%s import_catalog=%s seeds %s→%s",
        task_id,
        len(plan.prune_urls),
        plan.import_catalog,
        len(seeds_before),
        len(seeds_after),
    )
    return True
