#!/usr/bin/env bash
# P2 API 回归：G2 crawl auth 单测 + G5 audit ingestions API（需 admin 登录）
#
# Usage:
#   bash scripts/tbox_p2_regression_smoke.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASE="${TBOX_SMOKE_BASE_URL:-http://127.0.0.1:9380}"
CONSOLE="${TBOX_CONSOLE_URL:-http://127.0.0.1:5180}"
CONTAINER="${TBOX_SMOKE_CONTAINER:-docker-ragflow-cpu-1}"

if ! docker ps --format '{{.Names}}' | grep -q '^'"${CONTAINER}"'$'; then
  echo "FAIL: container ${CONTAINER} not running" >&2
  exit 1
fi

echo "==> P2 regression @ ${BASE}"
echo ""

echo "==> [1/2] G2-CRAWL-AUTH (profile + env headers)"
docker exec -e PYTHONPATH=/ragflow "$CONTAINER" /ragflow/.venv/bin/python3 - <<'PY'
import json
import os
import sys

from common.tbox_crawl_auth import (
    EXTRA_CRAWL_AUTH_PROFILE,
    resolve_auth_headers,
    validate_extra_config_no_secrets,
    profile_env_suffix,
)

assert profile_env_suffix("intranet") == "INTRANET"

key = "TBOX_CRAWL_AUTH_DEMO_HEADERS"
old = os.environ.pop(key, None)
try:
    os.environ[key] = json.dumps({"Authorization": "Bearer smoke", "X-Custom": "1"})
    headers = resolve_auth_headers({EXTRA_CRAWL_AUTH_PROFILE: "demo"})
    assert headers["Authorization"] == "Bearer smoke"
    assert headers["X-Custom"] == "1"
finally:
    if old is None:
        os.environ.pop(key, None)
    else:
        os.environ[key] = old

err = validate_extra_config_no_secrets({EXTRA_CRAWL_AUTH_PROFILE: "intranet"})
assert err is None
print("OK: crawl auth profile resolution")
PY
echo "OK: crawl auth"
echo ""

echo "==> [2/2] G5 audit ingestions API (admin login)"
docker exec \
  -e PYTHONPATH=/ragflow \
  -e TBOX_SMOKE_BASE_URL="$BASE" \
  -e TBOX_CONSOLE_URL="$CONSOLE" \
  "$CONTAINER" /ragflow/.venv/bin/python3 - <<'PY'
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from Crypto.Cipher import PKCS1_v1_5
from Crypto.PublicKey import RSA

base = os.environ.get("TBOX_SMOKE_BASE_URL", "http://127.0.0.1:9380")
console = os.environ.get("TBOX_CONSOLE_URL", "http://127.0.0.1:5180")
email = os.environ.get("TBOX_LOGIN_EMAIL", "admin@ragflow.io")
password = os.environ.get("TBOX_LOGIN_PASSWORD", "admin")

pem = Path("/ragflow/conf/public.pem").read_text()
key = RSA.importKey(pem, "Welcome")
cipher = PKCS1_v1_5.new(key)
enc = base64.b64encode(cipher.encrypt(base64.b64encode(password.encode()).decode().encode())).decode()

login_url = f"{base.rstrip('/')}/api/v1/auth/login"
req = urllib.request.Request(
    login_url,
    data=json.dumps({"email": email, "password": enc}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=30) as r:
    body = json.loads(r.read().decode())
    auth = (
        r.headers.get("X-Ragflow-Authorization")
        or r.headers.get("Authorization")
        or r.headers.get("authorization")
        or (body.get("data") or {}).get("access_token")
        or ""
    )
if body.get("code") != 0 or not auth:
    print("FAIL: login", body.get("message"), file=sys.stderr)
    sys.exit(1)

headers = {"Authorization": auth}


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


ds = get_json(f"{base}/api/v1/datasets?page=1&page_size=1&orderby=create_time&desc=true")
if ds.get("code") != 0:
    print("FAIL: list datasets", ds.get("message"), file=sys.stderr)
    sys.exit(1)
rows = ds.get("data") or []
if isinstance(rows, dict):
    rows = rows.get("data") or rows.get("datasets") or []
if not rows:
    print("SKIP: no datasets — ingestions API not exercised (create a KB first)")
    sys.exit(0)
ds_id = rows[0].get("id") or rows[0].get("kb_id")
if not ds_id:
    print("FAIL: dataset row missing id", rows[0], file=sys.stderr)
    sys.exit(1)

logs = get_json(
    f"{base}/api/v1/datasets/{ds_id}/ingestions?page=1&page_size=1&log_type=dataset&orderby=create_time&desc=true"
)
if logs.get("code") != 0:
    print("FAIL: list ingestions", logs.get("message"), file=sys.stderr)
    sys.exit(1)
print("OK: ingestions API code=0 dataset=", ds_id)
PY
echo "OK: audit ingestions API"
echo ""
echo "==> P2 REGRESSION PASSED"
