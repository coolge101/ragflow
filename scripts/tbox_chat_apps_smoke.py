#!/usr/bin/env python3
"""G3 对话应用 CRUD 冒烟：login → list → create → get → delete（/api/v1/chats）。"""

from __future__ import annotations

import json
import os
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.utils.crypt import crypt  # noqa: E402

BASE = os.environ.get("TBOX_SMOKE_BASE_URL", "http://127.0.0.1:9380").rstrip("/")
EMAIL = os.environ.get("TBOX_SMOKE_EMAIL", "admin@ragflow.io")
PASSWORD = os.environ.get("TBOX_SMOKE_PASSWORD", "admin")


@dataclass
class SmokeResult:
    list_ok: bool
    create_ok: bool
    get_ok: bool
    delete_ok: bool
    chat_id: str
    note: str


def login() -> str:
    r = requests.post(
        f"{BASE}/api/v1/auth/login",
        json={"email": EMAIL, "password": crypt(PASSWORD)},
        timeout=30,
    )
    body = r.json()
    if body.get("code") != 0:
        raise RuntimeError(f"login failed: {body.get('message')}")
    auth = r.headers.get("Authorization") or r.headers.get("authorization") or (body.get("data") or {}).get("access_token") or ""
    if not auth:
        raise RuntimeError("login missing token")
    return auth


def hdr(auth: str) -> dict[str, str]:
    return {"Authorization": auth, "Content-Type": "application/json"}


def first_dataset_id(auth: str) -> str | None:
    r = requests.get(
        f"{BASE}/api/v1/datasets",
        headers=hdr(auth),
        params={"page": 1, "page_size": 1, "orderby": "create_time", "desc": "true"},
        timeout=30,
    )
    body = r.json()
    if body.get("code") != 0:
        return None
    rows = body.get("data") or []
    if isinstance(rows, dict):
        rows = rows.get("data") or rows.get("datasets") or []
    if not rows:
        return None
    return str(rows[0].get("id") or "")


def main() -> int:
    auth = login()
    list_ok = create_ok = get_ok = delete_ok = False
    chat_id = ""
    note = "ok"

    r = requests.get(f"{BASE}/api/v1/chats", headers=hdr(auth), params={"page": 1, "page_size": 5}, timeout=30)
    body = r.json()
    if body.get("code") != 0:
        raise RuntimeError(f"list chats failed: {body.get('message')}")
    list_ok = True

    ds_id = first_dataset_id(auth)
    payload: dict = {
        "name": f"TBOX-SMOKE-{int(time.time())}",
        "description": "automated smoke",
        "language": "Chinese",
        "prompt_config": {
            "system": "You are a test assistant. {knowledge}",
            "prologue": "smoke",
            "empty_response": "no data",
            "parameters": [{"key": "knowledge", "optional": False}],
            "quote": True,
        },
    }
    if ds_id:
        payload["dataset_ids"] = [ds_id]

    r = requests.post(f"{BASE}/api/v1/chats", headers=hdr(auth), json=payload, timeout=30)
    body = r.json()
    if body.get("code") != 0:
        raise RuntimeError(f"create chat failed: {body.get('message')}")
    data = body.get("data") or {}
    chat_id = str(data.get("id") or "")
    if not chat_id:
        raise RuntimeError("create chat missing id")
    create_ok = True

    r = requests.get(f"{BASE}/api/v1/chats/{chat_id}", headers=hdr(auth), timeout=30)
    body = r.json()
    if body.get("code") != 0:
        raise RuntimeError(f"get chat failed: {body.get('message')}")
    get_ok = True

    r = requests.delete(f"{BASE}/api/v1/chats/{chat_id}", headers=hdr(auth), timeout=30)
    body = r.json()
    if body.get("code") != 0:
        raise RuntimeError(f"delete chat failed: {body.get('message')}")
    delete_ok = True

    out = SmokeResult(list_ok, create_ok, get_ok, delete_ok, chat_id, note)
    print(json.dumps({"base_url": BASE, "email": EMAIL, "result": asdict(out)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as ex:
        print(json.dumps({"error": str(ex)}), file=sys.stderr)
        raise SystemExit(1) from ex
