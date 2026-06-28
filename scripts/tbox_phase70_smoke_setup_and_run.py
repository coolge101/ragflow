#!/usr/bin/env python3
"""Create tech crawl task if missing, then run Phase 70 smoke checks."""

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
TASK_ID_ENV = os.environ.get("TBOX_CRAWL_TECH_TASK_ID", "")

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
    "tbox_crawl_keywords": ["车联网", "TBOX", "技术", "智能网联"],
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


def first_dataset_id(token: str) -> str:
    body, _ = req("GET", "/api/v1/datasets?page=1&page_size=20", None, token)
    items = (body.get("data") or []) if isinstance(body.get("data"), list) else []
    if not items:
        raise RuntimeError("no dataset available — create a KB first")
    return str(items[0]["id"])


def ensure_task(token: str) -> str:
    if TASK_ID_ENV:
        body, _ = req("GET", f"/v1/tbox/crawl/tasks/{TASK_ID_ENV}", None, token)
        if body.get("code") == 0:
            return TASK_ID_ENV

    dataset_id = first_dataset_id(token)
    create_body, _ = req(
        "POST",
        "/v1/tbox/crawl/tasks",
        {
            "name": "技术趋势爬取",
            "source_type": "static_web",
            "run_state": "ready",
            "enabled": True,
            "dataset_id": dataset_id,
            "seed_urls": ["https://example.com/"],
            "extra_config": TECH_EXTRA_CONFIG,
        },
        token,
    )
    if create_body.get("code") != 0:
        raise RuntimeError(f"create task failed: {create_body}")
    task_id = str((create_body.get("data") or {}).get("id") or "")
    if not task_id:
        raise RuntimeError(f"create task missing id: {create_body}")

    patch, _ = req(
        "PATCH",
        f"/v1/tbox/crawl/tasks/{task_id}",
        {"run_state": "ready", "extra_config": TECH_EXTRA_CONFIG},
        token,
    )
    if patch.get("code") != 0:
        raise RuntimeError(f"patch task failed: {patch}")
    print(f"OK created task {task_id} dataset={dataset_id}")
    return task_id


def run_smoke(token: str, task_id: str) -> int:
    patch, _ = req(
        "PATCH",
        f"/v1/tbox/crawl/tasks/{task_id}",
        {"run_state": "ready", "extra_config": TECH_EXTRA_CONFIG},
        token,
    )
    if patch.get("code") != 0:
        print("FAIL patch:", patch)
        return 1
    print("OK patched tech_trend discover-rank task")

    req("POST", f"/v1/tbox/crawl/tasks/{task_id}/run", {}, token)
    body, _ = req("GET", f"/v1/tbox/crawl/tasks/{task_id}", None, token)
    err = str((body.get("data") or {}).get("last_error") or "")
    print("RUN", err[:500])

    if "[tbox:TICK_OK]" not in err:
        print("FAIL: expected [tbox:TICK_OK] in last_error")
        return 1
    if "discover_hits=" not in err:
        print("FAIL: last_error missing discover_hits=")
        return 1
    if "skipped_serp_rank=" not in err:
        print("FAIL: last_error missing skipped_serp_rank=")
        return 1

    m_ing = re.search(r"ingested=(\d+)", err)
    ingested = int(m_ing.group(1)) if m_ing else 0
    if ingested >= 1:
        print(f"OK ingested={ingested}")
        return 0
    if "skipped_dup_content=" in err or "skipped_dup_url=" in err:
        print("OK tick completed (dedup skipped duplicates)")
        return 0

    print("FAIL: expected ingested>=1 or dedup skip in last_error")
    return 1


def main() -> int:
    token = login()
    print("OK login")
    task_id = ensure_task(token)
    os.environ["TBOX_CRAWL_TECH_TASK_ID"] = task_id
    return run_smoke(token, task_id)


if __name__ == "__main__":
    raise SystemExit(main())
