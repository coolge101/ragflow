#!/usr/bin/env python3
"""Seed tech-topic crawl source catalog entries (Phase 70.2).

Inserts ≥3 deep-link reference sources (not site roots) into
``/v1/tbox/crawl/sources`` with ``topic=tech``. Idempotent: existing URLs
(by canonical form) are skipped after listing the catalog first.

Usage::

    cd C:/ragflow/ragflow
    export TBOX_SMOKE_BASE_URL=http://127.0.0.1:9380
    uv run python scripts/tbox_seed_tech_catalog.py

Environment:

    TBOX_SMOKE_BASE_URL   API base (default ``http://127.0.0.1:9380``)
    TBOX_TENANT_ID        Tenant for catalog rows (default: from tech crawl task)
    TBOX_CRAWL_TECH_TASK_ID  Task used to resolve tenant (default tech task id)
    TBOX_LOGIN_EMAIL / TBOX_LOGIN_PASSWORD  Override demo admin credentials

After seeding, import into a crawl task from the 5180 UI or via::

    POST /v1/tbox/crawl/tasks/<task_id>/import-sources
    {"topic": "tech", "replace": false}
"""

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
from common.tbox_crawl_dedup import canonicalize_url  # noqa: E402

BASE = os.environ.get("TBOX_SMOKE_BASE_URL", "http://127.0.0.1:9380").rstrip("/")
TASK_ID = os.environ.get("TBOX_CRAWL_TECH_TASK_ID", "8ac2c9ae634311f186a045a2ee896efb")
LOGIN_EMAIL = os.environ.get("TBOX_LOGIN_EMAIL", "admin@ragflow.io")
LOGIN_PASSWORD = os.environ.get("TBOX_LOGIN_PASSWORD", "admin")

# Deep links only — column / article-list pages, not site roots.
TECH_CATALOG_ENTRIES: list[dict[str, str]] = [
    {
        "label": "工信部-工作动态",
        "url": "https://www.miit.gov.cn/xwfb/gzdt/index.html",
    },
    {
        "label": "国务院政策文件库",
        "url": "https://www.gov.cn/zhengce/zhengceku/index.htm",
    },
    {
        "label": "盖世汽车-TBOX资讯",
        "url": "https://auto.gasgoo.com/news/tbox.html",
    },
]


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
    _, hdrs = req(
        "POST",
        "/api/v1/auth/login",
        {"email": LOGIN_EMAIL, "password": crypt(LOGIN_PASSWORD)},
    )
    token = hdrs.get("authorization")
    if not token:
        raise RuntimeError("login missing Authorization")
    return token


def resolve_tenant_id(token: str) -> str:
    tenant_id = (os.environ.get("TBOX_TENANT_ID") or "").strip()
    if tenant_id:
        return tenant_id
    body, _ = req("GET", f"/v1/tbox/crawl/tasks/{TASK_ID}", None, token)
    if body.get("code") != 0:
        raise RuntimeError(f"cannot load crawl task {TASK_ID}: {body.get('message')}")
    tenant_id = str((body.get("data") or {}).get("tenant_id") or "").strip()
    if not tenant_id:
        raise RuntimeError("tenant_id not found; set TBOX_TENANT_ID")
    return tenant_id


def list_existing_canonical_urls(token: str, tenant_id: str) -> set[str]:
    seen: set[str] = set()
    page = 1
    page_size = 100
    while True:
        qs = f"tenant_id={tenant_id}&topic=tech&page={page}&page_size={page_size}"
        body, _ = req("GET", f"/v1/tbox/crawl/sources?{qs}", None, token)
        if body.get("code") != 0:
            raise RuntimeError(f"list sources failed: {body.get('message')}")
        data = body.get("data") or {}
        items = data.get("items") or []
        for row in items:
            url = str(row.get("url") or "").strip()
            canon = canonicalize_url(url)
            if canon:
                seen.add(canon)
        total = int(data.get("total") or 0)
        if page * page_size >= total or not items:
            break
        page += 1
    return seen


def seed_catalog(token: str, tenant_id: str) -> tuple[int, int]:
    existing = list_existing_canonical_urls(token, tenant_id)
    created = 0
    skipped = 0
    for entry in TECH_CATALOG_ENTRIES:
        url = entry["url"].strip()
        canon = canonicalize_url(url)
        if canon in existing:
            print(f"SKIP existing {entry['label']}: {url}")
            skipped += 1
            continue
        payload = {
            "tenant_id": tenant_id,
            "topic": "tech",
            "label": entry["label"],
            "url": url,
            "enabled": True,
        }
        body, _ = req("POST", "/v1/tbox/crawl/sources", payload, token)
        if body.get("code") != 0:
            raise RuntimeError(f"create source failed for {url}: {body.get('message')}")
        print(f"OK created {entry['label']}: {url}")
        created += 1
        if canon:
            existing.add(canon)
    return created, skipped


def main() -> int:
    token = login()
    print("OK login")
    tenant_id = resolve_tenant_id(token)
    print(f"OK tenant_id={tenant_id}")
    created, skipped = seed_catalog(token, tenant_id)
    print(f"OK catalog seed complete created={created} skipped={skipped}")
    if created + skipped < len(TECH_CATALOG_ENTRIES):
        print("FAIL: not all catalog entries accounted for")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
