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
from .crawl_helpers import crawl_allowed_sets, patchable_row


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
async def test_crawl_tasks_patch_server_error_when_get_task_raises(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])

    async def body():
        return {"name": "x"}

    def get_task(_tid):
        raise RuntimeError("load task failed")

    st, rs = crawl_allowed_sets()
    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=get_task,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p0x")
    data = await resp.get_json()
    assert data["code"] == RetCode.EXCEPTION_ERROR
    assert "load task failed" in data["message"]


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_server_error_when_get_request_json_raises(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = patchable_row("p0j")
    st, rs = crawl_allowed_sets()

    async def bad_body():
        raise RuntimeError("json read failed")

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "p0j" else None,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", bad_body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p0j")
    data = await resp.get_json()
    assert data["code"] == RetCode.EXCEPTION_ERROR
    assert "json read failed" in data["message"]


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
async def test_crawl_tasks_patch_server_error_when_update_task_fields_raises(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = SimpleNamespace(id="p3b", tenant_id="tbox-route-test-user", name="old")
    st, rs = crawl_allowed_sets()

    async def body():
        return {"name": "  newname  "}

    def update_task_fields(_t, _fields):
        raise RuntimeError("db write failed")

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "p3b" else None,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
        update_task_fields=update_task_fields,
        task_row_to_dict=lambda t: {"id": t.id},
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p3b")
    data = await resp.get_json()
    assert data["code"] == RetCode.EXCEPTION_ERROR
    assert "db write failed" in data["message"]


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_server_error_when_second_get_task_raises(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = SimpleNamespace(id="p3c", tenant_id="tbox-route-test-user", name="old")
    st, rs = crawl_allowed_sets()
    gt_calls = [0]

    async def body():
        return {"name": "  after  "}

    def get_task(tid):
        if tid != "p3c":
            return None
        gt_calls[0] += 1
        if gt_calls[0] == 1:
            return row
        raise OSError("re-read after update failed")

    def update_task_fields(t, fields):
        for k, v in fields.items():
            setattr(t, k, v)

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=get_task,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
        update_task_fields=update_task_fields,
        task_row_to_dict=lambda t: {"id": t.id, "name": t.name},
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p3c")
    data = await resp.get_json()
    assert data["code"] == RetCode.EXCEPTION_ERROR
    assert "re-read after update failed" in data["message"]
    assert gt_calls[0] == 2


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
async def test_crawl_tasks_patch_invalid_source_type(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = patchable_row("p6")
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
    row = patchable_row("p7")
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
    row = patchable_row("p8")
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
    row = patchable_row("p9")
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
    row = patchable_row("p10")
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
async def test_crawl_tasks_patch_not_found(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda _tid: None,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/missing-patch")
    data = await resp.get_json()
    assert data["code"] == RetCode.NOT_FOUND


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_schedule_cron_error(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = patchable_row("p11")
    st, rs = crawl_allowed_sets()

    async def body():
        return {"schedule_cron": "invalid-cron"}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "p11" else None,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
        validate_schedule_cron=lambda s: "bad expression",
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p11")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "bad expression" in data["message"]


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_seed_urls_empty_after_validate(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = patchable_row("p12")
    st, rs = crawl_allowed_sets()

    async def body():
        return {"seed_urls": ["https://x.example/"]}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "p12" else None,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
        validate_seed_urls=lambda urls: ([], None),
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p12")
    data = await resp.get_json()
    assert data["code"] == RetCode.ARGUMENT_ERROR
    assert "non-empty" in data["message"].lower()


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_clear_dataset_id_null(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = patchable_row("p13")
    st, rs = crawl_allowed_sets()
    updates: list[dict] = []

    async def body():
        return {"dataset_id": None}

    def update_task_fields(t, fields):
        updates.append(dict(fields))
        for k, v in fields.items():
            setattr(t, k, v)

    def task_row_to_dict(t):
        return {"id": t.id, "dataset_id": getattr(t, "dataset_id", "unset")}

    def get_task(tid):
        return row if tid == "p13" else None

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=get_task,
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
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p13")
    data = await resp.get_json()
    assert data["code"] == 0
    assert updates == [{"dataset_id": None}]
    assert data["data"]["dataset_id"] is None


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_delete_not_found(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda _tid: None,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.delete(f"/{API_VERSION}/tbox/crawl/tasks/missing-del")
    data = await resp.get_json()
    assert data["code"] == RetCode.NOT_FOUND


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_enabled_true(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = patchable_row("p14")
    st, rs = crawl_allowed_sets()
    updates: list[dict] = []

    async def body():
        return {"enabled": True}

    def update_task_fields(t, fields):
        updates.append(dict(fields))
        for k, v in fields.items():
            setattr(t, k, v)

    def task_row_to_dict(t):
        return {"id": t.id, "enabled": bool(getattr(t, "enabled", False))}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "p14" else None,
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
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p14")
    data = await resp.get_json()
    assert data["code"] == 0
    assert updates == [{"enabled": True}]
    assert data["data"]["enabled"] is True


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_schedule_cron_ok(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = patchable_row("p15")
    st, rs = crawl_allowed_sets()
    updates: list[dict] = []

    async def body():
        return {"schedule_cron": "0 0 * * *"}

    def update_task_fields(t, fields):
        updates.append(dict(fields))
        for k, v in fields.items():
            setattr(t, k, v)

    def task_row_to_dict(t):
        return {"id": t.id, "schedule_cron": getattr(t, "schedule_cron", "")}

    fake = SimpleNamespace(
        tenant_ids_for_crawl=lambda uid, is_sup: None,
        get_task=lambda tid: row if tid == "p15" else None,
        user_may_access_task=lambda t, allowed: True,
        ALLOWED_SOURCE_TYPES=st,
        ALLOWED_RUN_STATES=rs,
        validate_schedule_cron=lambda s: None,
        update_task_fields=update_task_fields,
        task_row_to_dict=task_row_to_dict,
    )
    monkeypatch.setattr(mod, "crawl_svc", fake)
    monkeypatch.setattr(mod, "get_request_json", body)
    TBOX_ROUTE_TEST_USER.is_superuser = True
    async with app.test_client() as client:
        resp = await client.patch(f"/{API_VERSION}/tbox/crawl/tasks/p15")
    data = await resp.get_json()
    assert data["code"] == 0
    assert updates == [{"schedule_cron": "0 0 * * *"}]
    assert data["data"]["schedule_cron"] == "0 0 * * *"
