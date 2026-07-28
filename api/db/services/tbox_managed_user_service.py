#
#  TBOX: workspace-scoped user CRUD (no email invite flow).
#
import json
import logging
import re
from typing import Any

from api.db import UserTenantRole
from api.db.db_models import UserTenant
from api.db.services.user_service import UserService, UserTenantService
from common.constants import StatusEnum
from common.misc_utils import get_uuid
from common.time_utils import delta_seconds, get_format_time

from api.utils.crypt import decrypt
from werkzeug.security import generate_password_hash

_TBOX_PERM_ALL = frozenset(
    {
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
    },
)

# RAGFlow `UserTenantRole` assignable by workspace managers (never `owner` here).
_MANAGED_ROLES = frozenset(
    {UserTenantRole.ADMIN.value, UserTenantRole.NORMAL.value, UserTenantRole.INVITE.value},
)


def _normalize_permissions(raw: Any) -> list[str] | None:
    if raw is None:
        return None
    if isinstance(raw, str) and not raw.strip():
        return None
    arr = raw
    if isinstance(raw, str):
        try:
            arr = json.loads(raw)
        except Exception:
            return None
    if not isinstance(arr, list) or len(arr) == 0:
        return None
    out = [str(p) for p in arr if str(p) in _TBOX_PERM_ALL]
    return out or None


def _serialize_row(r: dict) -> dict:
    perms = _normalize_permissions(r.get("tbox_permissions"))
    ud = r.get("update_date")
    ds = None
    if ud is not None:
        try:
            ds = delta_seconds(str(ud))
        except Exception:
            ds = None
    return {
        "user_tenant_id": r.get("id"),
        "user_id": r.get("user_id"),
        "email": r.get("email"),
        "nickname": r.get("nickname"),
        "role": r.get("role"),
        "status": r.get("status"),
        "is_superuser": bool(r.get("is_superuser")),
        "permissions": perms if perms is not None else [],
        "uses_permission_override": _normalize_permissions(r.get("tbox_permissions")) is not None,
        "update_date": str(ud) if ud is not None else None,
        "delta_seconds": ds,
    }


def list_managed_users(tenant_id: str) -> list[dict]:
    rows = UserTenantService.get_all_members_for_tenant(tenant_id)
    return [_serialize_row(dict(r)) for r in rows]


def _validate_email(email: str) -> str | None:
    e = (email or "").strip().lower()
    if not e or not re.match(r"^[\w\._-]+@([\w_-]+\.)+[\w-]{2,}$", e):
        return None
    return e


def _decrypt_password_field(pw_field: str) -> tuple[str | None, str | None]:
    """Returns (plain_password, error_message)."""
    try:
        return decrypt(pw_field), None
    except Exception as exc:  # noqa: BLE001
        logging.exception(exc)
        return None, "Fail to decrypt password"


def create_managed_user(
    tenant_id: str,
    manager_id: str,
    email: str,
    nickname: str,
    password_encrypted: str,
    role: str,
    permissions: list[str] | None,
) -> tuple[dict | None, str | None]:
    email_n = _validate_email(email)
    if not email_n:
        return None, "Invalid email address"
    role_l = str(role or "").strip().lower()
    if role_l not in _MANAGED_ROLES:
        return None, f"role must be one of: {', '.join(sorted(_MANAGED_ROLES))}"
    plain, err = _decrypt_password_field(password_encrypted)
    if err:
        return None, err
    if not plain or len(plain) < 6:
        return None, "Password must be at least 6 characters after decrypt"

    users = UserService.query(email=email_n)
    if users:
        user = users[0]
        uid = user.id
        if UserTenantService.filter_by_tenant_and_user_id(tenant_id, uid):
            return None, "User is already a member of this workspace"
        UserService.update_user(
            uid,
            {
                "nickname": (nickname or "").strip() or user.nickname,
                "password": generate_password_hash(str(plain)),
            },
        )
    else:
        uid = get_uuid()
        nick = (nickname or "").strip() or email_n.split("@")[0]
        try:
            UserService.save(
                id=uid,
                email=email_n,
                nickname=nick,
                password=str(plain),
                access_token=get_uuid(),
                login_channel="password",
                last_login_time=get_format_time(),
                is_superuser=False,
                is_active="1",
                is_authenticated="1",
                is_anonymous="0",
                status=StatusEnum.VALID.value,
            )
        except Exception as exc:  # noqa: BLE001
            logging.exception(exc)
            return None, "Failed to create user"

    perm_json = None
    norm = _normalize_permissions(permissions)
    if norm is not None:
        perm_json = json.dumps(norm, ensure_ascii=False)

    UserTenantService.save(
        id=get_uuid(),
        user_id=uid,
        tenant_id=tenant_id,
        invited_by=manager_id,
        role=role_l,
        status=StatusEnum.VALID.value,
        tbox_permissions=perm_json,
    )
    row = UserTenantService.filter_by_tenant_and_user_id(tenant_id, uid)
    if not row:
        return None, "Failed to link user to workspace"
    full = UserTenantService.get_all_members_for_tenant(tenant_id)
    for r in full:
        if str(r.get("user_id")) == str(uid):
            return _serialize_row(dict(r)), None
    return None, "User created but not found in listing"


