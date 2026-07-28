#!/usr/bin/env bash
# 当 TBOX_REQUIRE_DUAL_ACCOUNT=1 时，校验 scripts/tbox_smoke.env 双账号已完整配置
#
# Usage:
#   bash scripts/tbox_require_dual_account_gate.sh
#   TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_smoke_suite.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "${TBOX_REQUIRE_DUAL_ACCOUNT:-0}" != "1" ]]; then
  exit 0
fi

echo "==> dual-account required (TBOX_REQUIRE_DUAL_ACCOUNT=1)"
if ! bash scripts/tbox_setup_smoke_env.sh --check-only; then
  echo "FAIL: smoke env missing — run: bash scripts/tbox_setup_smoke_env.sh" >&2
  exit 1
fi
if ! bash scripts/tbox_dual_account_check.sh; then
  echo "FAIL: fill TBOX_SMOKE_NORMAL_* in scripts/tbox_smoke.env (see docs/TBOX_SMOKE_ENV.md)" >&2
  exit 1
fi
echo "OK: dual-account gate"
echo ""
