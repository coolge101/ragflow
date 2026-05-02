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
