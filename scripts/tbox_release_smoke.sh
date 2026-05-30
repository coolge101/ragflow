#!/usr/bin/env bash
# TBOX 发版/准生产冒烟：health → G1 多格式 → G3 DeepSeek（Harness §7.6 / Phase 6）
#
# Usage (from repo root, Docker stack @ 9380):
#   bash scripts/tbox_release_smoke.sh
#   TBOX_SMOKE_DEEPSEEK_API_KEY=sk-... bash scripts/tbox_release_smoke.sh
#
# Exit 0 only when all executed checks pass.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="$ROOT"

BASE="${TBOX_SMOKE_BASE_URL:-http://127.0.0.1:9380}"
fail=0

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

echo "==> TBOX release smoke @ ${BASE}"
echo ""

echo "==> [1/3] GET /v1/tbox/health"
if ! curl -sf "${BASE}/v1/tbox/health" | python3 -m json.tool >/dev/null; then
  echo "FAIL: health" >&2
  fail=1
else
  curl -sf "${BASE}/v1/tbox/health" | python3 -m json.tool | head -8
  echo "OK: health"
fi
echo ""

echo "==> [2/3] G1 ingest format smoke"
if ! _run_python scripts/tbox_g1_ingest_format_smoke.py | tee /tmp/tbox-g1-smoke.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
for r in d.get('results', []):
    if not (r.get('upload') and r.get('parse') and r.get('search_hit')):
        print('FAIL:', r.get('format'), r, file=sys.stderr)
        sys.exit(1)
print('OK: G1 all formats pass')
"; then
  fail=1
fi
echo ""

echo "==> [3/3] G3 DeepSeek smoke"
g3_out="$(_run_python scripts/tbox_g3_deepseek_smoke.py)"
echo "$g3_out" | python3 -m json.tool
if ! echo "$g3_out" | python3 -c "
import json, sys
d = json.load(sys.stdin)
r = d.get('result') or {}
if not r.get('health_ok'):
    sys.exit('health_ok false')
if not r.get('deepseek_models'):
    sys.exit('no deepseek models')
if r.get('chat_attempted') and not r.get('chat_ok'):
    sys.exit(r.get('note') or 'chat failed')
print('OK: G3', r.get('note', ''))
"; then
  echo "FAIL: G3" >&2
  fail=1
fi

echo ""
if [[ "$fail" -ne 0 ]]; then
  echo "==> SMOKE FAILED" >&2
  exit 1
fi
echo "==> SMOKE PASSED"
