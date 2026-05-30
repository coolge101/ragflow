#!/usr/bin/env bash
# G5 权限 API 冒烟（admin /v1/tbox/me；可选双账号 env）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="$ROOT"

if [[ -z "${TBOX_SMOKE_RUNNER:-}" ]] && docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'ragflow-cpu'; then
  export TBOX_SMOKE_RUNNER=docker
fi

_run_python() {
  local script="$1"
  if [[ "${TBOX_SMOKE_RUNNER:-}" == "docker" ]]; then
    local c="${TBOX_SMOKE_CONTAINER:-docker-ragflow-cpu-1}"
    local base="${TBOX_SMOKE_DOCKER_BASE_URL:-http://127.0.0.1:9380}"
    local name
    name="$(basename "$script")"
    docker cp "$script" "${c}:/tmp/tbox-smoke-${name}"
    docker exec -e PYTHONPATH=/ragflow -e TBOX_SMOKE_BASE_URL="$base" "$c" python3 "/tmp/tbox-smoke-${name}"
  else
    uv run python3 "$script"
  fi
}

echo "==> G5 permissions smoke @ ${TBOX_SMOKE_BASE_URL:-http://127.0.0.1:9380}"
out="$(_run_python scripts/tbox_permissions_smoke.py)"
echo "$out" | python3 -m json.tool
echo "$out" | python3 -c "
import json, sys
d = json.load(sys.stdin)
r = d.get('result') or {}
if not r.get('admin_ok'):
    sys.exit('admin_ok false')
print('OK:', r.get('note', ''))
"
echo "==> PERMISSIONS SMOKE PASSED"
