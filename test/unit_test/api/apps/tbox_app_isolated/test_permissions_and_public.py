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
def test_tbox_permissions_admin_matches_all(tbox_module):
    from api.db import UserTenantRole

    perms = tbox_module._tbox_permissions_for_tenants(
        False,
        [{"tenant_id": "t1", "role": UserTenantRole.ADMIN.value}],
    )
    assert perms == list(tbox_module._TBOX_PERMISSIONS_ALL)


@pytest.mark.p2
def test_tbox_permissions_owner_on_any_tenant_beats_invite_elsewhere(tbox_module):
    from api.db import UserTenantRole

    perms = tbox_module._tbox_permissions_for_tenants(
        False,
        [
            {"tenant_id": "t1", "role": UserTenantRole.INVITE.value},
            {"tenant_id": "t2", "role": UserTenantRole.OWNER.value},
        ],
    )
    assert perms == list(tbox_module._TBOX_PERMISSIONS_ALL)


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
