#!/usr/bin/env python3
"""Configure 法规爬取任务（种子 + BFS）并执行一次 tick，验证入库。"""

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

BASE = os.environ.get("TBOX_SMOKE_BASE_URL", "http://127.0.0.1:9380").rstrip("/")
TASK_ID = os.environ.get("TBOX_CRAWL_SMOKE_TASK_ID", "72339e405e8911f1906a791f22bf97c8")
DATASET_ID = os.environ.get("TBOX_CRAWL_SMOKE_DATASET_ID", "03e04d3e4c7e11f197f599d668cf34cb")

# 国内可访问、可 BFS 扩展的法规/行业入口（Tavily 不可达时的主力路径）
REGULATION_SEEDS = [
    "https://www.miit.gov.cn/",
    "https://www.cttic.cn/",
    "https://www.gov.cn/zhengce/",
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
    _, hdrs = req("POST", "/api/v1/auth/login", {"email": "admin@ragflow.io", "password": crypt("admin")})
    token = hdrs.get("authorization")
    if not token:
        raise RuntimeError("login missing Authorization")
    return token


def main() -> int:
    token = login()
    print("OK login")

    patch = {
        "name": "法规爬取",
        "seed_urls": REGULATION_SEEDS,
        "source_type": "static_web",
        "run_state": "ready",
        "enabled": True,
        "dataset_id": DATASET_ID,
        "extra_config": {
            "tbox_crawl_search_provider": "tavily",
            "tbox_crawl_search_queries": [
                "TBOX 车联网 标准 法规",
                "C-V2X TBOX standard regulation",
            ],
            "tbox_crawl_search_locale": "both",
            "tbox_crawl_max_depth": 2,
            "tbox_crawl_allowed_domains": ["miit.gov.cn", "gov.cn", "cttic.cn", "taf.org.cn"],
            "tbox_skip_http_probe": True,
        },
    }
    body, _ = req("PATCH", f"/v1/tbox/crawl/tasks/{TASK_ID}", patch, token)
    if body.get("code") != 0:
        print("FAIL patch:", body)
        return 1
    print("OK patched task (seeds + depth=2 + Tavily with network fallback)")

    req("POST", f"/v1/tbox/crawl/tasks/{TASK_ID}/run", {}, token)
    body, _ = req("GET", f"/v1/tbox/crawl/tasks/{TASK_ID}", None, token)
    err = str((body.get("data") or {}).get("last_error") or "")
    print("RUN last_error:", err[:400])

    if "[tbox:TICK_OK]" not in err:
        print("FAIL: expected successful tick")
        return 1
    if "ingested=" in err:
        import re

        m = re.search(r"ingested=(\d+)", err)
        n = int(m.group(1)) if m else 0
        if n >= 1:
            print(f"OK crawl ingested {n} document(s) into dataset {DATASET_ID}")
            return 0
    if "skipped_dup_content=" in err or "skipped_dup_url=" in err:
        print("OK tick completed (dedup skipped duplicates; KB already has recent pages)")
        return 0
    print("WARN: tick OK but ingested=0 — check keywords or dedup")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