def update_managed_user_fields(
    tenant_id: str,
    target_user_id: str,
    body: dict,
) -> tuple[dict | None, str | None]:
    """Dispatch update from JSON body (permissions key missing = no change; null = clear override)."""
    if target_user_id == tenant_id:
        if body.get("role") is not None or "permissions" in body:
            return None, "Cannot change workspace owner role or permission override via this API"
        user_ok, user = UserService.get_by_id(target_user_id)
        if not user_ok or not user:
            return None, "User not found"
        udict: dict = {}
        if "nickname" in body and body["nickname"] is not None:
            udict["nickname"] = str(body["nickname"]).strip() or user.nickname
        if "email" in body and body["email"] is not None:
            email_n = _validate_email(str(body["email"]))
            if not email_n:
                return None, "Invalid email address"
            others = UserService.query(email=email_n)
            if others and str(others[0].id) != str(target_user_id):
                return None, "Email is already used by another account"
            udict["email"] = email_n
        if body.get("password"):
            plain, err = _decrypt_password_field(str(body["password"]))
            if err:
                return None, err
            if not plain or len(plain) < 6:
                return None, "Password must be at least 6 characters after decrypt"
            udict["password"] = generate_password_hash(str(plain))
        if udict:
            UserService.update_user(target_user_id, udict)
        full = UserTenantService.get_all_members_for_tenant(tenant_id)
        for r in full:
            if str(r.get("user_id")) == str(target_user_id):
                return _serialize_row(dict(r)), None
        return None, "Owner not found in listing"

    rel = UserTenantService.filter_by_tenant_and_user_id(tenant_id, target_user_id)
    if not rel or str(rel.status) != str(StatusEnum.VALID.value):
        return None, "User is not a member of this workspace"

    user_ok, user = UserService.get_by_id(target_user_id)
    if not user_ok or not user:
        return None, "User not found"

    udict: dict = {}
    if "nickname" in body and body["nickname"] is not None:
        udict["nickname"] = str(body["nickname"]).strip() or user.nickname
    if "email" in body and body["email"] is not None:
        email_n = _validate_email(str(body["email"]))
        if not email_n:
            return None, "Invalid email address"
        others = UserService.query(email=email_n)
        if others and str(others[0].id) != str(target_user_id):
            return None, "Email is already used by another account"
        udict["email"] = email_n
    if body.get("password"):
        plain, err = _decrypt_password_field(str(body["password"]))
        if err:
            return None, err
        if not plain or len(plain) < 6:
            return None, "Password must be at least 6 characters after decrypt"
        udict["password"] = generate_password_hash(str(plain))

    if udict:
        UserService.update_user(target_user_id, udict)

    ut_updates: dict = {}
    if "role" in body and body["role"] is not None:
        rl = str(body["role"]).strip().lower()
        if rl == UserTenantRole.OWNER.value:
            return None, "Cannot set role to owner"
        if rl not in _MANAGED_ROLES:
            return None, f"role must be one of: {', '.join(sorted(_MANAGED_ROLES))}"
        ut_updates["role"] = rl

    if "permissions" in body:
        perm_val = body["permissions"]
        if perm_val is None:
            ut_updates["tbox_permissions"] = None
        elif isinstance(perm_val, list):
            norm = _normalize_permissions(perm_val)
            ut_updates["tbox_permissions"] = json.dumps(norm, ensure_ascii=False) if norm else None
        else:
            return None, "permissions must be an array or null"

    if ut_updates:
        UserTenantService.filter_update(
            [
                UserTenant.tenant_id == tenant_id,
                UserTenant.user_id == target_user_id,
                UserTenant.status == StatusEnum.VALID.value,
            ],
            ut_updates,
        )

    full = UserTenantService.get_all_members_for_tenant(tenant_id)
    for r in full:
        if str(r.get("user_id")) == str(target_user_id):
            return _serialize_row(dict(r)), None
    return None, "Updated but user not found in listing"


def remove_managed_member(tenant_id: str, target_user_id: str) -> tuple[bool, str | None]:
    if target_user_id == tenant_id:
        return False, "Cannot remove the workspace owner from the team."
    rel = UserTenantService.filter_by_tenant_and_user_id(tenant_id, target_user_id)
    if not rel:
        return False, "User is not a member of this workspace"
    if str(rel.role) == UserTenantRole.OWNER.value:
        return False, "Cannot remove owner role row"
    try:
        UserTenantService.filter_delete([UserTenant.tenant_id == tenant_id, UserTenant.user_id == target_user_id])
        return True, None
    except Exception as exc:  # noqa: BLE001
        logging.exception(exc)
        return False, str(exc)
