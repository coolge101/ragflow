#!/usr/bin/env bash
# 准生产 VM 验收脚本（5180 console + API 冒烟）
#
# 前置：bash scripts/start-tbox-ragflow.sh --console  或 deploy-on-new-server 已完成
#
# Usage:
#   bash scripts/tbox_vm_production_acceptance.sh
#   TBOX_CONSOLE_PORT=5180 bash scripts/tbox_vm_production_acceptance.sh
#   TBOX_SKIP_WEB_TBOX_CHECK=1 bash scripts/tbox_vm_production_acceptance.sh
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

echo "==> [1/6] Docker stack"
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

echo "==> [2/6] Console HTTP"
if curl -sf -o /dev/null -m 10 "${CONSOLE_URL}/login"; then
  echo "OK: ${CONSOLE_URL}/login"
else
  echo "FAIL: cannot reach console login" >&2
  fail=1
fi
echo ""

echo "==> [3/6] API health"
if curl -sf "${API}/v1/tbox/health" | python3 -m json.tool >/dev/null; then
  curl -sf "${API}/v1/tbox/health" | python3 -m json.tool | head -6
  echo "OK: tbox health"
else
  echo "FAIL: ${API}/v1/tbox/health" >&2
  fail=1
fi
echo ""

echo "==> [4/6] Console login (5180 proxy + /v1/tbox/me)"
if bash scripts/tbox_login_smoke.sh; then
  echo "OK: login smoke"
else
  fail=1
fi
echo ""

echo "==> [5/6] web-tbox check (typecheck + test + build)"
if [[ "${TBOX_SKIP_WEB_TBOX_CHECK:-0}" == "1" ]]; then
  echo "SKIP: TBOX_SKIP_WEB_TBOX_CHECK=1"
else
  if bash scripts/tbox_web_tbox_check.sh; then
    echo "OK: web-tbox check"
  else
    fail=1
  fi
fi
echo ""

echo "==> [6/6] Release smoke (health + G1 + G3 + chat apps + P2 + permissions)"
export TBOX_SMOKE_BASE_URL="${API}"
export TBOX_SMOKE_RUNNER="${TBOX_SMOKE_RUNNER:-docker}"
# shellcheck source=scripts/tbox_load_smoke_env.sh
source "$ROOT/scripts/tbox_load_smoke_env.sh"
_tbox_load_smoke_env "$ROOT"
if [[ "${TBOX_REQUIRE_DUAL_ACCOUNT:-0}" == "1" ]]; then
  if ! _tbox_smoke_dual_account_configured; then
    echo "FAIL: TBOX_REQUIRE_DUAL_ACCOUNT=1 but scripts/tbox_smoke.env missing TBOX_SMOKE_NORMAL_*" >&2
    fail=1
  else
    echo "    (dual-account required — permissions smoke will assert normal_checked)"
  fi
fi
if [[ "$fail" -eq 0 ]] && bash scripts/tbox_release_smoke.sh; then
  echo "OK: release smoke"
else
  fail=1
fi

echo ""
if [[ "$fail" -ne 0 ]]; then
  echo "==> VM ACCEPTANCE FAILED — see docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md" >&2
  exit 1
fi
echo "==> VM ACCEPTANCE PASSED (API + console + web-tbox + smoke)"
echo "Next: complete UI checklist in docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md §3–4"
