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
import logging
import re
from urllib.parse import urlparse

from api.db import UserTenantRole
from api.db.db_models import Knowledgebase, TboxCrawlTask, UserTenant
from api.db.services.knowledgebase_service import KnowledgebaseService
from api.db.services.tbox_crawl_ingest_service import ingest_rss_seeds_into_kb, ingest_static_web_seeds_into_kb
from common.constants import StatusEnum
from common.misc_utils import get_uuid
from common.tbox_crawl_http_probe import probe_seed_urls
from common.tbox_crawl_last_error import format_crawl_worker_error

_LOG = logging.getLogger(__name__)

MAX_SEED_URLS = 100
MAX_URL_LEN = 2048
ALLOWED_SOURCE_TYPES = frozenset({"static_web", "rss"})
ALLOWED_RUN_STATES = frozenset({"draft", "ready", "paused"})
_CRON_TOKEN_RE = re.compile(r"^[\d\*/,\-]+$")


def tenant_ids_for_crawl(user_id: str, is_superuser: bool) -> list[str] | None:
    """Tenants where the user may use crawl.manage; None means superuser (no tenant scope)."""
    if is_superuser:
        return None
    q = UserTenant.select(UserTenant.tenant_id, UserTenant.role).where((UserTenant.user_id == user_id) & (UserTenant.status == StatusEnum.VALID.value)).dicts()
    out: list[str] = []
    for row in q:
        r = str(row.get("role") or "")
        if r in (UserTenantRole.OWNER.value, UserTenantRole.ADMIN.value, UserTenantRole.NORMAL.value):
            out.append(row["tenant_id"])
    return out


def kb_valid_for_tenant(dataset_id: str, tenant_id: str) -> bool:
    return Knowledgebase.select().where((Knowledgebase.id == dataset_id) & (Knowledgebase.tenant_id == tenant_id) & (Knowledgebase.status == StatusEnum.VALID.value)).exists()


def validate_seed_urls(urls) -> tuple[list[str] | None, str | None]:
    if not isinstance(urls, list):
        return None, "seed_urls must be a list"
    if len(urls) > MAX_SEED_URLS:
        return None, f"seed_urls must have at most {MAX_SEED_URLS} entries"
    cleaned: list[str] = []
    for u in urls:
        if not isinstance(u, str):
            return None, "each seed_urls entry must be a string"
        u = u.strip()
        if not u:
            return None, "empty URL in seed_urls"
        if len(u) > MAX_URL_LEN:
            return None, "URL too long"
        parsed = urlparse(u)
        if parsed.scheme not in ("http", "https"):
            return None, "only http and https URLs are allowed"
        if not parsed.netloc:
            return None, "invalid URL (missing host)"
        cleaned.append(u)
    return cleaned, None


def validate_schedule_cron(expr: str) -> str | None:
    """
    Validate a lightweight cron expression.

    Accepts empty string (manual mode) or 5 fields with digits/*/,-/ only.
    """
    s = (expr or "").strip()
    if not s:
        return None
    parts = [p for p in s.split(" ") if p]
    if len(parts) != 5:
        return "schedule_cron must have 5 fields (min hour day month weekday)"
    for p in parts:
        if not _CRON_TOKEN_RE.fullmatch(p):
            return "schedule_cron contains invalid characters"
    return None


def _expand_value_token(token: str, lo: int, hi: int) -> set[int]:
    if token == "*":
        return set(range(lo, hi + 1))
    if "/" in token:
        base, step_raw = token.split("/", 1)
        if not step_raw.isdigit():
            return set()
        step = int(step_raw)
        if step <= 0:
            return set()
        if base == "*":
            base_values = set(range(lo, hi + 1))
        else:
            base_values = _expand_value_token(base, lo, hi)
            if not base_values:
                return set()
        anchor = min(base_values)
        return {v for v in sorted(base_values) if (v - anchor) % step == 0}
    if "-" in token:
        a_raw, b_raw = token.split("-", 1)
        if not (a_raw.isdigit() and b_raw.isdigit()):
            return set()
        a, b = int(a_raw), int(b_raw)
        if a > b:
            return set()
        return {v for v in range(max(lo, a), min(hi, b) + 1)}
    if token.isdigit():
        n = int(token)
        if lo <= n <= hi:
            return {n}
    return set()


def _cron_field_matches(field_expr: str, value: int, lo: int, hi: int) -> bool:
    for token in field_expr.split(","):
        token = token.strip()
        if not token:
            continue
        if value in _expand_value_token(token, lo, hi):
            return True
    return False


