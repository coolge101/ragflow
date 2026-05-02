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
from types import ModuleType

import pytest
from quart import Blueprint, Quart

from api.constants import API_VERSION


def _install_import_stubs(monkeypatch: pytest.MonkeyPatch) -> None:
    api_apps = ModuleType("api.apps")

    def login_required(func):
        return func

    api_apps.login_required = login_required
    api_apps.logout_user = lambda: None

    class _DummyUser:
        id = "u1"

    api_apps.current_user = _DummyUser()
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
    api_utils.get_request_json = lambda: {}
    api_utils.server_error_response = lambda e: {"code": 100, "message": str(e)}
    monkeypatch.setitem(sys.modules, "api.utils.api_utils", api_utils)


def _load_tbox_module(monkeypatch: pytest.MonkeyPatch):
    _install_import_stubs(monkeypatch)
    repo = Path(__file__).resolve().parents[4]
    path = repo / "api" / "apps" / "tbox_app.py"
    name = "tbox_app_smoke_isolated"
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    mod.manager = Blueprint("tbox", name)
    monkeypatch.setitem(sys.modules, name, mod)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def tbox_quart_app(monkeypatch: pytest.MonkeyPatch):
    mod = _load_tbox_module(monkeypatch)
    app = Quart(__name__)
    app.register_blueprint(mod.manager, url_prefix=f"/{API_VERSION}/tbox")
    return app, mod


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
