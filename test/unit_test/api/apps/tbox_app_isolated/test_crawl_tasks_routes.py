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

from ._shared import TBOX_ROUTE_TEST_USER, crawl_allowed_sets


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_list_superuser_empty(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        resolve_list_tenant_id=lambda tid, allowed: (tid, None),
        list_tasks=lambda tf, allowed, page, ps, ds: (0, []),
        task_row_to_dict=lambda t: {"id": getattr(t, "id", "")},
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.get(f"/{API_VERSION}/tbox/crawl/tasks")
    assert resp.status_code == 200
    body = await resp.get_json()
    assert body["code"] == 0
    assert body["data"]["total"] == 0
    assert body["data"]["page"] == 1
    assert body["data"]["items"] == []


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_list_crawl_manage_forbidden(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    TBOX_ROUTE_TEST_USER.is_superuser = False
    async with app.test_client() as client:
        resp = await client.get(f"/{API_VERSION}/tbox/crawl/tasks")
    assert resp.status_code == 200
    body = await resp.get_json()
    assert body["code"] == RetCode.FORBIDDEN
    assert "crawl.manage" in body["message"].lower()


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_get_not_found(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda _tid: None,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.get(f"/{API_VERSION}/tbox/crawl/tasks/missing-task-id")
    assert resp.status_code == 200
    body = await resp.get_json()
    assert body["code"] == RetCode.NOT_FOUND


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
async def test_crawl_tasks_patch_no_fields_to_update(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = SimpleNamespace(id="p1", tenant_id="tbox-route-test-user", name="x")
    st, rs = crawl_allowed_sets()

    async def empty_body():
        return {}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "p1" else None,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", empty_body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p1")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "no fields" in data["message"].lower()


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_name_empty(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = SimpleNamespace(id="p2", tenant_id="tbox-route-test-user", name="old")
    st, rs = crawl_allowed_sets()

    async def body():
        return {"name": "   "}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "p2" else None,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p2")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "non-empty" in data["message"].lower()


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_name_ok(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = SimpleNamespace(id="p3", tenant_id="tbox-route-test-user", name="old")
    st, rs = crawl_allowed_sets()
    update_calls: list[dict] = []

    async def body():
        return {"name": "  renamed  "}

    def update_task_fields(t, fields):
        update_calls.append(dict(fields))
        for k, v in fields.items():
            setattr(t, k, v)

    def task_row_to_dict(t):
        return {"id": t.id, "name": t.name}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "p3" else None,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
        update_task_fields=update_task_fields,
        task_row_to_dict=task_row_to_dict,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p3")
    data = await resp.get_json()
    assert data["code"] == 0
    assert data["data"]["name"] == "renamed"
    assert update_calls == [{"name": "renamed"}]


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_delete_ok(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = SimpleNamespace(id="d1", tenant_id="tbox-route-test-user")
    deleted: list[str] = []

    def soft_delete_task(t):
        deleted.append(t.id)

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "d1" else None,
        user_may_access_task=lambda t, allowed: True,
        soft_delete_task=soft_delete_task,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.delete(f"/{API_VERSION}/tbox/crawl/tasks/d1")
    data = await resp.get_json()
    assert data["code"] == 0
    assert data["message"] == "deleted"
    assert deleted == ["d1"]


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_run_ok(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = SimpleNamespace(id="r1", tenant_id="tbox-route-test-user", ran=False)
    ticks: list[str] = []

    def execute_crawl_task_stub_tick(tid):
        ticks.append(tid)
        row.ran = True

    def task_row_to_dict(t):
        return {"id": t.id, "ran": bool(getattr(t, "ran", False))}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "r1" else None,
        user_may_access_task=lambda t, allowed: True,
        execute_crawl_task_stub_tick=execute_crawl_task_stub_tick,
        record_worker_tick=lambda *a, **k: None,
        task_row_to_dict=task_row_to_dict,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/crawl/tasks/r1/run")
    data = await resp.get_json()
    assert data["code"] == 0
    assert data["data"]["id"] == "r1"
    assert data["data"]["ran"] is True
    assert ticks == ["r1"]


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_run_valueerror_not_found(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = SimpleNamespace(id="r2", tenant_id="tbox-route-test-user")

    def execute_crawl_task_stub_tick(tid):
        raise ValueError("task vanished")

    def record_worker_tick(*_a, **_k):
        raise AssertionError("record_worker_tick should not run")

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "r2" else None,
        user_may_access_task=lambda t, allowed: True,
        execute_crawl_task_stub_tick=execute_crawl_task_stub_tick,
        record_worker_tick=record_worker_tick,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/crawl/tasks/r2/run")
    data = await resp.get_json()
    assert data["code"] == RetCode.NOT_FOUND
    assert "vanished" in data["message"]


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_run_runtimeerror_records_tick(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = SimpleNamespace(id="r3", tenant_id="tbox-route-test-user")
    tick_args: list[tuple] = []

    def execute_crawl_task_stub_tick(tid):
        raise RuntimeError("stub failure")

    def record_worker_tick(task_id, *, ok, message):
        tick_args.append((task_id, ok, message))

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "r3" else None,
        user_may_access_task=lambda t, allowed: True,
        execute_crawl_task_stub_tick=execute_crawl_task_stub_tick,
        record_worker_tick=record_worker_tick,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/crawl/tasks/r3/run")
    data = await resp.get_json()
    assert data["code"] == RetCode.EXCEPTION_ERROR
    assert "stub failure" in data["message"]
    assert len(tick_args) == 1
    assert tick_args[0][0] == "r3"
    assert tick_args[0][1] is False
    assert "[tbox:WORKER_STUB]" in tick_args[0][2]
