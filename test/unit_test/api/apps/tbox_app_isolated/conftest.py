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

"""Shared fixtures: stub ``api.apps`` / ``api.utils`` and load ``tbox_app.py`` in isolation."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest
from quart import Blueprint, Quart

from api.constants import API_VERSION

from ._shared import TBOX_ROUTE_TEST_USER


def repo_root() -> Path:
    here = Path(__file__).resolve()
    for d in (here, *here.parents):
        if (d / "api" / "apps" / "tbox_app.py").is_file():
            return d
    raise RuntimeError("Could not locate repo root (api/apps/tbox_app.py).")


def install_import_stubs(monkeypatch: pytest.MonkeyPatch) -> None:
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


def load_tbox_module(monkeypatch: pytest.MonkeyPatch):
    install_import_stubs(monkeypatch)
    path = repo_root() / "api" / "apps" / "tbox_app.py"
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
    return load_tbox_module(monkeypatch)


@pytest.fixture
def tbox_quart_app(tbox_module):
    app = Quart(__name__)
    app.register_blueprint(tbox_module.manager, url_prefix=f"/{API_VERSION}/tbox")
    return app, tbox_module
