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
"""
TBOX product extension API (isolated under /v1/tbox).

Contract: docs/TBOX_API_BOUNDARY.md
"""

import json
import secrets

from quart import request

from api.apps import current_user, login_required, logout_user
from api.db import UserTenantRole
from api.db.db_models import UserTenant
from api.db.services import tbox_crawl_task_service as crawl_svc
from api.db.services import tbox_managed_user_service as managed_users
from api.utils.api_utils import get_json_result, get_request_json, server_error_response
from common.constants import RetCode, StatusEnum
from common.tbox_crawl_last_error import format_crawl_worker_error

# Bumped when response shape or semantics change for external clients (e.g. web-tbox).
# Keep aligned with web-tbox/src/constants/tboxContract.ts → TBOX_API_CONTRACT_VERSION_EXPECTED.
TBOX_API_CONTRACT_VERSION = 5

# UI permission keys — aligned with docs/TBOX_UI_DESIGN_DETAIL.md §2.2
_TBOX_PERMISSIONS_ALL = (
    "chat.use",
    "search.use",
    "doc.view",
    "doc.upload",
    "doc.delete",
    "doc.reparse",
    "doc.version.manage",
    "kb.configure",
    "kb.dangerous",
    "export.data",
    "audit.read",
    "stats.read",
    "user.manage",
    "crawl.manage",
)


def _parse_tbox_permissions_column(raw) -> list[str] | None:
    if raw is None or raw == "":
        return None
    try:
        arr = json.loads(raw) if isinstance(raw, str) else raw
        if isinstance(arr, list) and len(arr) > 0:
            return [str(p) for p in arr if p in _TBOX_PERMISSIONS_ALL]
    except Exception:
        return None
    return None


def _single_role_permissions(role: str) -> set[str]:
    r = str(role or "")
    if r in (UserTenantRole.OWNER.value, UserTenantRole.ADMIN.value):
        return set(_TBOX_PERMISSIONS_ALL)
    if r == UserTenantRole.NORMAL.value:
        return {
            "chat.use",
            "search.use",
            "doc.view",
            "doc.upload",
            "doc.delete",
            "doc.reparse",
            "doc.version.manage",
            "kb.configure",
            "export.data",
            "crawl.manage",
        }
    if r == UserTenantRole.INVITE.value:
        return {"chat.use", "search.use", "doc.view"}
    return set()


def _effective_permissions_for_membership_row(row: dict) -> set[str]:
    ovr = _parse_tbox_permissions_column(row.get("tbox_permissions"))
    if ovr is not None:
        return set(ovr)
    return _single_role_permissions(str(row.get("role") or ""))


def _tbox_permissions_for_tenants(is_superuser: bool, tenant_rows: list[dict]) -> list[str]:
    if is_superuser:
        return list(_TBOX_PERMISSIONS_ALL)
    acc: set[str] = set()
    for row in tenant_rows:
        acc.update(_effective_permissions_for_membership_row(row))
    order = list(_TBOX_PERMISSIONS_ALL)
    return [p for p in order if p in acc]


def _active_tenant_memberships(user_id: str) -> list[dict]:
    q = UserTenant.select(UserTenant.tenant_id, UserTenant.role, UserTenant.tbox_permissions).where((UserTenant.user_id == user_id) & (UserTenant.status == StatusEnum.VALID.value)).dicts()
    return [{"tenant_id": r["tenant_id"], "role": r["role"], "tbox_permissions": r.get("tbox_permissions")} for r in q]


def _team_manage_tenant_users(tenant_id: str) -> bool:
    """Same rules as tenant_api: personal owner or team OWNER/ADMIN."""
    from api.db.services.user_service import UserTenantService

    if current_user.id == tenant_id:
        return True
    rel = UserTenantService.filter_by_tenant_and_user_id(tenant_id, current_user.id)
    if not rel or str(rel.status) != str(StatusEnum.VALID.value):
        return False
    role = str(rel.role or "")
    return role in (UserTenantRole.OWNER.value, UserTenantRole.ADMIN.value)


def _team_view_tenant_users(tenant_id: str) -> bool:
    from api.db.services.user_service import UserTenantService

    if bool(getattr(current_user, "is_superuser", False)):
        return True
    if _team_manage_tenant_users(tenant_id):
        return True
    rel = UserTenantService.filter_by_tenant_and_user_id(tenant_id, current_user.id)
    return bool(rel and str(rel.status) == str(StatusEnum.VALID.value))


