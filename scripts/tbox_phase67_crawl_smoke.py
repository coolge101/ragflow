#!/usr/bin/env python3
"""Phase 67 discover/dedup API smoke (run inside ragflow container or with PYTHONPATH)."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.utils.crypt import crypt  # noqa: E402


def main() -> int:
    base = os.environ.get("TBOX_SMOKE_BASE_URL", "http://127.0.0.1:9380").rstrip("/")
    email = os.environ.get("TBOX_LOGIN_EMAIL", os.environ.get("TBOX_SMOKE_EMAIL", "admin@ragflow.io"))
    password = os.environ.get("TBOX_LOGIN_PASSWORD", os.environ.get("TBOX_SMOKE_PASSWORD", "admin"))
    task_id = os.environ.get("TBOX_CRAWL_SMOKE_TASK_ID", "72339e405e8911f1906a791f22bf97c8")
    dataset_id = os.environ.get("TBOX_CRAWL_SMOKE_DATASET_ID", "03e04d3e4c7e11f197f599d668cf34cb")

    def req(method: str, path: str, body: dict | None = None, token: str | None = None) -> tuple[dict, dict]:
        url = base + path
        data = None if body is None else json.dumps(body).encode()
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = token
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=120) as resp:
                hdrs = {k.lower(): v for k, v in resp.headers.items()}
                return json.loads(resp.read().decode()), hdrs
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode(errors="replace")
            print(f"HTTP {exc.code} {path}: {raw[:500]}", file=sys.stderr)
            raise

    login_body, login_hdrs = req("POST", "/api/v1/auth/login", {"email": email, "password": crypt(password)})
    if login_body.get("code") != 0:
        print("FAIL login:", login_body)
        return 1
    token = login_hdrs.get("authorization") or login_body.get("data", {}).get("access_token")
    if not token:
        print("FAIL login: no Authorization token")
        return 1
    print("OK login")

    patch_discover = {
        "extra_config": {
            "tbox_crawl_search_provider": "tavily",
            "tbox_crawl_search_queries": [
                "TBOX 车联网 标准 法规",
                "C-V2X TBOX standard regulation",
            ],
            "tbox_crawl_search_locale": "both",
            "tbox_crawl_allowed_domains": ["cttic.cn"],
            "tbox_skip_http_probe": True,
        },
        "dataset_id": dataset_id,
        "run_state": "ready",
    }
    patched, _ = req("PATCH", f"/v1/tbox/crawl/tasks/{task_id}", patch_discover, token)
    print("PATCH discover:", patched.get("code"), patched.get("message", ""))
    if patched.get("code") != 0:
        return 1

    req("POST", f"/v1/tbox/crawl/tasks/{task_id}/run", {}, token)
    got, _ = req("GET", f"/v1/tbox/crawl/tasks/{task_id}", None, token)
    last_err = str((got.get("data") or {}).get("last_error") or "")
    print("RUN discover last_error:", last_err[:240])
    if "DISCOVER_NO_KEY" in last_err:
        print("OK discover without Tavily key -> DISCOVER_NO_KEY")
    elif "TICK_OK" in last_err:
        print("OK discover tick (Tavily key present)")
    else:
        print("WARN unexpected discover tick error")

    patch_seed = {
        "extra_config": {"tbox_crawl_search_provider": "none", "tbox_skip_http_probe": True},
        "seed_urls": ["https://www.cttic.cn/"],
        "dataset_id": dataset_id,
    }
    patched2, _ = req("PATCH", f"/v1/tbox/crawl/tasks/{task_id}", patch_seed, token)
    print("PATCH seed-only:", patched2.get("code"))
    if patched2.get("code") != 0:
        return 1

    last_err = ""
    for i in range(1, 3):
        req("POST", f"/v1/tbox/crawl/tasks/{task_id}/run", {}, token)
        got, _ = req("GET", f"/v1/tbox/crawl/tasks/{task_id}", None, token)
        last_err = str((got.get("data") or {}).get("last_error") or "")
        print(f"RUN seed #{i} last_error:", last_err[:240])

    if "[tbox:TICK_OK]" not in last_err:
        print("FAIL: seed tick missing [tbox:TICK_OK]")
        return 1
    if i == 2 and "skipped_dup" not in last_err:
        print("WARN: second tick expected skipped_dup_* in summary")
    print("OK seed tick summary present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
