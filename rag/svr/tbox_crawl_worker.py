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
"""
TBOX crawl worker (skeleton process).

Polls task candidates and applies `schedule_cron` due check before ``execute_crawl_task_stub_tick``
(probe, optional SSRF fetch + KB document upload + parse queue; see ``docs/TBOX_API_BOUNDARY.md`` §1.3).

Run (dev, from repo root):
  export PYTHONPATH=$(pwd)
  python rag/svr/tbox_crawl_worker.py

Docker: set ``ENABLE_TBOX_CRAWL_WORKER=1`` or pass ``--enable-tbox-crawl-worker`` to entrypoint.

Env:
  ``TBOX_CRAWL_WORKER_INTERVAL`` — sleep seconds between polls (default 30).
  ``TBOX_CRAWL_WORKER_POLL_LIMIT`` — max tasks per poll (default 20).
"""

from __future__ import annotations

from datetime import datetime
import logging
import os
import signal
import sys
import threading
import uuid

import faulthandler
from valkey.lock import Lock

from api.db.db_models import TboxCrawlTask, close_connection, init_database_tables as init_web_db
from api.db.services import tbox_crawl_task_service as crawl_svc
from common import settings
from common.tbox_crawl_last_error import format_crawl_worker_error
from common.config_utils import show_configs
from common.log_utils import init_root_logger
from common.versions import get_ragflow_version
from rag.utils.redis_conn import REDIS_CONN

stop_event = threading.Event()

TBOX_CRAWL_WORKER_INTERVAL = int(os.environ.get("TBOX_CRAWL_WORKER_INTERVAL", "30"))
TBOX_CRAWL_WORKER_POLL_LIMIT = int(os.environ.get("TBOX_CRAWL_WORKER_POLL_LIMIT", "20"))


def signal_handler(sig, frame):
    logging.info("tbox_crawl_worker: shutdown signal received")
    stop_event.set()


def _redis_client():
    try:
        return REDIS_CONN.REDIS
    except Exception:
        return None


def process_task_stub(t: TboxCrawlTask, *, now: datetime) -> None:
    """Placeholder tick; shared logic with HTTP POST .../crawl/tasks/<id>/run."""
    client = _redis_client()
    lock: Lock | None = None
    token = uuid.uuid4().hex
    if client is not None:
        try:
            lock = Lock(client, f"tbox_crawl_tick:{t.id}", timeout=180, blocking=False)
            if not lock.acquire(token=token):
                logging.debug("tbox_crawl_worker: skip task_id=%s (redis lock held)", t.id)
                return
        except Exception:
            logging.warning("tbox_crawl_worker: redis lock unavailable; running without lock", exc_info=True)
            lock = None

    try:
        fresh = crawl_svc.get_task(t.id)
        if fresh is None or not crawl_svc.is_task_due_now(fresh, now=now):
            return
        logging.info(
            "tbox_crawl_worker tick task_id=%s tenant_id=%s name=%r seeds=%s dataset_id=%s",
            fresh.id,
            fresh.tenant_id,
            fresh.name,
            len(fresh.seed_urls or []),
            fresh.dataset_id or "",
        )
        crawl_svc.execute_crawl_task_stub_tick(fresh.id)
    finally:
        if lock is not None:
            try:
                lock.release()
            except Exception:
                logging.debug("tbox_crawl_worker: lock release skipped", exc_info=True)


def run_once() -> None:
    try:
        rows = crawl_svc.list_tasks_for_worker_poll(limit=TBOX_CRAWL_WORKER_POLL_LIMIT)
        if not rows:
            logging.debug("tbox_crawl_worker: no eligible tasks")
            return
        now = datetime.now()
        due_rows = [t for t in rows if crawl_svc.is_task_due_now(t, now=now)]
        if not due_rows:
            logging.debug("tbox_crawl_worker: %s candidate(s), none due this minute", len(rows))
            return
        logging.info("tbox_crawl_worker: %s due task(s) from %s candidate(s)", len(due_rows), len(rows))
        for t in due_rows:
            if stop_event.is_set():
                break
            try:
                process_task_stub(t, now=now)
            except Exception as e:  # noqa: BLE001
                logging.exception("tbox_crawl_worker task failed id=%s", t.id)
                crawl_svc.record_worker_tick(
                    t.id,
                    ok=False,
                    message=format_crawl_worker_error("WORKER_EXCEPTION", str(e)[:1800]),
                )
    finally:
        try:
            close_connection()
        except Exception:
            logging.exception("tbox_crawl_worker close_connection")


def main() -> None:
    logging.info(
        "TBOX crawl worker starting (interval=%ss limit=%s)",
        TBOX_CRAWL_WORKER_INTERVAL,
        TBOX_CRAWL_WORKER_POLL_LIMIT,
    )
    show_configs()
    settings.init_settings()
    init_web_db()

    if sys.platform != "win32":
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

    logging.info("tbox_crawl_worker: RAGFlow %s", get_ragflow_version())

    while not stop_event.is_set():
        try:
            run_once()
        except Exception:
            logging.exception("tbox_crawl_worker poll cycle failed")
        stop_event.wait(max(5, TBOX_CRAWL_WORKER_INTERVAL))

    logging.info("tbox_crawl_worker: exited cleanly")


if __name__ == "__main__":
    faulthandler.enable()
    init_root_logger("tbox_crawl_worker")
    main()