def _assert_managed_users_read(tenant_id: str):
    if not _team_view_tenant_users(tenant_id):
        return get_json_result(
            data=False,
            message="No authorization.",
            code=RetCode.AUTHENTICATION_ERROR,
        )
    return None


def _assert_managed_users_write(tenant_id: str):
    if bool(getattr(current_user, "is_superuser", False)):
        return None
    if _team_manage_tenant_users(tenant_id):
        return None
    return get_json_result(code=RetCode.FORBIDDEN, message="No authorization to manage workspace users.")


def _crawl_manage_denied_response():
    return get_json_result(code=RetCode.FORBIDDEN, message="Permission crawl.manage required")


def _crawl_task_forbidden_response():
    return get_json_result(code=RetCode.FORBIDDEN, message="Not allowed to access this crawl task")


def _assert_crawl_manage():
    user = current_user
    tenants = _active_tenant_memberships(user.id)
    is_super = bool(getattr(user, "is_superuser", False))
    if "crawl.manage" not in _tbox_permissions_for_tenants(is_super, tenants):
        return _crawl_manage_denied_response()
    return None


@manager.route("/health", methods=["GET"])  # noqa: F821
async def health():
    """Liveness for TBOX console / load balancers; no auth."""
    return get_json_result(
        data={
            "status": "ok",
            "tbox_api_contract_version": TBOX_API_CONTRACT_VERSION,
            "path": request.path,
        }
    )


@manager.route("/contract", methods=["GET"])  # noqa: F821
async def contract():
    """Machine-readable pointer to the human contract doc."""
    return get_json_result(
        data={
            "tbox_api_contract_version": TBOX_API_CONTRACT_VERSION,
            "docs": "docs/TBOX_API_BOUNDARY.md",
            "delivery_harness": "docs/TBOX_KB_DELIVERY_HARNESS.md",
        }
    )


@manager.route("/me", methods=["GET"])  # noqa: F821
@login_required
async def me():
    """Current user + tenant memberships (TBOX 用户 ↔ 租户/角色映射的首包)."""
    try:
        user = current_user
        tenants = _active_tenant_memberships(user.id)
        is_super = bool(getattr(user, "is_superuser", False))
        permissions = _tbox_permissions_for_tenants(is_super, tenants)
        return get_json_result(
            data={
                "user_id": user.id,
                "email": getattr(user, "email", None),
                "nickname": getattr(user, "nickname", None),
                "is_superuser": is_super,
                "tenants": tenants,
                "permissions": permissions,
            }
        )
    except Exception as e:  # noqa: BLE001
        return server_error_response(e)


@manager.route("/logout", methods=["POST"])  # noqa: F821
@login_required
async def tbox_logout():
    """Invalidate access_token and clear session (align with POST /api/v1/auth/logout)."""
    user = current_user
    user.access_token = f"INVALID_{secrets.token_hex(16)}"
    user.save()
    logout_user()
    return get_json_result(
        code=RetCode.SUCCESS,
        message="logged out",
        data={"tbox_api_contract_version": TBOX_API_CONTRACT_VERSION},
    )


def _parse_page_args():
    try:
        page = max(1, int(request.args.get("page", 1)))
        page_size = min(100, max(1, int(request.args.get("page_size", 20))))
    except (TypeError, ValueError):
        page, page_size = 1, 20
    return page, page_size


@manager.route("/crawl/tasks", methods=["GET"])  # noqa: F821
@login_required
async def crawl_tasks_list():
    denied = _assert_crawl_manage()
    if denied:
        return denied
    try:
        user = current_user
        is_super = bool(getattr(user, "is_superuser", False))
        allowed = crawl_svc.tenant_ids_for_crawl(user.id, is_super)
        tenant_param = request.args.get("tenant_id") or None
        tenant_filter, err_msg = crawl_svc.resolve_list_tenant_id(tenant_param, allowed)
        if err_msg:
            return get_json_result(code=RetCode.ARGUMENT_ERROR, message=err_msg)
        dataset_id = request.args.get("dataset_id") or None
        page, page_size = _parse_page_args()
        total, rows = crawl_svc.list_tasks(tenant_filter, allowed, page, page_size, dataset_id)
        return get_json_result(
            data={
                "total": total,
                "page": page,
                "page_size": page_size,
                "items": [crawl_svc.task_row_to_dict(t) for t in rows],
            }
        )
    except Exception as e:  # noqa: BLE001
        return server_error_response(e)


