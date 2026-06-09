#!/usr/bin/env python3
"""Phase 68 crawl quality smoke: URL quality + optional SearXNG discover."""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.utils.crypt import crypt  # noqa: E402

BASE = os.environ.get("TBOX_SMOKE_BASE_URL", "http://127.0.0.1:9380").rstrip("/")
TASK_ID = os.environ.get("TBOX_CRAWL_TECH_TASK_ID", "8ac2c9ae634311f186a045a2ee896efb")


def req(method: str, path: str, body: dict | None = None, token: str | None = None) -> tuple[dict, dict]:
    data = None if body is None else json.dumps(body).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=180) as resp:
        return json.loads(resp.read().decode()), {k.lower(): v for k, v in resp.headers.items()}


def login() -> str:
    _, hdrs = req("POST", "/api/v1/auth/login", {"email": "admin@ragflow.io", "password": crypt("admin")})
    token = hdrs.get("authorization")
    if not token:
        raise RuntimeError("login missing Authorization")
    return token


def main() -> int:
    token = login()
    print("OK login")

    # discover-only: only patch extra_config (API requires non-empty seed_urls if sent)
    patch = {
        "run_state": "ready",
        "extra_config": {
            "tbox_crawl_search_provider": "searxng",
            "tbox_crawl_search_queries": ["车联网 TBOX 技术架构 白皮书", "automotive TBOX technology trend"],
            "tbox_crawl_search_locale": "both",
            "tbox_crawl_url_quality_mode": "normal",
            "tbox_crawl_extract_main_content": True,
            "tbox_crawl_min_extract_chars": 200,
            "tbox_crawl_discover_skip_bfs": True,
            "tbox_skip_http_probe": True,
        },
    }
    body, _ = req("PATCH", f"/v1/tbox/crawl/tasks/{TASK_ID}", patch, token)
    if body.get("code") != 0:
        print("FAIL patch:", body)
        return 1
    print("OK patched discover-only tech task")

    req("POST", f"/v1/tbox/crawl/tasks/{TASK_ID}/run", {}, token)
    body, _ = req("GET", f"/v1/tbox/crawl/tasks/{TASK_ID}", None, token)
    err = str((body.get("data") or {}).get("last_error") or "")
    print("RUN", err[:500])
    if "[tbox:TICK_OK]" not in err and "[tbox:INGEST_STATIC]" not in err:
        print("WARN: unexpected tick outcome (is SearXNG up?)")
        return 0
    m_disc = re.search(r"discovered=(\d+)", err)
    m_ing = re.search(r"ingested=(\d+)", err)
    if m_disc and int(m_disc.group(1)) >= 1:
        print("OK discover path active")
    if m_ing and int(m_ing.group(1)) >= 1:
        print("OK ingested with quality pipeline")
    if "skipped_low_quality" in err:
        print("OK quality stats present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
