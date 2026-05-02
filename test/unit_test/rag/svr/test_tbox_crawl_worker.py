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
