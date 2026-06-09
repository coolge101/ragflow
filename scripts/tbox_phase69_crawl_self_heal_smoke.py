#!/usr/bin/env python3
"""Phase 69 crawl self-heal smoke: health / url-health / heal-log + optional prune path."""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.utils.crypt import crypt  # noqa: E402

BASE = os.environ.get("TBOX_SMOKE_BASE_URL", "http://127.0.0.1:9380").rstrip("/")
TASK_ID = os.environ.get("TBOX_CRAWL_TECH_TASK_ID", "8ac2c9ae634311f186a045a2ee896efb")
BAD_SEED = os.environ.get("TBOX_SELF_HEAL_BAD_SEED", "https://www.zhihu.com/")
PRUNE_RUNS = int(os.environ.get("TBOX_SELF_HEAL_PRUNE_RUNS", "3"))


def req(
    method: str,
    path: str,
    body: dict | None = None,
    token: str | None = None,
    *,
    allow_404: bool = False,
) -> tuple[dict, dict]:
    data = None if body is None else json.dumps(body).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=180) as resp:
            return json.loads(resp.read().decode()), {k.lower(): v for k, v in resp.headers.items()}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="replace")
        if allow_404 and exc.code == 404:
            try:
                return json.loads(raw), {}
            except json.JSONDecodeError:
                return {"code": 404, "message": raw[:500]}, {}
        print(f"HTTP {exc.code} {path}: {raw[:500]}", file=sys.stderr)
        raise


def login() -> str:
    _, hdrs = req("POST", "/api/v1/auth/login", {"email": "admin@ragflow.io", "password": crypt("admin")})
    token = hdrs.get("authorization")
    if not token:
        raise RuntimeError("login missing Authorization")
    return token


def heal_log_has_action(body: dict, action: str) -> bool:
    items = (body.get("data") or {}).get("items") or []
    return any(str(row.get("action") or "") == action for row in items)


def main() -> int:
    token = login()
    print("OK login")

    health, _ = req("GET", "/v1/tbox/crawl/health", None, token)
    if health.get("code") != 0:
        print("FAIL crawl/health:", health)
        return 1
    data = health.get("data") or {}
    recommended = str(data.get("recommended_discover_provider") or "")
    print("OK crawl/health recommended=", recommended, "self_heal=", data.get("self_heal_phase"))

    uh, _ = req("GET", f"/v1/tbox/crawl/tasks/{TASK_ID}/url-health?page=1&page_size=5", None, token)
    if uh.get("code") != 0:
        print("FAIL url-health:", uh)
        return 1
    print("OK url-health total=", (uh.get("data") or {}).get("total"))

    hl, _ = req("GET", f"/v1/tbox/crawl/tasks/{TASK_ID}/heal-log?page=1&page_size=10", None, token, allow_404=True)
    if hl.get("code") == 404:
        print("WARN heal-log route missing (rebuild ragflow image for Phase 69.1+)")
        return 0
    if hl.get("code") != 0:
        print("FAIL heal-log:", hl)
        return 1
    print("OK heal-log total=", (hl.get("data") or {}).get("total"))

    if os.environ.get("TBOX_SKIP_SELF_HEAL_PRUNE_SMOKE", "").strip().lower() in ("1", "true", "yes"):
        print("SKIP prune smoke (TBOX_SKIP_SELF_HEAL_PRUNE_SMOKE)")
        return 0

    patch_auto = {
        "run_state": "ready",
        "seed_urls": [BAD_SEED],
        "extra_config": {
            "tbox_crawl_search_provider": "auto",
            "tbox_crawl_search_queries": ["车联网 TBOX 技术趋势", "automotive TBOX technology trend"],
            "tbox_crawl_search_locale": "both",
            "tbox_crawl_catalog_topic": "tech",
            "tbox_crawl_self_heal_enabled": True,
            "tbox_crawl_auto_prune_seeds": True,
            "tbox_crawl_auto_import_catalog": True,
            "tbox_crawl_discover_skip_bfs": True,
            "tbox_skip_http_probe": True,
        },
    }
    patched, _ = req("PATCH", f"/v1/tbox/crawl/tasks/{TASK_ID}", patch_auto, token)
    if patched.get("code") != 0:
        print("FAIL patch auto+self-heal:", patched)
        return 1
    print("OK patched auto discover + self-heal probe task")

    last_err = ""
    for i in range(1, PRUNE_RUNS + 1):
        req("POST", f"/v1/tbox/crawl/tasks/{TASK_ID}/run", {}, token)
        got, _ = req("GET", f"/v1/tbox/crawl/tasks/{TASK_ID}", None, token)
        last_err = str((got.get("data") or {}).get("last_error") or "")
        print(f"RUN self-heal probe #{i}:", last_err[:240])
        time.sleep(0.5)

    hl2, _ = req("GET", f"/v1/tbox/crawl/tasks/{TASK_ID}/heal-log?page=1&page_size=20", None, token)
    if hl2.get("code") != 0:
        print("FAIL heal-log after runs:", hl2)
        return 1

    if heal_log_has_action(hl2, "prune_seed"):
        print("OK heal-log contains prune_seed")
    else:
        interval = os.environ.get("TBOX_CRAWL_SELF_HEAL_INTERVAL_SEC", "300")
        print(f"WARN: no prune_seed yet (need fail_count>=3 + low score; server TBOX_CRAWL_SELF_HEAL_INTERVAL_SEC={interval})")

    if heal_log_has_action(hl2, "import_catalog"):
        print("OK heal-log contains import_catalog")

    m_ing = re.search(r"ingested=(\d+)", last_err)
    if m_ing and int(m_ing.group(1)) >= 1:
        print("OK latest tick ingested>=1")
    elif "[tbox:TICK_OK]" in last_err:
        print("OK latest tick TICK_OK (ingest may be 0 if discover down)")
    else:
        print("WARN: unexpected latest tick outcome")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
