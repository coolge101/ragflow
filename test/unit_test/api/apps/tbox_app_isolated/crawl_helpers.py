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

"""Factories for isolated ``tbox_app`` crawl-route tests."""

from __future__ import annotations

from types import SimpleNamespace

from ._shared import crawl_allowed_sets


def super_create_fake(**overrides):
    """Minimal ``crawl_svc`` for superuser ``POST /crawl/tasks`` validation paths."""
    st, rs = crawl_allowed_sets()
    attrs = {
        "tenant_ids_for_crawl": lambda uid, is_sup: None,
        "ALLOWED_SOURCE_TYPES": st,
        "ALLOWED_RUN_STATES": rs,
        "validate_seed_urls": lambda urls: (["https://example.com/one"], None),
        "validate_schedule_cron": lambda s: None,
        "kb_valid_for_tenant": lambda kb, ten: True,
    }
    attrs.update(overrides)
    return SimpleNamespace(**attrs)


def patchable_row(task_id: str = "p6"):
    return SimpleNamespace(id=task_id, tenant_id="tbox-route-test-user", name="n")


__all__ = ["crawl_allowed_sets", "patchable_row", "super_create_fake"]
