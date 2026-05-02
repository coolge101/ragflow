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
async def test_crawl_tasks_list_passes_dataset_id_and_caps_page_size(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = SimpleNamespace(id="L1", tenant_id="t1")
    list_calls: list[tuple] = []

    def list_tasks(tf, allowed, page, ps, ds):
        list_calls.append((tf, allowed, page, ps, ds))
        return (1, [row])

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        resolve_list_tenant_id=lambda tid, allowed: (tid, None),
        list_tasks=list_tasks,
        task_row_to_dict=lambda t: {"id": t.id},
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.get(
            f"/{API_VERSION}/tbox/crawl/tasks",
            query_string={"dataset_id": "ds-99", "page": "2", "page_size": "500"},
        )
    data = await resp.get_json()
    assert data["code"] == 0
    assert data["data"]["total"] == 1
    assert data["data"]["page"] == 2
    assert data["data"]["page_size"] == 100
    assert len(list_calls) == 1
    assert list_calls[0][2] == 2
    assert list_calls[0][3] == 100
    assert list_calls[0][4] == "ds-99"


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_list_passes_tenant_id_query(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    resolve_calls: list[tuple] = []

    def resolve_list_tenant_id(tid, allowed):
        resolve_calls.append((tid, allowed))
        return ("tf-from-resolve", None)

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        resolve_list_tenant_id=resolve_list_tenant_id,
        list_tasks=lambda tf, al, p, ps, ds: (0, []),
        task_row_to_dict=lambda t: {},
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.get(
            f"/{API_VERSION}/tbox/crawl/tasks",
            query_string={"tenant_id": "  ten-from-query  "},
        )
    data = await resp.get_json()
    assert data["code"] == 0
    assert len(resolve_calls) == 1
    assert resolve_calls[0][0] == "  ten-from-query  "


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_list_invalid_page_args_fallback(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    list_calls: list[tuple] = []

    def list_tasks(tf, allowed, page, ps, ds):
        list_calls.append((page, ps))
        return (0, [])

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        resolve_list_tenant_id=lambda tid, allowed: (tid, None),
        list_tasks=list_tasks,
        task_row_to_dict=lambda t: {},
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.get(
            f"/{API_VERSION}/tbox/crawl/tasks",
            query_string={"page": "x", "page_size": "y"},
        )
    data = await resp.get_json()
    assert data["code"] == 0
    assert list_calls == [(1, 20)]


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
