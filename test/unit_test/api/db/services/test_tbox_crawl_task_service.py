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

import warnings

# xgboost (via rag/llm import chain) emits pkg_resources deprecation; pytest treats UserWarning as error.
warnings.filterwarnings(
    "ignore",
    message="pkg_resources is deprecated as an API.*",
    category=UserWarning,
)

import unittest
from datetime import datetime
from types import SimpleNamespace

from api.db.services.tbox_crawl_task_service import (
    _cron_field_matches,
    _expand_value_token,
    is_task_due_now,
    resolve_list_tenant_id,
    task_row_to_dict,
    validate_schedule_cron,
    validate_seed_urls,
)


class TestValidateSeedUrls(unittest.TestCase):
    def test_accepts_https(self):
        cleaned, err = validate_seed_urls([" https://a.example/x "])
        self.assertIsNone(err)
        self.assertEqual(cleaned, ["https://a.example/x"])

    def test_rejects_non_list(self):
        cleaned, err = validate_seed_urls("not-a-list")
        self.assertIsNone(cleaned)
        self.assertIn("list", err or "")

    def test_rejects_bad_scheme(self):
        cleaned, err = validate_seed_urls(["ftp://x.com/"])
        self.assertIsNone(cleaned)
        self.assertIsNotNone(err)

    def test_rejects_empty_entry(self):
        cleaned, err = validate_seed_urls(["https://ok.example/", "  "])
        self.assertIsNone(cleaned)
        self.assertIsNotNone(err)


class TestValidateScheduleCron(unittest.TestCase):
    def test_empty_ok(self):
        self.assertIsNone(validate_schedule_cron(""))

    def test_five_field_star_ok(self):
        self.assertIsNone(validate_schedule_cron("0 * * * *"))

    def test_wrong_field_count(self):
        err = validate_schedule_cron("0 * * *")
        self.assertIsNotNone(err)

    def test_invalid_character(self):
        err = validate_schedule_cron("0 9 ? * *")
        self.assertIsNotNone(err)


class TestCronExpand(unittest.TestCase):
    def test_star_all_minutes(self):
        s = _expand_value_token("*", 0, 59)
        self.assertEqual(len(s), 60)
        self.assertIn(0, s)
        self.assertIn(59, s)

    def test_step_from_star(self):
        s = _expand_value_token("*/15", 0, 59)
        self.assertEqual(s, {0, 15, 30, 45})

    def test_range(self):
        s = _expand_value_token("2-4", 0, 59)
        self.assertEqual(s, {2, 3, 4})

    def test_cron_field_comma(self):
        self.assertTrue(_cron_field_matches("0,30", 30, 0, 59))
        self.assertFalse(_cron_field_matches("0,30", 15, 0, 59))


class TestResolveListTenantId(unittest.TestCase):
    def test_superuser_passthrough(self):
        tid, err = resolve_list_tenant_id("t1", None)
        self.assertIsNone(err)
        self.assertEqual(tid, "t1")

    def test_empty_allowed(self):
        tid, err = resolve_list_tenant_id(None, [])
        self.assertIsNone(tid)
        self.assertIsNotNone(err)

    def test_single_tenant_default(self):
        tid, err = resolve_list_tenant_id(None, ["only-one"])
        self.assertIsNone(err)
        self.assertEqual(tid, "only-one")

    def test_multi_requires_tenant(self):
        tid, err = resolve_list_tenant_id(None, ["a", "b"])
        self.assertIsNone(tid)
        self.assertIsNotNone(err)


class TestIsTaskDueNow(unittest.TestCase):
    def _task(self, **kwargs):
        defaults = dict(
            status="1",
            enabled=True,
            run_state="ready",
            schedule_cron="30 14 * * *",
            last_run_at=None,
        )
        defaults.update(kwargs)
        return SimpleNamespace(**defaults)

    def test_manual_no_cron(self):
        t = self._task(schedule_cron="")
        self.assertFalse(is_task_due_now(t, now=datetime(2026, 6, 15, 14, 30)))

    def test_due_when_cron_matches(self):
        t = self._task()
        self.assertTrue(is_task_due_now(t, now=datetime(2026, 6, 15, 14, 30)))

    def test_same_minute_not_due_again(self):
        t = self._task(last_run_at=datetime(2026, 6, 15, 14, 30))
        self.assertFalse(is_task_due_now(t, now=datetime(2026, 6, 15, 14, 30)))

    def test_invalid_cron_not_due(self):
        t = self._task(schedule_cron="not five fields")
        self.assertFalse(is_task_due_now(t, now=datetime(2026, 6, 15, 14, 30)))

    def test_disabled(self):
        t = self._task(enabled=False)
        self.assertFalse(is_task_due_now(t, now=datetime(2026, 6, 15, 14, 30)))


class TestTaskRowToDict(unittest.TestCase):
    def test_shapes(self):
        t = SimpleNamespace(
            id="tid",
            tenant_id="ten",
            dataset_id=None,
            name="n",
            source_type="static_web",
            seed_urls=["https://x.com"],
            schedule_cron="0 1 * * *",
            enabled=True,
            run_state="ready",
            last_run_at=None,
            last_error="",
            extra_config={"k": 1},
            created_by="u1",
            create_time=1,
            update_time=2,
            status="1",
        )
        d = task_row_to_dict(t)
        self.assertEqual(d["id"], "tid")
        self.assertIsNone(d["dataset_id"])
        self.assertEqual(d["seed_urls"], ["https://x.com"])
        self.assertEqual(d["extra_config"], {"k": 1})
        self.assertTrue(d["enabled"])