@manager.route("/crawl/tasks/<task_id>", methods=["GET"])  # noqa: F821
@login_required
async def crawl_tasks_get(task_id: str):
    denied = _assert_crawl_manage()
    if denied:
        return denied
    try:
        user = current_user
        is_super = bool(getattr(user, "is_superuser", False))
        allowed = crawl_svc.tenant_ids_for_crawl(user.id, is_super)
        t = crawl_svc.get_task(task_id)
        if not t:
            return get_json_result(code=RetCode.NOT_FOUND, message="crawl task not found")
        if not crawl_svc.user_may_access_task(t, allowed):
            return _crawl_task_forbidden_response()
        return get_json_result(data=crawl_svc.task_row_to_dict(t))
    except Exception as e:  # noqa: BLE001
        return server_error_response(e)


@manager.route("/crawl/tasks", methods=["POST"])  # noqa: F821
@login_required
async def crawl_tasks_create():
    denied = _assert_crawl_manage()
    if denied:
        return denied
    try:
        user = current_user
        is_super = bool(getattr(user, "is_superuser", False))
        allowed = crawl_svc.tenant_ids_for_crawl(user.id, is_super)
        req = await get_request_json()
        tenant_id = (req.get("tenant_id") or user.id or "").strip()
        if allowed is not None and tenant_id not in allowed:
            return get_json_result(code=RetCode.ARGUMENT_ERROR, message="tenant_id is not permitted")
        name = (req.get("name") or "").strip()
        if not name:
            return get_json_result(code=RetCode.ARGUMENT_ERROR, message="name is required")
        source_type = (req.get("source_type") or "static_web").strip()
        if source_type not in crawl_svc.ALLOWED_SOURCE_TYPES:
            return get_json_result(code=RetCode.ARGUMENT_ERROR, message="invalid source_type")
        run_state = (req.get("run_state") or "draft").strip()
        if run_state not in crawl_svc.ALLOWED_RUN_STATES:
            return get_json_result(code=RetCode.ARGUMENT_ERROR, message="invalid run_state")
        seeds, err = crawl_svc.validate_seed_urls(req.get("seed_urls"))
        if err:
            return get_json_result(code=RetCode.ARGUMENT_ERROR, message=err)
        if not seeds:
            return get_json_result(code=RetCode.ARGUMENT_ERROR, message="seed_urls must be non-empty")
        schedule_cron = str(req.get("schedule_cron") or "").strip()[:128]
        cron_err = crawl_svc.validate_schedule_cron(schedule_cron)
        if cron_err:
            return get_json_result(code=RetCode.ARGUMENT_ERROR, message=cron_err)
        enabled = bool(req.get("enabled", False))
        extra = req.get("extra_config")
        if extra is None:
            extra = {}
        if not isinstance(extra, dict):
            return get_json_result(code=RetCode.ARGUMENT_ERROR, message="extra_config must be an object")
        secret_err = crawl_svc.validate_extra_config(extra)
        if secret_err:
            return get_json_result(code=RetCode.ARGUMENT_ERROR, message=secret_err)
        dataset_id = req.get("dataset_id")
        if dataset_id is not None:
            if not isinstance(dataset_id, str) or not dataset_id.strip():
                return get_json_result(code=RetCode.ARGUMENT_ERROR, message="dataset_id must be a non-empty string")
            dataset_id = dataset_id.strip()
            if not crawl_svc.kb_valid_for_tenant(dataset_id, tenant_id):
                return get_json_result(
                    code=RetCode.ARGUMENT_ERROR,
                    message="dataset_id is missing or not in this tenant",
                )
        else:
            dataset_id = None
        row = crawl_svc.create_task(
            tenant_id=tenant_id,
            created_by=user.id,
            name=name[:256],
            source_type=source_type,
            seed_urls=seeds,
            schedule_cron=schedule_cron,
            enabled=enabled,
            run_state=run_state,
            extra_config=extra,
            dataset_id=dataset_id,
        )
        return get_json_result(data=crawl_svc.task_row_to_dict(row))
    except Exception as e:  # noqa: BLE001
        return server_error_response(e)


