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

import signal
import warnings
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

# Importing the worker pulls the same dependency chain as other TBOX tests (xgboost → pkg_resources).
warnings.filterwarnings(
    "ignore",
    message="pkg_resources is deprecated as an API.*",
    category=UserWarning,
)

from unittest.mock import patch

import pytest

import rag.svr.tbox_crawl_worker as worker


@pytest.fixture(autouse=True)
def reset_stop_event():
    worker.stop_event.clear()
    yield
    worker.stop_event.clear()


def test_signal_handler_sets_stop_event():
    assert not worker.stop_event.is_set()
    worker.signal_handler(signal.SIGINT, None)
    assert worker.stop_event.is_set()


def test_run_once_no_tasks_skips_processing():
    with patch.object(worker.crawl_svc, "list_tasks_for_worker_poll", return_value=[]) as mock_list:
        with patch("rag.svr.tbox_crawl_worker.close_connection") as mock_close:
            worker.run_once()
    mock_list.assert_called_once_with(limit=worker.TBOX_CRAWL_WORKER_POLL_LIMIT)
    mock_close.assert_called_once()


def test_run_once_candidates_none_due_skips_process_task_stub():
    row = SimpleNamespace(id="t1")
    with patch.object(worker.crawl_svc, "list_tasks_for_worker_poll", return_value=[row]):
        with patch.object(worker.crawl_svc, "is_task_due_now", return_value=False):
            with patch.object(worker, "process_task_stub") as proc:
                with patch("rag.svr.tbox_crawl_worker.close_connection"):
                    worker.run_once()
    proc.assert_not_called()


def test_run_once_calls_process_task_stub_for_due_rows():
    row = SimpleNamespace(id="t-due")
    fixed_now = datetime(2026, 5, 2, 12, 0, 0)
    with patch.object(worker.crawl_svc, "list_tasks_for_worker_poll", return_value=[row]):
        with patch.object(worker.crawl_svc, "is_task_due_now", return_value=True):
            with patch.object(worker, "process_task_stub") as proc:
                with patch("rag.svr.tbox_crawl_worker.datetime") as mock_dt:
                    mock_dt.now.return_value = fixed_now
                    with patch("rag.svr.tbox_crawl_worker.close_connection"):
                        worker.run_once()
    proc.assert_called_once_with(row, now=fixed_now)


def test_run_once_process_task_stub_failure_records_worker_tick():
    row = SimpleNamespace(id="t-fail")
    with patch.object(worker.crawl_svc, "list_tasks_for_worker_poll", return_value=[row]):
        with patch.object(worker.crawl_svc, "is_task_due_now", return_value=True):
            with patch.object(worker, "process_task_stub", side_effect=RuntimeError("tick failed")):
                with patch.object(worker.crawl_svc, "record_worker_tick") as rec:
                    with patch("rag.svr.tbox_crawl_worker.close_connection"):
                        worker.run_once()
    rec.assert_called_once()
    assert rec.call_args[0][0] == "t-fail"
    assert rec.call_args[1]["ok"] is False
    assert "WORKER_EXCEPTION" in rec.call_args[1]["message"]


def test_run_once_respects_stop_event_between_due_tasks():
    rows = [SimpleNamespace(id="a"), SimpleNamespace(id="b")]
    with patch.object(worker.crawl_svc, "list_tasks_for_worker_poll", return_value=rows):
        with patch.object(worker.crawl_svc, "is_task_due_now", return_value=True):

            def proc_side_effect(*_a, **_k):
                worker.stop_event.set()

            with patch.object(worker, "process_task_stub", side_effect=proc_side_effect) as proc:
                with patch("rag.svr.tbox_crawl_worker.close_connection"):
                    worker.run_once()
    assert proc.call_count == 1


def test_process_task_stub_no_redis_executes_tick_when_due():
    row = SimpleNamespace(id="tid")
    fresh = SimpleNamespace(id="tid", tenant_id="tn", name="n", seed_urls=["https://x"], dataset_id="")
    now = datetime(2026, 5, 2, 12, 0, 0)
    with patch.object(worker, "_redis_client", return_value=None):
        with patch.object(worker.crawl_svc, "get_task", return_value=fresh):
            with patch.object(worker.crawl_svc, "is_task_due_now", return_value=True):
                with patch.object(worker.crawl_svc, "execute_crawl_task_stub_tick") as tick:
                    worker.process_task_stub(row, now=now)
    tick.assert_called_once_with("tid")


def test_process_task_stub_get_task_none_skips_tick():
    row = SimpleNamespace(id="gone")
    now = datetime(2026, 5, 2, 12, 0, 0)
    with patch.object(worker, "_redis_client", return_value=None):
        with patch.object(worker.crawl_svc, "get_task", return_value=None):
            with patch.object(worker.crawl_svc, "execute_crawl_task_stub_tick") as tick:
                worker.process_task_stub(row, now=now)
    tick.assert_not_called()


def test_process_task_stub_not_due_after_refresh_skips_tick():
    row = SimpleNamespace(id="tid")
    fresh = SimpleNamespace(id="tid", tenant_id="tn", name="n", seed_urls=[], dataset_id="")
    now = datetime(2026, 5, 2, 12, 0, 0)
    with patch.object(worker, "_redis_client", return_value=None):
        with patch.object(worker.crawl_svc, "get_task", return_value=fresh):
            with patch.object(worker.crawl_svc, "is_task_due_now", return_value=False):
                with patch.object(worker.crawl_svc, "execute_crawl_task_stub_tick") as tick:
                    worker.process_task_stub(row, now=now)
    tick.assert_not_called()


def test_process_task_stub_lock_not_acquired_skips_tick():
    row = SimpleNamespace(id="locked")
    now = datetime(2026, 5, 2, 12, 0, 0)
    fake_lock = MagicMock()
    fake_lock.acquire.return_value = False
    with patch.object(worker, "_redis_client", return_value=object()):
        with patch("rag.svr.tbox_crawl_worker.Lock", return_value=fake_lock):
            with patch.object(worker.crawl_svc, "execute_crawl_task_stub_tick") as tick:
                worker.process_task_stub(row, now=now)
    tick.assert_not_called()
