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

    id: str = "tbox-route-test-user"
    is_superuser: bool = True


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
    TBOX_ROUTE_TEST_USER.id = "tbox-route-test-user"
    TBOX_ROUTE_TEST_USER.is_superuser = True
    yield
    TBOX_ROUTE_TEST_USER.id = "tbox-route-test-user"
    TBOX_ROUTE_TEST_USER.is_superuser = True


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
