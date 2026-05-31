#!/usr/bin/env bash
# TBOX 全量冒烟套件：5180 bundle → 登录 → API release smoke
#
# Usage (repo root, Docker @ 9380 + tbox-console @ 5180):
#   bash scripts/tbox_smoke_suite.sh
#   TBOX_SKIP_CONSOLE_BUNDLE_SMOKE=1 bash scripts/tbox_smoke_suite.sh
#   TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_smoke_suite.sh   # 须 scripts/tbox_smoke.env
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/tbox_load_smoke_env.sh
source "$ROOT/scripts/tbox_load_smoke_env.sh"
_tbox_load_smoke_env "$ROOT"

export TBOX_SMOKE_RUNNER="${TBOX_SMOKE_RUNNER:-docker}"
fail=0

echo "==> TBOX smoke suite @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "    API:     ${TBOX_SMOKE_BASE_URL:-http://127.0.0.1:9380}"
echo "    Console: ${TBOX_CONSOLE_URL:-http://127.0.0.1:5180}"
echo ""

if [[ "${TBOX_REQUIRE_DUAL_ACCOUNT:-0}" == "1" ]]; then
  if ! bash scripts/tbox_dual_account_check.sh; then
    exit 1
  fi
  echo ""
fi

step=0
total=3

run_step() {
  step=$((step + 1))
  echo "==> [${step}/${total}] $1"
}

if [[ "${TBOX_SKIP_CONSOLE_BUNDLE_SMOKE:-0}" == "1" ]]; then
  echo "==> SKIP console bundle (TBOX_SKIP_CONSOLE_BUNDLE_SMOKE=1)"
  total=2
  echo ""
else
  run_step "Console bundle smoke"
  if bash scripts/tbox_console_bundle_smoke.sh; then
    echo "OK: console bundle"
  else
    fail=1
  fi
  echo ""
fi

run_step "Console login smoke"
if bash scripts/tbox_login_smoke.sh; then
  echo "OK: login smoke"
else
  fail=1
fi
echo ""

run_step "Release smoke (health + G1 + G3 + chat apps + P2 + permissions)"
export TBOX_SMOKE_BASE_URL="${TBOX_SMOKE_BASE_URL:-http://127.0.0.1:9380}"
if bash scripts/tbox_release_smoke.sh; then
  echo "OK: release smoke"
else
  fail=1
fi

echo ""
if [[ "$fail" -ne 0 ]]; then
  echo "==> SMOKE SUITE FAILED" >&2
  exit 1
fi
echo "==> SMOKE SUITE PASSED"
echo "Next: bash scripts/tbox_vm_production_acceptance.sh  (full VM 7-step)"
echo "      bash scripts/tbox_phase16_17_handtest.sh       (Phase 16–17 UI hand-test)"