@manager.route("/crawl/tasks/<task_id>", methods=["PATCH"])  # noqa: F821
@login_required
async def crawl_tasks_patch(task_id: str):
    denied = _assert_crawl_manage()
    if denied:
        return denied
    try:
        user = current_user
        is_super = bool(getattr(user, "is_superuser", False))
        allowed = crawl_svc.tenant_ids_for_crawl(user.id, is_super)
        t = crawl_svc.get_task(task_id)
        if not t:
            return get_json_result(code=RetCode.NOT_FOUND, message="crawl task not found")
        if not crawl_svc.user_may_access_task(t, allowed):
            return _crawl_task_forbidden_response()
        req = await get_request_json()
        updates: dict = {}
        if "name" in req:
            name = (req.get("name") or "").strip()
            if not name:
                return get_json_result(code=RetCode.ARGUMENT_ERROR, message="name must be non-empty")
            updates["name"] = name[:256]
        if "source_type" in req:
            st = str(req.get("source_type") or "").strip()
            if st not in crawl_svc.ALLOWED_SOURCE_TYPES:
                return get_json_result(code=RetCode.ARGUMENT_ERROR, message="invalid source_type")
            updates["source_type"] = st
        if "run_state" in req:
            rs = str(req.get("run_state") or "").strip()
            if rs not in crawl_svc.ALLOWED_RUN_STATES:
                return get_json_result(code=RetCode.ARGUMENT_ERROR, message="invalid run_state")
            updates["run_state"] = rs
        if "seed_urls" in req:
            seeds, err = crawl_svc.validate_seed_urls(req.get("seed_urls"))
            if err:
                return get_json_result(code=RetCode.ARGUMENT_ERROR, message=err)
            if not seeds:
                return get_json_result(code=RetCode.ARGUMENT_ERROR, message="seed_urls must be non-empty")
            updates["seed_urls"] = seeds
        if "schedule_cron" in req:
            schedule_cron = str(req.get("schedule_cron") or "").strip()[:128]
            cron_err = crawl_svc.validate_schedule_cron(schedule_cron)
            if cron_err:
                return get_json_result(code=RetCode.ARGUMENT_ERROR, message=cron_err)
            updates["schedule_cron"] = schedule_cron
        if "enabled" in req:
            updates["enabled"] = bool(req.get("enabled"))
        if "extra_config" in req:
            ex = req.get("extra_config")
            if not isinstance(ex, dict):
                return get_json_result(code=RetCode.ARGUMENT_ERROR, message="extra_config must be an object")
            secret_err = crawl_svc.validate_extra_config(ex)
            if secret_err:
                return get_json_result(code=RetCode.ARGUMENT_ERROR, message=secret_err)
            updates["extra_config"] = ex
        if "dataset_id" in req:
            ds = req.get("dataset_id")
            if ds is None:
                updates["dataset_id"] = None
            else:
                if not isinstance(ds, str) or not ds.strip():
                    return get_json_result(code=RetCode.ARGUMENT_ERROR, message="dataset_id must be a string")
                ds = ds.strip()
                if not crawl_svc.kb_valid_for_tenant(ds, t.tenant_id):
                    return get_json_result(
                        code=RetCode.ARGUMENT_ERROR,
                        message="dataset_id is missing or not in this tenant",
                    )
                updates["dataset_id"] = ds
        if not updates:
            return get_json_result(code=RetCode.ARGUMENT_ERROR, message="no fields to update")
        crawl_svc.update_task_fields(t, updates)
        t = crawl_svc.get_task(task_id)
        return get_json_result(data=crawl_svc.task_row_to_dict(t))
    except Exception as e:  # noqa: BLE001
        return server_error_response(e)


@manager.route("/crawl/tasks/<task_id>", methods=["DELETE"])  # noqa: F821
@login_required
async def crawl_tasks_delete(task_id: str):
    denied = _assert_crawl_manage()
    if denied:
        return denied
    try:
        user = current_user
        is_super = bool(getattr(user, "is_superuser", False))
        allowed = crawl_svc.tenant_ids_for_crawl(user.id, is_super)
        t = crawl_svc.get_task(task_id)
        if not t:
            return get_json_result(code=RetCode.NOT_FOUND, message="crawl task not found")
        if not crawl_svc.user_may_access_task(t, allowed):
            return _crawl_task_forbidden_response()
        crawl_svc.soft_delete_task(t)
        return get_json_result(message="deleted")
    except Exception as e:  # noqa: BLE001
        return server_error_response(e)


