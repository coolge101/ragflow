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

from types import SimpleNamespace

import pytest

from api.constants import API_VERSION
from common.constants import RetCode

from ._shared import TBOX_ROUTE_TEST_USER
from .crawl_helpers import crawl_allowed_sets, super_create_fake


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_create_tenant_id_not_permitted(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(
        mod,
        "_active_tenant_memberships",
        lambda _uid: [{"tenant_id": "allowed-ten", "role": "owner"}],
    )

    async def body():
        return {"tenant_id": "forbidden-ten"}

    fake = SimpleNamespace(tenant_ids_for_crawl=lambda uid, is_sup: ["allowed-ten"])
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = False
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/crawl/tasks")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "tenant_id" in data["message"].lower()
    assert "not permitted" in data["message"].lower()


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_create_invalid_source_type(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])

    async def body():
        return {
            "name": "x",
            "source_type": "not_a_real_type",
            "seed_urls": ["https://example.com/"],
        }

    st, rs = crawl_allowed_sets()
    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/crawl/tasks")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "source_type" in data["message"].lower()


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_create_name_required(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    monkeypatch.setattr(
        mod,
        "crawl_svc",
        SimpleNamespace(tenant_ids_for_crawl=lambda uid, is_sup: None),
    )

    async def body():
        return {"seed_urls": ["https://example.com/x"]}

    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/crawl/tasks")
    assert resp.status_code == 200
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "name" in data["message"].lower()


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_create_ok(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])

    payload = {
        "name": "  nightly ",
        "source_type": "static_web",
        "run_state": "draft",
        "seed_urls": ["https://example.com/doc"],
        "schedule_cron": "",
        "enabled": False,
        "extra_config": {},
    }

    async def body():
        return payload

    created = SimpleNamespace(
        id="new-task-id",
        tenant_id="tbox-route-test-user",
        dataset_id=None,
        name="nightly",
        source_type="static_web",
        seed_urls=["https://example.com/doc"],
        schedule_cron="",
        enabled=False,
        run_state="draft",
        last_error="",
        extra_config={},
        created_by="tbox-route-test-user",
        create_time=1,
        update_time=1,
        status="1",
    )

    def task_row_to_dict(t):
        return {"id": t.id, "name": t.name, "tenant_id": t.tenant_id}

    def create_task(**kwargs):
        assert kwargs["name"] == "nightly"
        assert kwargs["seed_urls"] == ["https://example.com/doc"]
        return created

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        ALLOWED_SOURCE_TYPES=frozenset({"static_web", "rss"}),
        ALLOWED_RUN_STATES=frozenset({"draft", "ready", "paused"}),
        validate_seed_urls=lambda urls: (["https://example.com/doc"], None),
        validate_schedule_cron=lambda s: None,
        kb_valid_for_tenant=lambda kb, ten: True,
        create_task=create_task,
        task_row_to_dict=task_row_to_dict,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/crawl/tasks")
    assert resp.status_code == 200
    data = await resp.get_json()
    assert data["code"] == 0
    assert data["data"]["id"] == "new-task-id"
    assert data["data"]["name"] == "nightly"


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_create_invalid_run_state(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])

    async def body():
        return {
            "name": "job",
            "source_type": "static_web",
            "run_state": "not-a-state",
            "seed_urls": ["https://example.com/"],
        }

    monkeypatch.setattr(mod, "crawl_svc", super_create_fake())
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/crawl/tasks")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "run_state" in data["message"].lower()


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_create_validate_seed_urls_error(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])

    async def body():
        return {"name": "job", "seed_urls": [1, 2, 3]}

    monkeypatch.setattr(
        mod,
        "crawl_svc",
        super_create_fake(validate_seed_urls=lambda urls: (None, "seed_urls invalid")),
    )
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/crawl/tasks")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "seed_urls invalid" in data["message"]


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_create_extra_config_not_object(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])

    async def body():
        return {
            "name": "job",
            "seed_urls": ["https://example.com/"],
            "extra_config": ["not", "dict"],
        }

    monkeypatch.setattr(mod, "crawl_svc", super_create_fake())
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/crawl/tasks")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "extra_config" in data["message"].lower()


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_create_dataset_kb_invalid(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])

    async def body():
        return {
            "name": "job",
            "seed_urls": ["https://example.com/"],
            "dataset_id": "kb-missing",
        }

    monkeypatch.setattr(
        mod,
        "crawl_svc",
        super_create_fake(kb_valid_for_tenant=lambda kb, ten: False),
    )
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/crawl/tasks")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "dataset_id" in data["message"].lower()


def _patchable_row(task_id: str = "p6"):
    return SimpleNamespace(id=task_id, tenant_id="tbox-route-test-user", name="n")


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_invalid_source_type(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = _patchable_row("p6")
    st, rs = crawl_allowed_sets()

    async def body():
        return {"source_type": "bad-st"}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "p6" else None,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p6")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "source_type" in data["message"].lower()


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_invalid_run_state(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = _patchable_row("p7")
    st, rs = crawl_allowed_sets()

    async def body():
        return {"run_state": "bogus"}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "p7" else None,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p7")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "run_state" in data["message"].lower()


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_dataset_id_not_string(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = _patchable_row("p8")
    st, rs = crawl_allowed_sets()

    async def body():
        return {"dataset_id": 999}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "p8" else None,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p8")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "dataset_id" in data["message"].lower()


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_dataset_kb_invalid(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = _patchable_row("p9")
    st, rs = crawl_allowed_sets()

    async def body():
        return {"dataset_id": "kb-not-in-tenant"}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "p9" else None,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
        kb_valid_for_tenant=lambda kb, tid: False,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p9")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "tenant" in data["message"].lower()


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_seed_urls_validate_error(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = _patchable_row("p10")
    st, rs = crawl_allowed_sets()

    async def body():
        return {"seed_urls": "not-a-list"}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "p10" else None,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
        validate_seed_urls=lambda urls: (None, "must be a list"),
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p10")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "must be a list" in data["message"]


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_create_empty_seeds_after_validate(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])

    async def body():
        return {"name": "job", "seed_urls": ["https://drop.me/"]}

    monkeypatch.setattr(
        mod,
        "crawl_svc",
        super_create_fake(validate_seed_urls=lambda urls: ([], None)),
    )
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/crawl/tasks")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "non-empty" in data["message"].lower()


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_create_schedule_cron_error(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])

    async def body():
        return {
            "name": "job",
            "seed_urls": ["https://example.com/"],
            "schedule_cron": "0 0 * * *",
        }

    monkeypatch.setattr(
        mod,
        "crawl_svc",
        super_create_fake(validate_schedule_cron=lambda s: "cron not allowed in test"),
    )
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/crawl/tasks")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "cron" in data["message"].lower()


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_create_dataset_id_whitespace_only(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])

    async def body():
        return {
            "name": "job",
            "seed_urls": ["https://example.com/"],
            "dataset_id": "   ",
        }

    monkeypatch.setattr(mod, "crawl_svc", super_create_fake())
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/crawl/tasks")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "dataset_id" in data["message"].lower()