def is_task_due_now(task: TboxCrawlTask, now: datetime | None = None) -> bool:
    """
    Decide whether a task should run in this worker tick.

    Rules:
    - requires status=valid, enabled=true, run_state=ready
    - empty schedule_cron => manual only (worker won't run it)
    - cron must match current minute
    - prevent duplicate run in the same minute via last_run_at
    """
    if task.status != StatusEnum.VALID.value:
        return False
    if not bool(task.enabled):
        return False
    if task.run_state != "ready":
        return False

    cron = (task.schedule_cron or "").strip()
    if not cron:
        return False
    if validate_schedule_cron(cron):
        return False

    now_dt = now or datetime.now()
    fields = [p for p in cron.split(" ") if p]
    if len(fields) != 5:
        return False
    minute, hour, day, month, weekday = fields
    # Python weekday: Mon=0..Sun=6. Cron weekday: Sun=0, Mon=1, ..., Sat=6.
    cron_weekday = (now_dt.weekday() + 1) % 7

    matched = (
        _cron_field_matches(minute, now_dt.minute, 0, 59)
        and _cron_field_matches(hour, now_dt.hour, 0, 23)
        and _cron_field_matches(day, now_dt.day, 1, 31)
        and _cron_field_matches(month, now_dt.month, 1, 12)
        and _cron_field_matches(weekday, cron_weekday, 0, 6)
    )
    if not matched:
        return False

    if task.last_run_at is not None:
        if (
            task.last_run_at.year == now_dt.year
            and task.last_run_at.month == now_dt.month
            and task.last_run_at.day == now_dt.day
            and task.last_run_at.hour == now_dt.hour
            and task.last_run_at.minute == now_dt.minute
        ):
            return False
    return True


def resolve_list_tenant_id(tenant_id: str | None, allowed: list[str] | None) -> tuple[str | None, str | None]:
    """
    Resolve tenant filter for listing.
    Returns (tenant_id_or_none, error). tenant_id None with allowed None = list all (superuser).
    """
    if allowed is None:
        return tenant_id, None
    if not allowed:
        return None, "no tenant eligible for crawl operations"
    if tenant_id:
        if tenant_id not in allowed:
            return None, "tenant_id is not permitted for this user"
        return tenant_id, None
    if len(allowed) == 1:
        return allowed[0], None
    return None, "tenant_id is required when the user belongs to multiple tenants"


def task_row_to_dict(t: TboxCrawlTask) -> dict:
    return {
        "id": t.id,
        "tenant_id": t.tenant_id,
        "dataset_id": t.dataset_id or None,
        "name": t.name,
        "source_type": t.source_type,
        "seed_urls": list(t.seed_urls or []),
        "schedule_cron": t.schedule_cron or "",
        "enabled": bool(t.enabled),
        "run_state": t.run_state,
        "last_run_at": t.last_run_at,
        "last_error": t.last_error or "",
        "extra_config": dict(t.extra_config or {}),
        "created_by": t.created_by,
        "create_time": t.create_time,
        "update_time": t.update_time,
        "status": t.status,
    }


def list_tasks(
    tenant_filter: str | None,
    allowed: list[str] | None,
    page: int,
    page_size: int,
    dataset_id: str | None = None,
) -> tuple[int, list[TboxCrawlTask]]:
    q = TboxCrawlTask.select().where(TboxCrawlTask.status == StatusEnum.VALID.value)
    if allowed is None:
        if tenant_filter:
            q = q.where(TboxCrawlTask.tenant_id == tenant_filter)
    else:
        q = q.where(TboxCrawlTask.tenant_id == tenant_filter)
    if dataset_id:
        q = q.where(TboxCrawlTask.dataset_id == dataset_id)
    total = int(q.count())
    rows = list(q.order_by(TboxCrawlTask.create_time.desc()).paginate(page, page_size))
    return total, rows


def get_task(task_id: str) -> TboxCrawlTask | None:
    row = TboxCrawlTask.get_or_none(TboxCrawlTask.id == task_id)
    if row is None or row.status != StatusEnum.VALID.value:
        return None
    return row


def user_may_access_task(t: TboxCrawlTask, allowed: list[str] | None) -> bool:
    if allowed is None:
        return True
    return t.tenant_id in allowed


def create_task(
    tenant_id: str,
    created_by: str,
    name: str,
    source_type: str,
    seed_urls: list[str],
    schedule_cron: str,
    enabled: bool,
    run_state: str,
    extra_config: dict,
    dataset_id: str | None,
) -> TboxCrawlTask:
    tid = get_uuid()
    TboxCrawlTask.insert(
        id=tid,
        tenant_id=tenant_id,
        dataset_id=dataset_id or None,
        name=name,
        source_type=source_type,
        seed_urls=seed_urls,
        schedule_cron=schedule_cron or "",
        enabled=enabled,
        run_state=run_state,
        extra_config=extra_config or {},
        created_by=created_by,
        status=StatusEnum.VALID.value,
    ).execute()
    return TboxCrawlTask.get_by_id(tid)


