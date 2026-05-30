#!/usr/bin/env bash
# G3 对话应用 API 冒烟（list/create/get/delete /api/v1/chats）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="$ROOT"
# shellcheck source=scripts/tbox_load_smoke_env.sh
source "$ROOT/scripts/tbox_load_smoke_env.sh"
_tbox_load_smoke_env "$ROOT"

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

echo "==> G3 chat apps smoke @ ${TBOX_SMOKE_BASE_URL:-http://127.0.0.1:9380}"
out="$(_run_python scripts/tbox_chat_apps_smoke.py)"
echo "$out" | python3 -m json.tool
echo "$out" | python3 -c "
import json, sys
d = json.load(sys.stdin)
r = d.get('result') or {}
for k in ('list_ok', 'create_ok', 'get_ok', 'delete_ok'):
    if not r.get(k):
        sys.exit(f'{k} false')
print('OK: chat apps CRUD')
"
echo "==> CHAT APPS SMOKE PASSED"
