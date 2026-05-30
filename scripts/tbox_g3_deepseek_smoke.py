#!/usr/bin/env python3
"""G3 DeepSeek 对话冒烟：health → LLM 列表 → 可选设 Key → chat/completions（供 docs/TBOX_DEEPSEEK_SMOKE.md）。"""

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
EMAIL = os.environ.get("TBOX_SMOKE_EMAIL", "admin@ragflow.io")
PASSWORD = os.environ.get("TBOX_SMOKE_PASSWORD", "admin")
FACTORY = os.environ.get("TBOX_SMOKE_DEEPSEEK_FACTORY", "DeepSeek")
API_KEY = os.environ.get("TBOX_SMOKE_DEEPSEEK_API_KEY", "").strip()
MODEL_ID = os.environ.get("TBOX_SMOKE_DEEPSEEK_MODEL", "").strip()
PROMPT = os.environ.get("TBOX_SMOKE_DEEPSEEK_PROMPT", "Reply with exactly: TBOX-DEEPSEEK-OK")


@dataclass
class SmokeResult:
    health_ok: bool
    tbox_contract_version: int | None
    deepseek_models: list[str]
    deepseek_available: bool
    api_key_configured: bool
    chat_attempted: bool
    chat_ok: bool
    answer_preview: str
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
    auth = r.headers.get("Authorization")
    if not auth:
        raise RuntimeError("login missing Authorization header")
    return auth


def headers(auth: str) -> dict[str, str]:
    return {"Authorization": auth, "Content-Type": "application/json"}


def check_health() -> tuple[bool, int | None]:
    r = requests.get(f"{BASE}/v1/tbox/health", timeout=15)
    if r.status_code != 200:
        return False, None
    body = r.json()
    if body.get("code") != 0:
        return False, None
    data = body.get("data") or {}
    ver = data.get("tbox_api_contract_version")
    return data.get("status") == "ok", int(ver) if ver is not None else None


def list_deepseek_chat(auth: str) -> tuple[list[str], bool]:
    r = requests.get(
        f"{BASE}/v1/llm/list",
        headers=headers(auth),
        params={"model_type": "chat"},
        timeout=30,
    )
    body = r.json()
    if body.get("code") != 0:
        raise RuntimeError(f"llm list failed: {body.get('message')}")
    bucket = (body.get("data") or {}).get(FACTORY) or []
    ids: list[str] = []
    any_available = False
    for m in bucket:
        name = str(m.get("llm_name") or "")
        fid = str(m.get("fid") or FACTORY)
        model_id = f"{name}@{fid}"
        ids.append(model_id)
        if m.get("available"):
            any_available = True
    return ids, any_available


def set_deepseek_key(auth: str, api_key: str) -> None:
    r = requests.post(
        f"{BASE}/v1/llm/set_api_key",
        headers=headers(auth),
        json={"llm_factory": FACTORY, "api_key": api_key},
        timeout=120,
    )
    body = r.json()
    if body.get("code") != 0:
        raise RuntimeError(f"set_api_key failed: {body.get('message')}")


def chat_once(auth: str, llm_id: str) -> tuple[bool, str]:
    r = requests.post(
        f"{BASE}/api/v1/chat/completions",
        headers=headers(auth),
        json={
            "stream": True,
            "llm_id": llm_id,
            "messages": [{"role": "user", "content": PROMPT}],
        },
        timeout=120,
        stream=True,
    )
    if r.status_code != 200:
        return False, f"HTTP {r.status_code}: {r.text[:200]}"

    answer_parts: list[str] = []
    for raw_line in r.iter_lines(decode_unicode=True):
        if not raw_line or not raw_line.startswith("data:"):
            continue
        payload = raw_line[5:].strip()
        if not payload:
            continue
        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError:
            continue
        if parsed.get("data") is True:
            break
        if parsed.get("code") not in (0, None):
            return False, str(parsed.get("message") or parsed)
        data = parsed.get("data")
        if isinstance(data, dict) and "answer" in data:
            chunk = str(data.get("answer") or "")
            if "**ERROR**" in chunk:
                return False, chunk[:500]
            answer_parts.append(chunk)

    answer = "".join(answer_parts).strip()
    if not answer:
        return False, "empty answer"
    return True, answer[:200]


def pick_model(ids: list[str], available: bool) -> str | None:
    if MODEL_ID:
        return MODEL_ID
    if not ids:
        return None
    preferred = [i for i in ids if "flash" in i.lower()]
    return preferred[0] if preferred else ids[0]


def run_smoke() -> dict:
    health_ok, contract_ver = check_health()
    auth = login()
    models, available = list_deepseek_chat(auth)
    note_parts: list[str] = []

    if API_KEY:
        set_deepseek_key(auth, API_KEY)
        models, available = list_deepseek_chat(auth)
        note_parts.append("api_key set from env")

    model_id = pick_model(models, available)
    chat_attempted = False
    chat_ok = False
    preview = ""

    if not models:
        note_parts.append("no DeepSeek chat models in catalog")
    elif not available and not API_KEY:
        note_parts.append("skipped chat: set TBOX_SMOKE_DEEPSEEK_API_KEY or configure in /kb")
    elif model_id:
        chat_attempted = True
        chat_ok, preview = chat_once(auth, model_id)
        if not chat_ok:
            note_parts.append(f"chat failed: {preview[:120]}")

    return {
        "base_url": BASE,
        "factory": FACTORY,
        "email": EMAIL,
        "result": asdict(
            SmokeResult(
                health_ok=health_ok,
                tbox_contract_version=contract_ver,
                deepseek_models=models,
                deepseek_available=available,
                api_key_configured=bool(API_KEY),
                chat_attempted=chat_attempted,
                chat_ok=chat_ok,
                answer_preview=preview,
                note="; ".join(note_parts) if note_parts else ("ok" if chat_ok else "skipped"),
            )
        ),
    }


if __name__ == "__main__":
    print(json.dumps(run_smoke(), ensure_ascii=False, indent=2))