def update_task_fields(t: TboxCrawlTask, fields: dict) -> TboxCrawlTask:
    for key, val in fields.items():
        setattr(t, key, val)
    t.save()
    return t


def soft_delete_task(t: TboxCrawlTask) -> None:
    t.status = StatusEnum.INVALID.value
    t.save()


def list_tasks_for_worker_poll(limit: int = 20) -> list[TboxCrawlTask]:
    """
    Tasks considered for a worker tick (skeleton).

    Candidate rows only. Final due decision is in `is_task_due_now`.
    """
    lim = max(1, min(int(limit), 200))
    return list(
        TboxCrawlTask.select()
        .where(
            (TboxCrawlTask.status == StatusEnum.VALID.value)
            & (TboxCrawlTask.enabled == True)  # noqa: E712
            & (TboxCrawlTask.run_state == "ready")
        )
        .order_by(TboxCrawlTask.update_time.asc())
        .limit(lim)
    )


def record_worker_tick(task_id: str, *, ok: bool, message: str = "") -> None:
    """Update last_run_at and last_error after a worker attempt (no-op if task missing)."""
    row = TboxCrawlTask.get_or_none((TboxCrawlTask.id == task_id) & (TboxCrawlTask.status == StatusEnum.VALID.value))
    if row is None:
        return
    row.last_run_at = datetime.now()
    row.last_error = (message or "")[:65000] if not ok else ""
    row.save()


def execute_crawl_task_stub_tick(task_id: str) -> None:
    """
    One crawl execution step: optional HTTP probe, then optional KB ingest.

    Ingest runs when ``dataset_id`` is set (unless ``extra_config.tbox_skip_ingest``):
    ``static_web`` uses SSRF-safe GET + upload; ``rss`` uses ``RSSConnector`` + per-entry ``.txt`` upload.
    ``robots.txt`` is consulted via ``common/tbox_crawl_robots.py`` unless ``extra_config.tbox_skip_robots_check``.
    Transient HTTP retry whitelist: ``extra_config.tbox_crawl_retry_extra_statuses`` is passed to
    ``common.tbox_crawl_ssrf_fetch.effective_retry_statuses`` for probe + ingest (with process env overrides).

    Used by the background worker and by POST /v1/tbox/crawl/tasks/<id>/run.
    Raises ValueError if task missing; RuntimeError if extra_config.worker_stub_fail is set.
    """
    row = get_task(task_id)
    if row is None:
        raise ValueError("crawl task not found or deleted")
    extra = dict(row.extra_config or {})
    if extra.get("worker_stub_fail"):
        raise RuntimeError("worker_stub_fail is set on task extra_config")

    seeds = list(row.seed_urls or [])
    skip_robots = bool(extra.get("tbox_skip_robots_check"))

    if not extra.get("tbox_skip_http_probe"):
        ok, msg = probe_seed_urls(seeds, skip_robots=skip_robots, extra_config=extra)
        if not ok:
            record_worker_tick(task_id, ok=False, message=format_crawl_worker_error("HTTP_PROBE", msg))
            return

    if extra.get("tbox_skip_ingest"):
        record_worker_tick(task_id, ok=True, message="")
        return

    ds = row.dataset_id
    if not ds or not str(ds).strip():
        record_worker_tick(task_id, ok=True, message="")
        return

    if not kb_valid_for_tenant(str(ds), row.tenant_id):
        record_worker_tick(
            task_id,
            ok=False,
            message=format_crawl_worker_error("DATASET_TENANT", "dataset_id is not valid for this task tenant"),
        )
        return

    ok_kb, kb = KnowledgebaseService.get_by_id(ds)
    if not ok_kb or kb is None:
        record_worker_tick(task_id, ok=False, message=format_crawl_worker_error("KB_NOT_FOUND", "knowledge base not found"))
        return

    st = str(row.source_type or "static_web")
    if st == "static_web":
        ok_i, msg_i = ingest_static_web_seeds_into_kb(kb, row.tenant_id, seeds, skip_robots=skip_robots, extra_config=extra)
    elif st == "rss":
        ok_i, msg_i = ingest_rss_seeds_into_kb(kb, row.tenant_id, seeds, skip_robots=skip_robots, extra_config=extra)
    else:
        _LOG.info("tbox_crawl_tick: unknown source_type=%s task_id=%s", row.source_type, task_id)
        ok_i, msg_i = True, ""

    if ok_i:
        record_worker_tick(task_id, ok=True, message="")
    elif st == "rss":
        record_worker_tick(task_id, ok=False, message=format_crawl_worker_error("INGEST_RSS", msg_i))
    else:
        record_worker_tick(task_id, ok=False, message=format_crawl_worker_error("INGEST_STATIC", msg_i))
