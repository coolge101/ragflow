#!/usr/bin/env bash
# 准生产 VM 验收脚本（5180 console + API 冒烟）
#
# 前置：bash scripts/start-tbox-ragflow.sh --console  或 deploy-on-new-server 已完成
#
# Usage:
#   bash scripts/tbox_vm_production_acceptance.sh
#   TBOX_CONSOLE_PORT=5180 bash scripts/tbox_vm_production_acceptance.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="$ROOT"

API="${TBOX_SMOKE_BASE_URL:-http://127.0.0.1:9380}"
CONSOLE_PORT="${TBOX_CONSOLE_PORT:-5180}"
CONSOLE_URL="${TBOX_CONSOLE_URL:-http://127.0.0.1:${CONSOLE_PORT}}"
fail=0

echo "==> TBOX VM production acceptance"
echo "    API:     ${API}"
echo "    Console: ${CONSOLE_URL}"
echo ""

if command -v hostname >/dev/null 2>&1; then
  LAN="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  if [[ -n "${LAN}" ]]; then
    echo "    LAN hint: http://${LAN}:${CONSOLE_PORT}/login"
  fi
fi
echo ""

echo "==> [1/5] Docker stack"
if ! bash scripts/tbox_verify_stack_image.sh; then
  if [[ "${TBOX_ALLOW_STOCK_IMAGE:-0}" == "1" ]]; then
    echo "WARN: stack image check failed (allowed by TBOX_ALLOW_STOCK_IMAGE=1)"
  else
    fail=1
  fi
fi
if ! docker ps --format '{{.Names}}' | grep -q 'ragflow-cpu'; then
  echo "WARN: ragflow-cpu container not running" >&2
  fail=1
else
  echo "OK: ragflow-cpu running"
fi
if ! docker ps --format '{{.Names}}' | grep -q 'tbox-console'; then
  echo "WARN: tbox-console container not running (use --console or TBOX_CONSOLE=1)" >&2
  fail=1
else
  echo "OK: tbox-console running"
fi
echo ""

echo "==> [2/5] Console HTTP"
if curl -sf -o /dev/null -m 10 "${CONSOLE_URL}/login"; then
  echo "OK: ${CONSOLE_URL}/login"
else
  echo "FAIL: cannot reach console login" >&2
  fail=1
fi
echo ""

echo "==> [3/5] API health"
if curl -sf "${API}/v1/tbox/health" | python3 -m json.tool >/dev/null; then
  curl -sf "${API}/v1/tbox/health" | python3 -m json.tool | head -6
  echo "OK: tbox health"
else
  echo "FAIL: ${API}/v1/tbox/health" >&2
  fail=1
fi
echo ""

echo "==> [4/5] Console login (5180 proxy + /v1/tbox/me)"
if bash scripts/tbox_login_smoke.sh; then
  echo "OK: login smoke"
else
  fail=1
fi
echo ""

echo "==> [5/5] Release smoke (G1 + G3) + P2 regression"
export TBOX_SMOKE_BASE_URL="${API}"
export TBOX_SMOKE_RUNNER="${TBOX_SMOKE_RUNNER:-docker}"
if bash scripts/tbox_release_smoke.sh; then
  echo "OK: release smoke"
else
  fail=1
fi

echo ""
if [[ "$fail" -ne 0 ]]; then
  echo "==> VM ACCEPTANCE FAILED — see docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md" >&2
  exit 1
fi
echo "==> VM ACCEPTANCE PASSED (API + console + smoke)"
echo "Next: complete UI checklist in docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md §3–4"
