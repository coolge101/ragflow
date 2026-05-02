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

"""Smoke Quart routes for ``tbox_app`` without importing ``api.apps`` (full app pulls Hub/LLM stack)."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest
from quart import Blueprint, Quart

from api.constants import API_VERSION
from common.constants import RetCode


class MutableTboxRouteUser:
    """Bound to ``api.apps.current_user`` before ``tbox_app`` loads; mutate fields per test."""

    def reset(self) -> None:
        self.id = "tbox-route-test-user"
        self.is_superuser = True
        self.email = "route-tester@example.invalid"
        self.nickname = "RouteTester"
        self.access_token = "access-token-intact"
        self.save_calls = 0

    def __init__(self) -> None:
        self.reset()

    def save(self) -> None:
        self.save_calls += 1


TBOX_ROUTE_TEST_USER = MutableTboxRouteUser()


def _repo_root() -> Path:
    here = Path(__file__).resolve()
    for d in (here, *here.parents):
        if (d / "api" / "apps" / "tbox_app.py").is_file():
            return d
    raise RuntimeError("Could not locate repo root (api/apps/tbox_app.py).")


def _install_import_stubs(monkeypatch: pytest.MonkeyPatch) -> None:
    api_apps = ModuleType("api.apps")

    def login_required(func):
        return func

    api_apps.login_required = login_required
    api_apps.logout_user = lambda: None
    api_apps.current_user = TBOX_ROUTE_TEST_USER
    monkeypatch.setitem(sys.modules, "api.apps", api_apps)

    import api.db as api_db

    monkeypatch.setitem(sys.modules, "api.db", api_db)

    db_models = ModuleType("api.db.db_models")

    class UserTenant:
        pass

    db_models.UserTenant = UserTenant
    monkeypatch.setitem(sys.modules, "api.db.db_models", db_models)

    crawl_svc_mod = ModuleType("api.db.services.tbox_crawl_task_service")
    services_pkg = ModuleType("api.db.services")
    services_pkg.tbox_crawl_task_service = crawl_svc_mod
    monkeypatch.setitem(sys.modules, "api.db.services", services_pkg)
    monkeypatch.setitem(sys.modules, "api.db.services.tbox_crawl_task_service", crawl_svc_mod)

    api_utils = ModuleType("api.utils.api_utils")

    def get_json_result(code=0, message="success", data=None):
        return {"code": int(code), "message": message, "data": data}

    api_utils.get_json_result = get_json_result

    async def get_request_json():
        return {}

    api_utils.get_request_json = get_request_json
    api_utils.server_error_response = lambda e: {"code": 100, "message": str(e)}
    monkeypatch.setitem(sys.modules, "api.utils.api_utils", api_utils)


def _load_tbox_module(monkeypatch: pytest.MonkeyPatch):
    _install_import_stubs(monkeypatch)
    repo = _repo_root()
    path = repo / "api" / "apps" / "tbox_app.py"
    name = "tbox_app_smoke_isolated"
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    mod.manager = Blueprint("tbox", name)
    monkeypatch.setitem(sys.modules, name, mod)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(autouse=True)
def _reset_mutable_tbox_route_user():
    TBOX_ROUTE_TEST_USER.reset()
    yield
    TBOX_ROUTE_TEST_USER.reset()


@pytest.fixture
def tbox_module(monkeypatch: pytest.MonkeyPatch):
    return _load_tbox_module(monkeypatch)


@pytest.fixture
def tbox_quart_app(tbox_module):
    app = Quart(__name__)
    app.register_blueprint(tbox_module.manager, url_prefix=f"/{API_VERSION}/tbox")
    return app, tbox_module


@pytest.mark.p2
def test_tbox_permissions_superuser_matches_all(tbox_module):
    perms = tbox_module._tbox_permissions_for_tenants(True, [])
    assert perms == list(tbox_module._TBOX_PERMISSIONS_ALL)


@pytest.mark.p2
def test_tbox_permissions_invite_minimal(tbox_module):
    from api.db import UserTenantRole

    perms = tbox_module._tbox_permissions_for_tenants(
        False,
        [{"tenant_id": "t1", "role": UserTenantRole.INVITE.value}],
    )
    assert perms == ["chat.use", "search.use", "doc.view"]


@pytest.mark.p2
def test_tbox_permissions_empty_tenants(tbox_module):
    assert tbox_module._tbox_permissions_for_tenants(False, []) == []


@pytest.mark.p2
def test_tbox_permissions_normal_lacks_ops_perms(tbox_module):
    from api.db import UserTenantRole

    normal = tbox_module._tbox_permissions_for_tenants(
        False,
        [{"tenant_id": "t1", "role": UserTenantRole.NORMAL.value}],
    )
    owner = tbox_module._tbox_permissions_for_tenants(
        False,
        [{"tenant_id": "t1", "role": UserTenantRole.OWNER.value}],
    )
    assert "audit.read" in owner and "audit.read" not in normal
    assert "user.manage" in owner and "user.manage" not in normal
    assert "crawl.manage" in normal


@pytest.mark.p2
@pytest.mark.asyncio
async def test_tbox_health(tbox_quart_app):
    app, mod = tbox_quart_app
    async with app.test_client() as client:
        resp = await client.get(f"/{API_VERSION}/tbox/health")
    assert resp.status_code == 200
    body = await resp.get_json()
    assert body["code"] == 0
    assert body["data"]["status"] == "ok"
    assert body["data"]["tbox_api_contract_version"] == mod.TBOX_API_CONTRACT_VERSION
    assert body["data"]["path"] == f"/{API_VERSION}/tbox/health"


@pytest.mark.p2
@pytest.mark.asyncio
async def test_tbox_contract(tbox_quart_app):
    app, mod = tbox_quart_app
    async with app.test_client() as client:
        resp = await client.get(f"/{API_VERSION}/tbox/contract")
    assert resp.status_code == 200
    body = await resp.get_json()
    assert body["data"]["tbox_api_contract_version"] == mod.TBOX_API_CONTRACT_VERSION
    assert "TBOX_API_BOUNDARY" in body["data"]["docs"]
    assert "TBOX_KB_DELIVERY_HARNESS" in body["data"]["delivery_harness"]


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


def _crawl_sets():
    return (
        frozenset({"static_web", "rss"}),
        frozenset({"draft", "ready", "paused"}),
    )


@pytest.mark.p2
@pytest.mark.asyncio
async def test_crawl_tasks_patch_no_fields_to_update(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda _uid: [])
    row = SimpleNamespace(id="p1", tenant_id="tbox-route-test-user", name="x")
    st, rs = _crawl_sets()

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
    st, rs = _crawl_sets()

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
    st, rs = _crawl_sets()
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
async def test_tbox_me_returns_profile(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    tenants = [{"tenant_id": "ten-a", "role": "owner"}]
    monkeypatch.setattr(mod, "_active_tenant_memberships", lambda uid: tenants if uid == TBOX_ROUTE_TEST_USER.id else [])
    TBOX_ROUTE_TEST_USER.is_superuser = False
    TBOX_ROUTE_TEST_USER.email = "me@example.invalid"
    TBOX_ROUTE_TEST_USER.nickname = "MeNick"
    async with app.test_client() as client:
        resp = await client.get(f"/{API_VERSION}/tbox/me")
    assert resp.status_code == 200
    data = await resp.get_json()
    assert data["code"] == 0
    assert data["data"]["user_id"] == "tbox-route-test-user"
    assert data["data"]["email"] == "me@example.invalid"
    assert data["data"]["nickname"] == "MeNick"
    assert data["data"]["is_superuser"] is False
    assert data["data"]["tenants"] == tenants
    assert "crawl.manage" in data["data"]["permissions"]


@pytest.mark.p2
@pytest.mark.asyncio
async def test_tbox_logout_invalidates_token(tbox_quart_app, monkeypatch: pytest.MonkeyPatch):
    app, mod = tbox_quart_app
    logout_calls: list[None] = []

    def logout_spy():
        logout_calls.append(None)

    monkeypatch.setattr(mod, "logout_user", logout_spy)
    async with app.test_client() as client:
        resp = await client.post(f"/{API_VERSION}/tbox/logout")
    assert resp.status_code == 200
    data = await resp.get_json()
    assert data["code"] == 0
    assert data["message"] == "logged out"
    assert data["data"]["tbox_api_contract_version"] == mod.TBOX_API_CONTRACT_VERSION
    assert TBOX_ROUTE_TEST_USER.save_calls == 1
    assert TBOX_ROUTE_TEST_USER.access_token.startswith("INVALID_")
    assert logout_calls == [None]


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
