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
async def test_crawl_tasks_list_tenant_filter_error(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(
        mod,
        "_active_tenant_memberships",
        lambda _uid: [{"tenant_id": "t-a", "role": "owner"}],
    )

    def list_tasks_must_not_run(*_a, **_k):
        raise AssertionError("list_tasks must not be called")

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: ["t-a", "t-b"],
        resolve_list_tenant_id=lambda tid, allowed: (None, "tenant_id is required when the user belongs to multiple tenants"),
        list_tasks=list_tasks_must_not_run,
        task_row_to_dict=lambda t: {},
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = False
    async with app.test_client() as client:
        resp = await client.get(f"/{API_VERSION}/tbox/crawl/tasks")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "tenant_id" in data["message"].lower()


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
async def test_crawl_tasks_get_ok(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = SimpleNamespace(id="g1", tenant_id="tbox-route-test-user", name="task-one")

    def task_row_to_dict(t):
        return {"id": t.id, "name": t.name}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "g1" else None,
        user_may_access_task=lambda t, allowed: True,
        task_row_to_dict=task_row_to_dict,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.get(f"/{API_VERSION}/tbox/crawl/tasks/g1")
    data = await resp.get_json()
    assert data["code"] == 0
    assert data["data"] == {"id": "g1", "name": "task-one"}


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_get_forbidden_wrong_tenant(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(
        mod,
        "_active_tenant_memberships",
        lambda _uid: [{"tenant_id": "allowed-ten", "role": "owner"}],
    )
    row = SimpleNamespace(id="g2", tenant_id="other-ten", name="x")

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: ["allowed-ten"],
        get_task=lambda tid: row if tid == "g2" else None,
        user_may_access_task=lambda t, allowed: t.tenant_id in (allowed or []),
        task_row_to_dict=lambda t: {"id": t.id},
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = False
    async with app.test_client() as client:
        resp = await client.get(f"/{API_VERSION}/tbox/crawl/tasks/g2")
    data = await resp.get_json()
    assert data["code"] == RetCode.FORBIDDEN
    assert "not allowed" in data["message"].lower()


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
async def test_crawl_tasks_patch_forbidden_wrong_tenant(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(
        mod,
        "_active_tenant_memberships",
        lambda _uid: [{"tenant_id": "allowed-ten", "role": "owner"}],
    )
    row = SimpleNamespace(id="p4", tenant_id="other-ten", name="x")
    st, rs = crawl_allowed_sets()

    async def body():
        return {"name": "  y  "}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: ["allowed-ten"],
        get_task=lambda tid: row if tid == "p4" else None,
        user_may_access_task=lambda t, allowed: t.tenant_id in (allowed or []),
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = False
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p4")
    data = await resp.get_json()
    assert data["code"] == RetCode.FORBIDDEN


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_extra_config_not_object(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = SimpleNamespace(id="p5", tenant_id="tbox-route-test-user", name="n")
    st, rs = crawl_allowed_sets()

    async def body():
        return {"extra_config": "not-an-object"}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "p5" else None,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p5")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "extra_config" in data["message"].lower()


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
async def test_crawl_tasks_delete_forbidden_wrong_tenant(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(
        mod,
        "_active_tenant_memberships",
        lambda _uid: [{"tenant_id": "allowed-ten", "role": "owner"}],
    )
    row = SimpleNamespace(id="d2", tenant_id="other-ten")

    def soft_delete_task(_t):
        raise AssertionError("soft_delete_task must not run")

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: ["allowed-ten"],
        get_task=lambda tid: row if tid == "d2" else None,
        user_may_access_task=lambda t, allowed: t.tenant_id in (allowed or []),
        soft_delete_task=soft_delete_task,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = False
    async with app.test_client() as client:
        resp = await client.delete(f"/{API_VERSION}/tbox/crawl/tasks/d2")
    data = await resp.get_json()
    assert data["code"] == RetCode.FORBIDDEN


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
async def test_crawl_tasks_run_forbidden_wrong_tenant(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(
        mod,
        "_active_tenant_memberships",
        lambda _uid: [{"tenant_id": "allowed-ten", "role": "owner"}],
    )
    row = SimpleNamespace(id="r0", tenant_id="other-ten")

    def execute_crawl_task_stub_tick(_tid):
        raise AssertionError("execute must not run")

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: ["allowed-ten"],
        get_task=lambda tid: row if tid == "r0" else None,
        user_may_access_task=lambda t, allowed: t.tenant_id in (allowed or []),
        execute_crawl_task_stub_tick=execute_crawl_task_stub_tick,
        record_worker_tick=lambda *a, **k: None,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = False
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/crawl/tasks/r0/run")
    data = await resp.get_json()
    assert data["code"] == RetCode.FORBIDDEN


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


def _super_create_fake(**overrides):
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

    monkeypatch.setattr(mod, "crawl_svc", _super_create_fake())
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
        _super_create_fake(validate_seed_urls=lambda urls: (None, "seed_urls invalid")),
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

    monkeypatch.setattr(mod, "crawl_svc", _super_create_fake())
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
        _super_create_fake(kb_valid_for_tenant=lambda kb, ten: False),
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
