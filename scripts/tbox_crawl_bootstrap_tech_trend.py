#!/usr/bin/env python3
"""Configure 技术趋势爬取任务并执行一次 tick，验证入库「技术发展趋势」知识库。

Catalog deep-link seeds (Phase 70.2): ``uv run python scripts/tbox_seed_tech_catalog.py``
"""

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
DATASET_ID = os.environ.get("TBOX_CRAWL_TECH_DATASET_ID", "50ba00ce634311f186a045a2ee896efb")

# Discover-only: no homepage seeds (API rejects empty seed_urls on PATCH — omit when empty).
TECH_SEEDS: list[str] = []

TECH_KEYWORDS = [
    "车联网",
    "TBOX",
    "技术",
    "智能网联",
]

TECH_EXTRA_CONFIG = {
    "tbox_crawl_search_provider": "auto",
    "tbox_crawl_query_template": "tech_trend",
    "tbox_crawl_url_quality_mode": "strict",
    "tbox_crawl_discover_skip_bfs": True,
    "tbox_crawl_discover_rank_mode": "rules",
    "tbox_crawl_discover_rank_min_score": 55,
    "tbox_crawl_relevance_mode": "rules",
    "tbox_crawl_relevance_min_score": 60,
    "tbox_crawl_min_extract_chars": 300,
    "tbox_crawl_keywords": TECH_KEYWORDS,
    "tbox_skip_http_probe": True,
}


def req(method: str, path: str, body: dict | None = None, token: str | None = None) -> tuple[dict, dict]:
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
        raise RuntimeError(f"HTTP {exc.code} {path}: {raw[:400]}") from exc


def login() -> str:
    _, hdrs = req("POST", "/api/v1/auth/login", {"email": "admin@ragflow.io", "password": crypt("admin")})
    token = hdrs.get("authorization")
    if not token:
        raise RuntimeError("login missing Authorization")
    return token


def main() -> int:
    token = login()
    print("OK login")

    patch: dict = {
        "name": "技术趋势爬取",
        "source_type": "static_web",
        "run_state": "ready",
        "enabled": True,
        "dataset_id": DATASET_ID,
        "extra_config": TECH_EXTRA_CONFIG,
    }
    if TECH_SEEDS:
        patch["seed_urls"] = TECH_SEEDS

    body, _ = req("PATCH", f"/v1/tbox/crawl/tasks/{TASK_ID}", patch, token)
    if body.get("code") != 0:
        print("FAIL patch:", body)
        return 1
    print("OK patched task (discover-only tech_trend + rank/relevance gates)")

    req("POST", f"/v1/tbox/crawl/tasks/{TASK_ID}/run", {}, token)
    body, _ = req("GET", f"/v1/tbox/crawl/tasks/{TASK_ID}", None, token)
    err = str((body.get("data") or {}).get("last_error") or "")
    print("RUN last_error:", err[:400])

    if "[tbox:TICK_OK]" not in err:
        print("FAIL: expected successful tick")
        return 1
    m = re.search(r"ingested=(\d+)", err)
    n = int(m.group(1)) if m else 0
    if n >= 1:
        print(f"OK crawl ingested {n} document(s) into dataset {DATASET_ID}")
        return 0
    if "skipped_dup_content=" in err or "skipped_dup_url=" in err:
        print("OK tick completed (dedup skipped duplicates)")
        return 0
    print("WARN: tick OK but ingested=0 — check discover provider or dedup")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
