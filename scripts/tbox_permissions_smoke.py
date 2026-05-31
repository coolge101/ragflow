#!/usr/bin/env python3
"""G5 权限冒烟：admin /v1/tbox/me 含运维权限；可选普通用户无 admin 权限。"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.utils.crypt import crypt  # noqa: E402

BASE = os.environ.get("TBOX_SMOKE_BASE_URL", "http://127.0.0.1:9380").rstrip("/")
ADMIN_EMAIL = os.environ.get("TBOX_SMOKE_EMAIL") or os.environ.get("TBOX_LOGIN_EMAIL") or "admin@ragflow.io"
ADMIN_PASSWORD = os.environ.get("TBOX_SMOKE_PASSWORD") or os.environ.get("TBOX_LOGIN_PASSWORD") or "admin"
NORMAL_EMAIL = os.environ.get("TBOX_SMOKE_NORMAL_EMAIL", "")
NORMAL_PASSWORD = os.environ.get("TBOX_SMOKE_NORMAL_PASSWORD", "")

ADMIN_ONLY = frozenset({"user.manage", "audit.read", "kb.dangerous", "stats.read"})
NORMAL_REQUIRED = frozenset({"chat.use", "search.use", "doc.view"})


@dataclass
class SmokeResult:
    admin_ok: bool
    admin_permissions: list[str]
    normal_checked: bool
    normal_ok: bool
    normal_permissions: list[str]
    note: str


def login(email: str, password: str) -> str:
    r = requests.post(
        f"{BASE}/api/v1/auth/login",
        json={"email": email, "password": crypt(password)},
        timeout=30,
    )
    body = r.json()
    if body.get("code") != 0:
        raise RuntimeError(f"login failed ({email}): {body.get('message')}")
    auth = r.headers.get("Authorization") or r.headers.get("authorization") or (body.get("data") or {}).get("access_token") or ""
    if not auth:
        raise RuntimeError(f"login missing token ({email})")
    return auth


def fetch_permissions(auth: str) -> list[str]:
    r = requests.get(f"{BASE}/v1/tbox/me", headers={"Authorization": auth}, timeout=30)
    body = r.json()
    if body.get("code") != 0:
        raise RuntimeError(f"/v1/tbox/me failed: {body.get('message')}")
    data = body.get("data") or {}
    perms = data.get("permissions") or []
    if not isinstance(perms, list):
        raise RuntimeError("permissions not a list")
    return [str(p) for p in perms]


def main() -> int:
    admin_auth = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    admin_perms = fetch_permissions(admin_auth)
    admin_set = set(admin_perms)
    missing_admin = sorted(ADMIN_ONLY - admin_set)
    if missing_admin:
        raise RuntimeError(f"admin missing permissions: {missing_admin}")
    admin_ok = True

    normal_checked = normal_ok = False
    normal_perms: list[str] = []
    note = "admin only (set TBOX_SMOKE_NORMAL_EMAIL/PASSWORD for dual-account)"

    has_normal_email = bool(NORMAL_EMAIL)
    has_normal_password = bool(NORMAL_PASSWORD)
    if has_normal_email ^ has_normal_password:
        raise RuntimeError("partial dual-account config: set both TBOX_SMOKE_NORMAL_EMAIL and TBOX_SMOKE_NORMAL_PASSWORD (see docs/TBOX_SMOKE_ENV.md)")

    if NORMAL_EMAIL and NORMAL_PASSWORD:
        normal_auth = login(NORMAL_EMAIL, NORMAL_PASSWORD)
        normal_perms = fetch_permissions(normal_auth)
        normal_set = set(normal_perms)
        leaked = sorted(ADMIN_ONLY & normal_set)
        if leaked:
            raise RuntimeError(f"normal user must not have: {leaked}")
        missing_normal = sorted(NORMAL_REQUIRED - normal_set)
        if missing_normal:
            raise RuntimeError(f"normal user missing permissions: {missing_normal}")
        normal_checked = normal_ok = True
        note = "admin + normal dual-account ok"

    out = SmokeResult(admin_ok, admin_perms, normal_checked, normal_ok, normal_perms, note)
    print(
        json.dumps(
            {
                "base_url": BASE,
                "admin_email": ADMIN_EMAIL,
                "normal_email": NORMAL_EMAIL or None,
                "result": asdict(out),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as ex:
        print(json.dumps({"error": str(ex)}), file=sys.stderr)
        raise SystemExit(1) from ex
