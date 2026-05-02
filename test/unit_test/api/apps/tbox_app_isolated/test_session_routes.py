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

import pytest

from api.constants import API_VERSION

from ._shared import TBOX_ROUTE_TEST_USER


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