@manager.route("/crawl/tasks/<task_id>/run", methods=["POST"])  # noqa: F821
@login_required
async def crawl_tasks_run(task_id: str):
    """Manual one-shot stub tick (same semantics as the background worker)."""
    denied = _assert_crawl_manage()
    if denied:
        return denied
    try:
        user = current_user
        is_super = bool(getattr(user, "is_superuser", False))
        allowed = crawl_svc.tenant_ids_for_crawl(user.id, is_super)
        t = crawl_svc.get_task(task_id)
        if not t:
            return get_json_result(code=RetCode.NOT_FOUND, message="crawl task not found")
        if not crawl_svc.user_may_access_task(t, allowed):
            return _crawl_task_forbidden_response()
        try:
            crawl_svc.execute_crawl_task_stub_tick(task_id)
        except ValueError as e:
            return get_json_result(code=RetCode.NOT_FOUND, message=str(e))
        except RuntimeError as e:
            crawl_svc.record_worker_tick(
                task_id,
                ok=False,
                message=format_crawl_worker_error("WORKER_STUB", str(e)[:1800]),
            )
            return get_json_result(code=RetCode.EXCEPTION_ERROR, message=str(e))
        t2 = crawl_svc.get_task(task_id)
        return get_json_result(data=crawl_svc.task_row_to_dict(t2) if t2 else None)
    except Exception as e:  # noqa: BLE001
        return server_error_response(e)


@manager.route("/workspaces/<tenant_id>/managed-users", methods=["GET"])  # noqa: F821
@login_required
async def managed_users_list(tenant_id: str):
    denied = _assert_managed_users_read(tenant_id)
    if denied:
        return denied
    try:
        data = managed_users.list_managed_users(tenant_id)
        return get_json_result(data=data)
    except Exception as e:  # noqa: BLE001
        return server_error_response(e)


@manager.route("/workspaces/<tenant_id>/managed-users", methods=["POST"])  # noqa: F821
@login_required
async def managed_users_create(tenant_id: str):
    denied = _assert_managed_users_write(tenant_id)
    if denied:
        return denied
    try:
        req = await get_request_json()
        email = (req.get("email") or "").strip()
        nickname = (req.get("nickname") or "").strip()
        password = req.get("password")
        role = (req.get("role") or "").strip()
        perms = req.get("permissions")
        if not email or password is None or str(password).strip() == "" or not role:
            return get_json_result(
                code=RetCode.ARGUMENT_ERROR,
                message="email, password (RSA encrypted), and role are required",
            )
        perms_list = perms if isinstance(perms, list) else None
        row, err = managed_users.create_managed_user(
            tenant_id,
            current_user.id,
            email,
            nickname,
            str(password),
            role,
            perms_list,
        )
        if err:
            return get_json_result(code=RetCode.OPERATING_ERROR, message=err)
        return get_json_result(data=row)
    except Exception as e:  # noqa: BLE001
        return server_error_response(e)


@manager.route("/workspaces/<tenant_id>/managed-users/<user_id>", methods=["PATCH"])  # noqa: F821
@login_required
async def managed_users_patch(tenant_id: str, user_id: str):
    denied = _assert_managed_users_write(tenant_id)
    if denied:
        return denied
    try:
        req = await get_request_json()
        if not isinstance(req, dict):
            return get_json_result(code=RetCode.ARGUMENT_ERROR, message="JSON body required")
        row, err = managed_users.update_managed_user_fields(tenant_id, user_id, req)
        if err:
            return get_json_result(code=RetCode.OPERATING_ERROR, message=err)
        return get_json_result(data=row)
    except Exception as e:  # noqa: BLE001
        return server_error_response(e)


@manager.route("/workspaces/<tenant_id>/managed-users/<user_id>", methods=["DELETE"])  # noqa: F821
@login_required
async def managed_users_delete(tenant_id: str, user_id: str):
    is_self = current_user.id == user_id
    if not is_self:
        denied = _assert_managed_users_write(tenant_id)
        if denied:
            return denied
    else:
        denied = _assert_managed_users_read(tenant_id)
        if denied:
            return denied
    try:
        ok, err = managed_users.remove_managed_member(tenant_id, user_id)
        if not ok:
            return get_json_result(code=RetCode.OPERATING_ERROR, message=err or "delete failed")
        return get_json_result(data=True)
    except Exception as e:  # noqa: BLE001
        return server_error_response(e)
